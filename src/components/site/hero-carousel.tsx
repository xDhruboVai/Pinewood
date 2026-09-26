"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Container } from "@/components/site/section";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface HeroSlideView {
  key: string;
  name: string;
  description: string;
  price: string;
  section: string;
  src: string;
  alt: string;
  position: string;
}

const AUTOPLAY_MS = 7000;
/** Pixels of sideways movement before a press counts as a drag rather than a tap or a scroll. */
const DRAG_START = 8;

export function HeroCarousel({
  slides,
  labels,
  bn,
  fontClassName,
}: {
  slides: HeroSlideView[];
  labels: { title: string; accent: string; eyebrow: string; note: string; reserve: string; menu: string };
  bn: boolean;
  /** Defines the hero fonts' CSS variables (next/font classes from home-hero.tsx). */
  fontClassName?: string;
}) {
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState(1);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  // The other photos wait until the page has loaded, so they don't compete with the first one (the
  // largest thing on the page); the first autoplay change is 7 seconds in.
  const [pageLoaded, setPageLoaded] = useState(false);
  // While a finger or mouse drags the slide: sideways distance in px and the hero's width. Otherwise null.
  const [dragState, setDragState] = useState<{ dx: number; width: number } | null>(null);
  const drag = dragState?.dx ?? null;
  const press = useRef<{ x: number; y: number; id: number; dragging: boolean } | null>(null);
  const dragged = useRef(false);
  const sectionRef = useRef<HTMLElement>(null);
  const many = slides.length > 1;
  const wrap = (i: number) => (i + slides.length) % slides.length;

  const go = useCallback(
    (to: number, direction: number) => {
      setDir(direction);
      setIndex((to + slides.length) % slides.length);
    },
    [slides.length],
  );
  const next = useCallback(() => go(index + 1, 1), [go, index]);
  const prev = useCallback(() => go(index - 1, -1), [go, index]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = () => setReducedMotion(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Autoplay, paused on hover, keyboard focus, while dragging, in hidden tabs and for reduced motion.
  const autoplay = many && !paused && drag === null && !reducedMotion;
  useEffect(() => {
    if (!autoplay) return;
    const timer = setTimeout(next, AUTOPLAY_MS);
    return () => clearTimeout(timer);
  }, [autoplay, next, index]);
  useEffect(() => {
    if (document.readyState === "complete") {
      setPageLoaded(true);
      return;
    }
    const onLoad = () => setPageLoaded(true);
    window.addEventListener("load", onLoad);
    return () => window.removeEventListener("load", onLoad);
  }, []);
  useEffect(() => {
    const onVisibility = () => setPaused(document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  // Drag with a finger or the mouse: the slide follows the pointer and the next photo fades in.
  // Letting go past a fifth of the width (or a quick 60px flick) changes slide, otherwise it springs back.
  const onPointerDown = (e: React.PointerEvent) => {
    if (!many || (e.pointerType === "mouse" && e.button !== 0)) return;
    press.current = { x: e.clientX, y: e.clientY, id: e.pointerId, dragging: false };
    dragged.current = false;
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const p = press.current;
    if (!p || p.id !== e.pointerId) return;
    const dx = e.clientX - p.x;
    if (!p.dragging) {
      if (Math.abs(dx) < DRAG_START) return;
      // Mostly vertical: let the page scroll instead.
      if (Math.abs(e.clientY - p.y) > Math.abs(dx)) {
        press.current = null;
        return;
      }
      p.dragging = true;
      dragged.current = true;
      sectionRef.current?.setPointerCapture(e.pointerId);
    }
    setDragState({ dx, width: sectionRef.current?.offsetWidth ?? 1000 });
  };
  const endPress = (e: React.PointerEvent) => {
    const p = press.current;
    press.current = null;
    if (!p?.dragging) return;
    const dx = e.clientX - p.x;
    const width = sectionRef.current?.offsetWidth ?? 1000;
    if (Math.abs(dx) > Math.min(width * 0.2, 160) || Math.abs(dx) > 60) {
      if (dx < 0) next();
      else prev();
    }
    setDragState(null);
  };
  // A drag that ends over a link or button shouldn't also click it.
  const onClickCapture = (e: React.MouseEvent) => {
    if (dragged.current) {
      e.preventDefault();
      e.stopPropagation();
      dragged.current = false;
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!many) return;
    if (e.key === "ArrowRight") next();
    if (e.key === "ArrowLeft") prev();
  };

  // While dragging: how far along (0 to 1) and which slide is coming in.
  const progress = dragState ? Math.min(1, Math.abs(dragState.dx) / (dragState.width * 0.5)) : 0;
  const incoming = drag === null || drag === 0 ? -1 : wrap(index + (drag < 0 ? 1 : -1));
  const photoOpacity = (i: number) => (i === index ? 1 - progress * 0.7 : i === incoming ? progress * 0.9 : 0);

  return (
    <section
      ref={sectionRef}
      aria-roledescription="carousel"
      aria-label={labels.title}
      tabIndex={many ? 0 : undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPress}
      onPointerCancel={endPress}
      onClickCapture={onClickCapture}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onKeyDown={onKeyDown}
      className={cn(
        // Pulled up under the see-through header so the photo runs behind the navigation.
        "relative isolate -mt-20 touch-pan-y 2xl:-mt-24 overflow-hidden bg-pine-800 text-cream-100 select-none focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-mustard-400",
        many && (drag === null ? "cursor-grab" : "cursor-grabbing"),
        fontClassName,
      )}
    >
      <h1 className="sr-only">{labels.title}</h1>

      {/* Photos: on desktop they start 28% of the way in and melt into the green on the left. Not full
          width on purpose: the dish photos are 1080-1500px wide, and stretching them across a whole
          1920px screen made them visibly soft. */}
      <div className="absolute inset-x-0 top-0 -z-10 h-[60%] overflow-hidden [mask-image:linear-gradient(to_bottom,black_55%,transparent)] sm:h-[64%] lg:inset-y-0 lg:right-0 lg:left-[28%] lg:h-auto lg:[mask-image:none]">
        {slides.map((s, i) => (
          <div
            key={s.key}
            aria-hidden={i !== index}
            style={{ opacity: photoOpacity(i) }}
            className={cn("absolute inset-0 motion-reduce:transition-none", drag === null && "transition-opacity duration-[1100ms] ease-[var(--ease-soft)]")}
          >
            {i === 0 || pageLoaded || i === index || i === incoming ? (
              <Image
                src={s.src}
                alt={s.alt}
                fill
                priority={i === 0}
                draggable={false}
                sizes="(min-width: 1024px) 72vw, 100vw"
                quality={85}
                style={{ objectPosition: s.position }}
                className={cn(
                  "pointer-events-none object-cover brightness-[0.88] transition-transform duration-[2400ms] ease-[var(--ease-soft)] motion-reduce:transition-none",
                  i === index && drag === null ? "scale-100" : "scale-[1.02]",
                )}
              />
            ) : null}
          </div>
        ))}
      </div>
      {/* Shade. Phones and tablets: the photo fades out at its foot (the mask above) and the green rises
          behind the text, so photo and text read as one picture with no hard edge. Desktop: a soft
          gradient from the left. */}
      <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-pine-800 via-pine-800 via-40% to-transparent to-70% lg:hidden" />
      <div
        aria-hidden
        className="absolute inset-0 -z-10 hidden lg:block bg-[linear-gradient(to_right,rgba(19,47,50,1)_28%,rgba(19,47,50,0.85)_36%,rgba(19,47,50,0.45)_48%,rgba(19,47,50,0.12)_62%,transparent_75%)]"
      />
      <div aria-hidden className="absolute inset-x-0 top-0 -z-10 h-36 bg-gradient-to-b from-pine-900/80 to-transparent" />
      <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_90%_80%_at_70%_50%,transparent_55%,rgb(19_47_50/0.4)_100%)]" />

      {/* 16:9 cinematic framing: comfortable height, generous desktop spacing */}
      <Container className="relative flex min-h-[100svh] flex-col justify-between pt-28 pb-8 sm:pt-32 sm:pb-10 lg:min-h-[min(100svh,52rem)] lg:pt-32 lg:pb-10 2xl:max-w-[110rem] 2xl:px-[4.5vw]">
        {/* Editorial text block occupying roughly the left 35-40% */}
        <div className="mt-auto max-w-md lg:my-auto lg:max-w-lg xl:max-w-xl">
          <p className={cn("hand animate-rise text-4xl text-mustard-400 sm:text-5xl lg:text-[3.25rem] xl:text-[3.75rem]", !bn && "origin-left -rotate-6")}>{labels.accent}</p>

          {/* Changing text. All slides share one grid cell so the layout doesn't jump; the active one is
              re-keyed each time it becomes active so it animates in from the swipe direction, and follows
              the pointer while dragging. */}
          <div
            className={cn("mt-2.5 grid", drag === null && "transition-[transform,opacity] duration-500 ease-[var(--ease-soft)]")}
            style={{
              "--dir": dir,
              transform: drag === null ? undefined : `translateX(${drag * 0.45}px)`,
              opacity: 1 - progress * 0.8,
            } as React.CSSProperties}
          >
            {slides.map((s, i) => {
              const active = i === index;
              const long = s.name.length > 12;
              // "৳999" → a smaller currency sign so the number carries the price
              const [currency, amount] = s.price.startsWith("৳") ? ["৳", s.price.slice(1)] : ["", s.price];
              return (
                <div
                  key={active ? `${s.key}-active` : s.key}
                  role="group"
                  aria-roledescription="slide"
                  aria-label={`${i + 1} / ${slides.length}`}
                  aria-hidden={!active}
                  aria-live={active && !autoplay ? "polite" : "off"}
                  className={cn("col-start-1 row-start-1", !active && "invisible")}
                >
                  <h2
                    className={cn(
                      "hero-serif text-cream-50",
                      active && "hero-in",
                      long
                        ? "text-3xl sm:text-4xl lg:text-[3.25rem] xl:text-[3.75rem] 2xl:text-[4.5rem]"
                        : "text-4xl sm:text-5xl lg:text-[4.25rem] xl:text-[5rem] 2xl:text-[5.75rem]",
                      bn ? "leading-[1.2]" : "leading-[1.02]",
                    )}
                  >
                    {s.name}
                  </h2>
                  {s.description ? (
                    <p
                      className={cn(
                        "mt-4 max-w-[20rem] text-sm leading-[1.65] text-pretty text-cream-100/80 sm:text-base sm:max-w-[24rem] xl:mt-5 xl:max-w-[28rem] xl:text-[1.0625rem] [--d:90ms]",
                        active && "hero-in",
                      )}
                    >
                      {s.description}
                    </p>
                  ) : null}
                  {s.price ? (
                    <p className={cn("mt-6 xl:mt-7 [--d:180ms]", active && "hero-in")}>
                      <span className="hero-serif text-3xl leading-none text-mustard-400 tabular-nums sm:text-4xl lg:text-[2.75rem] xl:text-5xl">
                        {currency ? <span className="mr-1 text-[0.75em] font-medium">{currency}</span> : null}
                        {amount}
                        <span className="ml-0.5 text-[0.6em] font-normal text-mustard-400/70">/-</span>
                      </span>
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>

          {/* Phones and small tablets only: booking straight from the first screen, without opening the
              menu first. From 768px the header has its own Reserve button. */}
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 md:hidden">
            <Button asChild variant="mustard" className="font-nav h-12 px-6 text-[0.78rem] tracking-[0.16em]">
              <Link href="/reserve">{labels.reserve}</Link>
            </Button>
            <Link href="/menu" className="font-nav text-[0.78rem] font-medium tracking-[0.16em] text-cream-100/85 uppercase underline-offset-4 hover:text-cream-50 hover:underline">
              {labels.menu}
            </Link>
          </div>
        </div>

        {/* Bottom rule: menu section | place, in wide-spaced capitals */}
        <div className="mt-8 flex max-w-md items-center gap-5 border-t border-cream-100/35 pt-4 lg:mt-0 lg:max-w-lg xl:max-w-xl">
          {slides[index].section ? (
            <>
              <span key={slides[index].key} className="font-nav hero-in shrink-0 text-[0.72rem] font-semibold tracking-[0.2em] text-cream-50 uppercase">
                {slides[index].section}
              </span>
              <span aria-hidden className="hidden h-5 w-px shrink-0 bg-cream-100/35 sm:block" />
            </>
          ) : null}
          {/* On phones there's only room for one of the two; the dish's menu section wins, rather than
              cutting "Café & restaurant" off half-way. */}
          <span className={cn("font-nav truncate text-[0.68rem] font-medium tracking-[0.38em] text-cream-100/80 uppercase", slides[index].section && "hidden sm:inline")}>{labels.eyebrow}</span>
        </div>
      </Container>

      {/* Handwritten note, bottom right */}
      <div className="pointer-events-none absolute right-[5%] bottom-8 hidden -rotate-12 text-mustard-400 drop-shadow-[0_1px_8px_rgb(19_47_50/0.6)] sm:block lg:bottom-10 lg:right-[6%]">
        <p className="hand text-3xl lg:text-4xl">{labels.note}</p>
        <svg aria-hidden viewBox="0 0 120 12" className="mt-0.5 ml-auto h-2.5 w-20" fill="none">
          <path d="M2 9 C 40 3, 80 2, 118 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>
    </section>
  );
}
