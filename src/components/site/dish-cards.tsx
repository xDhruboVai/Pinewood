"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DishPhoto {
  key: string;
  name: string;
  price: string;
  href: string;
  src: string;
  alt: string;
}

const AUTOPLAY_MS = 6500;

const subscribeMotion = (cb: () => void) => {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
const getMotionSnapshot = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const getMotionServer = () => false;

/**
 * A featured dish showcase with smooth opacity cross-fade transitions matching the hero carousel.
 * One dish is showcased at a time for ~6.5 seconds with a gentle scale zoom, then cross-fades
 * to the next dish. Pauses on hover, supports keyboard arrows, and includes indicator pills and
 * next/previous controls.
 */
export function DishStrip({ dishes, label }: { dishes: DishPhoto[]; label: string }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const reducedMotion = useSyncExternalStore(subscribeMotion, getMotionSnapshot, getMotionServer);
  const total = dishes.length;

  const next = useCallback(() => {
    setIndex((i) => (i + 1) % total);
  }, [total]);

  const prev = useCallback(() => {
    setIndex((i) => (i - 1 + total) % total);
  }, [total]);

  useEffect(() => {
    if (total <= 1 || paused || reducedMotion) return;
    const timer = setInterval(next, AUTOPLAY_MS);
    return () => clearInterval(timer);
  }, [total, paused, reducedMotion, next, index]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      prev();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      next();
    }
  };

  if (!dishes.length) return null;
  const current = dishes[index] ?? dishes[0];

  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label={label}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="group relative flex flex-col focus:outline-none"
    >
      {/* Featured Photo Frame with Smooth Opacity Cross-Fade */}
      <Link
        href={current.href}
        className="group/photo relative block aspect-[16/11] sm:aspect-[4/3] w-full overflow-hidden rounded-xl bg-surface-2 shadow-sm transition-shadow duration-300 hover:shadow-md"
      >
        {dishes.map((d, i) => {
          const isActive = i === index;
          return (
            <div
              key={d.key}
              aria-hidden={!isActive}
              className={cn(
                "absolute inset-0 transition-opacity duration-1000 ease-[var(--ease-soft)] motion-reduce:transition-none",
                isActive ? "opacity-100 z-10 pointer-events-auto" : "opacity-0 z-0 pointer-events-none",
              )}
            >
              <Image
                src={d.src}
                alt={d.alt}
                fill
                priority={i === 0}
                draggable={false}
                sizes="(min-width: 1280px) 46vw, (min-width: 1024px) 56vw, 100vw"
                className={cn(
                  "pointer-events-none object-cover transition-transform duration-[6500ms] ease-out motion-reduce:transition-none",
                  isActive ? "scale-100" : "scale-[1.03]",
                  "group-hover/photo:scale-[1.03]",
                )}
              />
            </div>
          );
        })}
      </Link>

      {/* Caption & Controls Row */}
      <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Dish Title & Price (updates smoothly with current slide, matching website sans typography) */}
        <Link href={current.href} className="group/title block min-w-0">
          <div className="flex items-baseline gap-3 sm:gap-4">
            <span className="text-xl font-semibold tracking-tight text-ink transition-colors group-hover/title:text-primary sm:text-2xl">
              {current.name}
            </span>
            <span className="text-lg font-semibold text-ink-muted sm:text-xl tabular-nums">
              {current.price}
            </span>
          </div>
        </Link>

        {/* Navigation Dots and Arrow Controls */}
        {total > 1 ? (
          <div className="flex items-center gap-3 shrink-0">
            {/* Slide Indicator Pills */}
            <div className="flex items-center gap-1.5" aria-hidden>
              {dishes.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-label={`Go to slide ${i + 1}`}
                  className={cn(
                    "h-1.5 rounded-full transition-all duration-500",
                    i === index ? "w-6 bg-primary" : "w-1.5 bg-ink/20 hover:bg-ink/40",
                  )}
                />
              ))}
            </div>

            {/* Prev / Next Arrows */}
            <div className="flex items-center gap-1.5 ml-1">
              <button
                type="button"
                onClick={prev}
                aria-label="Previous dish"
                className="flex size-8 items-center justify-center rounded-full border border-line bg-surface text-ink transition-colors hover:border-ink hover:bg-pine-100"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                type="button"
                onClick={next}
                aria-label="Next dish"
                className="flex size-8 items-center justify-center rounded-full border border-line bg-surface text-ink transition-colors hover:border-ink hover:bg-pine-100"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
