"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { PineGlyph } from "@/components/site/logo";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

/**
 * What visitors see when a page fails to load (used by app/error.tsx and app/(site)/error.tsx), in the
 * style of the 404 page. It shows no error details: in production Next.js replaces server error
 * messages with a digest, and the full error is in the server log under that same digest.
 */
export function ErrorScreen({ error, reset, standalone }: { error: Error & { digest?: string }; reset: () => void; standalone?: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const [retrying, startRetry] = useTransition();

  useEffect(() => {
    // The digest lets staff match this to the server log; no message or stack is shown to visitors.
    console.error("Page failed to load", error.digest ? `(digest ${error.digest})` : error);
  }, [error]);

  return (
    <div role="alert" className={cn("flex flex-col items-center justify-center px-6 py-24 text-center", standalone && "grain min-h-dvh")}>
      <PineGlyph className="h-14 text-primary" />
      <h1 className="display mt-8 text-4xl text-ink sm:text-5xl">{t.errorPage.title}</h1>
      <p className="mt-4 max-w-md text-ink-muted">{t.errorPage.body}</p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
        <Button
          disabled={retrying}
          onClick={() =>
            // Server-rendered pages need fresh data from the server, not just a client re-render.
            startRetry(() => {
              router.refresh();
              reset();
            })
          }
        >
          {t.errorPage.retry}
        </Button>
        <Button asChild variant="outline">
          <Link href="/">{t.errorPage.home}</Link>
        </Button>
      </div>
    </div>
  );
}
