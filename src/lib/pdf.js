import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { monthName } from "@/lib/dates";

const PKR = (n) =>
  "PKR " + Number(n ?? 0).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

/** Renders a one-page A4 payslip PDF (M6). */
export async function generatePayslipPdf({ settings, run, slip, employee }) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]); // A4
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const ink = rgb(0.09, 0.11, 0.16);
  const muted = rgb(0.45, 0.5, 0.58);
  const brand = rgb(0.16, 0.52, 0.96);
  const line = rgb(0.85, 0.87, 0.91);

  const M = 48; // margin
  let y = 800;

  const txt = (s, x, yy, size = 10, f = font, color = ink) => {
    page.drawText(String(s ?? ""), { x, y: yy, size, font: f, color });
  };
  const row = (label, value, boldValue = false) => {
    txt(label, M + 8, y, 9, font, muted);
    const right = 547 - font.widthOfTextAtSize(String(value ?? ""), boldValue ? 10 : 9);
    txt(value, right, y, boldValue ? 10 : 9, boldValue ? bold : font, ink);
    y -= 18;
  };

  // header
  txt(settings.company_name || "Company", M, y, 20, bold, brand);
  y -= 16;
  txt("PAYSLIP", M, y, 11, bold, muted);
  const period = `${monthName(run.period_month)} ${run.period_year}`;
  const pw = bold.widthOfTextAtSize(period, 11);
  txt(period, 547 - pw, y, 11, bold, ink);
  y -= 10;
  page.drawLine({ start: { x: M, y }, end: { x: 547, y }, thickness: 1.2, color: brand });
  y -= 26;

  // employee block
  const fullName = `${employee.first_name} ${employee.last_name ?? ""}`.trim();
  row("Employee", `${fullName}  (${employee.employee_code})`, true);
  row("Department", employee.department?.name ?? "—");
  row("Designation", employee.designation?.name ?? "—");
  row("Join date", employee.join_date ?? "—");
  row("Pay period", `${period} · ${slip.expected_days}/${slip.working_days} working days${slip.prorated ? " (prorated)" : ""}`);
  y -= 8;

  // earnings table
  const tableX = M;
  const tableW = 547 - M;
  const colVal = tableX + tableW - 8;
  const header = (title) => {
    page.drawRectangle({ x: tableX, y: y - 4, width: tableW, height: 20, color: rgb(0.95, 0.96, 0.98) });
    txt(title, tableX + 8, y + 2, 9.5, bold, ink);
    y -= 24;
  };
  const divider = () => {
    page.drawLine({ start: { x: tableX, y: y + 8 }, end: { x: 547, y: y + 8 }, thickness: 0.7, color: line });
    y -= 2;
  };

  header("EARNINGS");
  row("Basic salary", PKR(slip.basic));
  row("House rent allowance (40%)", PKR(slip.hra));
  row("Medical allowance (10%)", PKR(slip.medical));
  divider();
  row("Gross salary", PKR(slip.gross), true);
  y -= 10;

  header("ATTENDANCE & DEDUCTIONS");
  row("Absent days", String(slip.absent_days));
  row("Unpaid leave days", String(slip.unpaid_days));
  row("Half days", String(slip.half_days));
  row("Late arrivals (3 lates = 0.5 day)", `${slip.late_days ?? 0} (${(slip.late_penalty_days ?? 0)} d penalty)`);
  row("Attendance deduction", "- " + PKR(slip.deduction));
  row("Tax (monthly slab)", "- " + PKR(slip.tax));
  divider();
  row("Total deductions", "- " + PKR(Number(slip.deduction) + Number(slip.tax)), true);
  y -= 14;

  // net pay banner
  page.drawRectangle({ x: tableX, y: y - 10, width: tableW, height: 34, color: brand });
  txt("NET PAY", tableX + 10, y + 2, 11, bold, rgb(1, 1, 1));
  const net = PKR(slip.net_pay);
  const nw = bold.widthOfTextAtSize(net, 13);
  txt(net, 547 - 10 - nw, y, 13, bold, rgb(1, 1, 1));
  y -= 34;

  // footer
  const footer = [
    `Run: ${run.status === "finalized" ? "FINALIZED" : "DRAFT"} · generated ${new Date().toISOString().slice(0, 10)}`,
    "Gross = 1.5 × basic (HRA 40%, medical 10%). Deductions: absent + unpaid + 0.5 × half days.",
    "Computer-generated payslip — HCM Lite",
  ];
  y = 90;
  for (const f of footer) {
    txt(f, M, y, 7.5, font, muted);
    y -= 11;
  }

  const bytes = await doc.save();
  return Buffer.from(bytes);
}
