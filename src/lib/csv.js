/**
 * CSV import/export for employees (M3).
 * Dry-run validates: required fields, unique code/email (in file + database),
 * valid email, known department, ISO date, salary > 0.
 *
 * Expected header: employee_code,first_name,last_name,email,department,designation,
 *                  join_date,basic_salary,gender,phone
 */

const REQUIRED = ["employee_code", "first_name", "last_name", "email", "join_date", "basic_salary"];

export function parseCsv(text) {
  const rows = [];
  let cur = "";
  let row = [];
  let inQuotes = false;
  const src = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = false;
      } else cur += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(cur); cur = "";
    } else if (ch === "\n") {
      row.push(cur); rows.push(row); row = []; cur = "";
    } else {
      cur += ch;
    }
  }
  if (cur.length || row.length) { row.push(cur); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validates CSV rows against existing DB data. Returns
 * { valid: [...], errors: [{ row, field, reason }], headers }
 */
export async function validateEmployeeCsv(admin, csvText) {
  const table = parseCsv(csvText);
  if (!table.length) return { headers: [], valid: [], errors: [{ row: 1, field: "file", reason: "CSV file is empty" }] };

  const headers = table[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
  const missingHeaders = REQUIRED.filter((h) => !headers.includes(h));
  if (missingHeaders.length) {
    return {
      headers,
      valid: [],
      errors: [{ row: 1, field: "header", reason: `Missing column(s): ${missingHeaders.join(", ")}` }],
    };
  }

  const { data: depts } = await admin.from("departments").select("id, name");
  const deptByName = new Map((depts ?? []).map((d) => [d.name.trim().toLowerCase(), d]));
  const { data: existing } = await admin
    .from("employees")
    .select("employee_code, email");
  const codes = new Set((existing ?? []).map((e) => e.employee_code.toLowerCase()));
  const emails = new Set((existing ?? []).map((e) => e.email.toLowerCase()));

  const valid = [];
  const errors = [];
  const seenCodes = new Set();
  const seenEmails = new Set();

  table.slice(1).forEach((cells, idx) => {
    const rowNo = idx + 2;
    const rec = {};
    headers.forEach((h, i) => (rec[h] = (cells[i] ?? "").trim()));

    const pushErr = (field, reason) => errors.push({ row: rowNo, field, reason });

    for (const f of REQUIRED) {
      if (!rec[f]) pushErr(f, "required field is missing");
    }
    if (rec.email && !EMAIL_RE.test(rec.email)) pushErr("email", "invalid email format");
    if (rec.join_date && !ISO_DATE_RE.test(rec.join_date)) {
      pushErr("join_date", "must be ISO date YYYY-MM-DD");
    } else if (rec.join_date && ISO_DATE_RE.test(rec.join_date)) {
      const d = new Date(rec.join_date + "T12:00:00");
      if (Number.isNaN(d.getTime())) pushErr("join_date", "not a real date");
    }
    const salary = Number(rec.basic_salary);
    if (rec.basic_salary && (!Number.isFinite(salary) || salary <= 0)) {
      pushErr("basic_salary", "must be a number greater than 0");
    }
    if (rec.employee_code) {
      const code = rec.employee_code.toLowerCase();
      if (codes.has(code)) pushErr("employee_code", "code already exists in database");
      else if (seenCodes.has(code)) pushErr("employee_code", "duplicate code within file");
      seenCodes.add(code);
    }
    if (rec.email) {
      const em = rec.email.toLowerCase();
      if (emails.has(em)) pushErr("email", "email already exists in database");
      else if (seenEmails.has(em)) pushErr("email", "duplicate email within file");
      seenEmails.add(em);
    }
    if (rec.department) {
      const dept = deptByName.get(rec.department.trim().toLowerCase());
      if (!dept) pushErr("department", `unknown department "${rec.department}"`);
      else rec._department_id = dept.id;
    }
    if (rec.gender && !["male", "female", "other"].includes(rec.gender.toLowerCase())) {
      pushErr("gender", "must be male, female or other");
    } else if (rec.gender) {
      rec.gender = rec.gender.toLowerCase();
    }

    const rowErrors = errors.filter((e) => e.row === rowNo);
    if (!rowErrors.length) valid.push(rec);
  });

  return { headers, valid, errors };
}

export function employeesToCsv(rows) {
  const headers = [
    "employee_code", "first_name", "last_name", "email", "department", "designation",
    "join_date", "exit_date", "status", "basic_salary", "gender", "phone",
  ];
  const esc = (v) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(",")];
  for (const e of rows) {
    lines.push([
      e.employee_code, e.first_name, e.last_name, e.email,
      e.department?.name ?? "", e.designation?.name ?? "",
      e.join_date, e.exit_date ?? "", e.status, e.basic_salary,
      e.gender ?? "", e.phone ?? "",
    ].map(esc).join(","));
  }
  return lines.join("\n");
}
