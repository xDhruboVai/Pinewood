"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { inviteStaff, updateStaffMember } from "@/actions/admin";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import { relativeFromNow } from "./ui";
import { cn } from "@/lib/utils";
import type { StaffProfile, StaffRole } from "@/lib/types";

export type StaffRow = StaffProfile & { email: string; lastSignIn: string | null; isMe: boolean };

export function StaffManager({ rows }: { rows: StaffRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [form, setForm] = useState({ fullName: "", email: "", role: "foh" as StaffRole });

  const run = (fn: () => ReturnType<typeof inviteStaff>, msg: string, after?: () => void) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) toast.error(res.error);
      else {
        toast.success(msg);
        after?.();
        router.refresh();
      }
    });

  return (
    <div className="grid gap-x-16 gap-y-14 lg:grid-cols-12">
      <section className="lg:col-span-8">
        <table className="w-full border-separate border-spacing-y-2 text-sm">
          <thead className="text-left text-xs text-ink-muted">
            <tr>
              <th className="px-4 pb-1 font-normal">Name</th>
              <th className="px-4 pb-1 font-normal">Role</th>
              <th className="hidden px-4 pb-1 font-normal md:table-cell">Last signed in</th>
              <th className="px-4 pb-1 text-right font-normal">
                <span className="sr-only">Access</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.user_id} className={cn("bg-surface [&>td:first-child]:rounded-l-md [&>td:last-child]:rounded-r-md", !r.is_active && "opacity-60")}>
                <td className="px-4 py-3">
                  <p className="font-semibold text-ink">
                    {r.full_name || "No name"} {r.isMe ? <span className="font-normal text-ink-muted">(you)</span> : null}
                  </p>
                  <p className="text-xs text-ink-muted">{r.email}</p>
                </td>
                <td className="px-4 py-3">
                  <select
                    value={r.role}
                    disabled={r.isMe || pending}
                    onChange={(e) => run(() => updateStaffMember(r.user_id, { role: e.target.value as StaffRole }), "Role updated")}
                    className="h-8 rounded-md bg-canvas px-2 text-sm"
                    aria-label={`Role for ${r.full_name}`}
                  >
                    <option value="manager">Manager</option>
                    <option value="foh">Front of house</option>
                  </select>
                </td>
                <td className="hidden px-4 py-3 text-ink-muted md:table-cell">{r.lastSignIn ? relativeFromNow(r.lastSignIn) : "Never"}</td>
                <td className="px-4 py-3 text-right">
                  <Button
                    size="sm"
                    variant={r.is_active ? "ghost" : "outline"}
                    disabled={r.isMe || pending}
                    onClick={() => run(() => updateStaffMember(r.user_id, { is_active: !r.is_active }), r.is_active ? "Access removed" : "Access restored")}
                  >
                    {r.is_active ? "Deactivate" : "Reactivate"}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="lg:col-span-4">
        <h2 className="display text-3xl text-ink">Add someone</h2>
        <p className="mt-1 text-sm text-ink-muted">They&apos;ll get an email with a link to choose a password.</p>
        <form
          className="mt-5 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => inviteStaff(form), `Invitation sent to ${form.email}`, () => setForm({ fullName: "", email: "", role: "foh" }));
          }}
        >
          <Field label="Full name" htmlFor="s-name">
            <Input id="s-name" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required />
          </Field>
          <Field label="Email" htmlFor="s-email">
            <Input id="s-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          </Field>
          <Field label="Role" htmlFor="s-role">
            <Select id="s-role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as StaffRole })}>
              <option value="foh">Front of house</option>
              <option value="manager">Manager</option>
            </Select>
          </Field>
          <Button type="submit" variant="pine" disabled={pending} className="w-full">
            Send invitation
          </Button>
        </form>
      </section>
    </div>
  );
}
