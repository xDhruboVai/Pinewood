"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  createBlockout,
  createHoursOverride,
  deleteBlockout,
  deleteHoursOverride,
  toggleArea,
  toggleTable,
  updateOpeningHours,
} from "@/actions/admin";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import { formatDate, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ActionResult, Area, Blockout, DiningTable, HoursOverride, OpeningHours } from "@/lib/types";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function useAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<ActionResult>, success: string, after?: () => void) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) toast.error(res.error);
      else {
        toast.success(success);
        after?.();
        router.refresh();
      }
    });
  return { pending, run };
}

function Card({ title, description, children, className }: { title: string; description?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={className}>
      <h2 className="display text-3xl text-ink">{title}</h2>
      {description ? <p className="mt-1 max-w-lg text-sm leading-relaxed text-ink-muted">{description}</p> : null}
      <div className="mt-6">{children}</div>
    </section>
  );
}

export function AvailabilityManager({
  isManager,
  today,
  areas,
  tables,
  blockouts,
  overrides,
  hours,
}: {
  isManager: boolean;
  today: string;
  areas: Area[];
  tables: DiningTable[];
  blockouts: Blockout[];
  overrides: HoursOverride[];
  hours: OpeningHours[];
}) {
  const { pending, run } = useAction();
  const [block, setBlock] = useState({ date: today, from: "18:00", to: "20:00", areaId: "", seats: 0, reason: "Walk-ins" });
  const [override, setOverride] = useState({ label: "", startsOn: today, endsOn: today, isClosed: false, opensAt: "15:00", closesAt: "23:00" });
  const areaName = (id: string | null) => (id ? (areas.find((a) => a.id === id)?.name_en ?? "Area") : "Entire restaurant");
  const capacity = (areaId: string) => tables.filter((t) => t.area_id === areaId && t.is_active).reduce((s, t) => s + t.seats, 0);

  return (
    <div className="grid gap-x-16 gap-y-16 xl:grid-cols-2">
      <Card title="Hold seats" description="Keep seats out of online booking, for walk-ins or a private event.">
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => createBlockout(block), "Seats held. Online booking is updated.");
          }}
        >
          <Field label="Date" htmlFor="b-date">
            <Input id="b-date" type="date" value={block.date} min={today} onChange={(e) => setBlock({ ...block, date: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="From" htmlFor="b-from">
              <Input id="b-from" className="px-2.5 text-sm" type="time" step={1800} value={block.from} onChange={(e) => setBlock({ ...block, from: e.target.value })} />
            </Field>
            <Field label="To" htmlFor="b-to">
              <Input id="b-to" className="px-2.5 text-sm" type="time" step={1800} value={block.to} onChange={(e) => setBlock({ ...block, to: e.target.value })} />
            </Field>
          </div>
          <Field label="Area" htmlFor="b-area">
            <Select id="b-area" value={block.areaId} onChange={(e) => setBlock({ ...block, areaId: e.target.value })}>
              <option value="">Entire restaurant</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name_en} ({capacity(a.id)} seats)
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Seats to hold (0 = whole area)" htmlFor="b-seats">
            <Input
              id="b-seats"
              type="number"
              min={0}
              max={200}
              disabled={!block.areaId}
              value={block.seats}
              onChange={(e) => setBlock({ ...block, seats: Number(e.target.value) })}
            />
          </Field>
          <Field label="Reason" htmlFor="b-reason" className="sm:col-span-2">
            <Input id="b-reason" maxLength={120} value={block.reason} onChange={(e) => setBlock({ ...block, reason: e.target.value })} />
          </Field>
          <Button type="submit" disabled={pending} className="sm:col-span-2 sm:justify-self-start">
            Hold these seats
          </Button>
        </form>

        <ul className="mt-8 space-y-2 text-sm">
          {blockouts.length === 0 ? <li className="text-ink-muted">No seats held.</li> : null}
          {blockouts.map((b) => (
            <li key={b.id} className="flex items-center gap-3 rounded-md bg-surface px-4 py-3">
              <span className="flex-1">
                <span className="font-semibold">{formatDate(b.starts_at)}</span> · {formatTime(b.starts_at)}–{formatTime(b.ends_at)} ·{" "}
                {areaName(b.area_id)}
                {b.seats ? ` · ${b.seats} seats` : ""}
                <span className="block text-xs text-ink-muted">{b.reason}</span>
              </span>
              <button type="button" className="text-xs text-ink-muted hover:text-danger" disabled={pending} onClick={() => run(() => deleteBlockout(b.id), "Seats released")}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      </Card>

      {isManager ? (
        <Card title="Seating areas and tables" description="Online seats are the total of the tables that are on. Close an area to stop online bookings there.">
          <div className="space-y-5">
            {areas.map((a) => (
              <div key={a.id} className="rounded-md bg-surface p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-ink">{a.name_en}</p>
                    <p className="text-xs text-ink-muted">{capacity(a.id)} seats online</p>
                  </div>
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="accent-[var(--primary)]"
                      checked={a.is_active}
                      disabled={pending}
                      onChange={(e) => run(() => toggleArea(a.id, e.target.checked), e.target.checked ? "Area opened" : "Area closed")}
                    />
                    Open
                  </label>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {tables
                    .filter((t) => t.area_id === a.id)
                    .map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        disabled={pending}
                        aria-pressed={t.is_active}
                        onClick={() => run(() => toggleTable(t.id, !t.is_active), t.is_active ? `${t.label} taken offline` : `${t.label} back online`)}
                        className={cn(
                          "rounded-md px-2.5 py-1 text-xs transition-colors",
                          t.is_active ? "bg-pine-700 text-cream-50 hover:bg-pine-800" : "bg-canvas text-ink-muted line-through hover:text-ink",
                        )}
                      >
                        {t.label} · {t.seats}
                      </button>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {isManager ? (
        <Card title="Weekly hours" description="Times are Dhaka time. A closing time earlier than opening means closing after midnight.">
          <ul className="space-y-3">
            {hours.map((h) => (
              <HoursRow key={h.weekday} h={h} pending={pending} run={run} />
            ))}
          </ul>
        </Card>
      ) : null}

      {isManager ? (
        <Card title="Holiday and Ramadan hours" description="These replace the weekly hours on the chosen dates. If two overlap, the newest one counts.">
          <form
            className="grid gap-3 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              run(() => createHoursOverride(override), "Override saved", () => setOverride({ ...override, label: "" }));
            }}
          >
            <Field label="Label" htmlFor="o-label" className="sm:col-span-2">
              <Input id="o-label" placeholder="Ramadan hours, Eid-ul-Fitr…" value={override.label} onChange={(e) => setOverride({ ...override, label: e.target.value })} />
            </Field>
            <Field label="From date" htmlFor="o-start">
              <Input id="o-start" type="date" value={override.startsOn} onChange={(e) => setOverride({ ...override, startsOn: e.target.value })} />
            </Field>
            <Field label="To date" htmlFor="o-end">
              <Input id="o-end" type="date" value={override.endsOn} onChange={(e) => setOverride({ ...override, endsOn: e.target.value })} />
            </Field>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input type="checkbox" className="accent-[var(--primary)]" checked={override.isClosed} onChange={(e) => setOverride({ ...override, isClosed: e.target.checked })} />
              Closed all day
            </label>
            {!override.isClosed ? (
              <>
                <Field label="Opens" htmlFor="o-open">
                  <Input id="o-open" type="time" value={override.opensAt} onChange={(e) => setOverride({ ...override, opensAt: e.target.value })} />
                </Field>
                <Field label="Closes" htmlFor="o-close">
                  <Input id="o-close" type="time" value={override.closesAt} onChange={(e) => setOverride({ ...override, closesAt: e.target.value })} />
                </Field>
              </>
            ) : null}
            <Button type="submit" disabled={pending} className="sm:col-span-2 sm:justify-self-start">
              Save these hours
            </Button>
          </form>
          <ul className="mt-8 space-y-2 text-sm">
            {overrides.length === 0 ? <li className="text-ink-muted">No special hours coming up.</li> : null}
            {overrides.map((o) => (
              <li key={o.id} className="flex items-center gap-3 rounded-md bg-surface px-4 py-3">
                <span className="flex-1">
                  <span className="font-semibold">{o.label}</span> · {o.starts_on}
                  {o.ends_on !== o.starts_on ? ` → ${o.ends_on}` : ""}
                  <span className="block text-xs text-ink-muted">
                    {o.is_closed ? "Closed" : `${o.opens_at?.slice(0, 5)} – ${o.closes_at?.slice(0, 5)}`}
                  </span>
                </span>
                <button type="button" className="text-xs text-ink-muted hover:text-danger" disabled={pending} onClick={() => run(() => deleteHoursOverride(o.id), "Special hours removed")}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}

function HoursRow({
  h,
  pending,
  run,
}: {
  h: OpeningHours;
  pending: boolean;
  run: (fn: () => Promise<ActionResult>, success: string) => void;
}) {
  const [opens, setOpens] = useState(h.opens_at?.slice(0, 5) ?? "10:00");
  const [closes, setCloses] = useState(h.closes_at?.slice(0, 5) ?? "22:00");
  const [closed, setClosed] = useState(h.is_closed);
  const dirty = opens !== (h.opens_at?.slice(0, 5) ?? "10:00") || closes !== (h.closes_at?.slice(0, 5) ?? "22:00") || closed !== h.is_closed;

  return (
    <li className="flex flex-wrap items-center gap-3 text-sm">
      <span className="w-24 font-semibold">{WEEKDAYS[h.weekday]}</span>
      <Input type="time" value={opens} disabled={closed} onChange={(e) => setOpens(e.target.value)} className="h-9 w-32 px-2.5 text-sm" aria-label={`${WEEKDAYS[h.weekday]} opens`} />
      <span className="text-ink-muted">–</span>
      <Input type="time" value={closes} disabled={closed} onChange={(e) => setCloses(e.target.value)} className="h-9 w-32 px-2.5 text-sm" aria-label={`${WEEKDAYS[h.weekday]} closes`} />
      <label className="flex items-center gap-1.5 text-ink-muted">
        <input type="checkbox" className="accent-[var(--primary)]" checked={closed} onChange={(e) => setClosed(e.target.checked)} /> Closed
      </label>
      {dirty ? (
        <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => updateOpeningHours(h.weekday, opens, closes, closed), `${WEEKDAYS[h.weekday]} updated`)}>
          Save
        </Button>
      ) : null}
    </li>
  );
}
