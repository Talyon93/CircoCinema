
// ui/DiffPill.tsx
import React from "react";
import { formatScore } from "../../Utils/Utils";
type DiffVariant = "closest" | "farthest";
export function DiffPill({ user, imdb, variant="closest" }:{ user:number; imdb:number; variant?:DiffVariant }){
  const diff = Math.abs(user - imdb);
  const maxDiff = 5;
  const direct = Math.min(100, Math.max(5, (diff / maxDiff) * 100));
  const inverse = diff === 0 ? 100 : Math.min(100, Math.max(5, 100 - (diff / maxDiff) * 100));
  const pct = variant === "farthest" ? direct : inverse;
  const fill = variant === "farthest"
    ? "bg-rose-500"
    : diff <= 0.75 ? "bg-emerald-500" : diff <= 1.5 ? "bg-amber-400" : "bg-rose-500";
  const chip = diff <= 0.75
    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
    : diff <= 1.5
    ? "bg-amber-400/20 text-amber-200 border-amber-400/40"
    : "bg-rose-500/20 text-rose-200 border-rose-500/40";
  return (
    <div className="flex w-full min-w-0 items-center gap-2">
      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-semibold tabular-nums ${chip}`}>
        Δ {formatScore(diff)}
      </span>
      <div className="relative h-3 flex-1 min-w-0 overflow-hidden rounded-full bg-zinc-300/50 dark:bg-zinc-800">
        <div className={`h-3 ${fill}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="shrink-0 rounded-full border px-1.5 py-0.5 text-[11px] leading-none text-zinc-500 tabular-nums dark:border-zinc-700">
        {formatScore(user)} / {formatScore(imdb)}
      </span>
    </div>
  );
}
