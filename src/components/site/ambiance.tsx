"use client";

import { useEffect, useState } from "react";
import { Moon, Sun, SunMoon } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

type Mode = "auto" | "day" | "evening";
const KEY = "pw-ambiance";

/** Runs before paint (inlined in <head>) so there's no flash of the wrong mood. */
export const ambianceScript = `(function(){try{var d=document.documentElement;if(location.pathname.indexOf('/admin')===0){d.dataset.ambiance='day';return;}var m=localStorage.getItem('${KEY}')||'auto';var h=new Date().getHours();d.dataset.ambiance=m==='auto'?((h>=18||h<6)?'evening':'day'):m;d.dataset.ambianceMode=m;}catch(e){}})();`;

function resolve(mode: Mode): "day" | "evening" {
  if (mode !== "auto") return mode;
  const h = new Date().getHours();
  return h >= 18 || h < 6 ? "evening" : "day";
}

function readMode(): Mode {
  try {
    const v = localStorage.getItem(KEY);
    return v === "day" || v === "evening" ? v : "auto";
  } catch {
    return "auto";
  }
}

function apply(mode: Mode) {
  const el = document.documentElement;
  el.dataset.ambiance = resolve(mode);
  el.dataset.ambianceMode = mode;
}

/** Keeps "auto" mode in sync with the clock while the page stays open. */
export function AmbianceController() {
  useEffect(() => {
    apply(readMode());
    const id = window.setInterval(() => {
      const mode = readMode();
      if (mode === "auto") apply(mode);
    }, 60_000);
    return () => window.clearInterval(id);
  }, []);
  return null;
}

/** Admin screens always use the high-contrast day palette. */
export function ForceDayMode() {
  useEffect(() => {
    document.documentElement.dataset.ambiance = "day";
    return () => apply(readMode());
  }, []);
  return null;
}

export function AmbianceToggle({ className }: { className?: string }) {
  const { t } = useI18n();
  const [mode, setMode] = useState<Mode>("auto");

  useEffect(() => setMode(readMode()), []);

  const next: Record<Mode, Mode> = { auto: "day", day: "evening", evening: "auto" };
  const labels: Record<Mode, string> = {
    auto: t.common.ambianceAuto,
    day: t.common.ambianceDay,
    evening: t.common.ambianceEvening,
  };
  const Icon = mode === "auto" ? SunMoon : mode === "day" ? Sun : Moon;

  return (
    <button
      type="button"
      onClick={() => {
        const m = next[mode];
        try {
          localStorage.setItem(KEY, m);
        } catch {}
        setMode(m);
        apply(m);
      }}
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-full border border-line px-3 text-xs font-semibold text-ink-muted transition-colors hover:border-ink/40 hover:text-ink",
        className,
      )}
      aria-label={`${t.common.ambiance}: ${labels[mode]}`}
      title={`${t.common.ambiance}: ${labels[mode]}`}
    >
      <Icon className="size-4" aria-hidden />
      <span>{labels[mode]}</span>
    </button>
  );
}
