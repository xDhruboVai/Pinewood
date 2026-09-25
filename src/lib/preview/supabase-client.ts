// Frontend preview only: stands in for src/lib/supabase/client.ts when the dev server runs with
// PW_PREVIEW=1 (see next.config.ts). Answers the booking page's schedule and availability, and the
// admin boards' queries (via ./fake-db), with sample data. Nothing is saved.
import type { AvailabilitySlot } from "@/lib/types";
import sample from "./sample-data.json";
import { getSchedule } from "./data";
import { fakeAuth, fakeFrom, fakeRpc } from "./fake-db";

async function availability(date: string, party: number, duration: number): Promise<AvailabilitySlot[]> {
  const day = (await getSchedule(31)).find((d) => d.day === date);
  if (!day?.opens || !day.closes) return [];
  const open = new Date(day.opens).getTime();
  const lastStart = new Date(day.closes).getTime() - duration * 60_000;
  const slots: AvailabilitySlot[] = [];
  for (const [a, area] of sample.areas.entries()) {
    for (let t = open, n = 0; t <= lastStart; t += 30 * 60_000, n++) {
      const remaining = [16, 12, 8, 4, 0, 10, 2, 14][(n + a * 3) % 8];
      slots.push({
        slot_start: new Date(t).toISOString(),
        slot_end: new Date(t + duration * 60_000).toISOString(),
        area_id: area.id,
        capacity: 16,
        remaining,
        available: remaining >= party,
        waitlist_eligible: remaining < party,
      });
    }
  }
  return slots;
}

export function createClient() {
  const channel = { on: () => channel, subscribe: () => channel };
  return {
    async rpc(name: string, args: Record<string, unknown>) {
      if (name === "get_schedule") return { data: await getSchedule(Number(args.p_days)), error: null };
      if (name === "get_availability") {
        return { data: await availability(String(args.p_date), Number(args.p_party_size), Number(args.p_duration_minutes)), error: null };
      }
      return fakeRpc(name, args);
    },
    from: (table: string) => fakeFrom(table),
    auth: fakeAuth,
    channel: () => channel,
    removeChannel: () => {},
  };
}
