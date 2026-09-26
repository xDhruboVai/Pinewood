import { cn } from "@/lib/utils";
import type { PreOrderStatus } from "@/lib/types";

/**
 * Page heading for the staff screens: a small label, the title in the display serif and one line on
 * how the screen is used, on the cream page under the teal navigation. Compact on purpose, so the
 * bookings and dishes start near the top of the screen. Full width, above `AdminBody`.
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
    <section>
      <div className="mx-auto flex max-w-7xl flex-wrap items-end justify-between gap-x-8 gap-y-4 px-5 pt-7 sm:px-8 sm:pt-9 lg:px-12">
        <div className="max-w-3xl">
          <p className="eyebrow">{kicker ?? "Pinewood staff"}</p>
          <h1 className="display mt-1 text-[2.25rem] text-ink sm:text-[2.625rem]">{title}</h1>
          {description ? <p className="mt-1.5 text-sm leading-relaxed text-pretty text-ink-muted">{description}</p> : null}
        </div>
        {children ? <div className="flex flex-wrap items-center gap-3">{children}</div> : null}
      </div>
    </section>
  );
}

/** The page's content area: the site's container width and padding, below the `PageHeader`. */
export function AdminBody({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto w-full max-w-7xl px-5 pt-7 pb-16 sm:px-8 sm:pt-8 lg:px-12">{children}</div>;
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
