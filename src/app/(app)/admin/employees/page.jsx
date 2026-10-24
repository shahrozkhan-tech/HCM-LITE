import { EmployeesDirectory } from "@/components/features/employees-directory";

export default function AdminEmployeesPage() {
  return <EmployeesDirectory canManage={false} />;
}
