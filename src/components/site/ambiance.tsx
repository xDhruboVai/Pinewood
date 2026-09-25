"use client";

import { useEffect, useState } from "react";
import { Moon, Sun, SunMoon } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

import { AMBIANCE_KEY as KEY, DEFAULT_AMBIANCE as DEFAULT_MODE, type AmbianceMode as Mode } from "@/lib/ambiance";

function resolve(mode: Mode): "day" | "evening" {
  if (mode !== "auto") return mode;
  const h = new Date().getHours();
  return h >= 18 || h < 6 ? "evening" : "day";
}

function readMode(): Mode {
  try {
    const v = localStorage.getItem(KEY);
    return v === "auto" || v === "day" || v === "evening" ? v : DEFAULT_MODE;
  } catch {
    return DEFAULT_MODE;
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
  const [mode, setMode] = useState<Mode>(DEFAULT_MODE);

  useEffect(() => setMode(readMode()), []);

  const next: Record<Mode, Mode> = { day: "evening", evening: "auto", auto: "day" };
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
      className={cn("inline-flex items-center gap-1.5 transition-colors hover:text-cream-100", className)}
      aria-label={`${t.common.ambiance}: ${labels[mode]}`}
    >
      <Icon className="size-3.5" aria-hidden />
      <span>
        {t.common.ambiance}: {labels[mode]}
      </span>
    </button>
  );
}
