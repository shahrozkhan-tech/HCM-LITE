import { Badge } from "@/components/ui/badge";
import { titleCase } from "@/lib/utils";

const MAP = {
  present: "success",
  late: "warning",
  half_day: "warning",
  missing_checkout: "muted",
  absent: "destructive",
  on_leave: "info",
  pending: "warning",
  approved: "success",
  rejected: "destructive",
  cancelled: "muted",
  finalized: "success",
  draft: "muted",
  active: "success",
  probation: "info",
  exited: "muted",
};

export function StatusBadge({ status }) {
  return <Badge variant={MAP[status] ?? "muted"}>{titleCase(status)}</Badge>;
}
