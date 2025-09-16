// StatsKit/sections/UserPanelClassic/parts/TopReceivedCard.tsx
import React from "react";
import { InfoBadge } from "./InfoBadge";
import { formatScore } from "../../../../Utils/Utils";
import { Card } from "../../../../Components/UI/Card";
import { Award } from "lucide-react";
type TopItem = { title: string; avg: number };

export function TopReceivedCard({
  topRatedPicks,
  avgRt,
  avgYear,
  minYear,
  maxYear,
}: {
  topRatedPicks: TopItem[];
  avgRt: number | null;
  avgYear: number | null;
  minYear: number | null;
  maxYear: number | null;
}) {
  const items = topRatedPicks?.slice(0, 3) ?? [];

  return (
    <Card spaced={false}>
      {/* Header con titolo centrale + avg runtime a destra */}
      <Card.Header
        icon={<Award className="h-4 w-4" />}
        title="Top received when they pick"
        info={
          <div className="flex items-center gap-2">
            {avgRt != null && (
              <span className="rounded-full border border-zinc-700/70 bg-zinc-900/60 px-2 py-0.5 text-[11px] text-zinc-300">
                ⏱️ Avg runtime {avgRt} min
              </span>
            )}
            <InfoBadge text="I 3 film portati con media più alta." />
          </div>
        }
      />

      {/* Lista top 3 */}
      <Card.Section padding="sm" inset className="mt-1">
        {items.length === 0 ? (
          <div className="text-sm text-zinc-500">—</div>
        ) : (
          <ol className="divide-y divide-zinc-800/60">
            {items.map((t, i) => {
              const isFirst = i === 0;
              return (
                <li
                  key={i}
                  className={[
                    "flex items-center gap-3 py-2",
                    isFirst
                      ? "rounded-xl bg-zinc-900/50 px-2 ring-1 ring-zinc-800/70"
                      : "px-1",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "grid h-6 w-6 place-items-center rounded-full text-xs font-semibold",
                      isFirst
                        ? "bg-amber-500/20 text-amber-300 ring-1 ring-amber-400/30"
                        : "bg-zinc-800 text-zinc-200",
                    ].join(" ")}
                    aria-label={`Position ${i + 1}`}
                    title={`#${i + 1}`}
                  >
                    {i + 1}
                  </span>

                  <span className="min-w-0 grow truncate text-sm">{t.title}</span>

                  <span
                    className={[
                      "shrink-0 rounded-md px-2 py-0.5 text-sm font-semibold tabular-nums",
                      isFirst
                        ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/30"
                        : "bg-zinc-800 text-zinc-100",
                    ].join(" ")}
                  >
                    {formatScore(t.avg)}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </Card.Section>

      {/* Footer mini-stats */}
      <Card.Section padding="sm" inset tone="muted" divider="top" className="mt-1">
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Years avg" value={avgYear} />
          <Stat label="Oldest" value={minYear} />
          <Stat label="Newest" value={maxYear} align="right" />
        </div>
      </Card.Section>
    </Card>
  );
}

function Stat({
  label,
  value,
  align = "center",
}: {
  label: string;
  value: number | null;
  align?: "left" | "center" | "right";
}) {
  return (
    <div
      className={[
        "text-[11px] text-zinc-400",
        align === "left" ? "text-left" : align === "right" ? "text-right" : "text-center",
      ].join(" ")}
    >
      <div>{label}</div>
      <div className="mt-0.5 text-sm font-medium text-zinc-200">{value ?? "—"}</div>
    </div>
  );
}
