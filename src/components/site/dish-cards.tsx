import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

export interface DishPhoto {
  key: string;
  name: string;
  price: string;
  href: string;
  src: string;
  alt: string;
}

/**
 * A showcase of dish photos rolling slowly from left to right, each with its name and price
 * underneath like a caption. Open layout on purpose: no boxes, overlays or badges. Only dishes with
 * a real photo go here.
 *
 * The row holds the dishes twice and the animation (roll-right in globals.css) moves it by exactly
 * one copy, so the loop has no seam; each card carries its own right margin instead of a flex gap
 * for the same reason. The second copy is hidden from screen readers and the keyboard. It pauses
 * while hovered or while a dish has keyboard focus, and the edges fade out. With reduced motion
 * there's no animation: one copy, swiped or scrolled sideways instead.
 */
export function DishStrip({ dishes, label }: { dishes: DishPhoto[]; label: string }) {
  const copies = [...dishes, ...dishes];
  return (
    <div
      role="region"
      aria-label={label}
      className="group/strip overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_7%,black_93%,transparent)] motion-reduce:snap-x motion-reduce:snap-mandatory motion-reduce:overflow-x-auto motion-reduce:[mask-image:none]"
    >
      <ul
        className="flex w-max animate-roll-right group-hover/strip:[animation-play-state:paused] group-focus-within/strip:[animation-play-state:paused] motion-reduce:animate-none"
        // About 8 seconds per dish (roughly 40px a second), so the pace stays the same however many
        // dishes there are.
        style={{ animationDuration: `${Math.max(dishes.length, 3) * 8}s` }}
      >
        {copies.map((d, i) => {
          const repeat = i >= dishes.length;
          return (
            <li key={`${d.key}-${i}`} aria-hidden={repeat || undefined} className={cn("mr-8 w-64 shrink-0 snap-start sm:w-72", repeat && "motion-reduce:hidden")}>
              <Link href={d.href} draggable={false} tabIndex={repeat ? -1 : undefined} className="group block">
                <div className="relative aspect-[4/5] overflow-hidden bg-surface-2">
                  <Image
                    src={d.src}
                    alt={repeat ? "" : d.alt}
                    fill
                    draggable={false}
                    sizes="(min-width: 640px) 18rem, 16rem"
                    className="pointer-events-none object-cover transition-transform duration-[1200ms] ease-[var(--ease-soft)] group-hover:scale-[1.03] motion-reduce:transition-none"
                  />
                </div>
                <p className="mt-4 flex items-baseline justify-between gap-4">
                  <span className="display text-2xl text-ink">{d.name}</span>
                  <span className="shrink-0 text-ink-muted tabular-nums">{d.price}</span>
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
