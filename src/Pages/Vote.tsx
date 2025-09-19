import React, { useEffect, useMemo, useRef, useState } from "react";
import { Card } from "../Components/UI/Card";
import { VotesBar } from "../Components/UI/VotesBar";
import { PickerBadgePro } from "../Components/UI/PickerPro";
import { VoterChip } from "../Components/UI/VoterChip";
import { formatScore } from "../Utils/Utils";
import { getPosterUrl, tmdbDetails, tmdbSearch } from "../TMDBHelper";
import { AvatarInline } from "../Components/UI/Avatar";
import { sb } from "../supabaseClient";
import { ensureLiveFileExists, loadHistoryLive, subscribeHistoryLive } from "../storage";
import { K_VIEWINGS, lsGetJSON } from "../localStorage";
import { loadSharedState, saveSharedState, subscribeSharedState, SharedState } from "../state";
import ScoreSlider from "../Components/UI/ScoreSlider";
import { setNextPicker } from "../state";
import { LuckyCarousel } from "../Components/UI/LuckyCarousel";

/* ===================== Types ===================== */
export type ActiveSession = {
  id: any;
  movie: any;
  picked_by?: string;
  opened_by?: string;
  openedBy?: string;   // compat
  started_at: string;
};

type HistoryViewing = {
  id: any;
  movie: any;
  ratings?: Record<string, number>;
  avg?: number;
};

type Props = {
  currentUser: string;
  knownUsers: string[];
  activeVote: ActiveSession | null;
  activeRatings: Record<string, number>;
  onStartVoting: (movie: any, pickedBy: string) => void;
  onSendVote: (score: number) => void;
  onEndVoting: () => void;
  onCancelVoting?: () => void;
  historyViewings?: HistoryViewing[];
};

/* ===================== Helpers ===================== */
function computeAvg(ratings?: Record<string, number> | null): number | null {
  if (!ratings) return null;
  const vals = Object.values(ratings).map(Number).filter((n) => !Number.isNaN(n));
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}
const uniq = <T,>(arr: T[]) => Array.from(new Set(arr));

/* ===================== Search ===================== */
function SearchMovie({ onPick }: { onPick: (movie: any) => void }) {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);

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

  return (
    <Card>
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <label className="text-sm text-gray-600 dark:text-zinc-400">Search a movie</label>
          <input
            className="w-full rounded-xl border px-3 py-2 border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
            placeholder="e.g. The Matrix"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search()}
          />
        </div>
        <button
          onClick={search}
          className="rounded-xl bg-black px-4 py-2 text-white disabled:opacity-30 dark:bg-white dark:text-black"
          disabled={!q.trim() || loading}
        >
          {loading ? "…" : "Search"}
        </button>
      </div>
      {err && <p className="mt-2 text-sm text-red-600">{err}</p>}

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {results.map((r) => (
          <button
            key={r.id}
            className="flex gap-3 rounded-xl border p-2 text-left transition hover:bg-gray-50 dark:hover:bg-zinc-900 border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
            onClick={async () => {
              const det = await tmdbDetails(r.id);
              onPick(det || r);
              setResults([]);
            }}
            title="Pick this movie"
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
                  <span className="text-gray-500">({String(r.release_date).slice(0, 4)})</span>
                ) : null}
              </div>
              <div className="line-clamp-3 text-sm text-gray-700 dark:text-zinc-300">{r.overview}</div>
            </div>
          </button>
        ))}
      </div>
    </Card>
  );
}

