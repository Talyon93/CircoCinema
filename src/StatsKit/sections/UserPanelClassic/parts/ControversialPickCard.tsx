// StatsKit/ui/ControversialPickCard.tsx
import React, { useMemo, useRef, useLayoutEffect, useState } from "react";
import { getPosterUrl } from "../../../../TMDBHelper";
import { StatBadge } from "./StatBadge";
import { InfoBadge } from "./InfoBadge";
import { Card } from "../../../../Components/UI/Card";
import { Zap } from "lucide-react";
type Vote = { user: string; score: number };
export type ControversialData = {
  title: string;
  stdev: number;
  ratings: number[];
  votes?: Vote[];
  avg: number;
  ref?: number | null;
  poster_path?: string;
  poster_url?: string;
};

type Props = { data?: ControversialData; className?: string; infoText?: string };

export function ControversialPickCard({
  data,
  className = "",
  infoText = "Highest disagreement among votes. Axis is zoomed to this movie's vote range.",
}: Props) {
  if (!data || !data.ratings?.length) {
    return <Shell className={className} infoText={infoText} />;
  }

  const { title, stdev, ratings, votes, avg, ref, poster_path, poster_url } = data;

  const stripRef = useRef<HTMLDivElement | null>(null);
  const width = useContainerWidth(stripRef);

  const clamp10 = (v: number) => Math.max(1, Math.min(10, v));
  const minR = Math.min(...ratings);
  const maxR = Math.max(...ratings);
  const PAD = 0.2;
  const lo = clamp10(Math.floor((minR - PAD) * 10) / 10);
  const hi = clamp10(Math.ceil((maxR + PAD) * 10) / 10);
  const toPct = (v: number) => ((Math.max(lo, Math.min(hi, v)) - lo) / Math.max(hi - lo, 0.0001)) * 100;
  const toPx = (v: number) => (toPct(v) / 100) * Math.max(width, 1);
  const clampPx = (x: number, pad = 8) => Math.max(pad, Math.min(Math.max(width - pad, pad), x));
  const ticks = Array.from({ length: 5 }, (_, i) => (lo + (i * (hi - lo)) / 4).toFixed(1));

  const poster = useMemo(() => {
    if (poster_url) return poster_url;
    if (poster_path) return getPosterUrl(poster_path, "w185");
    return null;
  }, [poster_url, poster_path]);

  const minIdx = ratings.indexOf(minR);
  const maxIdx = ratings.lastIndexOf(maxR);
  const minUser = votes?.[minIdx]?.user;
  const maxUser = votes?.[maxIdx]?.user;

  let xAvg = clampPx(toPx(avg));
  let xRef = ref != null ? clampPx(toPx(ref)) : null;
  const xMin = clampPx(toPx(minR));
  const xMax = clampPx(toPx(maxR));
  const MIN_SPACING = 56;
  if (xRef != null && Math.abs(xAvg - xRef) < MIN_SPACING) {
    if (xAvg <= xRef) {
      xAvg = clampPx(xAvg - MIN_SPACING / 2);
      xRef = clampPx(xRef + MIN_SPACING / 2);
    } else {
      xAvg = clampPx(xAvg + MIN_SPACING / 2);
      xRef = clampPx(xRef - MIN_SPACING / 2);
    }
  }

  const leftPct = (px: number) => `${((px / Math.max(width, 1)) * 100).toFixed(4)}%`;
  const bandLeftPct = leftPct(clampPx(toPx(minR)));
  const bandWidthPx = clampPx(toPx(maxR)) - clampPx(toPx(minR));

  const stdevTone: "positive" | "negative" | "warning" | "default" =
    stdev < 0.9 ? "positive" : stdev > 1.5 ? "negative" : "warning";

  return (
    <Card spaced={false}>
  <Card.Header
    icon={<Zap className="h-4 w-4" />}
    title="Most controversial pick"
    info={<InfoBadge text={infoText} variant="floating" />}
  />

<Card.Section padding="md" inset tone="base" className="mt-1">
        <div className="flex items-start gap-3">
          <div className="shrink-0">
            {poster ? (
              <img src={poster} alt={title} className="h-20 w-14 rounded-md object-cover ring-1 ring-black/10" loading="lazy" />
            ) : (
              <div className="h-20 w-14 rounded-md bg-zinc-800/60" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{title}</div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-zinc-400">
              <Legend swatch="bg-zinc-300">votes</Legend>
              <Legend swatch="bg-emerald-400">group avg</Legend>
              {xRef != null && <Legend swatch="bg-sky-400">IMDb</Legend>}
            </div>
          </div>
        </div>

        <div ref={stripRef} className="relative mt-3 h-12 rounded-md bg-zinc-900/40">
          <div
            className="absolute top-2 bottom-2 rounded bg-zinc-600/20"
            style={{ left: bandLeftPct, width: `${Math.max(12, bandWidthPx)}px` }}
          />
          {xRef != null && <div className="absolute top-1 bottom-1 w-px bg-sky-400/70" style={{ left: leftPct(xRef) }} />}
          <div
            className="absolute -top-1.5 h-[calc(100%+12px)] w-[2px] rounded bg-emerald-400/80"
            style={{ left: leftPct(xAvg) }}
          />

          {ratings.map((r, i) => {
            const jitter = ((i % 3) - 1) * 6;
            const base = "absolute -translate-x-1 rounded-full shadow";
            const isMin = i === minIdx;
            const isMax = i === maxIdx;
            const cls = isMin
              ? "h-2.5 w-2.5 bg-rose-400 ring-2 ring-rose-400/30"
              : isMax
              ? "h-2.5 w-2.5 bg-violet-400 ring-2 ring-violet-400/30"
              : "h-2 w-2 bg-zinc-300";
            return (
              <div
                key={i}
                className={`${base} ${cls}`}
                style={{ left: leftPct(clampPx(toPx(r))), top: `calc(50% + ${jitter}px)` }}
              />
            );
          })}

          <div className="pointer-events-none absolute inset-0 z-10">
            <div
              className="absolute top-1 max-w-[180px] truncate rounded px-1.5 py-0.5 text-[10px] text-emerald-300 bg-emerald-500/15 shadow-sm"
              style={chipPosStyle(xAvg, width, "center")}
            >
              avg {avg.toFixed(2)}
            </div>
            {xRef != null && (
              <div
                className="absolute bottom-1 max-w-[180px] truncate rounded px-1.5 py-0.5 text-[10px] text-sky-300 bg-sky-500/15 shadow-sm"
                style={chipPosStyle(xRef, width, "center")}
              >
                IMDb {ref!.toFixed(2)}
              </div>
            )}
            <div className="absolute top-1 left-2 rounded bg-rose-500/15 px-1.5 py-0.5 text-[10px] text-rose-300">
              min {minR.toFixed(2)}{minUser ? ` — ${minUser}` : ""}
            </div>
            <div className="absolute top-1 right-2 rounded bg-violet-500/15 px-1.5 py-0.5 text-[10px] text-violet-200">
              max {maxR.toFixed(2)}{maxUser ? ` — ${maxUser}` : ""}
            </div>
            <div className="absolute -top-5 right-0 rounded bg-zinc-800/70 px-1.5 py-0.5 text-[10px] text-zinc-200 shadow-sm">
              {ratings.length} votes
            </div>
          </div>

          <div className="pointer-events-none absolute -bottom-4 left-0 right-0 flex justify-between text-[10px] text-zinc-500">
            {ticks.map((t) => (
              <span key={t}>{t}</span>
            ))}
          </div>
        </div>
      </Card.Section>

      <Card.Section padding="sm" inset tone="base" divider="top" className="mt-1">
  <div className="rounded-lg bg-white/[0.02] ring-1 ring-inset ring-zinc-700/50 p-2">
    <StatBadge
      label="Standard deviation"
      value={stdev.toFixed(2)}
      sub={`≈68% of votes fall within ±${stdev.toFixed(
        2
      )} of the average (lower = more consistent).`}
      tone={stdevTone}
      align="center"
      compact
      className="mb-0"
    />
  </div>
</Card.Section>
    </Card>
  );
}

function Shell({ className = "", infoText = "" }: { className?: string; infoText?: string }) {
  return (
    <Card className={className}>
      <Card.Section padding="md" tone="base">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold tracking-tight">Most controversial pick</h4>
          {infoText && <InfoBadge text={infoText} variant="floating" />}
        </div>
      </Card.Section>
      <Card.Section padding="sm" inset tone="muted" className="mt-1">
        <div className="text-sm text-zinc-500">—</div>
      </Card.Section>
    </Card>
  );
}

function Legend({ swatch, children }: { swatch: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`inline-block h-2 w-2 rounded ${swatch}`} />
      {children}
    </span>
  );
}

function useContainerWidth(ref: React.RefObject<HTMLElement>) {
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      if (!r) return;
      setW(r.width);
    });
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}

function chipPosStyle(
  xPx: number,
  containerW: number,
  prefer: "center" | "left" | "right" = "center"
) {
  const PAD = 8;
  const SAFE = 72;
  if (prefer !== "right" && xPx < SAFE) return { left: `${PAD}px`, transform: "none" } as const;
  if (prefer !== "left" && xPx > containerW - SAFE) return { right: `${PAD}px`, transform: "none" } as const;
  return { left: `${(xPx / Math.max(containerW, 1)) * 100}%`, transform: "translateX(-50%)" } as const;
}
