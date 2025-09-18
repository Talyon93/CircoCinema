// filepath: src/Components/history/HistoryPosterGrid.tsx
import React from "react";
import { HistoryPosterTile } from "./HistoryPosterTile";
import { Viewing } from "../../types/viewing";
import { Sparkles } from "lucide-react";

/* ---------- helpers ---------- */
function formatScore(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return "-";
  const x = Math.round(Number(n) * 10) / 10;
  return (x % 1 === 0 ? x.toFixed(0) : x.toFixed(1));
}
function getAvgAndCount(r?: Record<string, number> | null) {
  if (!r) return { avg: null as number | null, count: 0 };
  const vals = Object.values(r).map(Number).filter(Number.isFinite);
  if (!vals.length) return { avg: null as number | null, count: 0 };
  return { avg: vals.reduce((a, b) => a + b, 0) / vals.length, count: vals.length };
}
function getMine(r?: Record<string, number> | null, uid?: string) {
  if (!r || !uid) return null;
  const v = r[uid];
  return Number.isFinite(v) ? Number(v) : null;
}

/* ---------- component ---------- */
export function HistoryPosterGrid({
  items,
  onOpen,
  onResolve,
  onVote,
  currentUserId,
}: {
  items: Viewing[];
  onOpen: (v: Viewing) => void;
  onResolve?: (id: any, nextMovie: any) => void;
  onVote?: (v: Viewing) => void;
  currentUserId?: string;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {items.map((v) => {
        const { avg, count } = getAvgAndCount(v.ratings);
        const mine = getMine(v.ratings, currentUserId);

        // tilt 3D leggero
        const ref = React.useRef<HTMLDivElement | null>(null);
        React.useEffect(() => {
          const el = ref.current;
          if (!el) return;
          const onMove = (e: MouseEvent) => {
            const r = el.getBoundingClientRect();
            const x = (e.clientX - r.left) / r.width - 0.5;
            const y = (e.clientY - r.top) / r.height - 0.5;
            el.style.setProperty("--rx", `${(-y * 4).toFixed(2)}deg`);
            el.style.setProperty("--ry", `${(x * 6).toFixed(2)}deg`);
          };
          const onLeave = () => {
            el.style.setProperty("--rx", "0deg");
            el.style.setProperty("--ry", "0deg");
          };
          el.addEventListener("mousemove", onMove);
          el.addEventListener("mouseleave", onLeave);
          return () => {
            el.removeEventListener("mousemove", onMove);
            el.removeEventListener("mouseleave", onLeave);
          };
        }, []);

        return (
          <div
            key={(v as any).id}
            ref={ref}
            className="group relative [transform-style:preserve-3d] transition-transform duration-300"
            style={{ transform: "perspective(900px) rotateX(var(--rx,0)) rotateY(var(--ry,0))" }}
          >
            {/* bordo animato (gradient sweep) */}
            <div className="pointer-events-none absolute -inset-[2px] rounded-[1.1rem] bg-[conic-gradient(var(--tw-gradient-stops))] from-white/10 via-transparent to-transparent opacity-0 blur-[6px] transition-opacity duration-500 group-hover:opacity-100" />

            {/* poster + soft glow neutro */}
            <div className="relative rounded-2xl transition-transform duration-300 group-hover:-translate-y-1 group-hover:scale-[1.015]">
              <div className="pointer-events-none absolute -inset-1 rounded-[1.25rem] opacity-40 blur-xl bg-gradient-to-t from-white/10 to-transparent" />
              <HistoryPosterTile v={v} onClick={() => onOpen(v)} onResolve={onResolve} />
            </div>

            {/* overlay SEMPRE visibile */}
            <div
              className="pointer-events-none absolute inset-x-1 bottom-1 rounded-xl bg-black/70 backdrop-blur-[5px]
                         ring-1 ring-white/10 shadow-sm px-3 py-2 text-[12px] text-white
                         flex items-center justify-between gap-2"
              title={avg != null ? `Average of ${count} people: ${formatScore(avg)}` : "No ratings yet"}
            >
              {/* shimmer soft */}
              <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl">
                <span className="absolute -left-1/3 top-0 h-full w-1/3 rotate-12 bg-white/5 blur-sm animate-[shimmer_3.2s_linear_infinite]" />
              </span>

              {/* average */}
              <div className="relative z-10 flex items-center gap-1 min-w-0">
                <span className="select-none">⭐</span>
                <span className="font-semibold">{formatScore(avg)}</span>
                <span className="text-white/70">({count})</span>
              </div>

              {/* mio voto o pulsante */}
              <div className="relative z-10">
                {mine != null ? (
                  <div className="truncate text-white/90">
                    You: <span className="font-semibold">{formatScore(mine)}</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="pointer-events-auto inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40
                               bg-emerald-500/15 px-2.5 py-1.5 text-[12px] font-semibold text-emerald-300
                               hover:bg-emerald-500/25 active:scale-[0.98] transition
                               focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                    onClick={(e) => {
                      e.stopPropagation();
                      onVote?.(v);
                    }}
                    title="Vote on this movie"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Vote
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* Tailwind keyframes (globals.css se non li hai già):
@keyframes shimmer { 
  0% { transform: translateX(-120%); opacity:.0 }
  15% { opacity:.35 }
  100% { transform: translateX(220%); opacity:.0 }
}
*/
