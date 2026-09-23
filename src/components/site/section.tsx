import { cn } from "@/lib/utils";

export function Container({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-10", className)}>{children}</div>;
}

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
      {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
      {eyebrow ? <div className={cn("hairline mt-4", align === "center" && "mx-auto")} /> : null}
      <Tag className={cn("display mt-5 text-ink", Tag === "h1" ? "text-5xl sm:text-6xl lg:text-7xl" : "text-4xl sm:text-5xl")}>
        {title}
      </Tag>
      {lede ? <p className="mt-5 text-base leading-relaxed text-ink-muted sm:text-lg">{lede}</p> : null}
    </div>
  );
}

export function PageHero({ eyebrow, title, lede, children }: { eyebrow: string; title: string; lede?: string; children?: React.ReactNode }) {
  return (
    <section className="border-b border-line">
      <Container className="py-16 sm:py-24">
        <SectionHeading as="h1" eyebrow={eyebrow} title={title} lede={lede} />
        {children}
      </Container>
    </section>
  );
}
