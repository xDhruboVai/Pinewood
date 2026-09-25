import Link from "next/link";
import { cn } from "@/lib/utils";
import type { PreOrderStatus, ReservationStatus } from "@/lib/types";

/**
 * Page heading, built like the Menu page's header: a teal band with a small mustard label, the
 * title in the Pinewood script (lowercase) and a short line under it. Full width, above `AdminBody`.
 */
export function PageHeader({
  title,
  kicker,
  description,
  children,
}: {
  title: string;
  kicker?: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="grain grain-dark bg-pine-700 text-cream-100">
      <div className="mx-auto flex max-w-7xl flex-wrap items-end justify-between gap-x-8 gap-y-5 px-5 pt-10 pb-12 sm:px-8 sm:pt-14 lg:px-12">
        <div className="max-w-2xl">
          <p className="eyebrow !text-mustard-400">{kicker ?? "Pinewood staff"}</p>
          <h1 className="script mt-3 pl-1.5 text-6xl lowercase sm:text-7xl">{title}</h1>
          {description ? <p className="mt-4 max-w-xl leading-relaxed text-cream-100/75">{description}</p> : null}
        </div>
        {children ? <div className="flex flex-wrap items-center gap-3">{children}</div> : null}
      </div>
    </section>
  );
}

/** The page's content area: the site's container width and padding, below the `PageHeader` band. */
export function AdminBody({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto w-full max-w-7xl px-5 py-10 sm:px-8 lg:px-12 lg:py-14">{children}</div>;
}

/** Section heading inside an admin page: serif, with an optional sentence under it and a quiet link on the right. */
export function AdminSection({
  title,
  description,
  action,
  className,
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={className}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h2 className="display text-3xl text-ink">{title}</h2>
        {action}
      </div>
      {description ? <p className="mt-1 max-w-xl text-sm leading-relaxed text-ink-muted">{description}</p> : null}
      <div className="mt-6">{children}</div>
    </section>
  );
}

/** "All pending" + the site's thin line arrow. Sentence case, no underline. */
export function AdminLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="group inline-flex items-center gap-2 text-sm font-medium text-primary hover:text-accent-ink">
      {children}
      <svg aria-hidden viewBox="0 0 28 10" fill="none" className="h-2.5 w-6 shrink-0 transition-transform duration-300 group-hover:translate-x-1">
        <path d="M1 5.2 C 9 4.6, 17 5.4, 26 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M21.5 1.6 L 26 5 L 21.5 8.4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </Link>
  );
}

/** Text tabs like the site navigation: wide-tracked caps, the current one in ink with a short mustard line under it. */
export function TextTabs<K extends string>({
  items,
  current,
  onSelect,
  label,
}: {
  items: { key: K; label: string; count?: number; href?: string }[];
  current: K;
  onSelect?: (key: K) => void;
  label: string;
}) {
  return (
    <div role="tablist" aria-label={label} className="no-scrollbar -mx-1 flex gap-x-6 overflow-x-auto px-1">
      {items.map((item) => {
        const active = item.key === current;
        const cls = cn(
          "font-nav relative inline-flex shrink-0 items-baseline gap-1.5 pt-1 pb-2.5 text-[0.7rem] font-medium tracking-[0.16em] uppercase transition-colors",
          "after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-5 after:bg-mustard-400 after:transition-opacity",
          active ? "text-ink after:opacity-100" : "text-ink-muted after:opacity-0 hover:text-ink",
        );
        const inner = (
          <>
            {item.label}
            {item.count !== undefined ? <span className="font-sans text-[0.7rem] tracking-normal text-ink-muted tabular-nums">{item.count}</span> : null}
          </>
        );
        return item.href ? (
          <Link key={item.key} href={item.href} role="tab" aria-selected={active} className={cls}>
            {inner}
          </Link>
        ) : (
          <button key={item.key} type="button" role="tab" aria-selected={active} onClick={() => onSelect?.(item.key)} className={cls}>
            {inner}
          </button>
        );
      })}
    </div>
  );
}

type Tone = "mustard" | "pine" | "wood" | "muted" | "danger";

const DOT: Record<Tone, string> = {
  mustard: "bg-mustard-400",
  pine: "bg-pine-600",
  wood: "bg-wood-500",
  muted: "bg-ink-muted/40",
  danger: "bg-danger",
};

/** A status as plain text with a small coloured dot (no pills). */
export function Mark({ tone = "muted", children, className }: { tone?: Tone; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs whitespace-nowrap", tone === "danger" ? "text-danger" : "text-ink-muted", className)}>
      <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", DOT[tone])} />
      {children}
    </span>
  );
}

const STATUS_TONE: Record<ReservationStatus, Tone> = {
  pending: "mustard",
  confirmed: "pine",
  seated: "wood",
  completed: "muted",
  cancelled: "muted",
  rejected: "danger",
  expired: "muted",
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

export function StatusBadge({ status, className }: { status: ReservationStatus; className?: string }) {
  return (
    <Mark tone={STATUS_TONE[status]} className={className}>
      {STATUS_LABEL[status]}
    </Mark>
  );
}

export const PREORDER_LABEL: Record<PreOrderStatus, string> = {
  submitted: "New",
  acknowledged: "Acknowledged",
  preparing: "Preparing",
  ready: "Ready",
  served: "Served",
  cancelled: "Cancelled",
};

export const PREORDER_TONE: Record<PreOrderStatus, Tone> = {
  submitted: "mustard",
  acknowledged: "muted",
  preparing: "wood",
  ready: "pine",
  served: "muted",
  cancelled: "danger",
};

/** A row of plain figures: a big serif number with a short sentence-case label, no tiles. */
export function Figures({ children, className }: { children: React.ReactNode; className?: string }) {
  return <dl className={cn("grid grid-cols-2 gap-x-8 gap-y-8 sm:grid-cols-3 lg:flex lg:flex-wrap lg:gap-x-16", className)}>{children}</dl>;
}

export function Figure({ label, value, hint, alert }: { label: string; value: React.ReactNode; hint?: string; alert?: boolean }) {
  return (
    <div className="flex flex-col">
      <dt className="order-2 mt-2 text-sm text-ink">{label}</dt>
      <dd className={cn("order-1 display text-5xl leading-none sm:text-6xl tabular-nums lining-nums", alert ? "text-accent-ink" : "text-ink")}>{value}</dd>
      {hint ? <dd className="order-3 text-xs text-ink-muted">{hint}</dd> : null}
    </div>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <p className="rounded-md bg-surface px-6 py-10 text-center text-sm text-ink-muted">{children}</p>;
}

export function relativeFromNow(iso: string) {
  const diff = new Date(iso).getTime() - Date.now();
  const abs = Math.abs(diff);
  const mins = Math.round(abs / 60000);
  const text = mins < 60 ? `${mins}m` : mins < 60 * 48 ? `${Math.round(mins / 60)}h` : `${Math.round(mins / 1440)}d`;
  return diff >= 0 ? `in ${text}` : `${text} ago`;
}
