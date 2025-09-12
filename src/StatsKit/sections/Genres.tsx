
// sections/Genres.tsx
import React from "react";
import { Card } from "../../Components/UI/Card";
import { ChartBarIcon } from "@heroicons/react/24/outline";
import { BarRow } from "../ui/BarRow";
export function Genres({ items, isLoading }:{ items:Array<{name:string; count:number}>; isLoading?:boolean }){
  const LoadingRow = () => (
    <div className="rounded-xl border px-3 py-2 text-sm text-gray-500 dark:border-zinc-700 dark:text-zinc-400">
      <span className="animate-pulse">Loading…</span>
    </div>
  );
  return (
    <Card>
      <h3 className="flex items-center gap-2 text-lg font-semibold">
        <ChartBarIcon className="h-5 w-5" />
        Most watched genres
      </h3>
      {isLoading && items.length === 0 ? (
        <LoadingRow />
      ) : items.length === 0 ? (
        <div className="text-sm text-zinc-500">No genre data (ensure TMDB genres present)</div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {items.slice(0, 12).map((g) => (
            <BarRow key={g.name} label={g.name} value={g.count} max={items[0]?.count || 1} />
          ))}
        </div>
      )}
    </Card>
  );
}
