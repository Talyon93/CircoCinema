// charts/Histogram.tsx
import React from "react";

export function Histogram({
  values,
  height = 120,
  gap = 8,
  embedded = false, // <-- NEW
}: {
  values: number[];
  height?: number;
  gap?: number;
  embedded?: boolean; // <-- NEW
}) {
  const buckets = Array.from({ length: 10 }, (_, i) => i + 1);
  const counts = buckets.map((b) => values.filter((v) => Math.round(v) === b).length);
  const max = Math.max(1, ...counts);

  const barAreaH = Math.max(72, Math.min(height - 28, height));
  const gridY = [0.5];

  function colors(b: number) {
    if (b <= 3)  return { bar: "from-rose-500/70 to-rose-400/50", dot: "bg-rose-400" };
    if (b <= 6)  return { bar: "from-amber-400/80 to-yellow-300/60", dot: "bg-amber-300" };
    return         { bar: "from-emerald-500/70 to-green-400/50",    dot: "bg-emerald-400" };
  }

  const Inner = (
    <div className="relative" style={{ height }} aria-hidden="true">
      <div className="absolute inset-x-0 top-0">
        {gridY.map((g, idx) => (
          <div
            key={idx}
            className="absolute inset-x-0 border-t border-dashed border-zinc-700/40"
            style={{ top: `${(1 - g) * barAreaH + 10}px` }}
          />
        ))}
      </div>
      <div
        className="relative grid items-end"
        style={{
          gridTemplateColumns: "repeat(10, minmax(0,1fr))",
          columnGap: gap,
          height: barAreaH + 12,
        }}
      >
        {counts.map((c, i) => {
          const { bar, dot } = colors(i + 1);
          const h = (c / max) * (barAreaH - 20) + (c > 0 ? 10 : 4);
          return (
            <div key={i} className="flex flex-col items-center">
              <div
                className={`w-8 rounded-lg bg-gradient-to-t shadow-sm ${bar}`}
                style={{ height: `${h}px` }}
                title={`${c} vote${c !== 1 ? "s" : ""} on ${i + 1}`}
                aria-label={`${c} votes on ${i + 1}`}
              />
              <div className="mt-1 flex items-center gap-1 text-[11px] tabular-nums">
                <span className={`inline-block h-2 w-2 rounded-full ${dot}`} />
                <span className="font-semibold text-zinc-100">{c}</span>
              </div>
              <span className="text-[10px] text-zinc-400">{i + 1}</span>
            </div>
          );
        })}
      </div>
    </div>
  );

  // Se "embedded", non usare il box interno
  if (embedded) return Inner;

  return (
    <div className="rounded-xl bg-white/[0.02] p-3 ring-1 ring-inset ring-zinc-800/60">
      {Inner}
    </div>
  );
}
