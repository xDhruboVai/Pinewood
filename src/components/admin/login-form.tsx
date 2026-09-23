"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { createClient } from "@/lib/supabase/client";

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const signIn = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const { error } = await createClient().auth.signInWithPassword({ email: email.trim(), password });
      if (error) {
        setError("Incorrect email or password.");
        return;
      }
      router.replace(next);
      router.refresh();
    });
  };

  const forgot = () => {
    if (!email.trim()) {
      setError("Enter your email first, then choose “Forgot password”.");
      return;
    }
    startTransition(async () => {
      const redirectTo = `${window.location.origin}/auth/confirm?next=/admin/set-password`;
      await createClient().auth.resetPasswordForEmail(email.trim(), { redirectTo });
      toast.success("If that email belongs to a staff account, a reset link is on its way.");
    });
  };

  return (
    <form onSubmit={signIn} className="mt-6 space-y-4">
      <Field label="Email" htmlFor="email">
        <Input id="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <Field label="Password" htmlFor="password" error={error ?? undefined}>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-invalid={!!error}
        />
      </Field>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
      <button type="button" onClick={forgot} className="w-full text-center text-xs text-ink-muted hover:text-ink">
        Forgot password
      </button>
    </form>
  );
}
