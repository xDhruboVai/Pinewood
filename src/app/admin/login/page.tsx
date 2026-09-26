import Link from "next/link";
import { Logo } from "@/components/site/logo";
import { LoginForm } from "@/components/admin/login-form";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string; invited?: string }> }) {
  const params = await searchParams;
  const next = params.next?.startsWith("/admin") ? params.next : "/admin";

  return (
    <main className="grain grain-dark flex min-h-dvh items-center justify-center bg-pine-700 px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center">
          <Logo tone="light" subline="Staff" />
        </div>
        <div className="mt-10 rounded-md bg-canvas p-8">
          <h1 className="font-display text-3xl text-ink">Sign in</h1>
          <p className="mt-1 text-sm text-ink-muted">Reservations and the menu.</p>
          {params.error === "not_staff" ? (
            <p role="alert" className="mt-4 rounded-sm bg-red-50 p-3 text-sm text-red-800">
              This account isn&apos;t an active staff member. Ask a manager to add you.
            </p>
          ) : null}
          {params.error === "link" ? (
            <p role="alert" className="mt-4 rounded-sm bg-red-50 p-3 text-sm text-red-800">
              That link is invalid or has expired. Request a new one.
            </p>
          ) : null}
          <LoginForm next={next} />
        </div>
        <p className="mt-6 text-center text-xs text-cream-100/70">
          <Link href="/" className="hover:text-cream-50">
            ← Back to the website
          </Link>
        </p>
      </div>
    </main>
  );
}
