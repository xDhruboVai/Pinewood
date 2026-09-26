import { AdminNav } from "@/components/admin/nav";
import { requireStaff } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const staff = await requireStaff();
  if (staff.role === "manager") redirect("/manager");
  if (staff.role !== "owner") redirect("/admin/login?error=forbidden");

  return (
    <div className="min-h-dvh">
      <AdminNav name={staff.fullName || staff.email} role={staff.role} />
      <main>{children}</main>
    </div>
  );
}
