
// sections/PickerAverages.tsx
import React from "react";
import { Card } from "../../Components/UI/Card";
import { FilmIcon } from "@heroicons/react/24/outline";
import { AvatarInline } from "../../Components/UI/Avatar";
import { formatScore } from "../../Utils/Utils";

export function PickerAverages({ items, isLoading }:{ items:Array<{user:string; avg:number; count:number}>; isLoading?:boolean; }){
  const LoadingRow = () => (
    <div className="rounded-xl border px-3 py-2 text-sm text-gray-500 dark:border-zinc-700 dark:text-zinc-400">
      <span className="animate-pulse">Loading…</span>
    </div>
  );
  return (
    <Card>
      <h3 className="flex items-center gap-2 text-lg font-semibold">
        <FilmIcon className="h-5 w-5" />
        Avg score received by pickers
      </h3>
      {isLoading && items.length === 0 ? (
        <LoadingRow />
      ) : items.length === 0 ? (
        <div className="text-sm text-zinc-500">No movies with votes yet.</div>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((p) => (
            <li key={p.user} className="flex items-center justify-between rounded-xl border bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900">
              <div className="flex min-w-0 items-center gap-2">
                <AvatarInline name={p.user} size={20} />
                <span className="truncate">{p.user}</span>
              </div>
              <span className="text-xs">avg <b>{formatScore(p.avg)}</b> · {p.count} movies</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
