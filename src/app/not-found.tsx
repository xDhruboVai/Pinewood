import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PineGlyph } from "@/components/site/logo";
import { getI18n } from "@/lib/i18n";

export default async function NotFound() {
  const { t } = await getI18n();
  return (
    <main className="grain flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <PineGlyph className="h-14 text-primary" />
      <h1 className="display mt-8 text-5xl text-ink">{t.notFound.title}</h1>
      <p className="mt-4 text-ink-muted">{t.notFound.body}</p>
      <Button asChild className="mt-8">
        <Link href="/">{t.notFound.cta}</Link>
      </Button>
    </main>
  );
}
