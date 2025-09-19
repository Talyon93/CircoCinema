// filepath: src/Components/EditViewingDialog.tsx
import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { VotesBar } from "./UI/VotesBar";
import { ScoreDonut } from "./UI/ScoreDonut";
import ScoreSlider from "./UI/ScoreSlider";
import { tmdbSearch, tmdbDetails, getPosterUrl } from "../TMDBHelper";

function clamp(v: number, lo = 1, hi = 10) { return Math.max(lo, Math.min(hi, v)); }
function roundQuarter(v: number) { return Math.round(v / 0.25) * 0.25; }
function toNumberSafe(v: any, fallback = 7) { const n = Number(v); return Number.isFinite(n) ? n : fallback; }
function toLocalDatetimeInputValue(iso?: string) {
  const d = iso ? new Date(iso) : new Date(); const pad = (n:number)=>String(n).padStart(2,"0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fromLocalDatetimeInputValue(s: string) {
  const d = new Date(s.replace("T", " ") + ":00");
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), 0, 0).toISOString();
}

/* ---------- Integrated modal for changing the movie ---------- */
function ChangeMovieModal({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (movie: any) => void;
}) {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) { setQ(""); setResults([]); setErr(null); }
  }, [open]);

  const search = async () => {
    const query = q.trim();
    if (!query) return;
    setErr(null);
    setLoading(true);
    try {
      const res = await tmdbSearch(query);
      setResults(res.slice(0, 12));
    } catch (e: any) {
      setErr(e?.message || "Search error");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-3xl rounded-2xl border border-zinc-800/70 bg-zinc-950 text-zinc-100 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-800/70 px-4 py-3">
          <h4 className="text-base font-semibold">Change movie</h4>
          <button
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm hover:bg-zinc-900"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="px-4 py-3">
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="text-xs text-zinc-400">Search a movie</label>
              <input
                className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2"
                placeholder="e.g. The Matrix"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && search()}
              />
            </div>
            <button
              onClick={search}
              disabled={!q.trim() || loading}
              className="rounded-xl bg-sky-600 px-4 py-2 font-semibold text-white disabled:opacity-40 hover:bg-sky-500"
            >
              {loading ? "…" : "Search"}
            </button>
          </div>

          {err && <div className="mt-2 text-sm text-red-400">{err}</div>}

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {results.map((r) => (
              <button
                key={r.id}
                className="flex gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-2 text-left hover:bg-zinc-900"
                onClick={async () => {
                  const det = await tmdbDetails(r.id);
                  onPick(det || r);
                  onClose();
                }}
              >
                {r.poster_path && (
                  <img
                    src={getPosterUrl(r.poster_path, "w185")}
                    alt={r.title}
                    className="h-24 w-16 rounded-lg object-cover"
                  />
                )}
                <div className="flex-1">
                  <div className="font-semibold">
                    {r.title}{" "}
                    {r.release_date ? (
                      <span className="text-zinc-400">({String(r.release_date).slice(0, 4)})</span>
                    ) : null}
                  </div>
                  <div className="line-clamp-3 text-sm text-zinc-300">{r.overview}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function EditViewingDialog({
  open,
  viewing,
  knownUsers,
  currentUser,
  onClose,
  onSave,
  onDelete,
}: {
  open: boolean;
  viewing: any;
  knownUsers: string[];
  currentUser: string;
  onClose: () => void;
  onSave: (next: any) => void;
  onDelete: (view?: any) => void;
}) {
  const [movie, setMovie] = useState(viewing?.movie || null);
  const [ratings, setRatings] = useState<Record<string, number>>(viewing?.ratings || {});
  const [date, setDate] = useState<string>(toLocalDatetimeInputValue(viewing?.started_at));
  const [pickOpen, setPickOpen] = useState(false);

  useEffect(() => {
    setMovie(viewing?.movie || null);
    setRatings(viewing?.ratings || {});
    setDate(toLocalDatetimeInputValue(viewing?.started_at));
  }, [viewing?.id]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) save();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ratings, date, movie]);

  const entries = useMemo(
    () => Object.entries(ratings).map(([k, v]) => [k, Number(v)] as [string, number]),
    [ratings]
  );
  const values = entries.map(([, v]) => v);
  const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;

  const myScore = ratings[currentUser];
  const hasMyVote = currentUser in ratings;

  const setMyScore = (v: number) => {
    const clean = roundQuarter(clamp(toNumberSafe(v, 7)));
    setRatings((prev) => ({ ...prev, [currentUser]: clean }));
  };

  const addMyVote = () => {
    if (!hasMyVote) setRatings((prev) => ({ ...prev, [currentUser]: 7 }));
  };

  const save = () => {
    onSave({
      ...viewing,
      movie,
      ratings,
      started_at: fromLocalDatetimeInputValue(date),
    });
  };

  const confirmDelete = () => {
  const title =
    movie?.title ||
    viewing?.movie?.title ||
    "this viewing";
  if (window.confirm(`Delete "${title}"? This action cannot be undone.`)) {
    // Passa al parent: prima l'id se c'è, altrimenti l'intero oggetto
    const payload = viewing?.id ?? viewing ?? null;
    try {
      onDelete(payload as any);
    } finally {
      onClose(); // chiudi sempre il dialog per evitare UI stantie
    }
  }
};

  if (!open) return null;

  const ScoreEditor = () => {
    if (!hasMyVote) {
      return (
        <div className="rounded-xl border border-zinc-800/70 bg-zinc-900/40 p-4 text-sm">
          You haven&apos;t voted yet.
          <div className="mt-3">
            <button
              onClick={addMyVote}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
            >
              Add my vote
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="rounded-2xl border border-zinc-800/70 bg-zinc-900/40 p-4 md:p-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-sm text-zinc-300">Choose your score</div>
          <div className="rounded-full border border-zinc-700 px-2 py-0.5 text-xs text-zinc-300">
            {Number(myScore).toFixed(2)}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex-1">
            <ScoreSlider value={Number(myScore ?? 7)} onChange={setMyScore} min={1} max={10} step={0.25} />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setMyScore((myScore ?? 7) - 0.25)}
              className="rounded-lg border border-zinc-700 bg-zinc-900/60 px-3 py-1.5 text-sm hover:bg-zinc-800"
              title="-0.25"
            >
              −
            </button>
            <button
              onClick={() => setMyScore((myScore ?? 7) + 0.25)}
              className="rounded-lg border border-zinc-700 bg-zinc-900/60 px-3 py-1.5 text-sm hover:bg-zinc-800"
              title="+0.25"
            >
              +
            </button>
          </div>
        </div>
      </div>
    );
  };

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-3 md:p-6"
        role="dialog" aria-modal="true" aria-labelledby="edit-viewing-title"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div
          className="w-full max-w-3xl overflow-hidden rounded-2xl border border-zinc-800/70 bg-zinc-950/95 text-zinc-100 shadow-2xl ring-1 ring-black/40 backdrop-blur-sm"
          onClick={(e)=>e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-3 border-b border-zinc-800/70 px-4 py-3 md:px-6">
            <div>
              <h3 id="edit-viewing-title" className="text-base font-semibold">Edit Viewing</h3>
              <p className="mt-0.5 text-xs text-zinc-400">
                {avg !== null ? `Avg ${avg.toFixed(2)} • ${entries.length} vote${entries.length!==1?"s":""}` : "No votes yet"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
              type="button" 
                onClick={confirmDelete}
                className="rounded-xl border border-red-900/60 bg-red-950/30 px-3 py-1.5 text-sm font-medium text-red-300 hover:bg-red-900/30"
              >
                Delete
              </button>
              <button
                onClick={onClose}
                className="rounded-xl border border-zinc-700/70 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-800"
              >
                Close
              </button>
            </div>
          </div>

          {/* Top summary */}
          <div className="flex items-center gap-4 px-4 pb-3 pt-4 md:px-6">
            {avg !== null && <ScoreDonut value={avg} size={56} />}
            <div className="flex-1">
              <div className="mb-1 text-xs text-zinc-400">Avg {entries.length ? `(${entries.length} votes)` : ""}</div>
              <VotesBar entries={entries} avg={avg ?? undefined} size="sm" showHeader={false} />
            </div>
          </div>

          {/* Content */}
          <div className="grid gap-5 px-4 pb-4 md:px-6">
            {/* Movie */}
            <div>
              <label className="text-xs text-zinc-300">Movie</label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="text"
                  value={movie?.title ?? ""}
                  onChange={(e) => setMovie({ ...(movie || {}), title: e.target.value })}
                  placeholder="Movie title"
                  className="flex-1 rounded-xl border border-zinc-800/70 bg-zinc-900/60 px-3 py-2 text-zinc-100 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                />
                <button
                  type="button"
                  onClick={() => setPickOpen(true)}
                  className="rounded-xl bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-500"
                >
                  Change
                </button>
              </div>
            </div>

            {/* Date */}
            <div>
              <label className="text-xs text-zinc-300">Date</label>
              <input
                type="datetime-local"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1 w-full rounded-xl border border-zinc-800/70 bg-zinc-900/60 px-3 py-2 text-zinc-100 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
              />
            </div>

            {/* Only my vote */}
            <div>
              <div className="mb-1 text-xs text-zinc-500">You can only edit your vote</div>
              <ScoreEditor />
            </div>
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-zinc-800/70 bg-zinc-950/95 px-4 py-3 md:px-6">
            <button
              onClick={save}
              className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500"
              title="Ctrl/Cmd+Enter"
            >
              Save
            </button>
          </div>
        </div>
      </div>

      {/* Integrated picker modal */}
      <ChangeMovieModal
        open={pickOpen}
        onClose={() => setPickOpen(false)}
        onPick={(m) => setMovie(m)}
      />
    </>,
    document.body
  );
}
