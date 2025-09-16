// src/StatsKit/sections/UserPanelClassic/parts/AffinityCard.tsx
import React from "react";
import { InfoBadge } from "./InfoBadge";
import { AvatarInline } from "../../../../Components/UI/Avatar";
import { Card } from "../../../../Components/UI/Card";
import { Users } from "lucide-react";
type Row = { user: string; corr: number };
type Aff = { most: Row[]; least: Row[] };

export function AffinityCard({
  affinity,
  limit = 3,
  compact = true,
  onUserClick,
}: {
  affinity: Aff;
  limit?: number;
  compact?: boolean;
  onUserClick?: (user: string) => void;
}) {
  const most = (affinity?.most ?? []).slice(0, limit);
  const least = (affinity?.least ?? []).slice(0, limit);
  const sz = compact ? "py-1.5" : "py-2.5";

  const pillClass = (c: number) =>
    c >= 0
      ? "bg-emerald-500/12 text-emerald-300 ring-1 ring-emerald-500/30"
      : "bg-rose-500/12 text-rose-300 ring-1 ring-rose-500/30";

  const fillColor = (c: number) => (c >= 0 ? "bg-emerald-500/30" : "bg-rose-500/30");
  const accentColor = (c: number) => (c >= 0 ? "bg-emerald-500" : "bg-rose-500");

  const RowItem = ({ r }: { r: Row }) => {
    const val = Number.isFinite(r?.corr) ? Number(r.corr) : 0;
    const abs = Math.min(1, Math.max(0, Math.abs(val)));
    const width = `${Math.max(14, abs * 100)}%`;
    const clickable = Boolean(onUserClick);

    return (
      <li className="relative">
        {/* barra di riempimento */}
        <div
          className={`pointer-events-none absolute inset-y-0.5 left-0 rounded-md ${fillColor(val)}`}
          style={{ width }}
        />
        {/* accento a sinistra */}
        <div className={`pointer-events-none absolute inset-y-0.5 left-0 w-[3px] rounded ${accentColor(val)}`} />

        <div
          className={`relative z-10 flex w-full items-center justify-between gap-3 ${sz} px-1.5 ${
            clickable ? "cursor-pointer" : "cursor-default"
          }`}
          onClick={clickable ? () => onUserClick?.(r.user) : undefined}
        >
          <div className="min-w-0 flex items-center gap-2">
            <AvatarInline name={r.user} size={24} />
            <span className="truncate">{r.user}</span>
          </div>
          <span
            className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-mono font-medium tabular-nums ${pillClass(val)}`}
            title={`ρ ${val >= 0 ? "+" : ""}${val.toFixed(2)}`}
          >
            {val >= 0 ? "↑" : "↓"} ρ {val >= 0 ? "+" : ""}
            {val.toFixed(2)}
          </span>
        </div>
      </li>
    );
  };

  return (
    <Card spaced={false}>
      <Card.Header
        icon={<Users className="h-4 w-4" />}
        title="With other users"
        subtitle="Affinity"
        info={<InfoBadge text="Correlazione di voto con gli altri utenti (ρ di Pearson)." />}
      />

      {/* container scuro; liste con riquadro interno chiaro */}
      <Card.Section padding="md" inset tone="base" className="mt-1">
        <div className="grid gap-3 sm:grid-cols-2">
          {/* Most similar */}
          <div>
            <div className="mb-1 text-xs uppercase tracking-wide text-zinc-500">Most similar</div>
            {most.length === 0 ? (
              <div className="text-sm text-zinc-500">—</div>
            ) : (
              <ol className="divide-y divide-zinc-800/70 rounded-lg bg-white/[0.02] ring-1 ring-inset ring-zinc-700/50">
                {most.map((r) => (
                  <RowItem key={`most-${r.user}`} r={r} />
                ))}
              </ol>
            )}
          </div>

          {/* Most different */}
          <div>
            <div className="mb-1 text-xs uppercase tracking-wide text-zinc-500">Most different</div>
            {least.length === 0 ? (
              <div className="text-sm text-zinc-500">—</div>
            ) : (
              <ol className="divide-y divide-zinc-800/70 rounded-lg bg-white/[0.02] ring-1 ring-inset ring-zinc-700/50">
                {least.map((r) => (
                  <RowItem key={`least-${r.user}`} r={r} />
                ))}
              </ol>
            )}
          </div>
        </div>
      </Card.Section>
    </Card>
  );
}

export default AffinityCard;
