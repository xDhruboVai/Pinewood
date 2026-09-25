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
    <div role="group" aria-label={t.common.language} className={cn("flex items-center gap-2 text-[0.8rem]", pending && "opacity-60", className)}>
      {(["en", "bn"] as const).map((l, i) => (
        <span key={l} className="flex items-center gap-2">
          {i > 0 ? <span className="opacity-30">/</span> : null}
          <button
            type="button"
            onClick={() => change(l)}
            aria-pressed={locale === l}
            lang={l}
            className={cn("font-semibold transition-colors", locale === l ? "text-mustard-400" : "opacity-70 hover:opacity-100")}
          >
            {l === "en" ? "EN" : "বাংলা"}
          </button>
        </span>
      ))}
    </div>
  );
}
