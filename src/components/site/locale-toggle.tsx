"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setLocale } from "@/actions/locale";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

export function LocaleToggle({ className }: { className?: string }) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const change = (next: "en" | "bn") => {
    if (next === locale) return;
    startTransition(async () => {
      await setLocale(next);
      router.refresh();
    });
  };

  return (
    <div
      role="group"
      aria-label={t.common.language}
      className={cn("inline-flex h-9 items-center rounded-full border border-line p-0.5 text-xs font-semibold", pending && "opacity-60", className)}
    >
      {(["en", "bn"] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => change(l)}
          aria-pressed={locale === l}
          lang={l}
          className={cn(
            "h-full rounded-full px-3 transition-colors",
            locale === l ? "bg-primary text-primary-ink" : "text-ink-muted hover:text-ink",
          )}
        >
          {l === "en" ? "EN" : "বাং"}
        </button>
      ))}
    </div>
  );
}
