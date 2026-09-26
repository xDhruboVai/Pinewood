import type { Branch, BranchStaff } from "@/lib/types";

export function BranchStaffDirectory({ branches, staff }: { branches: Branch[]; staff: BranchStaff[] }) {
  return (
    <div className="space-y-12">
      {branches.map((branch) => {
        const rows = staff.filter((entry) => entry.branch_id === branch.id);
        return (
          <section key={branch.id}>
            <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-line pb-3">
              <h2 className="display text-2xl text-ink">{branch.name_en}</h2>
              <p className="text-sm text-ink-muted">{rows.filter((entry) => entry.is_active).length} active · {rows.length} records</p>
            </div>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full border-separate border-spacing-y-1 text-left text-sm">
                <thead className="text-xs text-ink-muted">
                  <tr>
                    <th className="px-3 py-2 font-normal">Name</th>
                    <th className="px-3 py-2 font-normal">Job title</th>
                    <th className="px-3 py-2 font-normal">Contact</th>
                    <th className="px-3 py-2 font-normal">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="bg-surface [&>td:first-child]:rounded-l-md [&>td:last-child]:rounded-r-md">
                      <td className="px-3 py-2.5 font-medium text-ink">{row.full_name}</td>
                      <td className="px-3 py-2.5 text-ink">{row.job_title}</td>
                      <td className="px-3 py-2.5 text-ink-muted">
                        {row.phone ? <p>{row.phone}</p> : null}
                        {row.email ? <p>{row.email}</p> : null}
                        {!row.phone && !row.email ? "—" : null}
                      </td>
                      <td className="px-3 py-2.5 text-ink-muted">{row.is_active ? "Active" : "Inactive"}</td>
                    </tr>
                  ))}
                  {rows.length === 0 ? <tr><td colSpan={4} className="px-3 py-6 text-ink-muted">No staff records for this branch.</td></tr> : null}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
}