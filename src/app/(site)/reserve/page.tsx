import type { Metadata } from "next";
import { Container, SectionHeading } from "@/components/site/section";
import { BookingFlow } from "@/components/reserve/booking-flow";
import { getAreas } from "@/lib/data";
import { getI18n } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.reserve.title, description: t.reserve.lede };
}

export default async function ReservePage({ searchParams }: { searchParams: Promise<{ area?: string }> }) {
  const [{ t }, areas, params] = await Promise.all([getI18n(), getAreas(), searchParams]);

  return (
    <Container className="py-14 lg:py-20">
      <SectionHeading as="h1" eyebrow={t.reserve.eyebrow} title={t.reserve.title} lede={t.reserve.lede} />
      <div className="mt-12">
        <BookingFlow areas={areas} initialArea={params.area} />
      </div>
    </Container>
  );
}
