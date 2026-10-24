export const FALLBACK_TZ = "Asia/Karachi";

/** 'YYYY-MM-DD' for `d` rendered in the org timezone. */
export function localDateStr(d = new Date(), tz = FALLBACK_TZ) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** Minutes since local midnight for `d` in the org timezone. */
export function localMinutes(d = new Date(), tz = FALLBACK_TZ) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return h * 60 + m;
}

export function localTimeStr(d = new Date(), tz = FALLBACK_TZ) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

/** 'YYYY-MM-DD' → Date at local noon (safe for day-of-week math in any TZ). */
export function parseDay(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}

export function toISODate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDays(dateStr, days) {
  const d = parseDay(dateStr);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

export function dayOfWeek(dateStr) {
  return parseDay(dateStr).getDay();
}

export function isWeekend(dateStr, weekendDays) {
  return weekendDays.includes(dayOfWeek(dateStr));
}

export function todayStr() {
  return localDateStr(new Date(), FALLBACK_TZ);
}

export function monthBounds(year, month) {
  const first = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const last = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { first, last };
}

export function datesBetween(start, end) {
  const out = [];
  let cur = start;
  let guard = 0;
  while (cur <= end && guard < 1000) {
    out.push(cur);
    cur = addDays(cur, 1);
    guard++;
  }
  return out;
}

export async function getSettings(admin) {
  const { data, error } = await admin
    .from("organization_settings")
    .select("*")
    .eq("id", 1)
    .single();
  if (error || !data) {
    throw new Error("Organization settings not found — complete first-run setup.");
  }
  return data;
}

export async function getHolidaySet(admin, from, to) {
  let q = admin.from("holidays").select("date");
  if (from) q = q.gte("date", from);
  if (to) q = q.lte("date", to);
  const { data } = await q;
  return new Set((data ?? []).map((h) => h.date));
}

/** Working days (skip weekends + holidays) between two dates inclusive. */
export function workingDaysBetween(start, end, weekendDays, holidays) {
  if (start > end) return [];
  return datesBetween(start, end).filter(
    (d) => !isWeekend(d, weekendDays) && !holidays.has(d)
  );
}

export function monthName(m) {
  return [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ][m - 1];
}
