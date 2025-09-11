import React, { useEffect, useMemo, useState } from "react";
import {
  loadAvatarFor,
} from "../../localStorage";

import {
  formatScore,
} from "../../Utils/Utils";

import { AvatarInline } from "./Avatar";

function avgColor(score: number) {
  const s = Math.max(1, Math.min(10, score));
  if (s <= 4) return `hsl(0 85% 50%)`;               // rosso fisso fino a 5
  const hue = ((s - 4) / 4) * 120;                   // 5→0°, 10→120°
  return `hsl(${hue} 85% 50%)`;
}

export function VotesBar({
  entries,
  avg,
  currentUser,
  size = "md",
  showScale = true,
  showHeader = true,
}: {
  entries: [string, number][];
  avg: number | null;
  currentUser?: string;
  size?: "sm" | "md";
  showScale?: boolean;
  showHeader?: boolean;
}) {
  const toPct = (n: number) => ((Number(n) - 1) / 9) * 100;
  const BADGE_SHIFT = 0.5;

  const trackH    = size === "sm" ? 8  : 16;
  const tickH     = size === "sm" ? 14 : 24;
  const avatarSz  = size === "sm" ? 18 : 22;
  const countSz   = size === "sm" ? 14 : 16;

  const ringByScore = (s: number) =>
    s >= 8 ? "ring-emerald-500/70" : s >= 6 ? "ring-amber-400/70" : "ring-rose-500/70";

  const ref = React.useRef<HTMLDivElement>(null);
  const [w, setW] = React.useState(0);
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    setW(el.clientWidth);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const points = React.useMemo(
    () =>
      entries
        .map(([name, score]) => ({
          name,
          score: Number(score),
          pct: toPct(Number(score)),
        }))
        .sort((a, b) => a.pct - b.pct),
    [entries]
  );

  const minPct = React.useMemo(() => {
    if (!w) return 1.4;
    const minPx = Math.max(avatarSz * 0.9, 16);
    return (minPx / w) * 100;
  }, [w, avatarSz]);

  type Cluster = { pct: number; people: typeof points };
  const clusters: Cluster[] = React.useMemo(() => {
    const out: Cluster[] = [];
    let cur: typeof points = [];
    for (const p of points) {
      if (!cur.length || Math.abs(p.pct - cur[cur.length - 1].pct) < minPct) {
        cur.push(p);
      } else {
        const pct = cur.reduce((a, b) => a + b.pct, 0) / cur.length;
        out.push({ pct, people: cur });
        cur = [p];
      }
    }
    if (cur.length) {
      const pct = cur.reduce((a, b) => a + b.pct, 0) / cur.length;
      out.push({ pct, people: cur });
    }
    return out;
  }, [points, minPct]);

  function pickRep(c: Cluster) {
    const meIdx = currentUser ? c.people.findIndex(p => p.name === currentUser) : -1;
    if (meIdx >= 0) return c.people[meIdx];
    return c.people.slice().sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))[0];
  }

  return (
    <div className="w-full">
      {showHeader && (
        <div className="mb-1 flex items-center justify-between text-xs text-zinc-400">
          <span>Avg {entries.length ? `(${entries.length} votes)` : ""}</span>
          <span>10</span>
        </div>
      )}

      <div
        ref={ref}
        className="relative w-full overflow-visible rounded-full bg-zinc-800"
        style={{ height: trackH }}
      >
        {avg !== null && (
        <div
          className="absolute left-0 top-0 h-full rounded-full"
          style={{
            width: `${toPct(avg)}%`,
            backgroundColor: avgColor(avg),
          }}
        />
      )}


        {clusters.map((c, i) => {
          const rep = pickRep(c);
          const others = c.people.length - 1;
          const left = `calc(${c.pct}% - 1px)`;
          const ring =
            rep.name === currentUser ? "ring-white" : ringByScore(rep.score);
          const tooltip = c.people
            .map(p => `${p.name} ${formatScore(p.score)}`)
            .join(", ");

          return (
            <div key={i} className="absolute pointer-events-none" style={{ left }}>
              <div
                className="absolute top-0 w-[2px] -translate-x-1/2 rounded-full bg-white/90 shadow-[0_0_0_2px_rgba(0,0,0,0.5)]"
                style={{ height: tickH }}
              />
              <div
                className="absolute -translate-x-1/2"
                style={{ top: -(avatarSz + 6) }}
                title={tooltip}
              >
                <AvatarInline
                  name={rep.name}
                  size={avatarSz}
                  ringClassName={`ring-2 ${ring}`}
                />

                {others > 0 && (
                  <div
                    className="absolute grid place-items-center rounded-full border border-zinc-900 bg-white text-[10px] font-bold text-zinc-900 shadow dark:bg-zinc-200"
                    style={{
                      width: countSz,
                      height: countSz,
                      right: -countSz * BADGE_SHIFT,
                      bottom: -countSz * 0.2,
                    }}
                  >
                    +{others}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {showScale && (
        <div className="mt-1 flex justify-between text-[11px] text-zinc-500">
          <span>1</span><span>5</span><span>10</span>
        </div>
      )}
    </div>
  );
}