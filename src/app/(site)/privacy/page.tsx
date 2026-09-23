import type { Metadata } from "next";
import { Container, SectionHeading } from "@/components/site/section";
import { getI18n } from "@/lib/i18n";
import { SITE } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.privacy.title };
}

export default async function PrivacyPage() {
  const { t } = await getI18n();
  return (
    <Container className="py-16 lg:py-24">
      <SectionHeading as="h1" title={t.privacy.title} lede={t.privacy.updated} />
      <div className="mt-10 max-w-2xl space-y-5 text-base leading-relaxed text-ink">
        {t.privacy.body.map((p) => (
          <p key={p}>{p}</p>
        ))}
        <p className="text-ink-muted">
          {SITE.phones.map((p) => p.display).join(" · ")}
        </p>
      </div>
    </Container>
  );
}
