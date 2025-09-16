// StatsKit/sections/UserPanelClassic/parts/TopLovedCard.tsx
import React from "react";
import { Card } from "../../../../Components/UI/Card";
import { InfoBadge } from "./InfoBadge";
import { formatScore } from "../../../../Utils/Utils";
import { Heart } from "lucide-react";
export function TopLovedCard({
  items,
}: {
  items: Array<{ title: string; score: number }>;
}) {
  const list = (items ?? []).slice(0, 5);

  return (
    <Card spaced={false}>
      <Card.Header
        icon={<Heart className="h-4 w-4" />}
        title="Top films they loved (their votes)"
        info={<InfoBadge text="Highest scores this user has given to watched films." />}
      />

      <Card.Section padding="sm" inset className="mt-1">
        {list.length === 0 ? (
          <div className="text-sm text-zinc-500">—</div>
        ) : (
          <ol className="divide-y divide-zinc-800/60">
            {list.map((x, i) => {
              const isFirst = i === 0;
              return (
                <li
                  key={`${x.title}-${i}`}
                  className={[
                    "flex items-center gap-3 py-2",
                    isFirst
                      ? "rounded-xl bg-zinc-900/50 px-2 ring-1 ring-zinc-800/70"
                      : "px-1",
                  ].join(" ")}
                >
                  {/* posizione */}
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

                  {/* titolo */}
                  <span className="min-w-0 grow truncate text-sm">{x.title}</span>

                  {/* valore (stile identico alla received) */}
                  <span
                    className={[
                      "shrink-0 rounded-md px-2 py-0.5 text-sm font-semibold tabular-nums",
                      isFirst
                        ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/30"
                        : "bg-zinc-800 text-zinc-100",
                    ].join(" ")}
                  >
                    {formatScore(x.score)}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </Card.Section>
    </Card>
  );
}
