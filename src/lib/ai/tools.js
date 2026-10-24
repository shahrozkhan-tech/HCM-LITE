import { materializeAttendance } from "@/lib/attendance";
import { getBalances } from "@/lib/leave";
import { getSettings, monthBounds, addDays, todayStr } from "@/lib/dates";

/**
 * AI tools (M8). Every tool reuses the same services + permission checks as
 * the REST API: each executor receives the caller's AuthContext and scopes
 * its queries to the caller's role. The model never touches the database.
 */

async function resolveDepartmentId(admin, name) {
  if (!name) return null;
  const { data } = await admin
    .from("departments")
    .select("id, name")
    .ilike("name", `%${name}%`);
  if (!data?.length) return null;
  return data[0].id;
}

async function headcountByDept(admin) {
  const { data: depts } = await admin.from("departments").select("id, name");
  const { data: emps } = await admin
    .from("employees")
    .select("department_id")
    .in("status", ["active", "probation"]);
  const counts = {};
  for (const d of depts ?? []) counts[d.name] = 0;
  for (const e of emps ?? []) {
    const name = (depts ?? []).find((d) => d.id === e.department_id)?.name ?? "Unassigned";
    counts[name] = (counts[name] ?? 0) + 1;
  }
  return counts;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export const AI_TOOLS = [
  {
    type: "function",
    function: {
      name: "get_headcount",
      description:
        "Current headcount (active + probation employees), optionally filtered by department name. Admin/HR only.",
      parameters: {
        type: "object",
        properties: {
          department: { type: "string", description: "Department name, e.g. 'Engineering'" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_attendance_summary",
      description:
        "Attendance summary for a date range: counts by status (present, late, half_day, absent, missing_checkout, on_leave) and the attendance rate = (present+late+missing_checkout+0.5×half_day) ÷ (working-day records − on_leave). Admin/HR see the company; an employee gets only their own record.",
      parameters: {
        type: "object",
        properties: {
          from: { type: "string", description: "Start date YYYY-MM-DD (default: 30 days ago)" },
          to: { type: "string", description: "End date YYYY-MM-DD (default: today)" },
          department: { type: "string", description: "Filter by department name (admin/HR only)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_late_comers",
      description:
        "Employees who came late most often in a month, with counts and latest check-in times. Admin/HR only.",
      parameters: {
        type: "object",
        properties: {
          month: { type: "number", description: "1-12 (default: current month)" },
          year: { type: "number", description: "e.g. 2026 (default: current year)" },
          department: { type: "string", description: "Filter by department name" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_leave_summary",
      description:
        "Leave summary for a date range: approved/pending days per leave type and who is on leave today. Admin/HR only.",
      parameters: {
        type: "object",
        properties: {
          from: { type: "string", description: "YYYY-MM-DD (default: 30 days ago)" },
          to: { type: "string", description: "YYYY-MM-DD (default: today)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_my_leave_balance",
      description:
        "The current user's own leave balances (annual/sick/casual used vs quota). Works for every role.",
      parameters: {
        type: "object",
        properties: {
          year: { type: "number", description: "Default: current year" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_payroll_summary",
      description:
        "Payroll summary for a month: total gross, deductions, tax, net pay and employee count. Admin/HR see company totals; an employee gets only their own payslip figures.",
      parameters: {
        type: "object",
        properties: {
          month: { type: "number", description: "1-12 (default: last completed month)" },
          year: { type: "number", description: "Default: current year" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_employees",
      description:
        "Search employees by name, code, email or department. Returns work info only (no salary for employee-role callers). Admin/HR only.",
      parameters: {
        type: "object",
        properties: {
          q: { type: "string", description: "Search term" },
        },
        required: ["q"],
      },
    },
  },
];

export async function executeAiTool(name, args, ctx) {
  const { admin, profile, employee } = ctx;
  const isStaff = profile.role === "admin" || profile.role === "hr";
  const settings = await getSettings(admin);
  const today = todayStr();

  switch (name) {
    case "get_headcount": {
      if (!isStaff) return { error: "Only Admin/HR can view company headcount." };
      const deptId = await resolveDepartmentId(admin, args.department);
      if (args.department && !deptId) return { error: `No department named "${args.department}"` };
      let q = admin
        .from("employees")
        .select("status", { count: "exact", head: true })
        .in("status", ["active", "probation"]);
      if (deptId) q = q.eq("department_id", deptId);
      const { count } = await q;
      const byDept = args.department ? undefined : await headcountByDept(admin);
      return { headcount: count, department: args.department ?? "all", byDepartment: byDept };
    }

    case "get_attendance_summary": {
      const to = ISO.test(args.to ?? "") ? args.to : today;
      const from = ISO.test(args.from ?? "") ? args.from : addDays(to, -29);
      await materializeAttendance(admin, from, to);

      let query = admin
        .from("attendance")
        .select("status, employee_id, employees!inner(department_id)")
        .gte("date", from)
        .lte("date", to);
      if (!isStaff) {
        if (!employee) return { error: "No employee record linked to your account." };
        query = query.eq("employee_id", employee.id);
      } else if (args.department) {
        const deptId = await resolveDepartmentId(admin, args.department);
        if (!deptId) return { error: `No department named "${args.department}"` };
        query = query.eq("employees.department_id", deptId);
      }
      const { data } = await query;
      const counts = { present: 0, late: 0, half_day: 0, absent: 0, missing_checkout: 0, on_leave: 0 };
      for (const r of data ?? []) counts[r.status] = (counts[r.status] ?? 0) + 1;
      const denominator = (data ?? []).length - counts.on_leave;
      const rate =
        denominator > 0
          ? Math.round(
              ((counts.present + counts.late + counts.missing_checkout + 0.5 * counts.half_day) /
                denominator) * 100
            )
          : null;
      return { from, to, counts, attendanceRatePercent: rate };
    }

    case "get_late_comers": {
      if (!isStaff) return { error: "Only Admin/HR can view late-comers." };
      const now = new Date();
      const month = args.month ?? now.getMonth() + 1;
      const year = args.year ?? now.getFullYear();
      const { first, last } = monthBounds(year, month);
      let q = admin
        .from("attendance")
        .select("employee_id, date, check_in, employees!inner(first_name, last_name, employee_code, department_id, departments(name))")
        .eq("status", "late")
        .gte("date", first)
        .lte("date", last);
      if (args.department) {
        const deptId = await resolveDepartmentId(admin, args.department);
        if (!deptId) return { error: `No department named "${args.department}"` };
        q = q.eq("employees.department_id", deptId);
      }
      const { data } = await q;
      const map = new Map();
      for (const r of data ?? []) {
        const cur = map.get(r.employee_id) ?? {
          name: `${r.employees.first_name} ${r.employees.last_name ?? ""}`.trim(),
          code: r.employees.employee_code,
          department: r.employees.departments?.name ?? "—",
          lateCount: 0,
          latestCheckIn: null,
        };
        cur.lateCount++;
        if (!cur.latestCheckIn || r.check_in > cur.latestCheckIn) cur.latestCheckIn = r.check_in;
        map.set(r.employee_id, cur);
      }
      const rows = [...map.values()].sort((a, b) => b.lateCount - a.lateCount).slice(0, 10);
      return { month, year, topLateComers: rows };
    }

    case "get_leave_summary": {
      if (!isStaff) return { error: "Only Admin/HR can view company leave data." };
      const to = ISO.test(args.to ?? "") ? args.to : today;
      const from = ISO.test(args.from ?? "") ? args.from : addDays(to, -29);
      const { data: leaves } = await admin
        .from("leaves")
        .select("type, status, days, start_date, end_date, employees(first_name, last_name, employee_code)")
        .gte("start_date", from)
        .lte("start_date", to);
      const summary = {};
      for (const l of leaves ?? []) {
        const key = `${l.type}:${l.status}`;
        summary[key] = (summary[key] ?? 0) + Number(l.days);
      }
      const { data: todayOnLeave } = await admin
        .from("leaves")
        .select("type, employees(first_name, last_name, employee_code)")
        .eq("status", "approved")
        .lte("start_date", today)
        .gte("end_date", today);
      return {
        from,
        to,
        daysByTypeAndStatus: summary,
        onLeaveToday: (todayOnLeave ?? []).map((l) => ({
          name: `${l.employees.first_name} ${l.employees.last_name ?? ""}`.trim(),
          type: l.type,
        })),
      };
    }

    case "get_my_leave_balance": {
      if (!employee) return { error: "No employee record linked to your account." };
      const year = args.year ?? new Date().getFullYear();
      const balances = await getBalances(admin, employee.id, year);
      return {
        year,
        balances: {
          annual: balances.annual,
          sick: balances.sick,
          casual: balances.casual,
          unpaid: { used: balances.unpaid.used, note: "unlimited quota" },
        },
      };
    }

    case "get_payroll_summary": {
      const now = new Date();
      const lastMonth = now.getMonth() === 0 ? 12 : now.getMonth();
      const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
      const month = args.month ?? lastMonth;
      const y = args.year ?? year;
      if (!isStaff) {
        if (!employee) return { error: "No employee record linked to your account." };
        const { data: slip } = await admin
          .from("payslips")
          .select("*, payroll_runs(period_month, period_year, status)")
          .eq("employee_id", employee.id)
          .eq("payroll_runs.period_month", month)
          .eq("payroll_runs.period_year", y)
          .maybeSingle();
        if (!slip) return { note: `No payroll run exists yet for ${month}/${y}.` };
        return {
          month,
          year: y,
          status: slip.payroll_runs?.status,
          own: {
            gross: slip.gross, deduction: slip.deduction, tax: slip.tax, net_pay: slip.net_pay,
          },
        };
      }
      const { data: run } = await admin
        .from("payroll_runs")
        .select("id, status")
        .eq("period_month", month)
        .eq("period_year", y)
        .maybeSingle();
      if (!run) return { note: `No payroll run exists yet for ${month}/${y}.` };
      const { data: slips } = await admin.from("payslips").select("*").eq("run_id", run.id);
      const list = slips ?? [];
      const sum = (f) => Math.round(list.reduce((s, p) => s + Number(p[f] ?? 0), 0));
      return {
        month,
        year: y,
        status: run.status,
        employees: list.length,
        totalGross: sum("gross"),
        totalDeductions: sum("deduction"),
        totalTax: sum("tax"),
        totalNet: sum("net_pay"),
      };
    }

    case "search_employees": {
      if (!isStaff) return { error: "Only Admin/HR can search employees." };
      const term = `%${args.q}%`;
      const { data } = await admin
        .from("employees")
        .select("employee_code, first_name, last_name, email, status, join_date, departments(name), designations(name)")
        .or(`first_name.ilike.${args.q},last_name.ilike.${args.q},employee_code.ilike.${args.q},email.ilike.${args.q}`)
        .limit(10);
      return {
        results: (data ?? []).map((e) => ({
          code: e.employee_code,
          name: `${e.first_name} ${e.last_name ?? ""}`.trim(),
          email: e.email,
          department: e.departments?.name ?? "—",
          designation: e.designations?.name ?? "—",
          status: e.status,
          joined: e.join_date,
        })),
      };
    }

    default:
      return { error: `Unknown tool ${name}` };
  }
}
