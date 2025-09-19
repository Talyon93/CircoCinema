import React from "react";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";

function clamp(n: number, lo = 1, hi = 10) { return Math.max(lo, Math.min(hi, n)); }
function pctFrom10(n: number) { return ((clamp(n) - 1) / 9) * 100; }
function fmt(n?: number | null) {
  return typeof n === "number" && Number.isFinite(n) ? n.toFixed(2) : "–";
}

export function CompareRatingsCard({
  title = "Our Avg vs IMDb",
  ourAvg = null,
  imdbAvg = null,
  votes,
}: {
  title?: string;
  ourAvg?: number | null;
  imdbAvg?: number | null;
  votes?: number;
}) {
  const hasOur = typeof ourAvg === "number" && Number.isFinite(ourAvg);
  const hasImdb = typeof imdbAvg === "number" && Number.isFinite(imdbAvg);
  const delta = hasOur && hasImdb ? Number((ourAvg! - imdbAvg!).toFixed(2)) : null;
  const deltaPositive = (delta ?? 0) > 0;

  return (
    <div className="rounded-2xl border border-zinc-800/70 bg-zinc-900/30 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-semibold text-zinc-200">{title}</div>
        {delta !== null && (
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${
              deltaPositive
                ? "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30"
                : "bg-rose-500/10 text-rose-300 ring-rose-500/30"
            }`}
            title="Differenza (Our Avg − IMDb)"
          >
            {deltaPositive ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
            {delta > 0 ? "+" : ""}{delta.toFixed(2)}
          </span>
        )}
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3 text-center">
          <div className="mb-1 text-[11px] font-semibold tracking-wide text-zinc-400">OUR AVG</div>
          <div className="text-2xl font-extrabold text-zinc-100">{fmt(ourAvg)}</div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3 text-center">
          <div className="mb-1 text-[11px] font-semibold tracking-wide text-zinc-400">IMDb</div>
          <div className="text-2xl font-extrabold text-zinc-100">{fmt(imdbAvg)}</div>
        </div>
      </div>

      <div className="mb-2">
        <div className="relative h-2 rounded-full bg-zinc-800/80 ring-1 ring-black/30" aria-hidden>
          <div className="absolute -top-2 left-0 text-[10px] text-zinc-500">1</div>
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 text-[10px] text-zinc-500">5</div>
          <div className="absolute -top-2 right-0 text-[10px] text-zinc-500">10</div>

          {hasOur && (
            <div
              className="absolute top-1/2 h-3 w-3 -translate-y-1/2 -translate-x-1/2 rounded-full bg-emerald-400 shadow"
              style={{ left: `${pctFrom10(ourAvg!)}%` }}
              title={`Our Avg ${ourAvg!.toFixed(2)}`}
            />
          )}
          {hasImdb && (
            <div
              className="absolute top-1/2 h-3 w-3 -translate-y-1/2 -translate-x-1/2 rounded-full bg-sky-400 shadow"
              style={{ left: `${pctFrom10(imdbAvg!)}%` }}
              title={`IMDb ${imdbAvg!.toFixed(2)}`}
            />
          )}
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between">
        <div className="flex items-center gap-3 text-[11px] text-zinc-400">
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-emerald-400" /> Our Avg
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-sky-400" /> IMDb
          </span>
        </div>
        <div className="text-[11px] text-zinc-500">
          {typeof votes === "number" ? `${votes} votes` : ""}
        </div>
      </div>
    </div>
  );
}
