import Link from "next/link";
import { LoginForm } from "@/components/admin/login-form";
import { Logo } from "@/components/site/logo";

export const metadata = { title: "Manager sign in" };

export default function ManagerLoginPage() {
  return (
    <main className="grain grain-dark flex min-h-dvh items-center justify-center bg-pine-700 px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center"><Logo tone="light" subline="Manager" /></div>
        <div className="mt-10 rounded-md bg-canvas p-8">
          <h1 className="font-display text-3xl text-ink">Manager sign in</h1>
          <p className="mt-1 text-sm text-ink-muted">Branch menu and staff.</p>
          <LoginForm next="/manager" />
        </div>
        <p className="mt-6 text-center text-xs text-cream-100/70"><Link href="/" className="hover:text-cream-50">Back to the website</Link></p>
      </div>
    </main>
  );
}