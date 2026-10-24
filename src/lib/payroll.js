import { AppError } from "@/lib/api";
import {
  getHolidaySet,
  getSettings,
  monthBounds,
  workingDaysBetween,
  datesBetween,
  isWeekend,
} from "@/lib/dates";

/**
 * Payroll Lite rules (M6):
 *  - gross = 1.5 × basic  (HRA 40% of basic, medical 10% of basic)
 *  - per-day = gross ÷ working days in month
 *  - deduction days = absents + unpaid leave days + 0.5 × half days
 *  - joiners/leavers prorated by expected working days
 *  - tax slab on gross × 12 (illustrative), monthly = annual ÷ 12
 */

export function round2(n) {
  return Math.round(n * 100) / 100;
}

export function componentsFromBasic(basic) {
  const hra = round2(basic * 0.4);
  const medical = round2(basic * 0.1);
  const gross = round2(basic + hra + medical); // = 1.5 × basic
  return { hra, medical, gross };
}

/** Annual-salary tax slab (illustrative): 0–600k free; 5%→1.2M; 30k+15%→2.4M; 210k+25%→3.6M; 510k+35% above. */
export function annualTax(annualGross) {
  if (annualGross <= 600_000) return 0;
  if (annualGross <= 1_200_000) return 0.05 * (annualGross - 600_000);
  if (annualGross <= 2_400_000) return 30_000 + 0.15 * (annualGross - 1_200_000);
  if (annualGross <= 3_600_000) return 210_000 + 0.25 * (annualGross - 2_400_000);
  return 510_000 + 0.35 * (annualGross - 3_600_000);
}

export async function buildPayslipFor(admin, employee, year, month) {
  const settings = await getSettings(admin);
  const { first, last } = monthBounds(year, month);
  const holidays = await getHolidaySet(admin, first, last);
  const workingDays = workingDaysBetween(first, last, settings.weekend_days, holidays);
  const wdCount = Math.max(1, workingDays.length);

  // expected days for joiners/leavers
  const startBound = employee.join_date > first ? employee.join_date : first;
  const endBound = employee.exit_date && employee.exit_date < last ? employee.exit_date : last;
  const expectedDays = workingDays.filter((d) => d >= startBound && d <= endBound);
  const prorated = expectedDays.length < workingDays.length;

  // attendance-derived deductions in the month (only for days employed)
  const { data: attendance } = await admin
    .from("attendance")
    .select("status, date")
    .eq("employee_id", employee.id)
    .gte("date", first)
    .lte("date", last);
  let absent = 0;
  let half = 0;
  let late = 0;
  for (const a of attendance ?? []) {
    if (a.date < startBound || a.date > endBound) continue;
    if (a.status === "absent") absent++;
    else if (a.status === "half_day") half++;
    else if (a.status === "late") late++;
  }
  // bonus rule: late penalty — every 3 lates deducts 0.5 day
  const latePenaltyDays = Math.floor(late / 3) * 0.5;

  // approved unpaid leave days in month (working days only)
  const { data: unpaidLeaves } = await admin
    .from("leaves")
    .select("start_date, end_date")
    .eq("employee_id", employee.id)
    .eq("status", "approved")
    .eq("type", "unpaid")
    .lte("start_date", last)
    .gte("end_date", first);
  const unpaidSet = new Set();
  for (const l of unpaidLeaves ?? []) {
    for (const d of datesBetween(l.start_date, l.end_date)) {
      if (d >= first && d <= last && !isWeekend(d, settings.weekend_days) && !holidays.has(d)) {
        unpaidSet.add(d);
      }
    }
  }
  const unpaidDays = [...unpaidSet].filter((d) => d >= startBound && d <= endBound).length;

  const basic = Number(employee.basic_salary);
  const { hra, medical, gross } = componentsFromBasic(basic);
  const perDay = gross / wdCount;

  const prorationFactor = prorated ? expectedDays.length / wdCount : 1;
  const effectiveGross = round2(gross * prorationFactor);

  const deductionDays = absent + unpaidDays + 0.5 * half + latePenaltyDays;
  const deduction = round2(Math.min(perDay * deductionDays, effectiveGross));

  const monthlyTaxFull = annualTax(gross * 12) / 12;
  const tax = round2(Math.max(0, monthlyTaxFull * prorationFactor));

  const net = round2(Math.max(0, effectiveGross - deduction - tax));

  return {
    employee_id: employee.id,
    basic: round2(basic),
    hra,
    medical,
    gross: effectiveGross,
    working_days: wdCount,
    expected_days: expectedDays.length,
    absent_days: absent,
    unpaid_days: unpaidDays,
    half_days: half,
    late_days: late,
    late_penalty_days: latePenaltyDays,
    deduction,
    tax,
    net_pay: net,
    prorated,
  };
}

/** (Re)builds the draft for a month. Finalized runs are locked (409). */
export async function buildPayrollRun(admin, year, month, createdBy) {
  const { data: existingRun } = await admin
    .from("payroll_runs")
    .select("*")
    .eq("period_year", year)
    .eq("period_month", month)
    .maybeSingle();
  if (existingRun?.status === "finalized") {
    throw new AppError(409, `Payroll for ${month}/${year} is finalized and locked`);
  }

  const { first, last } = monthBounds(year, month);
  const { data: employees } = await admin
    .from("employees")
    .select("*")
    .lte("join_date", last)
    .or(`exit_date.is.null,exit_date.gte.${first}`);

  const slips = [];
  for (const emp of employees ?? []) {
    slips.push(await buildPayslipFor(admin, emp, year, month));
  }

  let runId = existingRun?.id;
  if (runId) {
    await admin.from("payroll_runs").update({ status: "draft" }).eq("id", runId);
    await admin.from("payslips").delete().eq("run_id", runId);
  } else {
    const { data: run, error } = await admin
      .from("payroll_runs")
      .insert({ period_month: month, period_year: year, created_by: createdBy, status: "draft" })
      .select("id")
      .single();
    if (error || !run) throw new AppError(500, "Could not create payroll run");
    runId = run.id;
  }

  if (slips.length) {
    const { error } = await admin
      .from("payslips")
      .insert(slips.map((s) => ({ ...s, run_id: runId })));
    if (error) throw new AppError(500, `Payslip insert failed: ${error.message}`);
  }

  return { runId, payslips: slips };
}

export function sumPayslips(slips) {
  return {
    gross: round2(slips.reduce((s, p) => s + p.gross, 0)),
    deductions: round2(slips.reduce((s, p) => s + p.deduction, 0)),
    tax: round2(slips.reduce((s, p) => s + p.tax, 0)),
    net: round2(slips.reduce((s, p) => s + p.net_pay, 0)),
    count: slips.length,
  };
}
