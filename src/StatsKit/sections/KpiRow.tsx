
// sections/KpiRow.tsx
import React from "react";
import { Card } from "../../Components/UI/Card";
export function KpiRow({ totalMovies, minutesLabel, distinctGenres, totalVotes, isLoading }:{ totalMovies:number; minutesLabel:string; distinctGenres:number; totalVotes:number; isLoading?:boolean; }){
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card className="relative overflow-hidden">
        <div className="text-xs uppercase text-zinc-500">Total movies</div>
        <div className="text-3xl font-extrabold tracking-tight">{totalMovies}</div>
        <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br from-indigo-500/20 to-emerald-500/20" />
      </Card>
      <Card className="relative overflow-hidden">
        <div className="text-xs uppercase text-zinc-500">Minutes watched</div>
        <div className="flex items-center gap-2 text-3xl font-extrabold tracking-tight">
          <span>{minutesLabel}</span>
          {isLoading && <span className="animate-pulse text-lg">⏳</span>}
        </div>
        <div className="pointer-events-none absolute -left-8 -bottom-8 h-28 w-28 rounded-full bg-gradient-to-br from-amber-500/20 to-pink-500/20" />
      </Card>
      <Card>
        <div className="text-xs uppercase text-zinc-500">Distinct genres</div>
        <div className="text-3xl font-extrabold tracking-tight">{distinctGenres}</div>
      </Card>
      <Card>
        <div className="text-xs uppercase text-zinc-500">Total votes</div>
        <div className="text-3xl font-extrabold tracking-tight">{totalVotes}</div>
      </Card>
    </div>
  );
}
