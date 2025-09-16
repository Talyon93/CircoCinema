// StatsKit/ui/OutlierList.tsx
import React from "react";
import { Card } from "../../../../Components/UI/Card";
import { InfoBadge } from "./InfoBadge";
import { BarChart3 } from "lucide-react";
type Item = {
  title: string;
  delta: number;
  thumbUrl?: string;
  href?: string;
};

export function OutlierList({
  title,
  items,
  positive = true,
  numbers = 5,
  infoText = "Δ rispetto a IMDb per i film proposti da questo utente.",
  compact = true,
  onItemClick,
  showIndex = true,
  leftAccent = "bar",
}: {
  title: string;
  items: Item[];
  positive?: boolean;
  numbers?: number;
  infoText?: string;
  compact?: boolean;
  onItemClick?: (item: Item, index: number) => void;
  showIndex?: boolean;
  leftAccent?: "bar" | "dot" | "none";
}) {
  const n = Number.isFinite(numbers) ? Math.max(0, Math.floor(numbers as number)) : 5;
  const sliced = items.slice(0, n);

  const maxAbs = Math.max(0.01, ...sliced.map((x) => Math.abs(x.delta)));
  const ok = "text-emerald-300 ring-1 ring-emerald-500/30 bg-emerald-500/12";
  const bad = "text-rose-300 ring-1 ring-rose-500/30 bg-rose-500/12";
  const neutral = "text-zinc-300 ring-1 ring-zinc-600/40 bg-zinc-700/30";
  const rowPadding = compact ? "py-1.5" : "py-2.5";

  const pillTone = (d: number) =>
    positive ? (d >= 0 ? ok : neutral) : (d < 0 ? bad : neutral);

  const barColor = (d: number) =>
    positive
      ? d >= 0
        ? "bg-emerald-500/25"
        : "bg-zinc-600/25"
      : d < 0
      ? "bg-rose-500/25"
      : "bg-zinc-600/25";

  const dotColor = (d: number) =>
    positive
      ? d >= 0
        ? "bg-emerald-500/60"
        : "bg-zinc-500/60"
      : d < 0
      ? "bg-rose-500/60"
      : "bg-zinc-500/60";

  return (
     <Card spaced={false}>
      <Card.Header
        icon={<BarChart3 className="h-4 w-4" />}
        title={title}
        subtitle="Outliers"
        info={<InfoBadge text={infoText} />}
      />

      {/* container scuro; solo gli elementi interni hanno toni chiari */}
      <Card.Section padding="sm" inset tone="base" divider="top">
        {sliced.length === 0 ? (
          <div className="text-sm text-zinc-500">—</div>
        ) : (
          <ol className="divide-y divide-zinc-800/70">
            {sliced.map((x, i) => {
              const width = `${Math.min(100, Math.max(6, (Math.abs(x.delta) / maxAbs) * 100))}%`;
              const clickable = Boolean(onItemClick || x.href);
              const Container: any = clickable ? "button" : "div";
              const handleClick = () => {
                if (x.href) window.open(x.href, "_blank");
                else onItemClick?.(x, i);
              };

              return (
                <li key={i} className="relative rounded-lg">
                  {/* intensity bar */}
                  <div
                    className={`pointer-events-none absolute inset-y-1 left-0 rounded-lg ${barColor(
                      x.delta
                    )}`}
                    style={{ width }}
                  />

                  <Container
                    onClick={clickable ? handleClick : undefined}
                    className={`relative z-10 flex w-full items-center justify-between gap-3 ${rowPadding} px-1.5 ${
                      clickable ? "cursor-pointer" : ""
                    }`}
                  >
                    <div className="min-w-0 flex items-center gap-3">
                      {leftAccent === "bar" && (
                        <div className="mr-0.5 h-6 w-1.5 rounded-full bg-zinc-700/40">
                          <div
                            className={`h-full w-full rounded-full ${barColor(x.delta)}`}
                            style={{ opacity: 0.9 }}
                          />
                        </div>
                      )}
                      {leftAccent === "dot" && (
                        <div className={`h-2.5 w-2.5 rounded-full ${dotColor(x.delta)}`} />
                      )}

                      {showIndex && (
                        <span className="w-6 shrink-0 text-center font-mono text-[11px] text-zinc-400">
                          {i + 1}
                        </span>
                      )}

                      {x.thumbUrl && (
                        <img
                          src={x.thumbUrl}
                          alt=""
                          className="h-6 w-4 shrink-0 rounded-[3px] object-cover ring-1 ring-zinc-700/60"
                          loading="lazy"
                        />
                      )}

                      <span className="truncate text-sm">{x.title}</span>
                    </div>

                    {/* pill con leggero fondo chiaro */}
                    <span
                      className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-medium font-mono tabular-nums bg-white/[0.02] ring-1 ring-inset ring-zinc-700/50 ${pillTone(
                        x.delta
                      )}`}
                      title={`${x.delta >= 0 ? "+" : ""}${x.delta.toFixed(2)}`}
                    >
                      {x.delta >= 0 ? "↑" : "↓"} {x.delta >= 0 ? "+" : ""}
                      {x.delta.toFixed(2)}
                    </span>
                  </Container>
                </li>
              );
            })}
          </ol>
        )}
      </Card.Section>
    </Card>
  );
}
