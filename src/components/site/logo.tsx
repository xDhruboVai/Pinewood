import Image from "next/image";
import { cn } from "@/lib/utils";

// The Pinewood Cafe + Kitchen oval badge (2026 logo), cut out of the supplied artwork into transparent PNGs:
// green (#085b47) for light backgrounds and cream for the green ones. See public/images/logo-*.png.
const BADGE = { width: 975, height: 685 };
const TREE = { width: 103, height: 156 };
const ALT = "Pinewood Cafe + Kitchen, since 2016";

/**
 * Picks the file for a tone. "light" = cream artwork for green backgrounds. "dark" = green artwork,
 * switching to cream in the evening theme, where the page background turns green.
 */
function Art({
  file,
  size,
  tone,
  alt,
  className,
  priority,
}: {
  file: "badge" | "tree";
  size: { width: number; height: number };
  tone: "light" | "dark";
  alt: string;
  className?: string;
  priority?: boolean;
}) {
  if (tone === "light") {
    return <Image src={`/images/logo-${file}-cream.png`} alt={alt} {...size} priority={priority} className={className} />;
  }
  return (
    <>
      <Image src={`/images/logo-${file}-green.png`} alt={alt} {...size} priority={priority} className={cn(className, "evening:hidden")} />
      <Image src={`/images/logo-${file}-cream.png`} alt={alt} {...size} className={cn(className, "hidden evening:block")} />
    </>
  );
}

/** The tree from the logo. */
export function PineGlyph({ className, tone = "dark" }: { className?: string; tone?: "light" | "dark" }) {
  return <Art file="tree" size={TREE} tone={tone} alt="" className={cn("h-7 w-auto", className)} />;
}

/** The oval logo badge, with an optional label beside it (used on the staff pages). */
export function Logo({
  className,
  subline,
  tone = "dark",
  priority,
}: {
  className?: string;
  subline?: string;
  tone?: "light" | "dark";
  priority?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-3", className)}>
      <Art file="badge" size={BADGE} tone={tone} alt={ALT} priority={priority} className="h-14 w-auto" />
      {subline ? (
        <span className={cn("label border-l pl-3 text-[0.65rem]", tone === "light" ? "border-cream-100/30 text-cream-100/70" : "border-line text-ink-muted")}>
          {subline}
        </span>
      ) : null}
    </span>
  );
}

/** The badge at a larger size, for the footer. */
export function LogoStacked({ tone = "light", className }: { tone?: "light" | "dark"; className?: string }) {
  return <Art file="badge" size={BADGE} tone={tone} alt={ALT} className={cn("h-28 w-auto", className)} />;
}
