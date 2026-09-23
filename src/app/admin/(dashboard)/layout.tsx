import { AdminNav } from "@/components/admin/nav";
import { requireStaff } from "@/lib/auth";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const staff = await requireStaff();

  return (
    <div className="lg:grid lg:min-h-dvh lg:grid-cols-[240px_1fr]">
      <AdminNav name={staff.fullName || staff.email} role={staff.role} />
      <div className="min-w-0">
        <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 lg:px-10 lg:py-10">{children}</div>
      </div>
    </div>
  );
}
