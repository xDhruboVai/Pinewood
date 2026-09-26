"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { inviteStaff, updateStaffMember } from "@/actions/admin";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import { relativeFromNow } from "./ui";
import type { Branch, StaffProfile } from "@/lib/types";

export type ManagerRow = StaffProfile & { email: string; lastSignIn: string | null; isMe: boolean };

export function ManagerManager({ rows, branches }: { rows: ManagerRow[]; branches: Branch[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [form, setForm] = useState({ fullName: "", email: "", branchId: "" });
  const [assignments, setAssignments] = useState<Record<string, string>>({});

  const run = (action: () => Promise<{ ok: boolean; error?: string }>, success: string, after?: () => void) =>
    start(async () => {
      const result = await action();
      if (!result.ok) toast.error(result.error);
      else {
        toast.success(success);
        after?.();
        router.refresh();
      }
    });

  return (
    <div className="grid gap-x-16 gap-y-14 lg:grid-cols-12">
      <section className="lg:col-span-8">
        <h2 className="display text-3xl text-ink">Branch managers</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-separate border-spacing-y-2 text-left text-sm">
            <thead className="text-xs text-ink-muted">
              <tr>
                <th className="px-4 pb-1 font-normal">Name</th>
                <th className="px-4 pb-1 font-normal">Access role</th>
                <th className="px-4 pb-1 font-normal">Branch</th>
                <th className="px-4 pb-1 font-normal">Access</th>
                <th className="hidden px-4 pb-1 font-normal md:table-cell">Last signed in</th>
                <th className="px-4 pb-1 text-right font-normal"><span className="sr-only">Appointment</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.user_id} className="bg-surface [&>td:first-child]:rounded-l-md [&>td:last-child]:rounded-r-md">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-ink">{row.full_name || "No name"} {row.isMe ? <span className="font-normal text-ink-muted">(you)</span> : null}</p>
                    <p className="text-xs text-ink-muted">{row.email}</p>
                  </td>
                  <td className="px-4 py-3 text-ink">{row.role === "manager" ? "Branch manager" : "Front of house"}</td>
                  <td className="px-4 py-3">
                    <Select
                      value={row.role === "manager" ? row.branch_id ?? "" : assignments[row.user_id] ?? ""}
                      disabled={pending || row.isMe || row.role === "owner"}
                      onChange={(event) => {
                        const branchId = event.target.value;
                        if (row.role === "manager") run(() => updateStaffMember(row.user_id, { branch_id: branchId || null }), "Branch assignment updated");
                        else setAssignments((current) => ({ ...current, [row.user_id]: branchId }));
                      }}
                      aria-label={`Branch assignment for ${row.full_name}`}
                    >
                      <option value="">{row.role === "manager" ? "Unassigned" : "Choose to appoint"}</option>
                      {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name_en}</option>)}
                    </Select>
                  </td>
                  <td className="px-4 py-3 text-ink-muted">{row.is_active ? "Active" : "Inactive"}</td>
                  <td className="hidden px-4 py-3 text-ink-muted md:table-cell">{row.lastSignIn ? relativeFromNow(row.lastSignIn) : "Never"}</td>
                  <td className="px-4 py-3 text-right">
                    {row.role === "manager" ? (
                      <Button size="sm" variant="outline" disabled={pending || row.isMe} onClick={() => run(() => updateStaffMember(row.user_id, row.is_active ? { role: "foh", branch_id: null, is_active: false } : { is_active: true }), row.is_active ? "Manager role and access removed" : "Manager access restored")}>
                        {row.is_active ? "Remove manager" : "Restore access"}
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" disabled={pending || row.isMe || !assignments[row.user_id]} onClick={() => run(() => updateStaffMember(row.user_id, { role: "manager", branch_id: assignments[row.user_id], is_active: true }), "Manager appointed")}>
                        Make manager
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? <tr><td colSpan={6} className="px-4 py-8 text-center text-ink-muted">No staff accounts available for manager appointments.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="lg:col-span-4">
        <h2 className="display text-3xl text-ink">Appoint a manager</h2>
        <p className="mt-1 text-sm text-ink-muted">They&apos;ll receive an email invitation to set their password.</p>
        <form
          className="mt-5 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            run(
              () => inviteStaff({ ...form, role: "manager", branchId: form.branchId }),
              `Invitation sent to ${form.email}`,
              () => setForm({ fullName: "", email: "", branchId: "" }),
            );
          }}
        >
          <Field label="Full name" htmlFor="manager-name">
            <Input id="manager-name" value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} required />
          </Field>
          <Field label="Email" htmlFor="manager-email">
            <Input id="manager-email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required />
          </Field>
          <Field label="Branch" htmlFor="manager-branch">
            <Select id="manager-branch" value={form.branchId} onChange={(event) => setForm({ ...form, branchId: event.target.value })} required>
              <option value="">Choose a branch</option>
              {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name_en}</option>)}
            </Select>
          </Field>
          <Button type="submit" variant="pine" disabled={pending || branches.length === 0} className="w-full">
            Send manager invitation
          </Button>
        </form>
      </section>
    </div>
  );
}