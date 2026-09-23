"use client";

import { useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/** Re-renders the current server page whenever one of the given tables changes. */
export function LiveRefresh({ tables }: { tables: string[] }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const key = tables.join(",");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const channel = supabase.channel(`live-${key}`);
    for (const table of key.split(",")) {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, () => {
        clearTimeout(timer.current);
        timer.current = setTimeout(() => router.refresh(), 500);
      });
    }
    channel.subscribe();
    return () => {
      clearTimeout(timer.current);
      supabase.removeChannel(channel);
    };
  }, [supabase, key, router]);

  return null;
}
