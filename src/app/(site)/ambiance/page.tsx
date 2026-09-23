import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Container, PageHero, SectionHeading } from "@/components/site/section";
import { Scene } from "@/components/site/scene";
import { getI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.nav.ambiance, description: t.ambiance.lede };
}

const SPACES = [
  { key: "fireplace", area: "fireplace" },
  { key: "study", area: "study" },
  { key: "rooftop", area: "rooftop" },
] as const;

export default async function AmbiancePage() {
  const { t } = await getI18n();
  const gallery = ["timber", "coffee", "glow", "music"] as const;

  return (
    <>
      <PageHero eyebrow={t.ambiance.eyebrow} title={t.ambiance.title} lede={t.ambiance.lede} />

      {SPACES.map(({ key, area }, i) => {
        const s = t.ambiance[key];
        return (
          <section key={key} id={key} className={cn("scroll-mt-20 border-b border-line", i % 2 === 1 && "bg-surface")}>
            <Container className="grid items-center gap-12 py-20 lg:grid-cols-2 lg:gap-20 lg:py-28">
              <Scene
                name={key}
                title={s.title}
                uid={`amb-${key}`}
                className={cn("aspect-[4/5] rounded-sm border border-line", i % 2 === 1 && "lg:order-2")}
              />
              <div>
                <p className="eyebrow">0{i + 1}</p>
                <div className="hairline mt-4" />
                <h2 className="display mt-5 text-4xl text-ink sm:text-5xl">{s.title}</h2>
                <p className="mt-6 text-lg leading-relaxed text-ink-muted">{s.body}</p>
                <p className="mt-8 text-xs font-semibold tracking-[0.18em] text-ink-muted uppercase">{t.ambiance.goodFor}</p>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {s.goodFor.map((g) => (
                    <li key={g} className="rounded-full border border-line px-3.5 py-1.5 text-sm text-ink">
                      {g}
                    </li>
                  ))}
                </ul>
                <Button asChild className="mt-9">
                  <Link href={`/reserve?area=${area}`}>
                    {t.ambiance.reserveHere}
                    <ArrowRight />
                  </Link>
                </Button>
              </div>
            </Container>
          </section>
        );
      })}

      <section>
        <Container className="py-20 lg:py-28">
          <SectionHeading eyebrow={t.ambiance.galleryEyebrow} title={t.ambiance.galleryTitle} />
          <div className="mt-12 grid grid-cols-2 gap-4 md:grid-cols-4">
            {gallery.map((name, i) => (
              <figure key={name} className={cn(i % 2 === 1 && "md:mt-10")}>
                <Scene
                  name={name}
                  title={t.ambiance.gallery[i]}
                  uid={`gal-${name}`}
                  sizes="(min-width: 768px) 25vw, 50vw"
                  className="aspect-square rounded-sm border border-line"
                />
                <figcaption className="mt-3 text-sm text-ink-muted">{t.ambiance.gallery[i]}</figcaption>
              </figure>
            ))}
          </div>
          <p className="mt-10 text-xs text-ink-muted">{t.ambiance.photoNote}</p>
        </Container>
      </section>
    </>
  );
}
