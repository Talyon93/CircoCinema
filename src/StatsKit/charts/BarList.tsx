import React from "react";
import { Card } from "../../Components/UI/Card";
import { InfoBadge } from "../../StatsKit/sections/UserPanelClassic/parts/InfoBadge";

const BAR_COLORS = [
  "bg-emerald-500/80",
  "bg-sky-500/80",
  "bg-amber-400/80",
  "bg-rose-500/80",
  "bg-purple-500/80",
  "bg-indigo-500/80",
];

export function BarList({
  items,
  labelWidth = 100,
}: {
  items: Array<{ name: string; count: number }>;
  labelWidth?: number;
}) {
  if (!items.length) return <div className="text-sm text-zinc-500">—</div>;
  const max = Math.max(...items.map((x) => x.count), 1);

  return (
    <div className="flex flex-col gap-2">
      {items.map((it, idx) => {
        const pct = Math.max(4, Math.round((it.count / max) * 100));
        return (
          <div key={it.name} className="flex items-center gap-2">
            {/* label */}
            <div
              style={{ width: labelWidth }}
              className="shrink-0 truncate text-xs text-zinc-300"
            >
              {it.name}
            </div>

            {/* bar */}
            <div className="relative h-2 w-full rounded bg-zinc-800/60 ring-1 ring-inset ring-zinc-700/40">
              <div
                className={`absolute inset-y-0 left-0 rounded ${BAR_COLORS[idx % BAR_COLORS.length]}`}
                style={{ width: `${pct}%` }}
              />
            </div>

            {/* value */}
            <div className="w-6 text-right text-xs font-medium text-zinc-400">
              {it.count}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function CountriesPicksCard({
  countries,
}: {
  countries: Array<{ name: string; count: number }>;
}) {
  const items = (countries ?? [])
    .slice(0, 10)
    .map((x) => ({ name: String(x.name), count: Number(x.count) || 0 }));

  return (
    <Card>
      <Card.Header
        icon={<span>🌍</span>}
        title="Countries"
        subtitle="Picks frequency"
        info={<InfoBadge text="Most frequent countries among their picks." />}
      />
      <Card.Section padding="md" inset tone="base">
        <BarList items={items} labelWidth={96} />
      </Card.Section>
    </Card>
  );
}
