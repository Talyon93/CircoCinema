
// sections/TopFlop.tsx
import React from "react";
import { Card } from "../../Components/UI/Card";
import { PickedByBadge } from "../../Components/UI/PickedByBadge";
import { TrophyIcon, BoltIcon } from "@heroicons/react/24/outline";
import { formatScore } from "../../Utils/Utils";
export function TopFlop({ bestMovies, worstMovies, isLoading }:{ bestMovies:any[]; worstMovies:any[]; isLoading?:boolean; }){
  const LoadingRow = () => (
    <div className="rounded-xl border px-3 py-2 text-sm text-gray-500 dark:border-zinc-700 dark:text-zinc-400">
      <span className="animate-pulse">Loading…</span>
    </div>
  );
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <h3 className="flex items-center gap-2 text-lg font-semibold">
          <TrophyIcon className="h-5 w-5" />
          Top 5 movies
        </h3>
        {isLoading && bestMovies.length === 0 ? (
          <LoadingRow />
        ) : bestMovies.length === 0 ? (
          <div className="text-sm text-zinc-500">N/A</div>
        ) : (
          <ol className="grid gap-2">
            {bestMovies.map((m, i) => (
              <li key={m.id} className="flex items-center justify-between rounded-xl border bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="text-zinc-400 tabular-nums">{i + 1}.</span>
                  {!!m.picked_by && <PickedByBadge name={m.picked_by} />}
                  <span className="truncate">{m.title}</span>
                </div>
                <span className="shrink-0 rounded-full border px-2 py-0.5 text-xs dark:border-zinc-700">
                  avg <b>{formatScore(m.avg)}</b> · {m.votes} votes
                </span>
              </li>
            ))}
          </ol>
        )}
      </Card>
      <Card>
        <h3 className="flex items-center gap-2 text-lg font-semibold">
          <BoltIcon className="h-5 w-5 text-rose-500" />
          Flop 5 movies
        </h3>
        {isLoading && worstMovies.length === 0 ? (
          <LoadingRow />
        ) : worstMovies.length === 0 ? (
          <div className="text-sm text-zinc-500">N/A</div>
        ) : (
          <ol className="grid gap-2">
            {worstMovies.map((m, i) => (
              <li key={m.id} className="flex items-center justify-between rounded-xl border bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="text-zinc-400 tabular-nums">{i + 1}.</span>
                  {!!m.picked_by && <PickedByBadge name={m.picked_by} />}
                  <span className="truncate">{m.title}</span>
                </div>
                <span className="shrink-0 rounded-full border px-2 py-0.5 text-xs dark:border-zinc-700">
                  avg <b>{formatScore(m.avg)}</b> · {m.votes} votes
                </span>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
}
