"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { saveBranchStaff } from "@/actions/admin";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/form";
import { cn } from "@/lib/utils";
import type { BranchStaff } from "@/lib/types";

type StaffForm = {
  id: string | null;
  fullName: string;
  jobTitle: string;
  email: string;
  phone: string;
  notes: string;
  isActive: boolean;
};

const emptyForm: StaffForm = { id: null, fullName: "", jobTitle: "", email: "", phone: "", notes: "", isActive: true };

function toForm(row: BranchStaff): StaffForm {
  return {
    id: row.id,
    fullName: row.full_name,
    jobTitle: row.job_title,
    email: row.email ?? "",
    phone: row.phone ?? "",
    notes: row.notes ?? "",
    isActive: row.is_active,
  };
}

export function BranchStaffManager({ rows }: { rows: BranchStaff[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [form, setForm] = useState<StaffForm>(emptyForm);

  const save = (staff: StaffForm, message: string, reset = false) =>
    start(async () => {
      const result = await saveBranchStaff(staff);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(message);
      if (reset) setForm(emptyForm);
      router.refresh();
    });

  return (
    <div className="grid gap-x-16 gap-y-12 lg:grid-cols-12">
      <section className="lg:col-span-8">
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-y-2 text-left text-sm">
            <thead className="text-xs text-ink-muted">
              <tr>
                <th className="px-4 pb-1 font-normal">Staff member</th>
                <th className="px-4 pb-1 font-normal">Job title</th>
                <th className="hidden px-4 pb-1 font-normal md:table-cell">Contact</th>
                <th className="px-4 pb-1 font-normal">Status</th>
                <th className="px-4 pb-1 text-right font-normal"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className={cn("bg-surface [&>td:first-child]:rounded-l-md [&>td:last-child]:rounded-r-md", !row.is_active && "opacity-60")}>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-ink">{row.full_name}</p>
                    {row.notes ? <p className="mt-1 max-w-sm text-xs text-ink-muted">{row.notes}</p> : null}
                  </td>
                  <td className="px-4 py-3 text-ink">{row.job_title}</td>
                  <td className="hidden px-4 py-3 text-ink-muted md:table-cell">
                    {row.phone ? <p>{row.phone}</p> : null}
                    {row.email ? <p>{row.email}</p> : null}
                    {!row.phone && !row.email ? "—" : null}
                  </td>
                  <td className="px-4 py-3 text-ink-muted">{row.is_active ? "Active" : "Inactive"}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => setForm(toForm(row))}>Edit</Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={row.is_active ? "outline" : "subtle"}
                        disabled={pending}
                        onClick={() => save({ ...toForm(row), isActive: !row.is_active }, row.is_active ? "Staff member deactivated" : "Staff member reactivated")}
                      >
                        {row.is_active ? "Deactivate" : "Reactivate"}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? <tr><td colSpan={5} className="px-4 py-10 text-center text-ink-muted">No staff records for this branch yet.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="lg:col-span-4">
        <h2 className="display text-3xl text-ink">{form.id ? "Edit staff member" : "Add staff member"}</h2>
        <form
          className="mt-5 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            save(form, form.id ? "Staff details updated" : "Staff member added", true);
          }}
        >
          <Field label="Full name" htmlFor="branch-staff-name">
            <Input id="branch-staff-name" value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} required minLength={2} maxLength={100} />
          </Field>
          <Field label="Job title" htmlFor="branch-staff-title">
            <Input id="branch-staff-title" value={form.jobTitle} onChange={(event) => setForm({ ...form, jobTitle: event.target.value })} placeholder="Waiter, chef, side chef…" required minLength={2} maxLength={80} />
          </Field>
          <Field label="Phone" htmlFor="branch-staff-phone">
            <Input id="branch-staff-phone" type="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} maxLength={32} />
          </Field>
          <Field label="Email" htmlFor="branch-staff-email">
            <Input id="branch-staff-email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} maxLength={254} />
          </Field>
          <Field label="Notes" htmlFor="branch-staff-notes">
            <Textarea id="branch-staff-notes" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} maxLength={1000} rows={3} />
          </Field>
          <div className="flex gap-2">
            <Button type="submit" variant="pine" disabled={pending} className="flex-1">{form.id ? "Save changes" : "Add staff member"}</Button>
            {form.id ? <Button type="button" variant="outline" disabled={pending} onClick={() => setForm(emptyForm)}>Cancel</Button> : null}
          </div>
        </form>
      </section>
    </div>
  );
}