import { redirect } from "next/navigation";
import { signOut } from "@/actions/admin";
import { LoginForm } from "@/components/admin/login-form";
import { Logo } from "@/components/site/logo";
import { getStaff } from "@/lib/auth";

export const metadata = { title: "Admin sign in" };

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const [staff, params] = await Promise.all([getStaff(), searchParams]);
  if (staff?.role === "owner") redirect("/admin/reservations");
  if (staff?.role === "manager") redirect("/manager");

  const requestedNext = params.next;
  const next = requestedNext === "/admin" || requestedNext?.startsWith("/admin/") || requestedNext === "/manager" || requestedNext?.startsWith("/manager/")
    ? requestedNext
    : "/admin";

  return (
    <main className="grain grain-dark flex min-h-dvh items-center justify-center bg-pine-700 px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center"><Logo tone="light" subline="Staff" /></div>
        <div className="mt-10 rounded-md bg-canvas p-8">
          {staff ? (
            <>
              <h1 className="font-display text-3xl text-ink">Access unavailable</h1>
              <p className="mt-2 text-sm text-ink-muted">This account doesn&apos;t have owner or manager access. Contact an owner.</p>
              <form action={signOut} className="mt-6"><button type="submit" className="text-sm text-ink-muted underline">Sign out</button></form>
            </>
          ) : (
            <>
              <h1 className="font-display text-3xl text-ink">Sign in</h1>
              <p className="mt-1 text-sm text-ink-muted">Owner and manager access.</p>
              {params.error === "link" ? (
                <p role="alert" className="mt-4 rounded-sm bg-red-50 p-3 text-sm text-red-800">That link is invalid or has expired. Request a new one.</p>
              ) : null}
              <LoginForm next={next} />
            </>
          )}
        </div>
      </div>
    </main>
  );
}