import { AppError } from "@/lib/api";
import { getHolidaySet, getSettings, workingDaysBetween } from "@/lib/dates";

/**
 * Leave rules (M5):
 *  - working days only (weekends + public holidays skipped)
 *  - quotas: annual 14 · sick 8 · casual 10 · unpaid unlimited
 *  - overlap with pending/approved leave, or exceeding balance → 422
 */

const QUOTA_FIELD = {
  annual: "annual_quota",
  sick: "sick_quota",
  casual: "casual_quota",
};

export async function getBalances(admin, employeeId, year) {
  const settings = await getSettings(admin);
  const start = `${year}-01-01`;
  const end = `${year}-12-31`;
  const holidays = await getHolidaySet(admin, start, end);
  const { data: leaves } = await admin
    .from("leaves")
    .select("type, start_date, end_date")
    .eq("employee_id", employeeId)
    .eq("status", "approved")
    .gte("start_date", start)
    .lte("end_date", end);

  const used = { annual: 0, sick: 0, casual: 0, unpaid: 0 };
  for (const l of leaves ?? []) {
    const days = workingDaysBetween(l.start_date, l.end_date, settings.weekend_days, holidays)
      .filter((d) => d.startsWith(String(year))).length;
    used[l.type] += days;
  }

  const mk = (quota, u) => ({ quota, used: u, remaining: Math.max(0, quota - u) });
  return {
    annual: mk(settings.annual_quota, used.annual),
    sick: mk(settings.sick_quota, used.sick),
    casual: mk(settings.casual_quota, used.casual),
    unpaid: { quota: Infinity, used: used.unpaid, remaining: Infinity },
  };
}

export async function validateAndCountLeave(admin, { employeeId, type, start, end }) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
    throw new AppError(400, "Dates must be in YYYY-MM-DD format");
  }
  if (start > end) {
    throw new AppError(422, "Start date must be on or before the end date");
  }

  const settings = await getSettings(admin);
  const holidays = await getHolidaySet(admin, start, end);
  const days = workingDaysBetween(start, end, settings.weekend_days, holidays);
  if (!days.length) {
    throw new AppError(
      422,
      "The selected range contains no working days (weekends/holidays are skipped)"
    );
  }

  // overlap with pending/approved leave → 422
  const { data: overlap } = await admin
    .from("leaves")
    .select("id, status, type, start_date, end_date")
    .eq("employee_id", employeeId)
    .in("status", ["pending", "approved"])
    .lte("start_date", end)
    .gte("end_date", start);
  if (overlap?.length) {
    throw new AppError(
      422,
      `This overlaps an existing ${overlap[0].status} leave (${overlap[0].start_date} → ${overlap[0].end_date})`
    );
  }

  // balance check → 422 (unpaid unlimited)
  if (type !== "unpaid") {
    const year = Number(start.slice(0, 4));
    const balances = await getBalances(admin, employeeId, year);
    const remaining = balances[type].remaining;
    if (days.length > remaining) {
      throw new AppError(
        422,
        `Insufficient balance: ${remaining} day(s) of ${type} left, requested ${days.length}`
      );
    }
  }

  return days.length;
}
