// filepath: src/Components/UI/VoteModal.tsx
import React from "react";
import { Card } from "../UI/Card";
import ScoreSlider from "../UI/ScoreSlider";
import { formatScore } from "../../Utils/Utils";

/* -------------------- utils -------------------- */
function mkPosterUrl(posterPath?: string | null, width: number | string = 342): string | null {
  if (!posterPath) return null;
  if (posterPath.startsWith("http")) return posterPath;
  const w = typeof width === "number" ? `w${width}` : width;
  const path = posterPath.startsWith("/") ? posterPath : `/${posterPath}`;
  return `https://image.tmdb.org/t/p/${w}${path}`;
}
function clampToQuarter(n: number) {
  const q = Math.round(n * 4) / 4;
  return Math.max(0, Math.min(10, q));
}
function moodClasses(v: number) {
  // colore dinamico in base al voto
  if (v >= 8) return { ring: "ring-emerald-400/40", chip: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" };
  if (v >= 6.5) return { ring: "ring-lime-300/40", chip: "bg-lime-400/15 text-lime-300 border-lime-400/30" };
  if (v >= 5) return { ring: "ring-amber-300/40", chip: "bg-amber-400/15 text-amber-300 border-amber-400/30" };
  if (v >= 3.5) return { ring: "ring-orange-400/40", chip: "bg-orange-500/15 text-orange-300 border-orange-500/30" };
  return { ring: "ring-rose-400/40", chip: "bg-rose-500/15 text-rose-300 border-rose-500/30" };
}

/* -------------------- component -------------------- */
type Props = {
  open: boolean;
  title?: string;
  posterPath?: string | null;
  avg?: number | null;
  count?: number;
  initial?: number | null;
  onClose: () => void;
  onSave: (score: number) => void;
};

export default function VoteModal({
  open,
  title,
  posterPath,
  avg,
  count = 0,
  initial,
  onClose,
  onSave,
}: Props) {
  const [val, setVal] = React.useState<number>(initial ?? 7.5);
  const poster = mkPosterUrl(posterPath, 300);
  const { ring, chip } = moodClasses(val);

  React.useEffect(() => setVal(initial ?? 7.5), [initial, open]);

  // scorciatoie tastiera
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Enter") onSave(clampToQuarter(val));
      if (e.key === "ArrowLeft") setVal((v) => clampToQuarter(v - 0.25));
      if (e.key === "ArrowRight") setVal((v) => clampToQuarter(v + 0.25));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, val, onClose, onSave]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100]">
      {/* Backdrop con poster sfocato */}
      <div className="absolute inset-0">
        {poster && (
          <img
            src={poster}
            alt=""
            className="absolute inset-0 h-full w-full scale-110 object-cover opacity-15 blur-2xl"
          />
        )}
        <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      </div>

      {/* Dialog */}
      <div className="relative mx-auto mt-[6vh] w-[min(720px,94vw)]">
        <div className={`rounded-2xl border border-white/10 bg-zinc-950/70 p-0 shadow-2xl backdrop-blur-xl ring-1 ${ring}`}>
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
            <h3 className="text-xl font-semibold tracking-tight">Rate this movie</h3>
            <button
              onClick={onClose}
              className="rounded-xl p-2 text-zinc-400 hover:bg-white/10 hover:text-zinc-100"
              aria-label="Close"
            >
              ×
            </button>
          </div>

          {/* Body */}
          <div className="grid gap-4 p-5 sm:grid-cols-[120px,1fr]">
            {/* Poster grande con cornice */}
            <div className="relative">
              <div className="overflow-hidden rounded-xl border border-white/10 bg-zinc-900 shadow-lg">
                {poster ? (
                  <img src={poster} alt={title ?? ""} className="h-[180px] w-full object-cover sm:h-[220px]" />
                ) : (
                  <div className="grid h-[180px] place-items-center text-xs text-zinc-500 sm:h-[220px]">No poster</div>
                )}
              </div>
              {/* glow sottile */}
              <div className="pointer-events-none absolute -inset-1 -z-10 rounded-2xl bg-gradient-to-tr from-white/10 to-transparent blur-xl" />
            </div>

            {/* Info + slider */}
            <div className="min-w-0">
              <div className="mb-2 truncate text-lg font-semibold">{title}</div>

              {/* badge media */}
              <div className="mb-4 inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-sm shadow-sm backdrop-blur-sm border-white/10 bg-white/5">
                <span className="mr-0.5">⭐</span>
                <span className="font-semibold">{avg == null ? "-" : formatScore(avg)}</span>
                <span className="ml-1 text-zinc-400">({count})</span>
              </div>

              {/* slider area */}
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                  Your vote
                </div>

                {/* Slider + pill dinamica */}
                <div className="relative">
                  <ScoreSlider
                    value={val}
                    onChange={(n: number) => setVal(clampToQuarter(n))}
                    min={0}
                    max={10}
                    step={0.25}
                  />
                  {/* pill valore attaccata al thumb (approssimazione percentuale) */}
                  <div
                    className={`pointer-events-none absolute -top-7 translate-x-[-50%] rounded-md border px-2 py-0.5 text-sm font-semibold ${chip} border`}
                    style={{ left: `${(val / 10) * 100}%` }}
                  >
                    {formatScore(val)}
                  </div>
                </div>

                {/* scala rapida */}
                <div className="mt-3 flex flex-wrap gap-2">
                  {[3, 5, 6.5, 8, 9.5].map((n) => (
                    <button
                      key={n}
                      onClick={() => setVal(n)}
                      className="rounded-lg border border-white/10 px-2 py-1 text-xs text-zinc-300 hover:bg-white/10"
                      type="button"
                    >
                      {n}
                    </button>
                  ))}
                  <span className="ml-auto text-[11px] text-zinc-400">←/→ = ±0.25 · Enter = Save</span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 border-t border-white/10 px-5 py-4">
            <button
              onClick={onClose}
              className="rounded-xl border border-white/10 px-4 py-2 text-sm text-zinc-200 hover:bg-white/10"
            >
              Cancel
            </button>
            <button
              onClick={() => onSave(clampToQuarter(val))}
              className="rounded-xl border border-emerald-500/30 bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-300 hover:bg-emerald-500/25"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