/* ===================== Who picked ===================== */
function WhoPicked({
  known,
  value,
  onChange,
  currentUser,
}: {
  known: string[];
  value: string;
  onChange: (v: string) => void;
  currentUser: string;
}) {
  const [q, setQ] = useState(value || currentUser || "");
  useEffect(() => setQ(value), [value]);

  const filtered = useMemo(() => {
    const norm = q.trim().toLowerCase();
    return known.filter((n) => n.toLowerCase().includes(norm)).slice(0, 12);
  }, [known, q]);

  return (
    <div className="grid gap-2">
      <div className="flex gap-2">
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            onChange(e.target.value);
          }}
          placeholder="Who picked it?"
          className="flex-1 rounded-xl border px-3 py-2 border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
        />
      </div>

      {filtered.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {filtered.map((n) => (
            <button
              type="button"
              key={n}
              onClick={() => {
                setQ(n);
                onChange(n);
              }}
              className={[
                "group inline-flex items-center gap-2 rounded-full",
                "border px-2.5 py-1.5 text-sm transition",
                "bg-white hover:bg-gray-50 dark:bg-zinc-900 dark:hover:bg-zinc-800",
                "border-gray-300 dark:border-zinc-700",
              ].join(" ")}
              title={n}
            >
              <AvatarInline name={n} size={18} className="ring-2 ring-amber-400/40" />
              <span className="font-medium">{n}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ===================== StartVote ===================== */
function StartVoteCard({
  movie,
  knownUsers,
  currentUser,
  onStartVoting,
}: {
  movie: any;
  knownUsers: string[];
  currentUser: string;
  onStartVoting: (movie: any, pickedBy: string) => void;
}) {
  const [pickedBy, setPickedBy] = useState("");
  const valid = pickedBy.trim().length > 0;

  return (
    <Card>
      <div className="flex gap-4">
        {movie?.poster_path && (
          <img
            src={getPosterUrl(movie.poster_path, "w342")}
            className="h-48 w-32 rounded-xl object-cover"
            alt={movie.title}
          />
        )}
        <div className="flex-1">
          <h3 className="text-xl font-bold">
            {movie?.title}{" "}
            {movie?.release_date ? (
              <span className="text-gray-500">({String(movie.release_date).slice(0, 4)})</span>
            ) : null}
          </h3>
          {movie?.overview && (
            <p className="mt-1 whitespace-pre-wrap text-gray-700 dark:text-zinc-300">{movie.overview}</p>
          )}

          <div className="mt-4 grid gap-2">
            <label className="text-sm font-medium text-gray-700 dark:text-zinc-300">Picked by</label>
            <WhoPicked known={knownUsers} currentUser={currentUser} value={pickedBy} onChange={setPickedBy} />
          </div>

          <div className="mt-4">
            <button
              className="rounded-xl bg-black px-4 py-2 text-white disabled:opacity-30 dark:bg-white dark:text-black"
              disabled={!valid}
              onClick={() => onStartVoting(movie, pickedBy.trim())}
            >
              Start voting
            </button>
          </div>
        </div>
      </div>
    </Card>
  );
}

/* ===================== ActiveVoting ===================== */
function ActiveVoting({
  movie,
  pickedBy,
  openedBy,
  currentUser,
  ratings,
  onSendVote,
  onEnd,
  onCancel,
}: {
  movie: any;
  pickedBy?: string;
  openedBy?: string;
  currentUser: string;
  ratings: Record<string, number>;
  onSendVote: (score: number) => void;
  onEnd: () => void;
  onCancel?: () => void;
}) {
  const you = ratings[currentUser];
  const hasVoted = typeof you === "number";
  const [openVote, setOpenVote] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [temp, setTemp] = useState<number>(you ?? 7);

  useEffect(() => {
    if (typeof you === "number") setTemp(you);
  }, [you]);

  const submit = () => {
    onSendVote(Math.round(temp / 0.25) * 0.25);
    setOpenVote(false);
    setEditMode(false);
  };

  const entries = Object.entries(ratings) as [string, number][];
  const scores = entries.map(([, n]) => Number(n));
  const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;

  const sorted = entries
    .slice()
    .sort((a, b) => Number(b[1]) - Number(a[1]) || a[0].localeCompare(b[0]));

  const releaseYear =
    movie?.release_year || (movie?.release_date ? String(movie.release_date).slice(0, 4) : null);

  const genreLine = Array.isArray(movie?.genres)
    ? movie.genres.map((g: any) => g?.name).filter(Boolean).join(", ")
    : "";

  const poster = movie?.poster_path ? getPosterUrl(movie.poster_path, "w342") : "";

  const normalize = (s?: string) => (s || "").trim().toLowerCase();
  const isOwner = normalize(openedBy) === normalize(currentUser);

  const votesByUser: Record<string, number> = ratings || {};
  const groupAvg = avg;
  const me = currentUser;

  const roomId = "global";
  const viewingId =
    (movie?.id ?? movie?.imdb_id ?? movie?.tmdb_id) ??
    `${(movie?.title || "unknown").trim()}|${releaseYear || ""}`;

return (
  <div className="rounded-3xl border border-zinc-800/70 bg-zinc-900/60 p-5 shadow-sm ring-1 ring-black/5">
    {/* Header */}
    <div className="mb-4 grid items-start gap-3 md:grid-cols-[auto,1fr]">
      <div className="flex items-center gap-2">
        {pickedBy && <PickerBadgePro name={pickedBy} />}
      </div>

      <div className="min-w-0">
        <h2 className="text-xl font-semibold tracking-tight text-zinc-100">
          Voting in progress · {movie?.title}
          {releaseYear && <span className="ml-1 text-zinc-400">({releaseYear})</span>}
        </h2>

        <div className="mt-2 flex flex-wrap items-center gap-2 text-[13px]">
          {Number(movie?.runtime) > 0 && (
            <span className="rounded-full border border-zinc-700/80 bg-zinc-800/50 px-2 py-0.5 text-zinc-300">
              ⏱ {movie.runtime} min
            </span>
          )}
          {genreLine && (
            <span className="rounded-full border border-zinc-700/80 bg-zinc-800/50 px-2 py-0.5 text-zinc-300">
              {genreLine}
            </span>
          )}
        </div>
      </div>
    </div>

    {/* Body */}
    <div className="grid gap-5 md:grid-cols-[176px,1fr]">
      {/* Poster */}
      <div className="flex items-start justify-center">
        {poster ? (
          <img
            src={poster}
            alt={movie?.title}
            className="h-[264px] w-[176px] rounded-2xl border border-zinc-800 object-cover shadow-sm"
          />
        ) : (
          <div className="flex h-[264px] w-[176px] items-center justify-center rounded-2xl border border-dashed border-zinc-700 text-xs text-zinc-400">
            No poster
          </div>
        )}
      </div>

      {/* Right column */}
      <div className="min-w-0">
        {/* Overview */}
        {movie?.overview && (
          <p className="mb-4 whitespace-pre-wrap text-[15px] leading-relaxed text-zinc-300">
            {movie.overview}
          </p>
        )}

        {/* Top row: (avg donut) + (votes bar only dopo il voto) */}
        <div className="mb-3">
          <div className="flex items-center gap-6">
            {avg !== null && (
              <div className="relative h-16 w-16">
                <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90">
                  <circle cx="32" cy="32" r="26" strokeWidth="8" className="fill-none stroke-zinc-800/60" />
                  <circle
                    cx="32"
                    cy="32"
                    r="26"
                    strokeWidth="8"
                    className="fill-none stroke-lime-400"
                    strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 26}
                    strokeDashoffset={
                      2 * Math.PI * 26 -
                      ((Math.max(1, Math.min(10, avg)) - 1) / 9) * (2 * Math.PI * 26)
                    }
                  />
                </svg>
                <div className="absolute inset-0 grid place-items-center text-sm font-bold text-zinc-100">
                  {formatScore(avg)}
                </div>
              </div>
            )}

            {/* VotesBar appare solo dopo che hai votato */}
            {hasVoted && (
              <div className="flex-1">
                <VotesBar
                  entries={Object.entries(votesByUser)}
                  avg={groupAvg}
                  currentUser={me}
                  roomId={roomId}
                  targetId={String(viewingId)}
                  interactive
                  showButtons={false}
                />
              </div>
            )}
          </div>
        </div>

        {/* CTA / Voto */}
        {hasVoted ? (
          <>
            <div className="mt-2 flex items-center justify-between gap-3 rounded-2xl border border-zinc-800/80 bg-zinc-900/70 p-3">
              <div className="flex items-center gap-2 text-sm text-zinc-200">
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                <span><b>Vote saved.</b> Please wait for others…</span>
              </div>
              <button
                className="rounded-xl border border-zinc-700 px-3 py-2 text-zinc-200 hover:bg-zinc-800/60"
                onClick={() => {
                  setTemp(you ?? 7);
                  setEditMode(true);
                }}
              >
                Edit vote
              </button>
            </div>

            {editMode && (
              <div className="mt-3 rounded-2xl border border-zinc-800/80 bg-zinc-900/70 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-sm text-zinc-300">
                    Edit your vote <span className="text-zinc-500">(current: {formatScore(you)})</span>
                  </div>
                  <div className="rounded-full border border-zinc-700 px-2 py-0.5 text-xs text-zinc-300">
                    {formatScore(temp)}
                  </div>
                </div>
                <ScoreSlider value={temp} onChange={setTemp} min={1} max={10} step={0.25} />
                <div className="mt-3 flex items-center gap-2">
                  <button
                    className="rounded-xl bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-700"
                    onClick={() => {
                      onSendVote(Math.round(temp / 0.25) * 0.25);
                      setEditMode(false);
                    }}
                  >
                    Save
                  </button>
                  <button
                    className="rounded-xl border border-zinc-700 px-3 py-2 text-zinc-200 hover:bg-zinc-800/60"
                    onClick={() => setEditMode(false)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="mt-1">
            {!openVote ? (
              <button
                className="rounded-2xl bg-emerald-600 px-5 py-2.5 text-[15px] font-semibold text-white shadow hover:bg-emerald-700 active:scale-[0.99]"
                onClick={() => setOpenVote(true)}
              >
                Vote
              </button>
            ) : (
              <div className="mt-2 rounded-2xl border border-zinc-800/80 bg-zinc-900/70 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-sm text-zinc-300">Choose your score</div>
                  <div className="rounded-full border border-zinc-700 px-2 py-0.5 text-xs text-zinc-300">
                    {formatScore(temp)}
                  </div>
                </div>
                <ScoreSlider value={temp} onChange={setTemp} min={1} max={10} step={0.25} />
                <div className="mt-3 flex items-center gap-2">
                  <button
                    className="rounded-xl bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-700"
                    onClick={() => {
                      onSendVote(Math.round(temp / 0.25) * 0.25);
                      setOpenVote(false);
                    }}
                  >
                    Submit vote
                  </button>
                  <button
                    className="rounded-xl border border-zinc-700 px-3 py-2 text-zinc-200 hover:bg-zinc-800/60"
                    onClick={() => {
                      setOpenVote(false);
                      setTemp(you ?? 7);
                    }}
                  >
                    Cancel
                  </button>
                  <span className="ml-auto text-sm font-semibold text-zinc-200">{formatScore(temp)}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Live votes */}
        <div className="mt-6">
          <div className="mb-2 text-[13px] font-semibold text-zinc-200">Live votes</div>
          {sorted.length === 0 ? (
            <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-3 text-sm text-zinc-300">
              No votes yet — be the first!
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {sorted.map(([name, score]) => (
                <VoterChip key={name} name={name} score={Number(score)} currentUser={currentUser} />
              ))}
            </div>
          )}
        </div>

        {/* Owner actions */}
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            className="rounded-xl border border-zinc-700 px-4 py-2 text-zinc-100 hover:bg-zinc-800/60 disabled:opacity-40"
            onClick={onEnd}
            disabled={!isOwner}
            title={isOwner ? "Save results and close voting" : "Only the host can end voting"}
          >
            End voting
          </button>
          {onCancel && (
            <button
              className="rounded-xl border border-zinc-700 px-4 py-2 text-rose-400 hover:bg-zinc-800/60 disabled:opacity-40"
              onClick={() => {
                if (!isOwner) return;
                if (confirm("Cancel this voting? All votes will be discarded.")) onCancel();
              }}
              disabled={!isOwner}
              title={isOwner ? "Cancel without saving results" : "Only the host can cancel"}
            >
              Cancel voting
            </button>
          )}
        </div>
      </div>
    </div>
  </div>
);

}


/* ===================== Closed recap (con Carousel) ===================== */
function ClosedRecapCard({
  movie,
  pickedBy,
  ratings,
  history,
  onClose,
  openedBy,
  currentUser, 
}: {
  movie: any;
  pickedBy?: string;
  ratings: Record<string, number>;
  history?: { id: any; movie: any; ratings?: Record<string, number>; avg?: number }[];
  onClose: () => void;
  openedBy?: string;
  currentUser?: string;
}) {
  const entries = Object.entries(ratings) as [string, number][];
  const scores = entries.map(([, v]) => Number(v));
  const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
  const [nextPicker, setNextPickerState] = React.useState<string | null>(null);

  React.useEffect(() => {
    let off: (() => void) | null = null;
    (async () => {
      try {
        const s = await loadSharedState();
        setNextPickerState(
          ((s as any)?.nextPicker?.name) ??
          ((s as any)?.slot?.winner) ??   // LuckyCarousel
          ((s as any)?.wheel?.winner) ??  // legacy compat
          null
        );
        off = subscribeSharedState((n: SharedState) => {
          setNextPickerState(
            ((n as any)?.nextPicker?.name) ??
            ((n as any)?.slot?.winner) ??
            ((n as any)?.wheel?.winner) ??
            null
          );
        });
      } catch {}
    })();
    return () => off?.();
  }, []);

  const poster = movie?.poster_path ? getPosterUrl(movie.poster_path, "w342") : "";
  const releaseYear =
    movie?.release_year || (movie?.release_date ? String(movie.release_date).slice(0, 4) : null);
  const genreLine = Array.isArray(movie?.genres)
    ? movie.genres.map((g: any) => g?.name).filter(Boolean).join(", ")
    : "";

  const allHistoricalVoters = useMemo(() => {
    const fromHistory = (history || []).flatMap((v) => Object.keys(v.ratings || {}));
    const fromThis = Object.keys(ratings || {});
    return uniq([...fromHistory, ...fromThis]).sort((a, b) => a.localeCompare(b));
  }, [history, ratings]);

  const ranking = React.useMemo(() => {
    if (!history || avg == null) return null;
    const items = history
      .map((v) => {
        const a = typeof v.avg === "number" ? v.avg : computeAvg(v.ratings || null);
        const title = v?.movie?.title || "Untitled";
        const year =
          v?.movie?.release_year || (v?.movie?.release_date ? String(v.movie.release_date).slice(0, 4) : null);
        return a != null ? { id: v.id, title, year, avg: a } : null;
      })
      .filter(Boolean) as { id: any; title: string; year?: string | null; avg: number }[];

    const thisKey = `${(movie?.title || "").trim()}|${releaseYear || ""}`.toLowerCase();
    if (!items.some((it) => `${it.title}|${it.year ?? ""}`.toLowerCase() === thisKey)) {
      items.push({ id: "__current__", title: movie?.title || "Untitled", year: releaseYear, avg: avg! });
    }
    items.sort((a, b) => b.avg - a.avg || a.title.localeCompare(b.title));
    const idx = items.findIndex((it) => `${it.title}|${it.year ?? ""}`.toLowerCase() === thisKey);
    const rank = idx >= 0 ? idx + 1 : null;
    const total = items.length;
    return { rank, total, prev: idx > 0 ? items[idx - 1] : null, next: idx < total - 1 ? items[idx + 1] : null };
  }, [history, avg, movie, releaseYear]);

return (
  <Card>
    <div className="mb-2 text-lg font-bold">La votazione è chiusa.</div>

    <div className="grid gap-5 md:grid-cols-[176px,1fr]">
      <div className="flex items-start justify-center">
        {poster ? (
          <img
            src={poster}
            alt={movie?.title || "Poster"}
            className="h-[264px] w-[176px] rounded-2xl border border-zinc-700 object-cover"
          />
        ) : (
          <div className="flex h-[264px] w-[176px] items-center justify-center rounded-2xl border border-dashed text-xs text-zinc-400">
            No poster
          </div>
        )}
      </div>

      <div className="min-w-0">
        <div className="text-xl font-bold">
          {movie?.title} {releaseYear && <span className="ml-1 text-zinc-400">({releaseYear})</span>}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-zinc-400">
          {Number(movie?.runtime) > 0 && (
            <span className="rounded-full border px-2 py-0.5 dark:border-zinc-700">⏱ {movie.runtime} min</span>
          )}
          {genreLine && (
            <span className="rounded-full border px-2 py-0.5 dark:border-zinc-700">{genreLine}</span>
          )}
          {typeof movie?.imdb_rating === "number" && (
            <span className="rounded-full border px-2 py-0.5 dark:border-zinc-700">
              ★ IMDb {formatScore(movie.imdb_rating)}
            </span>
          )}
          {typeof movie?.tmdb_vote_count === "number" && movie.tmdb_vote_count > 0 && (
            <span className="rounded-full border px-2 py-0.5 dark:border-zinc-700">
              {movie.tmdb_vote_count.toLocaleString()} votes
            </span>
          )}
          {pickedBy && <PickerBadgePro name={pickedBy} />}
        </div>

        {movie?.overview && (
          <p className="mt-3 whitespace-pre-wrap text-[15px] leading-relaxed text-zinc-300">
            {movie.overview}
          </p>
        )}

        <div className="mt-5 flex items-center gap-4">
          <div className="relative h-16 w-16">
            <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90">
              <circle cx="32" cy="32" r="26" strokeWidth="8" className="fill-none stroke-zinc-800/60" />
              <circle
                cx="32"
                cy="32"
                r="26"
                strokeWidth="8"
                className="fill-none stroke-lime-400"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 26}
                strokeDashoffset={
                  2 * Math.PI * 26 -
                  ((Math.max(1, Math.min(10, avg ?? 1)) - 1) / 9) * (2 * Math.PI * 26)
                }
              />
            </svg>
            <div className="absolute inset-0 grid place-items-center text-sm font-bold">
              {avg != null ? formatScore(avg) : "—"}
            </div>
          </div>

          <div className="text-sm">
            {ranking?.rank != null ? (
              <div className="rounded-full border border-amber-500/40 bg-amber-500/15 px-3 py-1 text-amber-200">
                Posizione #{ranking.rank} su {ranking.total}
              </div>
            ) : (
              <div className="text-zinc-400">Nessuna classifica disponibile</div>
            )}
          </div>
        </div>

        <div className="mt-6">
          <button onClick={onClose} className="rounded-xl border px-4 py-2 dark:border-zinc-700">
            Chiudi
          </button>
        </div>
      </div>
    </div>

    {/* ===== Estrazione sotto il recap (LuckyCarousel) ===== */}
    <div className="mt-6">
      <LuckyCarousel
        candidates={allHistoricalVoters}
        roomId="global"
        currentUser={currentUser} /* opzionale se non lo hai qui */
        voteOwner={openedBy} // solo l'host può avviare
        onWinner={async (name) => {
          try {
            await setNextPicker(name);
          } catch {}
        }}
      />
    </div>
  </Card>
);

}

/* ===================== Page ===================== */
export default function VotePage({
  currentUser,
  knownUsers,
  activeVote,
  activeRatings,
  onStartVoting,
  onSendVote,
  onEndVoting,
  onCancelVoting,
  historyViewings,
}: Props) {
  const [pickedMovie, setPickedMovie] = useState<any | null>(null);

  const prevActiveRef = useRef<ActiveSession | null>(null);
  const lastNonEmptyRatingsRef = useRef<Record<string, number>>({});
  const canceledRef = React.useRef(false);
  const [selfHistory, setSelfHistory] = useState<HistoryViewing[] | null>(null);
  const [closedRecap, setClosedRecap] = useState<{
    movie: any;
    picked_by?: string;
    ratings: Record<string, number>;
    opened_by?: string;
  } | null>(null);

  useEffect(() => {
    if (historyViewings && Array.isArray(historyViewings)) {
      setSelfHistory(historyViewings);
      return;
    }

    let offLive: (() => void) | null = null;

    (async () => {
      try {
        if (sb) {
          await ensureLiveFileExists();
          const live = await loadHistoryLive();
          setSelfHistory(Array.isArray(live) ? live : []);
          offLive = subscribeHistoryLive((next) => setSelfHistory(Array.isArray(next) ? next : []));
        } else {
          const hist = lsGetJSON<HistoryViewing[]>(K_VIEWINGS, []);
          setSelfHistory(Array.isArray(hist) ? hist : []);

          const onStorage = (e: StorageEvent) => {
            if (e.key === K_VIEWINGS) {
              const curr = lsGetJSON<HistoryViewing[]>(K_VIEWINGS, []);
              setSelfHistory(Array.isArray(curr) ? curr : []);
            }
          };
          window.addEventListener("storage", onStorage);
          offLive = () => window.removeEventListener("storage", onStorage);
        }
      } catch {
        setSelfHistory([]);
      }
    })();

    return () => { if (offLive) offLive(); };
  }, [historyViewings]);

  useEffect(() => {
    if (activeVote?.movie) {
      prevActiveRef.current = activeVote;
    }
  }, [activeVote]);

  useEffect(() => {
    if (activeRatings && Object.keys(activeRatings).length > 0) {
      lastNonEmptyRatingsRef.current = activeRatings;
    }
  }, [activeRatings]);

  useEffect(() => {
    if (activeVote !== null) return;
    if (!prevActiveRef.current?.movie) return;

    if (canceledRef.current) {
      canceledRef.current = false;
      setClosedRecap(null);
      setPickedMovie(null);
      return;
    }

    const snapshot = lastNonEmptyRatingsRef.current;

    setClosedRecap({
      movie: prevActiveRef.current.movie,
      picked_by: prevActiveRef.current.picked_by,
      ratings: snapshot,
      opened_by: (prevActiveRef.current as any).opened_by ?? (prevActiveRef.current as any).openedBy,
    });
    setPickedMovie(null);
  }, [activeVote]);

  const pickHandler = async (res: any) => setPickedMovie(res || null);

  if (activeVote?.movie) {
    return (
      <ActiveVoting
        movie={activeVote.movie}
        pickedBy={activeVote.picked_by}
        openedBy={activeVote.opened_by ?? (activeVote as any).openedBy}
        currentUser={currentUser}
        ratings={activeRatings}
        onSendVote={onSendVote}
        onEnd={onEndVoting}
        onCancel={() => {
          canceledRef.current = true;
          setPickedMovie(null);
          onCancelVoting?.();
        }}
      />
    );
  }

  if (closedRecap) {
    return (
      <ClosedRecapCard
        movie={closedRecap.movie}
        pickedBy={closedRecap.picked_by}
        ratings={closedRecap.ratings}
        history={historyViewings ?? selfHistory ?? []}
        openedBy={closedRecap.opened_by}
        currentUser={currentUser}
        onClose={() => setClosedRecap(null)}
      />
    );
  }

  return (
    <div className="grid gap-4">
      {!pickedMovie ? (
        <SearchMovie onPick={pickHandler} />
      ) : (
        <StartVoteCard
          movie={pickedMovie}
          knownUsers={knownUsers}
          currentUser={currentUser}
          onStartVoting={onStartVoting}
        />
      )}
    </div>
  );
}
