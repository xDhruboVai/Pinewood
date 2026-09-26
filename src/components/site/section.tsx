import Link from "next/link";
import { Photo } from "@/components/site/photo";
import type { PhotoName } from "@/lib/site";
import { cn } from "@/lib/utils";

export function Container({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("mx-auto w-full max-w-7xl px-5 sm:px-8 lg:max-w-[88rem] lg:px-12 xl:max-w-[100rem] 2xl:max-w-[110rem] 2xl:px-[4.5vw]", className)}>{children}</div>;
}

/**
 * Section title in the Pinewood hand (Kaushan Script), lowercase like the category names on the
 * printed menu. Use it for a few expressive section openers per page, not for every heading.
 */
export function ScriptTitle({
  children,
  as: Tag = "h2",
  light,
  className,
}: {
  children: React.ReactNode;
  as?: "h1" | "h2" | "h3" | "p";
  light?: boolean;
  className?: string;
}) {
  return <Tag className={cn("script pl-1 text-5xl lowercase sm:text-6xl", light ? "text-cream-100" : "text-ink", className)}>{children}</Tag>;
}

/** A thin drawn line with an open tip, used after quiet links. It stretches a little on hover. */
export function LineArrow({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 28 10" fill="none" className={cn("h-2.5 w-7 shrink-0 translate-y-[-0.05em] transition-transform duration-300 group-hover:translate-x-1", className)}>
      <path d="M1 5.2 C 9 4.6, 17 5.4, 26 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M21.5 1.6 L 26 5 L 21.5 8.4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** A quiet text link ("See the menu" + a thin line arrow): sentence case, no underline. `light` for green backgrounds. */
export function QuietLink({
  href,
  children,
  light,
  external,
  className,
}: {
  href: string;
  children: React.ReactNode;
  light?: boolean;
  external?: boolean;
  className?: string;
}) {
  const cls = cn(
    "group inline-flex items-center gap-2.5 text-[0.95rem] font-medium transition-colors",
    light ? "text-cream-100 hover:text-mustard-300" : "text-primary hover:text-accent-ink evening:text-ink evening:hover:text-accent-ink",
    className,
  );
  const arrow = <LineArrow />;
  return external ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
      {children}
      {arrow}
    </a>
  ) : (
    <Link href={href} className={cls}>
      {children}
      {arrow}
    </Link>
  );
}

/** Serif section heading with an optional short line of context above it (sentence case, no label). */
export function SectionHeading({
  eyebrow,
  title,
  lede,
  align = "left",
  className,
  as: Tag = "h2",
}: {
  eyebrow?: string;
  title: string;
  lede?: string;
  align?: "left" | "center";
  className?: string;
  as?: "h1" | "h2";
}) {
  return (
    <div className={cn("max-w-2xl", align === "center" && "mx-auto text-center", className)}>
      {eyebrow ? <p className="text-sm text-ink-muted">{eyebrow}</p> : null}
      <Tag className={cn("display text-ink", eyebrow && "mt-2", Tag === "h1" ? "text-5xl sm:text-6xl lg:text-7xl" : "text-4xl sm:text-5xl")}>
        {title}
      </Tag>
      {lede ? <p className="mt-5 text-base leading-relaxed text-ink-muted sm:text-lg">{lede}</p> : null}
    </div>
  );
}

/**
 * Green title band at the top of inner pages: a line in the Pinewood hand, the serif page title and a
 * short lede, with an optional photo on the right that runs to the edge of the screen.
 */
export function PageHero({
  eyebrow,
  title,
  lede,
  photo,
  children,
}: {
  eyebrow: string;
  title: string;
  lede?: string;
  photo?: { name: PhotoName; alt: string; position?: string };
  children?: React.ReactNode;
}) {
  return (
    <section className="grain grain-dark relative isolate overflow-hidden bg-pine-700 text-cream-100">
      {photo ? (
        <div className="relative -z-10 aspect-[16/10] sm:aspect-[16/8] lg:absolute lg:inset-y-0 lg:right-0 lg:aspect-auto lg:w-[46%]">
          <Photo name={photo.name} alt={photo.alt} priority position={photo.position} sizes="(min-width: 1024px) 46vw, 100vw" className="h-full rounded-none" />
        </div>
      ) : null}
      <Container className={cn("py-14 sm:py-20", photo && "lg:min-h-[26rem] lg:py-24")}>
        <div className={cn(photo && "lg:max-w-[48%]")}>
          <p className="script text-3xl text-mustard-400 lowercase">{eyebrow}</p>
          <h1 className="display mt-2 max-w-3xl text-5xl text-cream-50 sm:text-6xl lg:text-7xl">{title}</h1>
          {lede ? <p className="mt-5 max-w-xl text-base leading-relaxed text-cream-100/75 sm:text-lg">{lede}</p> : null}
          {children}
        </div>
      </Container>
    </section>
  );
}
