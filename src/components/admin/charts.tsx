import { cn } from "@/lib/utils";

interface Datum {
  key: string;
  label: string;
  value: number;
  detail?: string;
}

function niceMax(max: number) {
  if (max <= 0) return 4;
  const pow = 10 ** Math.floor(Math.log10(max));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => max / s <= 4) ?? pow * 10;
  return Math.ceil(max / step) * step;
}

function TableView({ data, unit }: { data: Datum[]; unit?: string }) {
  return (
    <details className="mt-4 text-sm">
      <summary className="cursor-pointer text-xs text-ink-muted hover:text-ink">View as table</summary>
      <table className="mt-2 w-full text-left">
        <thead>
          <tr className="border-b border-line text-xs text-ink-muted">
            <th className="py-1.5 font-medium">Label</th>
            <th className="py-1.5 text-right font-medium">{unit ?? "Value"}</th>
            {data.some((d) => d.detail) ? <th className="py-1.5 text-right font-medium">Detail</th> : null}
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.key} className="border-b border-line/60">
              <td className="py-1.5">{d.label}</td>
              <td className="py-1.5 text-right tabular-nums">{d.value}</td>
              {data.some((x) => x.detail) ? <td className="py-1.5 text-right text-ink-muted">{d.detail}</td> : null}
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

/** Single-series vertical bars: one hue, rounded data-end, 2px gaps, hover tooltip, table fallback. */
export function BarChart({ data, unit, className }: { data: Datum[]; unit?: string; className?: string }) {
  if (data.length === 0 || data.every((d) => d.value === 0)) {
    return <p className={cn("rounded-sm border border-dashed border-line p-10 text-center text-sm text-ink-muted", className)}>No data yet for this range.</p>;
  }
  const max = niceMax(Math.max(...data.map((d) => d.value)));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(max * f));
  const labelEvery = Math.ceil(data.length / 12);

  return (
    <figure className={className}>
      <div className="flex gap-2">
        <div className="relative h-56 w-8 shrink-0 text-right text-[0.68rem] text-ink-muted tabular-nums" aria-hidden>
          {ticks.map((t) => (
            <span key={t} className="absolute right-0" style={{ bottom: `${(t / max) * 100}%`, transform: "translateY(50%)" }}>
              {t}
            </span>
          ))}
        </div>
        <div className="relative h-56 flex-1">
          {ticks.map((t) => (
            <div key={t} className="absolute inset-x-0 border-t border-line/70" style={{ bottom: `${(t / max) * 100}%` }} aria-hidden />
          ))}
          <div className="absolute inset-0 flex items-end gap-[2px]" role="list">
            {data.map((d) => (
              <div key={d.key} role="listitem" className="group relative flex h-full flex-1 items-end justify-center" aria-label={`${d.label}: ${d.value} ${unit ?? ""}`}>
                <div
                  className="w-full max-w-10 rounded-t-[4px] bg-forest-600 transition-colors group-hover:bg-forest-700"
                  style={{ height: `${(d.value / max) * 100}%`, minHeight: d.value > 0 ? 2 : 0 }}
                />
                <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 rounded-sm border border-line bg-surface px-2.5 py-1.5 text-xs whitespace-nowrap text-ink shadow-md group-hover:block">
                  <span className="font-semibold">{d.label}</span>
                  <span className="block tabular-nums">
                    {d.value} {unit}
                  </span>
                  {d.detail ? <span className="block text-ink-muted">{d.detail}</span> : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-2 ml-10 flex gap-[2px] text-[0.68rem] text-ink-muted" aria-hidden>
        {data.map((d, i) => (
          <span key={d.key} className="flex-1 truncate text-center">
            {i % labelEvery === 0 ? d.label : ""}
          </span>
        ))}
      </div>
      <TableView data={data} unit={unit} />
    </figure>
  );
}

/** Ranked horizontal bars with direct value labels (few rows, so every row is labelled). */
export function HBarList({ data, className }: { data: Datum[]; className?: string }) {
  if (data.length === 0) {
    return <p className={cn("rounded-sm border border-dashed border-line p-10 text-center text-sm text-ink-muted", className)}>No pre-orders yet for this range.</p>;
  }
  const max = Math.max(...data.map((d) => d.value));
  return (
    <figure className={className}>
      <ul className="space-y-3">
        {data.map((d) => (
          <li key={d.key} className="text-sm">
            <div className="flex justify-between gap-3">
              <span className="truncate text-ink">{d.label}</span>
              <span className="shrink-0 text-ink-muted tabular-nums">
                <span className="font-semibold text-ink">{d.value}</span>
                {d.detail ? ` · ${d.detail}` : ""}
              </span>
            </div>
            <div className="mt-1.5 h-2 rounded-full bg-surface-2">
              <div className="h-2 rounded-full bg-forest-600" style={{ width: `${(d.value / max) * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>
      <TableView data={data} unit="Quantity" />
    </figure>
  );
}
