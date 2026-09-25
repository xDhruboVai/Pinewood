import { Logo } from "@/components/site/logo";
import { SetPasswordForm } from "@/components/admin/set-password-form";

export const metadata = { title: "Set password" };

export default function SetPasswordPage() {
  return (
    <main className="grain grain-dark flex min-h-dvh items-center justify-center bg-pine-700 px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center">
          <Logo tone="light" subline="Staff" />
        </div>
        <div className="mt-10 rounded-md bg-canvas p-8">
          <h1 className="font-display text-3xl text-ink">Choose a password</h1>
          <p className="mt-1 text-sm text-ink-muted">At least 10 characters.</p>
          <SetPasswordForm />
        </div>
      </div>
    </main>
  );
}
