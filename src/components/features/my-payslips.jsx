"use client";

import { Download, Wallet, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader, EmptyState } from "@/components/page-header";
import { useGetMyPayslipsQuery } from "@/store/api";
import { formatMoney } from "@/lib/utils";
import { monthName } from "@/lib/dates";

/** Employee: own payslips with PDF download (M6). */
export function MyPayslips() {
  const { data, isLoading } = useGetMyPayslipsQuery();
  const slips = data?.payslips ?? [];

  return (
    <div>
      <PageHeader
        title="My payslips"
        description="Payslips unlock when Admin finalizes the monthly payroll."
      />

      {isLoading ? (
        <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
      ) : slips.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="No payslips yet"
          description="Once HR runs payroll and Admin finalizes the month, your payslip appears here."
        />
      ) : (
        <div className="rounded-xl border bg-card overflow-hidden">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Period</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Gross</TableHead>
              <TableHead className="hidden sm:table-cell text-right">Deductions</TableHead>
              <TableHead className="hidden sm:table-cell text-right">Tax</TableHead>
              <TableHead className="text-right">Net pay</TableHead>
              <TableHead className="text-right">PDF</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {slips.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium text-sm">
                    {monthName(p.payroll_runs?.period_month)} {p.payroll_runs?.period_year}
                  </TableCell>
                  <TableCell>
                    <Badge variant={p.payroll_runs?.status === "finalized" ? "success" : "muted"}>
                      {p.payroll_runs?.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-sm">{formatMoney(p.gross)}</TableCell>
                  <TableCell className="hidden sm:table-cell text-right text-sm text-destructive">-{formatMoney(p.deduction)}</TableCell>
                  <TableCell className="hidden sm:table-cell text-right text-sm text-destructive">-{formatMoney(p.tax)}</TableCell>
                  <TableCell className="text-right text-sm font-bold text-success">{formatMoney(p.net_pay)}</TableCell>
                  <TableCell className="text-right">
                    {p.payroll_runs?.status === "finalized" ? (
                      <Button asChild variant="outline" size="sm" className="gap-1.5">
                        <a href={`/api/payroll/runs/${p.run_id}/payslip-pdf`}>
                          <Download className="h-3.5 w-3.5" /> Download
                        </a>
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground"><FileText className="mr-1 inline h-3 w-3" />draft</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
