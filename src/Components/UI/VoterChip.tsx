import React from "react";
import { formatScore } from "../../Utils/Utils";

function InitialCircle({ name, score }: { name: string; score: number }) 
{
    const ring =
      score >= 8 ? "ring-emerald-500/60" :
      score >= 6 ? "ring-amber-400/60"  :
                   "ring-rose-500/60";

    return (
      <div
        className={`grid h-6 w-6 place-items-center rounded-full text-[11px] font-bold ring-2 ${ring}`}
        title={name}
      >
        {(name?.[0] || "?").toUpperCase()}
      </div>
    );
}

export function VoterChip({ name, score, currentUser }: { name: string; score: number; currentUser: string;}) {
return (
    <div className="inline-flex items-center gap-2 rounded-2xl border border-zinc-700/80 bg-zinc-900/70 px-2.5 py-1 text-sm text-zinc-100">
        <InitialCircle name={name} score={score} />
        <span className="truncate max-w-[8.5rem]">{name}</span>
        <span className="mx-1 text-zinc-500">•</span>
        <span className="font-semibold">{formatScore(score)}</span>
        {name === currentUser && (
            <span className="ml-1 rounded bg-zinc-200 px-1.5 py-0.5 text-[10px] font-bold text-zinc-900">You</span>
        )}
    </div>
);
}
