import { Logo } from "@/components/site/logo";
import { SetPasswordForm } from "@/components/admin/set-password-form";

export const metadata = { title: "Set password" };

export default function SetPasswordPage() {
  return (
    <main className="grain flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center">
          <Logo subline="Staff" />
        </div>
        <div className="mt-10 rounded-sm border border-line bg-surface p-7 shadow-sm">
          <h1 className="font-display text-3xl text-ink">Choose a password</h1>
          <p className="mt-1 text-sm text-ink-muted">At least 10 characters.</p>
          <SetPasswordForm />
        </div>
      </div>
    </main>
  );
}
