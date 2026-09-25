import { AdminNav } from "@/components/admin/nav";
import { requireStaff } from "@/lib/auth";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const staff = await requireStaff();

  return (
    <div className="min-h-dvh">
      <AdminNav name={staff.fullName || staff.email} role={staff.role} />
      <main>{children}</main>
    </div>
  );
}
