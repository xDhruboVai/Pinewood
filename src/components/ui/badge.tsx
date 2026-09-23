import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.68rem] font-semibold tracking-wide whitespace-nowrap",
  {
    variants: {
      tone: {
        neutral: "border-line bg-surface-2 text-ink-muted",
        forest: "border-forest-600/20 bg-forest-50 text-forest-700 evening:border-forest-300/30 evening:bg-forest-900/60 evening:text-forest-200",
        gold: "border-gold-400/40 bg-gold-400/10 text-gold-600 evening:text-gold-300",
        timber: "border-timber-500/20 bg-timber-100 text-timber-600 evening:bg-timber-700/60 evening:text-timber-200",
        danger: "border-red-800/20 bg-red-50 text-red-800 evening:bg-red-950/50 evening:text-red-200",
        blue: "border-sky-800/20 bg-sky-50 text-sky-900",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export function Badge({
  className,
  tone,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
