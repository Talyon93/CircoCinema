
// sections/GroupImdb.tsx
import React from "react";
import { Card } from "../../Components/UI/Card";
import { ChartBarIcon, BoltIcon } from "@heroicons/react/24/outline";
import { DiffPill } from "../ui/DiffPill";
export function GroupImdb({ closest, farthest }:{ closest:any[]; farthest:any[]; }){
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <h3 className="flex items-center gap-2 text-lg font-semibold">
          <ChartBarIcon className="h-5 w-5" />
          Closest to IMDb
        </h3>
        {!closest.length ? (
          <div className="text-sm text-zinc-500">Nessun confronto disponibile.</div>
        ) : (
          <ol className="grid gap-2">
            {closest.map((r, i) => (
              <li key={r.id} className="flex items-center justify-between gap-3 rounded-xl border bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900">
                <span className="truncate font-medium min-w-[180px]">{i + 1}. {r.title}</span>
                <div className="flex w-full items-center"><DiffPill variant="closest" user={r.avg} imdb={r.ref} /></div>
              </li>
            ))}
          </ol>
        )}
      </Card>
      <Card>
        <h3 className="flex items-center gap-2 text-lg font-semibold">
          <BoltIcon className="h-5 w-5" />
          Farthest from IMDb
        </h3>
        {!farthest.length ? (
          <div className="text-sm text-zinc-500">Nessun confronto disponibile.</div>
        ) : (
          <ol className="grid gap-2">
            {farthest.map((r, i) => (
              <li key={r.id} className="flex items-center justify-between gap-3 rounded-xl border bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900">
                <span className="truncate font-medium min-w-[180px]">{i + 1}. {r.title}</span>
                <div className="flex w-full items-center"><DiffPill variant="farthest" user={r.avg} imdb={r.ref} /></div>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
}
