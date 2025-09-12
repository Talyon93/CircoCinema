
// charts/Histogram.tsx
import React from "react";
export function Histogram({ values }:{ values:number[] }){
  const buckets = Array.from({ length: 10 }, (_, i) => i + 1);
  const counts = buckets.map((b) => values.filter((v) => Math.round(v) === b).length);
  const max = Math.max(1, ...counts);
  function colorForBucket(b: number) {
    if (b <= 3) return { bar: "from-rose-500 to-rose-400", dot: "bg-rose-500" };
    if (b <= 6) return { bar: "from-amber-400 to-yellow-300", dot: "bg-amber-400" };
    return { bar: "from-emerald-500 to-green-400", dot: "bg-emerald-500" };
  }
  const H = 90; const barMaxH = 68; const gridY = [0.5];
  return (
    <div className="relative">
      <div className="absolute inset-x-0 top-0 h-[90px]">
        {gridY.map((g, idx) => (
          <div key={idx} className="absolute inset-x-0 border-t border-dashed border-zinc-700/40" style={{ top: `${(1 - g) * H}px` }} />
        ))}
      </div>
      <div className="relative grid grid-cols-10 items-end gap-6">
        {counts.map((c, i) => {
          const { bar, dot } = colorForBucket(i + 1);
          const h = (c / max) * barMaxH + (c > 0 ? 6 : 2);
          return (
            <div key={i} className="flex flex-col items-center">
              <div className={`w-10 rounded-lg bg-gradient-to-t shadow-sm ${bar}`} style={{ height: `${h}px` }} title={`${c} vote${c !== 1 ? "s" : ""} on ${i + 1}`} aria-label={`${c} votes on ${i + 1}`} />
              <div className="mt-1 flex items-center gap-1 text-xs tabular-nums">
                <span className={`inline-block h-2 w-2 rounded-full ${dot}`} />
                <span className="font-semibold text-zinc-100">{c}</span>
              </div>
              <span className="text-[10px] text-zinc-400">{i + 1}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex items-center gap-4 text-[11px] text-zinc-400">
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-500" /> 1–3</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-400" /> 4–6</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> 7–10</span>
      </div>
    </div>
  );
}
