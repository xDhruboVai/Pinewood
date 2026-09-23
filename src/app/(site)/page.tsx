import Link from "next/link";
import { ArrowRight, Music2, Phone, Quote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Container, SectionHeading } from "@/components/site/section";
import { Scene } from "@/components/site/scene";
import { TagBadges } from "@/components/site/tag-badges";
import { getFeaturedItems, getReviews, getSchedule } from "@/lib/data";
import { getI18n, pick } from "@/lib/i18n";
import { formatPrice, formatTime } from "@/lib/format";
import { SITE } from "@/lib/site";

export default async function HomePage() {
  const { locale, t } = await getI18n();
  const [featured, reviews, schedule] = await Promise.all([getFeaturedItems(), getReviews(), getSchedule(1)]);
  const today = schedule[0];

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <Container className="grid items-center gap-12 pt-10 pb-20 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:pt-16 lg:pb-28">
          <div className="animate-rise">
            <p className="eyebrow">{t.home.eyebrow}</p>
            <div className="hairline mt-4" />
            <h1 className="display mt-6 text-[3.4rem] text-ink sm:text-7xl lg:text-[5.6rem]">
              {t.home.titleA}
              <br />
              <em className="font-normal text-secondary italic">{t.home.titleB}</em>
            </h1>
            <p className="mt-7 max-w-lg text-lg leading-relaxed text-ink-muted">{t.home.lede}</p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/reserve">
                  {t.home.ctaReserve}
                  <ArrowRight />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/menu">{t.home.ctaMenu}</Link>
              </Button>
            </div>
            <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-ink-muted">
              <span className="inline-flex items-center gap-2">
                <span className="relative flex size-2">
                  <span className={`absolute inline-flex h-full w-full rounded-full ${today?.opens ? "animate-ping bg-forest-400" : ""} opacity-60`} />
                  <span className={`relative inline-flex size-2 rounded-full ${today?.opens ? "bg-forest-400" : "bg-timber-300"}`} />
                </span>
                {today?.opens && today.closes
                  ? `${t.common.openToday} · ${formatTime(today.opens, locale)} – ${formatTime(today.closes, locale)}`
                  : t.common.closedToday}
              </span>
              <span className="inline-flex items-center gap-2">
                <Music2 className="size-4 text-accent-ink" aria-hidden />
                {t.home.nowPlaying}
              </span>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-md lg:max-w-none">
            <div className="amber-glow absolute inset-8 rounded-t-full" aria-hidden />
            <Scene
              name="hero"
              title={t.home.titleA + " " + t.home.titleB}
              priority
              className="relative aspect-[4/5] rounded-t-[999px] border border-line shadow-[0_40px_80px_-40px_rgba(28,20,15,0.45)]"
            />
          </div>
        </Container>
      </section>

      {/* Philosophy */}
      <section className="border-y border-line bg-surface">
        <Container className="grid gap-14 py-20 lg:grid-cols-[1fr_1.2fr] lg:py-28">
          <SectionHeading eyebrow={t.home.philosophyEyebrow} title={t.home.philosophyTitle} />
          <div>
            <p className="display text-2xl leading-snug text-ink sm:text-[1.75rem]">{t.home.philosophyBody}</p>
            <div className="mt-12 grid gap-8 sm:grid-cols-3">
              {t.home.pillars.map((p, i) => (
                <div key={p.title} className="border-t border-line pt-5">
                  <span className="font-display text-sm text-accent-ink">0{i + 1}</span>
                  <h3 className="mt-2 font-display text-xl text-ink">{p.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-muted">{p.body}</p>
                </div>
              ))}
            </div>
          </div>
        </Container>
      </section>

      {/* Spaces */}
      <section>
        <Container className="py-20 lg:py-28">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <SectionHeading eyebrow={t.home.spacesEyebrow} title={t.home.spacesTitle} />
            <Link href="/ambiance" className="inline-flex items-center gap-2 text-sm font-semibold text-ink hover:text-accent-ink">
              {t.home.spacesCta} <ArrowRight className="size-4" />
            </Link>
          </div>
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {(["fireplace", "study", "rooftop"] as const).map((key, i) => (
              <Link
                key={key}
                href={`/ambiance#${key}`}
                className={`group block ${i === 1 ? "md:mt-12" : ""}`}
              >
                <Scene
                  name={key}
                  title={t.home.spaces[key].title}
                  uid={`home-${key}`}
                  sizes="(min-width: 768px) 33vw, 100vw"
                  className="aspect-[4/5] rounded-sm border border-line transition-transform duration-700 ease-[var(--ease-soft)] group-hover:-translate-y-1.5"
                />
                <h3 className="mt-5 font-display text-2xl text-ink">{t.home.spaces[key].title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-muted">{t.home.spaces[key].body}</p>
              </Link>
            ))}
          </div>
        </Container>
      </section>

      {/* Signature menu */}
      {featured.length > 0 ? (
        <section className="border-y border-line bg-surface">
          <Container className="py-20 lg:py-28">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <SectionHeading eyebrow={t.home.signatureEyebrow} title={t.home.signatureTitle} />
              <Link href="/menu" className="inline-flex items-center gap-2 text-sm font-semibold text-ink hover:text-accent-ink">
                {t.home.signatureCta} <ArrowRight className="size-4" />
              </Link>
            </div>
            <ul className="mt-14 grid gap-x-14 md:grid-cols-2">
              {featured.slice(0, 6).map((item) => (
                <li key={item.id} className="border-b border-line py-6">
                  <div className="flex items-baseline gap-4">
                    <h3 className="font-display text-2xl text-ink">{pick(item, "name", locale)}</h3>
                    <span className="h-px flex-1 translate-y-[-0.3rem] border-b border-dotted border-ink/25" aria-hidden />
                    <span className="font-display text-xl text-ink">{formatPrice(item.price, locale)}</span>
                  </div>
                  {pick(item, "description", locale) ? (
                    <p className="mt-1.5 text-sm text-ink-muted">{pick(item, "description", locale)}</p>
                  ) : null}
                  <TagBadges tags={item.tags} t={t} className="mt-3 flex flex-wrap gap-1.5" />
                </li>
              ))}
            </ul>
          </Container>
        </section>
      ) : null}

      {/* Reserve & pre-order */}
      <section className="bg-forest-600 text-cream-100 evening:bg-forest-900">
        <Container className="grid gap-14 py-20 lg:grid-cols-[1fr_1.3fr] lg:py-28">
          <div>
            <p className="eyebrow !text-gold-300">{t.home.howEyebrow}</p>
            <div className="hairline mt-4" />
            <h2 className="display mt-5 text-4xl text-cream-50 sm:text-5xl">{t.home.howTitle}</h2>
            <Button asChild size="lg" className="mt-9 bg-gold-400 text-forest-900 hover:bg-gold-300">
              <Link href="/reserve">
                {t.nav.reserve}
                <ArrowRight />
              </Link>
            </Button>
          </div>
          <ol className="grid gap-px overflow-hidden rounded-sm border border-cream-100/15 bg-cream-100/15 sm:grid-cols-3">
            {t.home.howSteps.map((s, i) => (
              <li key={s.title} className="bg-forest-600 p-7 evening:bg-forest-900">
                <span className="font-display text-4xl text-gold-300">{i + 1}</span>
                <h3 className="mt-6 font-display text-xl text-cream-50">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-cream-100/75">{s.body}</p>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      {/* Reviews */}
      {reviews.length > 0 ? (
        <section>
          <Container className="py-20 lg:py-28">
            <SectionHeading eyebrow={t.home.reviewsEyebrow} title={t.home.reviewsTitle} align="center" />
            <div className="mt-14 grid gap-6 md:grid-cols-3">
              {reviews.slice(0, 3).map((r) => (
                <figure key={r.id} className="flex flex-col rounded-sm border border-line bg-surface p-8">
                  <Quote className="size-6 text-accent" aria-hidden />
                  <blockquote className="mt-5 flex-1 font-display text-xl leading-snug text-ink">
                    {locale === "bn" && r.body_bn ? r.body_bn : r.body_en}
                  </blockquote>
                  <figcaption className="mt-6 border-t border-line pt-4 text-sm">
                    <span className="font-semibold text-ink">{r.author_name}</span>
                    {r.author_context ? <span className="text-ink-muted"> · {r.author_context}</span> : null}
                    <span className="mt-1 block text-accent-ink" aria-label={`${r.rating} / 5`}>
                      {"★".repeat(r.rating)}
                    </span>
                  </figcaption>
                </figure>
              ))}
            </div>
          </Container>
        </section>
      ) : null}

      {/* Visit */}
      <section className="border-t border-line bg-surface-2">
        <Container className="flex flex-col items-start justify-between gap-8 py-16 md:flex-row md:items-center">
          <div>
            <h2 className="display text-3xl text-ink sm:text-4xl">{t.home.visitTitle}</h2>
            <p className="mt-3 text-ink-muted">{SITE.address[locale]}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="outline">
              <a href={`tel:${SITE.phones[0].tel}`}>
                <Phone />
                {SITE.phones[0].display}
              </a>
            </Button>
            <Button asChild>
              <Link href="/visit">{t.home.visitCta}</Link>
            </Button>
          </div>
        </Container>
      </section>
    </>
  );
}
