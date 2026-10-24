/**
 * Generates public/sample-payslip.pdf using the REAL generator from
 * src/lib/pdf.js (alias import inlined) so the payslip layout can be
 * verified without a running database. Run: node scripts/gen-sample-payslip.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let src = readFileSync(path.join(root, "src/lib/pdf.js"), "utf8");
src = src.replace(
  'import { monthName } from "@/lib/dates";',
  'const monthName = (m) => ["January","February","March","April","May","June","July","August","September","October","November","December"][m - 1];'
);
const tmp = path.join(root, "scripts/_pdf_tmp.mjs");
writeFileSync(tmp, src);
const { generatePayslipPdf } = await import("./_pdf_tmp.mjs");

const pdf = await generatePayslipPdf({
  settings: {
    company_name: "Saylani Welfare (sample)",
    office_start: "09:00",
    grace_minutes: 15,
    half_day_hours: 5,
  },
  run: { period_month: 10, period_year: 2026, status: "finalized" },
  slip: {
    basic: 80000, hra: 32000, medical: 8000, gross: 120000,
    working_days: 22, expected_days: 22,
    absent_days: 1, unpaid_days: 0, half_days: 1,
    late_days: 3, late_penalty_days: 0.5,
    deduction: 8181.82, tax: 0, net_pay: 111818.18, prorated: false,
  },
  employee: {
    employee_code: "EMP-001", first_name: "Ayesha", last_name: "Khan",
    join_date: "2026-01-15",
    department: { name: "Engineering" }, designation: { name: "Software Engineer" },
  },
});

writeFileSync(path.join(root, "public/sample-payslip.pdf"), pdf);
console.log("WROTE public/sample-payslip.pdf bytes=" + pdf.length);
