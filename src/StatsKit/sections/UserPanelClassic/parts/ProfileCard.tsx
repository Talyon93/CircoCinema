import React from "react";
import { InfoBadge } from "./InfoBadge";
import { TrophyIcon, HeartIcon } from "@heroicons/react/24/outline";
import { formatScore } from "../../../../Utils/Utils";


export function ProfileCard({ selectedUser, selGiven, selReceived, kindnessFromGiven, avgImdbPicks, history, DonutComponent, }: { selectedUser: string; selGiven?: { avg: number; count: number; scores: number[] } | undefined; selReceived?: { avg: number; count: number } | undefined; kindnessFromGiven: Array<{ user: string; avg: number; count: number }>; avgImdbPicks: number | null; history: any[]; DonutComponent: React.ComponentType<{ value: number }>; }) {
    const kindness = React.useMemo(() => {
        const sorted = kindnessFromGiven.slice().sort((a, b) => b.avg - a.avg || b.count - a.count);
        const total = sorted.length;
        const idx = sorted.findIndex((r) => r.user === selectedUser);
        const rank = idx >= 0 ? idx + 1 : null;
        const perc = rank != null ? Math.round((1 - (rank - 1) / total) * 100) : null;
        return { rank, total, perc };
    }, [kindnessFromGiven, selectedUser]);


    return (
        <div className="relative overflow-hidden rounded-xl border p-4 pr-7 dark:border-zinc-700">
            <InfoBadge variant="floating" text="Media dei voti che questo utente assegna. Sotto: voti totali e posizione nella classifica dei 'gentili'." />
            <div className="flex items-center gap-3">
                <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{selectedUser}</div>
                    <div className="text-xs text-zinc-500">Profile</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-400 ring-1 ring-emerald-400/30">
                            <HeartIcon className="h-3.5 w-3.5" />
                            <span>{selGiven?.count ?? 0} votes</span>
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-300 ring-1 ring-amber-400/30">
                            <TrophyIcon className="h-3.5 w-3.5" />
                            <span>{kindness.rank != null ? `#${kindness.rank}/${kindness.total}` : "—"}</span>
                            {kindness.perc != null && <span className="ml-1 opacity-80">({kindness.perc}° pct)</span>}
                        </span>
                    </div>


                    <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-zinc-400 md:grid-cols-3">
                        <div className="flex justify-between gap-2"><span>Avg received</span><span className="font-medium text-zinc-200">{selReceived?.avg != null ? selReceived.avg.toFixed(2) : "—"}</span></div>
                        <div className="flex justify-between gap-2"><span>Avg IMDb (picks)</span><span className="font-medium text-zinc-200">{avgImdbPicks != null ? avgImdbPicks.toFixed(2) : "—"}</span></div>
                        <div className="flex justify-between gap-2"><span>Picks</span><span className="font-medium text-zinc-200">{history.filter((h) => (h?.picked_by ?? h?.pickedBy) === selectedUser).length}</span></div>
                    </div>
                </div>
                <div className="ml-auto shrink-0">
                    <div className="w-28"><DonutComponent value={selGiven?.avg || 0} /></div>
                    <div className="mt-1 text-center text-xs text-zinc-500">Avg given</div>
                </div>
            </div>
        </div>
    );
}