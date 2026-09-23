import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { PreOrderStatus, ReservationStatus } from "@/lib/types";

export function PageHeader({ title, description, children }: { title: string; description?: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-6">
      <div>
        <h1 className="font-display text-4xl text-ink">{title}</h1>
        {description ? <p className="mt-1 text-sm text-ink-muted">{description}</p> : null}
      </div>
      {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
    </div>
  );
}

const STATUS_TONE: Record<ReservationStatus, "gold" | "forest" | "blue" | "neutral" | "danger" | "timber"> = {
  pending: "gold",
  confirmed: "forest",
  seated: "blue",
  completed: "neutral",
  cancelled: "neutral",
  rejected: "danger",
  expired: "timber",
  no_show: "danger",
};

export const STATUS_LABEL: Record<ReservationStatus, string> = {
  pending: "Pending call",
  confirmed: "Confirmed",
  seated: "Seated",
  completed: "Completed",
  cancelled: "Cancelled",
  rejected: "Rejected",
  expired: "Expired",
  no_show: "No-show",
};

export function StatusBadge({ status }: { status: ReservationStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>;
}

export const PREORDER_LABEL: Record<PreOrderStatus, string> = {
  submitted: "New",
  acknowledged: "Acknowledged",
  preparing: "Preparing",
  ready: "Ready",
  served: "Served",
  cancelled: "Cancelled",
};

export function StatCard({ label, value, hint, tone }: { label: string; value: React.ReactNode; hint?: string; tone?: "alert" }) {
  return (
    <div className={cn("rounded-sm border bg-surface p-5", tone === "alert" ? "border-gold-400/60" : "border-line")}>
      <p className="text-xs font-semibold tracking-wide text-ink-muted uppercase">{label}</p>
      <p className="mt-2 font-display text-4xl text-ink tabular-nums">{value}</p>
      {hint ? <p className="mt-1 text-xs text-ink-muted">{hint}</p> : null}
    </div>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="rounded-sm border border-dashed border-line p-10 text-center text-sm text-ink-muted">{children}</div>;
}

export function relativeFromNow(iso: string) {
  const diff = new Date(iso).getTime() - Date.now();
  const abs = Math.abs(diff);
  const mins = Math.round(abs / 60000);
  const text = mins < 60 ? `${mins}m` : mins < 60 * 48 ? `${Math.round(mins / 60)}h` : `${Math.round(mins / 1440)}d`;
  return diff >= 0 ? `in ${text}` : `${text} ago`;
}
