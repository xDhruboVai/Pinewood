"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { deleteInactiveManager, inviteStaff, updateManagerInformation, updateStaffMember } from "@/actions/admin";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import { relativeFromNow } from "./ui";
import { formatDate, formatTime } from "@/lib/format";
import type { Branch, StaffProfile } from "@/lib/types";

export type ManagerRow = StaffProfile & { email: string; phone: string | null; lastSignIn: string | null; isMe: boolean };
export type ManagerHistoryRow = {
  id: number;
  full_name: string;
  event: "appointed" | "removed";
  branch_name: string;
  actor_name: string;
  created_at: string;
};

export function ManagerManager({ rows, branches, history }: { rows: ManagerRow[]; branches: Branch[]; history: ManagerHistoryRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [form, setForm] = useState({ fullName: "", email: "", branchId: "", temporaryPassword: "" });
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<ManagerRow | null>(null);
  const [editForm, setEditForm] = useState({ fullName: "", email: "" });
  const editDialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = editDialog.current;
    if (!dialog) return;
    if (editing && !dialog.open) dialog.showModal();
    if (!editing && dialog.open) dialog.close();
  }, [editing]);

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
                    {row.phone ? <p className="text-xs text-ink-muted">{row.phone}</p> : null}
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
                      <div className="flex flex-wrap justify-end gap-2">
                        {row.is_active ? (
                          <Button size="sm" variant="outline" disabled={pending || row.isMe} onClick={() => run(() => updateStaffMember(row.user_id, { is_active: false }), "Manager deactivated")}>
                            Deactivate
                          </Button>
                        ) : (
                          <>
                            <Button size="sm" variant="outline" disabled={pending || row.isMe} onClick={() => run(() => updateStaffMember(row.user_id, { is_active: true }), "Manager reactivated")}>
                              Reactivate
                            </Button>
                            <Button size="sm" variant="danger" disabled={pending || row.isMe} onClick={() => {
                              if (window.confirm(`Delete ${row.full_name || row.email}'s manager account permanently? This cannot be undone.`)) {
                                run(() => deleteInactiveManager(row.user_id), "Manager account deleted");
                              }
                            }}>
                              Delete
                            </Button>
                          </>
                        )}
                        <Button size="sm" variant="outline" disabled={pending || row.isMe} onClick={() => {
                          setEditForm({ fullName: row.full_name, email: row.email });
                          setEditing(row);
                        }}>
                          Edit
                        </Button>
                      </div>
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

      <dialog
        ref={editDialog}
        aria-labelledby="edit-manager-title"
        onClose={() => setEditing(null)}
        onClick={(event) => event.target === event.currentTarget && event.currentTarget.close()}
        className="fixed inset-0 m-auto w-[min(28rem,calc(100%-2rem))] rounded-sm border border-line bg-canvas p-6 text-ink shadow-xl backdrop:bg-ink/40"
      >
        {editing ? (
          <form className="space-y-4" onSubmit={(event) => {
            event.preventDefault();
            const userId = editing.user_id;
            run(() => updateManagerInformation(userId, editForm), "Manager information updated", () => setEditing(null));
          }}>
            <div>
              <h2 id="edit-manager-title" className="display text-2xl">Edit manager information</h2>
              <p className="mt-1 text-sm text-ink-muted">Update the manager&apos;s name and email address.</p>
            </div>
            <Field label="Full name" htmlFor="edit-manager-name">
              <Input id="edit-manager-name" value={editForm.fullName} onChange={(event) => setEditForm({ ...editForm, fullName: event.target.value })} required minLength={2} maxLength={80} />
            </Field>
            <Field label="Email" htmlFor="edit-manager-email">
              <Input id="edit-manager-email" type="email" value={editForm.email} onChange={(event) => setEditForm({ ...editForm, email: event.target.value })} required />
            </Field>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" disabled={pending} onClick={() => setEditing(null)}>Cancel</Button>
              <Button type="submit" variant="pine" disabled={pending}>Save changes</Button>
            </div>
          </form>
        ) : null}
      </dialog>

      <section className="lg:col-span-4">
        <h2 className="display text-3xl text-ink">Appoint a branch manager</h2>
        <p className="mt-1 text-sm text-ink-muted">Set a temporary password and share it securely. They can use Forgot password on the sign-in page to choose a new one.</p>
        <form
          className="mt-5 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            run(
              () => inviteStaff({ ...form, role: "manager", branchId: form.branchId }),
              `Manager account created for ${form.email}`,
              () => setForm({ fullName: "", email: "", branchId: "", temporaryPassword: "" }),
            );
          }}
        >
          <Field label="Full name" htmlFor="manager-name">
            <Input id="manager-name" value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} required />
          </Field>
          <Field label="Email" htmlFor="manager-email">
            <Input id="manager-email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required />
          </Field>
          <Field label="Temporary password" htmlFor="manager-password" hint="At least 8 characters. Share it with the manager securely.">
            <Input id="manager-password" type="password" autoComplete="new-password" minLength={8} maxLength={72} value={form.temporaryPassword} onChange={(event) => setForm({ ...form, temporaryPassword: event.target.value })} required />
          </Field>
          <Field label="Branch" htmlFor="manager-branch">
            <Select id="manager-branch" value={form.branchId} onChange={(event) => setForm({ ...form, branchId: event.target.value })} required>
              <option value="">Choose a branch</option>
              {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name_en}</option>)}
            </Select>
          </Field>
          <Button type="submit" variant="pine" disabled={pending || branches.length === 0} className="w-full">
            Create manager account
          </Button>
        </form>
      </section>

      <section className="lg:col-span-12">
        <div className="border-b border-line pb-3">
          <h2 className="display text-3xl text-ink">Manager history</h2>
          <p className="mt-1 text-sm text-ink-muted">Appointments, removals and branch changes.</p>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-separate border-spacing-y-1 text-left text-sm">
            <thead className="text-xs text-ink-muted">
              <tr>
                <th className="px-3 py-2 font-normal">Date</th>
                <th className="px-3 py-2 font-normal">Manager</th>
                <th className="px-3 py-2 font-normal">Event</th>
                <th className="px-3 py-2 font-normal">Branch</th>
                <th className="px-3 py-2 font-normal">Changed by</th>
              </tr>
            </thead>
            <tbody>
              {history.map((entry) => (
                <tr key={entry.id} className="bg-surface">
                  <td className="whitespace-nowrap px-3 py-2.5 text-ink-muted">
                    <time dateTime={entry.created_at}>{formatDate(entry.created_at, "en", { weekday: undefined, year: "numeric" })} {formatTime(entry.created_at, "en")}</time>
                  </td>
                  <td className="px-3 py-2.5 font-medium text-ink">{entry.full_name}</td>
                  <td className={`px-3 py-2.5 ${entry.event === "removed" ? "text-danger" : "text-forest-700"}`}>
                    {entry.event === "removed" ? "Manager removed" : "Manager appointed"}
                  </td>
                  <td className="px-3 py-2.5 text-ink">{entry.branch_name}</td>
                  <td className="px-3 py-2.5 text-ink-muted">{entry.actor_name}</td>
                </tr>
              ))}
              {history.length === 0 ? <tr><td colSpan={5} className="px-3 py-8 text-center text-ink-muted">No manager changes recorded yet.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}