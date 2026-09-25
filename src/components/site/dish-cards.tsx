import Image from "next/image";
import Link from "next/link";
import { DragScroll } from "@/components/site/drag-scroll";

export interface DishPhoto {
  key: string;
  name: string;
  price: string;
  href: string;
  src: string;
  alt: string;
}

/**
 * A row of dish photos you can swipe or drag, each with its name and price underneath like a caption.
 * Open layout on purpose: no boxes, overlays or badges. Only dishes with a real photo go here.
 */
export function DishStrip({ dishes, label }: { dishes: DishPhoto[]; label: string }) {
  return (
    <DragScroll label={label} className="gap-8">
      {dishes.map((d) => (
        <Link key={d.key} href={d.href} draggable={false} className="group w-full shrink-0 snap-start sm:w-[calc((100%-2rem)/2)]">
          <div className="relative aspect-[4/5] overflow-hidden bg-surface-2">
            <Image
              src={d.src}
              alt={d.alt}
              fill
              draggable={false}
              sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 75vw"
              className="pointer-events-none object-cover transition-transform duration-[1200ms] ease-[var(--ease-soft)] group-hover:scale-[1.03] motion-reduce:transition-none"
            />
          </div>
          <p className="mt-4 flex items-baseline justify-between gap-4">
            <span className="display text-2xl text-ink">{d.name}</span>
            <span className="shrink-0 text-ink-muted tabular-nums">{d.price}</span>
          </p>
        </Link>
      ))}
    </DragScroll>
  );
}
