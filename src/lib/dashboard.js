import { materializeAttendance } from "@/lib/attendance";
import { getBalances } from "@/lib/leave";
import { round2 } from "@/lib/payroll";
import {
  addDays,
  datesBetween,
  getHolidaySet,
  getSettings,
  isWeekend,
  monthBounds,
  parseDay,
  todayStr,
} from "@/lib/dates";

/**
 * Server-side dashboard aggregation (M7). Every number is computed here on
 * the server from the database — the browser only renders.
 * Independent queries run in parallel (Promise.all) to keep TTFB low.
 */

export async function getAdminStats(admin, { departmentId } = {}) {
  const settings = await getSettings(admin);
  const today = todayStr();
  const year = today.slice(0, 4);

  // materialize rule-derived rows first so every snapshot below is exact
  await materializeAttendance(admin, addDays(today, -7), today);

  const [
    employeesRows,
    exitsCount,
    runRows,
    auditFeed,
    todayAttendance,
    att30Rows,
  ] = await Promise.all([
    admin
      .from("employees")
      .select("*, departments(name), designations(name)")
      .in("status", ["active", "probation"])
      .then(({ data }) => data ?? []),
    admin
      .from("employees")
      .select("id", { count: "exact", head: true })
      .eq("status", "exited")
      .gte("exit_date", `${year}-01-01`)
      .then(({ count }) => count ?? 0),
    admin
      .from("payroll_runs")
      .select("id, period_month, period_year, status")
      .eq("period_year", Number(year))
      .order("period_month")
      .then(({ data }) => data ?? []),
    admin
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(8)
      .then(({ data }) => data ?? []),
    admin
      .from("attendance")
      .select("status")
      .eq("date", today)
      .then(({ data }) => data ?? []),
    admin
      .from("attendance")
      .select("employee_id, status, date")
      .gte("date", addDays(today, -29))
      .lte("date", today)
      .then(({ data }) => data ?? []),
  ]);

  const employees = employeesRows;
  const headcount = employees.length;
  const probation = employees.filter((e) => e.status === "probation").length;
  const exitsYtd = exitsCount;

  // attrition = exits ÷ average headcount (start ≈ now + exits/2) × 100
  const avgHeadcount = Math.max(1, headcount + exitsYtd / 2);
  const attritionYtd = round2((exitsYtd / avgHeadcount) * 100);

  // payroll cost YTD (all runs this year, finalized + draft)
  const runIds = runRows.map((r) => r.id);
  let payrollCostYtd = { gross: 0, net: 0 };
  let payrollCostByMonth = [];
  let payrollByDept = [];
  if (runIds.length) {
    const { data: slips } = await admin
      .from("payslips")
      .select("run_id, gross, net_pay, employees(departments(name))")
      .in("run_id", runIds);
    const byRun = {};
    const byDept = {};
    for (const s of slips ?? []) {
      byRun[s.run_id] = byRun[s.run_id] ?? { gross: 0, net: 0 };
      byRun[s.run_id].gross += Number(s.gross);
      byRun[s.run_id].net += Number(s.net_pay);
      const dept = s.employees?.departments?.name ?? "Unassigned";
      byDept[dept] = byDept[dept] ?? { gross: 0, net: 0 };
      byDept[dept].gross += Number(s.gross);
      byDept[dept].net += Number(s.net_pay);
    }
    let g = 0, n = 0;
    payrollCostByMonth = runRows.map((r) => {
      const t = byRun[r.id] ?? { gross: 0, net: 0 };
      g += t.gross; n += t.net;
      return { month: `${r.period_year}-${String(r.period_month).padStart(2, "0")}`, gross: round2(t.gross), net: round2(t.net) };
    });
    payrollCostYtd = { gross: round2(g), net: round2(n) };
    payrollByDept = Object.entries(byDept)
      .map(([name, v]) => ({ name, gross: round2(v.gross), net: round2(v.net) }))
      .sort((a, b) => b.gross - a.gross);
  }

  const avgGross = headcount
    ? round2(employees.reduce((s, e) => s + Number(e.basic_salary) * 1.5, 0) / headcount)
    : 0;

  // today snapshot
  const tc = { present: 0, late: 0, on_leave: 0 };
  for (const a of todayAttendance) {
    if (tc[a.status] !== undefined) tc[a.status]++;
    else if (a.status === "half_day" || a.status === "missing_checkout") tc.present++;
  }

  // headcount by dept
  const deptCounts = {};
  for (const e of employees) {
    const name = e.departments?.name ?? "Unassigned";
    deptCounts[name] = (deptCounts[name] ?? 0) + 1;
  }

  // gender + tenure
  const genderSplit = {};
  const tenureBuckets = { "< 1 yr": 0, "1–3 yrs": 0, "3+ yrs": 0 };
  const now = new Date();
  for (const e of employees) {
    const g = e.gender ?? "unspecified";
    genderSplit[g] = (genderSplit[g] ?? 0) + 1;
    const yrs = (now - new Date(e.join_date + "T12:00:00")) / (365.25 * 24 * 3600 * 1000);
    if (yrs < 1) tenureBuckets["< 1 yr"]++;
    else if (yrs < 3) tenureBuckets["1–3 yrs"]++;
    else tenureBuckets["3+ yrs"]++;
  }

  // mean gross by designation (active employees)
  const byDesig = {};
  for (const e of employees) {
    const name = e.designations?.name;
    if (!name) continue;
    byDesig[name] = byDesig[name] ?? { sum: 0, n: 0 };
    byDesig[name].sum += Number(e.basic_salary) * 1.5;
    byDesig[name].n++;
  }
  const avgGrossByDesignation = Object.entries(byDesig)
    .map(([name, v]) => ({ name, value: round2(v.sum / v.n) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  // ── bonus: attrition risk score (heuristic on live attendance) ───────
  const perEmp = new Map();
  for (const a of att30Rows) {
    const cur = perEmp.get(a.employee_id) ?? { abs: 0, late: 0, last: null };
    if (a.status === "absent") cur.abs++;
    if (a.status === "late") cur.late++;
    if (!cur.last || a.date > cur.last) cur.last = a.date;
    perEmp.set(a.employee_id, cur);
  }
  const attritionRisk = employees
    .map((e) => {
      const s = perEmp.get(e.id) ?? { abs: 0, late: 0, last: null };
      const lastSeen = s.last ?? e.join_date;
      const idleDays = Math.max(0, Math.round((parseDay(today) - parseDay(lastSeen > e.join_date ? lastSeen : e.join_date)) / 86400000));
      const tenureDays = Math.max(0, Math.round((parseDay(today) - parseDay(e.join_date)) / 86400000));
      const reasons = [];
      let score = 0;
      if (s.abs > 0) { score += s.abs * 10; reasons.push(`${s.abs} absence(s) in 30 days`); }
      if (s.late > 0) { score += s.late * 4; reasons.push(`${s.late} late arrival(s)`); }
      if (idleDays >= 5) { score += 25; reasons.push(`no activity for ${idleDays} days`); }
      else if (idleDays >= 3) { score += 12; reasons.push(`no activity for ${idleDays} days`); }
      if (tenureDays < 90) { score += 10; reasons.push("tenure under 90 days"); }
      score = Math.min(100, score);
      return {
        name: `${e.first_name} ${e.last_name ?? ""}`.trim(),
        code: e.employee_code,
        score,
        level: score >= 50 ? "high" : score >= 25 ? "medium" : "low",
        reasons,
      };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  return {
    headcount,
    probation,
    exitsYtd,
    attritionYtd,
    payrollCostYtd,
    avgGross,
    presentToday: tc.present,
    onLeaveToday: tc.on_leave,
    lateToday: tc.late,
    headcountByDept: Object.entries(deptCounts).map(([name, value]) => ({ name, value })),
    payrollCostByMonth,
    payrollByDept,
    avgGrossByDesignation,
    genderSplit: Object.entries(genderSplit).map(([name, value]) => ({ name, value })),
    tenureBuckets: Object.entries(tenureBuckets).map(([name, value]) => ({ name, value })),
    auditFeed,
    attritionRisk,
  };
}

export async function getHrStats(admin, { departmentId } = {}) {
  const settings = await getSettings(admin);
  const today = todayStr();
  const from14 = addDays(today, -13);
  const from30 = addDays(today, -29);

  // materialize rule-derived rows first so every snapshot below is exact
  await materializeAttendance(admin, from30, today);

  const [
    employeesRows,
    todayRows,
    trendRows,
    leaveRows,
    pendingLeaves,
    pendingCorr,
    attWindowRows,
    lateRows,
    luRows,
    deptsRows,
    holidays30,
  ] = await Promise.all([
    admin
      .from("employees")
      .select("*, departments(name), designations(name)")
      .in("status", ["active", "probation"])
      .then((r) => (departmentId ? (r.data ?? []).filter((e) => e.department_id === departmentId) : r.data ?? [])),
    admin
      .from("attendance")
      .select("status, employee_id, employees!inner(department_id)")
      .eq("date", today)
      .then((r) => (departmentId ? (r.data ?? []).filter((a) => a.employees.department_id === departmentId) : r.data ?? [])),
    admin
      .from("attendance")
      .select("date, status, employee_id, employees!inner(first_name, last_name, employee_code, department_id)")
      .gte("date", from14)
      .lte("date", today)
      .then((r) => (departmentId ? (r.data ?? []).filter((a) => a.employees.department_id === departmentId) : r.data ?? [])),
    admin
      .from("leaves")
      .select("type, days, employees!inner(department_id)")
      .eq("status", "approved")
      .gte("start_date", from30)
      .lte("start_date", today)
      .then((r) => (departmentId ? (r.data ?? []).filter((l) => l.employees.department_id === departmentId) : r.data ?? [])),
    admin
      .from("leaves")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending")
      .then(({ count }) => count ?? 0),
    admin
      .from("attendance")
      .select("id", { count: "exact", head: true })
      .eq("correction_status", "pending")
      .then(({ count }) => count ?? 0),
    admin
      .from("attendance")
      .select("employee_id, status, date, employees!inner(first_name, last_name, employee_code, department_id)")
      .gte("date", from30)
      .lte("date", today)
      .then((r) => (departmentId ? (r.data ?? []).filter((a) => a.employees.department_id === departmentId) : r.data ?? [])),
    admin
      .from("attendance")
      .select("employee_id, employees!inner(first_name, last_name, employee_code, department_id)")
      .eq("status", "late")
      .gte("date", monthBounds(Number(today.slice(0, 4)), Number(today.slice(5, 7))).first)
      .lte("date", monthBounds(Number(today.slice(0, 4)), Number(today.slice(5, 7))).last)
      .then((r) => (departmentId ? (r.data ?? []).filter((a) => a.employees.department_id === departmentId) : r.data ?? [])),
    admin
      .from("leaves")
      .select("type, days, employees!inner(department_id)")
      .eq("status", "approved")
      .gte("start_date", `${today.slice(0, 4)}-01-01`)
      .then((r) => (departmentId ? (r.data ?? []).filter((l) => l.employees.department_id === departmentId) : r.data ?? [])),
    admin.from("departments").select("id, name").then(({ data }) => data ?? []),
    getHolidaySet(admin, from30, today),
  ]);

  const employees = employeesRows;
  const empIds = employees.map((e) => e.id);

  // today snapshot
  const tc = { present: 0, late: 0, half_day: 0, absent: 0, missing_checkout: 0, on_leave: 0 };
  for (const a of todayRows) if (tc[a.status] !== undefined) tc[a.status]++;

  // attendance trend last 14 days
  const byDate = {};
  for (const r of trendRows) {
    byDate[r.date] = byDate[r.date] ?? { num: 0, den: 0, onLeave: 0 };
    if (r.status === "on_leave") byDate[r.date].onLeave++;
    else {
      byDate[r.date].den++;
      if (r.status === "present" || r.status === "late" || r.status === "missing_checkout") byDate[r.date].num++;
      else if (r.status === "half_day") byDate[r.date].num += 0.5;
    }
  }
  const attendanceTrend = datesBetween(from14, today).map((d) => ({
    date: d,
    rate: byDate[d] && byDate[d].den > 0 ? Math.round((byDate[d].num / byDate[d].den) * 100) : null,
  }));

  // absenteeism by department (30 days)
  const workingDays30 = datesBetween(from30, today).filter(
    (d) => !isWeekend(d, settings.weekend_days) && !holidays30.has(d)
  );
  const absentByDept = {};
  const empById = new Map(employees.map((e) => [e.id, e]));
  for (const a of attWindowRows) {
    if (a.status !== "absent") continue;
    const dept = empById.get(a.employee_id)?.departments?.name ?? "Unassigned";
    absentByDept[dept] = (absentByDept[dept] ?? 0) + 1;
  }
  const byDeptEmpCount = {};
  for (const e of employees) {
    const name = e.departments?.name ?? "Unassigned";
    byDeptEmpCount[name] = (byDeptEmpCount[name] ?? 0) + 1;
  }
  const absenteeismByDept = Object.entries(byDeptEmpCount).map(([name, count]) => ({
    name,
    value: workingDays30.length && count
      ? round2(((absentByDept[name] ?? 0) / (workingDays30.length * count)) * 100)
      : 0,
  }));

  // leave by type last 30 days (approved)
  const leaveAgg = { annual: 0, sick: 0, casual: 0, unpaid: 0 };
  for (const l of leaveRows) leaveAgg[l.type] += Number(l.days);

  // top late-comers this month
  const lateMap = new Map();
  for (const r of lateRows) {
    const cur = lateMap.get(r.employee_id) ?? {
      name: `${r.employees.first_name} ${r.employees.last_name ?? ""}`.trim(),
      code: r.employees.employee_code,
      lateCount: 0,
    };
    cur.lateCount++;
    lateMap.set(r.employee_id, cur);
  }
  const topLateComers = [...lateMap.values()].sort((a, b) => b.lateCount - a.lateCount).slice(0, 5);

  // late % today = late ÷ (present + late)
  const latePercentToday =
    tc.late + tc.present > 0 ? round2((tc.late / (tc.late + tc.present)) * 100) : 0;

  // leave utilization: approved YTD days ÷ (quota × headcount), per type (brief §7)
  const usedByType = { annual: 0, sick: 0, casual: 0, unpaid: 0 };
  for (const l of luRows) usedByType[l.type] += Number(l.days);
  const hcForQuota = Math.max(1, employees.length);
  const quotaField = { annual: "annual_quota", sick: "sick_quota", casual: "casual_quota" };
  const leaveUtilization = ["annual", "sick", "casual"].map((t) => {
    const capacity = Number(settings[quotaField[t]]) * hcForQuota;
    return {
      name: t,
      value: capacity > 0 ? Math.min(100, Math.round((usedByType[t] / capacity) * 100)) : 0,
      used: usedByType[t],
    };
  });

  // ── bonus: absence anomaly flags over the 30-day window ───────────────
  const anomalyMap = new Map();
  for (const a of attWindowRows) {
    if (a.status !== "absent") continue;
    const cur = anomalyMap.get(a.employee_id) ?? {
      id: a.employee_id,
      name: `${a.employees.first_name} ${a.employees.last_name ?? ""}`.trim(),
      code: a.employees.employee_code,
      abs30: 0,
      mfAbs: 0,
    };
    cur.abs30++;
    const dow = parseDay(a.date).getDay();
    if (dow === 1 || dow === 5) cur.mfAbs++; // Mon / Fri pattern
    anomalyMap.set(a.employee_id, cur);
  }
  const anomalyFlags = [...anomalyMap.values()]
    .map((m) => {
      const flags = [];
      if (m.abs30 >= 3) flags.push(`${m.abs30} absences in 30 days`);
      if (m.mfAbs >= 2) flags.push(`${m.mfAbs} Mon/Fri absences (long-weekend pattern)`);
      return { id: m.id, name: m.name, code: m.code, flags };
    })
    .filter((m) => m.flags.length);

  // merge chronic lateness into the anomaly flags (bonus)
  for (const [empId, t] of lateMap.entries()) {
    if (t.lateCount < 5) continue;
    const existing = anomalyFlags.find((f) => f.id === empId);
    if (existing) existing.flags.push(`${t.lateCount} lates this month`);
    else
      anomalyFlags.push({
        id: empId,
        name: t.name,
        code: t.code,
        flags: [`${t.lateCount} lates this month`],
      });
  }
  anomalyFlags.sort((a, b) => b.flags.length - a.flags.length);

  return {
    headcount: employees.length,
    presentToday: tc.present + tc.missing_checkout,
    lateToday: tc.late,
    latePercentToday,
    onLeaveToday: tc.on_leave,
    absentToday: tc.absent,
    pendingLeaveRequests: pendingLeaves,
    pendingCorrections: pendingCorr,
    attendanceTrend,
    absenteeismByDept,
    leaveByType: Object.entries(leaveAgg).map(([name, days]) => ({ name, days })),
    leaveUtilization,
    topLateComers,
    anomalyFlags: anomalyFlags.slice(0, 6),
  };
}

export async function getEmployeeStats(ctx) {
  const { admin, employee } = ctx;
  const settings = await getSettings(admin);
  const today = todayStr();

  // this week (Mon .. today)
  const dow = new Date(today + "T12:00:00").getDay(); // 0 Sun..6 Sat
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const monday = addDays(today, mondayOffset);

  // materialize rule-derived rows first so every read below is exact
  await materializeAttendance(admin, addDays(today, -40), today);

  const [weekRows, lateCount, balances, lastPayslip, announcements, todayRec] = await Promise.all([
    admin
      .from("attendance")
      .select("work_hours, status")
      .eq("employee_id", employee.id)
      .gte("date", monday)
      .lte("date", today)
      .then(({ data }) => data ?? []),
    admin
      .from("attendance")
      .select("id", { count: "exact", head: true })
      .eq("employee_id", employee.id)
      .eq("status", "late")
      .gte("date", monthBounds(Number(today.slice(0, 4)), Number(today.slice(5, 7))).first)
      .then(({ count }) => count ?? 0),
    getBalances(admin, employee.id, Number(today.slice(0, 4))),
    admin
      .from("payslips")
      .select("*, payroll_runs(period_month, period_year, status)")
      .eq("employee_id", employee.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("announcements")
      .select("*, author:profiles(full_name)")
      .order("created_at", { ascending: false })
      .limit(5)
      .then(({ data }) => data ?? []),
    admin
      .from("attendance")
      .select("*")
      .eq("employee_id", employee.id)
      .eq("date", today)
      .maybeSingle(),
  ]);

  return {
    todayStatus: todayRec?.status ?? null,
    checkIn: todayRec?.check_in ?? null,
    checkOut: todayRec?.check_out ?? null,
    hoursThisWeek: round2(weekRows.reduce((s, r) => s + Number(r.work_hours ?? 0), 0)),
    lateThisMonth: lateCount,
    balances,
    lastPayslip: lastPayslip
      ? { ...lastPayslip, period_month: lastPayslip.payroll_runs?.period_month, period_year: lastPayslip.payroll_runs?.period_year }
      : null,
    announcements,
  };
}
