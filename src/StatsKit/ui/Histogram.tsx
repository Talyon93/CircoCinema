
import React from "react";
export function Histogram({ values }: { values: number[] }) {
  const buckets = Array.from({ length: 10 }, (_, i) => i + 1);
  const counts = buckets.map((b) => values.filter((v) => Math.round(v) === b).length);
  const max = Math.max(1, ...counts);
  function colorForBucket(b: number) {
    if (b <= 3) return { bar: "from-rose-500 to-rose-400", dot: "bg-rose-500" };
    if (b <= 6) return { bar: "from-amber-400 to-yellow-300", dot: "bg-amber-400" };
    return { bar: "from-emerald-500 to-green-400", dot: "bg-emerald-500" };
  }
  return (
    <div className="relative">
      <div className="relative grid grid-cols-10 items-end gap-6">
        {counts.map((c, i) => {
          const { bar, dot } = colorForBucket(i + 1);
          const h = (c / max) * 68 + (c > 0 ? 6 : 2);
          return (
            <div key={i} className="flex flex-col items-center">
              <div className={`w-10 rounded-lg bg-gradient-to-t shadow-sm ${bar}`} style={{ height: `${h}px` }} />
              <div className="mt-1 flex items-center gap-1 text-xs tabular-nums">
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
}
