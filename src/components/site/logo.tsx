import { cn } from "@/lib/utils";

export function PineGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 32" aria-hidden className={cn("h-7 w-auto", className)}>
      <path
        d="M12 2 L18 12 H15 L20 20 H16.5 L22 28 H2 L7.5 20 H4 L9 12 H6 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <line x1="12" y1="28" x2="12" y2="31.5" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

export function Logo({ className, subline }: { className?: string; subline?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-3 text-ink", className)}>
      <PineGlyph className="text-primary evening:text-accent" />
      <span className="flex flex-col leading-none">
        <span className="font-display text-[1.35rem] font-semibold tracking-[0.32em] uppercase">Pine&nbsp;Wood</span>
        {subline ? <span className="mt-1 text-[0.6rem] font-semibold tracking-[0.3em] text-ink-muted uppercase">{subline}</span> : null}
      </span>
    </span>
  );
}
