import React, { useEffect, useMemo, useState } from "react";
import { tmdbDetails, tmdbSearch, omdbRatingFromImdbId, mergeMovie, fetchMetaForTitle, ensureRuntime, ensureGenres, getPosterUrl } from "../../TMDBHelper";

// LocalStorage helpers + costanti chiave
import {
  K_USER,
  K_VIEWINGS,
  K_ACTIVE_VOTE,
  K_ACTIVE_RATINGS,
  K_PROFILE_PREFIX,
  K_TMDB_CACHE,
  K_THEME,
  lsGetJSON,
  lsSetJSON,
  getMetaCache,
  setMetaCache,
  loadAvatarFor,
} from "../../localStorage";

import { ScoreDonut } from "./ScoreDonut";
import { VotesBar } from "./VotesBar";
import { PickedByBadge } from "./PickedByBadge";
import { VoterChip } from "./VoterChip";
import { formatScore } from "../../Utils/Utils";


export function HistoryCardExtended({
  v,
  onEdit,
  onMetaResolved,
}: {
  v: any;
  onEdit?: (id: any) => void;
  onMetaResolved?: (viewingId: any, nextMovie: any) => void;
}) {
  const ratings = (v.ratings || {}) as Record<string, number>;
  const entries = Object.entries(ratings) as [string, number][];
  const scores = entries.map(([, n]) => Number(n));
  const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;

  const releaseYear =
    v?.movie?.release_year ||
    (v?.movie?.release_date ? String(v.movie.release_date).slice(0, 4) : null);

  const genreLine = Array.isArray(v?.movie?.genres)
    ? v.movie.genres.map((g: any) => g?.name).filter(Boolean).join(", ")
    : "";

  // ----- lazy meta (poster/overview) + cache -----
  const [meta, setMeta] = React.useState<{ poster_path?: string; overview?: string }>({
    poster_path: v?.movie?.poster_path,
    overview: v?.movie?.overview,
  });
  React.useEffect(() => {
    setMeta({
      poster_path: v?.movie?.poster_path,
      overview: v?.movie?.overview,
    });
  }, [v?.id, v?.movie?.id, v?.movie?.poster_path, v?.movie?.overview]);

  const persistOnceRef = React.useRef(false);
  const tryPersist = (cand: { poster_path?: string; overview?: string }) => {
    if (persistOnceRef.current) return;
    const needPoster = !v?.movie?.poster_path && cand.poster_path;
    const needOverview = !v?.movie?.overview && (cand.overview && cand.overview.trim());
    if (needPoster || needOverview) {
      persistOnceRef.current = true;
      const nextMovie = { ...v.movie, ...cand };
      onMetaResolved?.(v.id, nextMovie);
    }
  };

  const inFlightTitleRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    const title = (v?.movie?.title || "").trim();
    if (!title) return;

    const needPoster = !meta?.poster_path;
    const needOverview = !meta?.overview || meta.overview.trim().length === 0;
    if (!needPoster && !needOverview) return;
    if (inFlightTitleRef.current === title) return;
    inFlightTitleRef.current = title;

    // 1) cache
    const cache = getMetaCache();
    const cached = cache[title];
    if (cached && (cached.poster_path || cached.overview)) {
      setMeta((m) => {
        const merged = {
          poster_path: m.poster_path || cached.poster_path,
          overview: m.overview || cached.overview,
        };
        tryPersist(merged);
        return merged;
      });
      inFlightTitleRef.current = null;
      return;
    }

    // 2) fetch
    (async () => {
      try {
        const fetched = await fetchMetaForTitle(title);
        if (fetched) {
          setMeta((m) => {
            const merged = {
              poster_path: m.poster_path || fetched.poster_path,
              overview: m.overview || fetched.overview,
            };
            tryPersist(merged);
            return merged;
          });
          const c = getMetaCache();
          c[title] = { poster_path: fetched.poster_path, overview: fetched.overview };
          setMetaCache(c);
        }
      } finally {
        inFlightTitleRef.current = null;
      }
    })();
  }, [v?.movie?.title, meta?.poster_path, meta?.overview]);
  // -----------------------------------------------

  const poster = meta?.poster_path ? getPosterUrl(meta.poster_path, "w342") : "";
  const overview = (meta?.overview || "").trim();

  // --- UI helpers (ring & bar) ---
  const AvgRing = ({ value }: { value: number }) => {
    const r = 26, c = 2 * Math.PI * r, pct = Math.max(0, Math.min(100, ((value - 1) / 9) * 100));
    return (
      <div className="relative h-16 w-16">
        <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90">
          <circle cx="32" cy="32" r={r} strokeWidth="8" className="fill-none stroke-zinc-800/60" />
          <circle cx="32" cy="32" r={r} strokeWidth="8" className="fill-none stroke-lime-400"
                  strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - (pct / 100) * c}/>
        </svg>
        <div className="absolute inset-0 grid place-items-center text-sm font-bold">
          {formatScore(value)}
        </div>
      </div>
    );
  };

  return (
    <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm ring-1 ring-black/5 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900/60">
      {/* Header */}
      <div className="mb-3 flex items-center gap-3">
        {v.picked_by && (
          <>
            <PickedByBadge name={v.picked_by} />
            <div className="mx-1 text-gray-300">•</div>
          </>
        )}

        <h3 className="min-w-0 text-lg font-semibold leading-tight">
          <span className="break-words">{v.movie?.title || "Untitled"}</span>
          {releaseYear && <span className="ml-2 text-gray-500">({releaseYear})</span>}
        </h3>

        {onEdit && (
          <button
            className="ml-2 rounded-full border px-2.5 py-1 text-xs dark:border-zinc-700"
            onClick={() => onEdit(v.id)}
          >
            Edit
          </button>
        )}

        {v.started_at && (
          <span className="ml-auto rounded-full bg-gray-50 px-2.5 py-1 text-xs text-gray-600 dark:bg-zinc-900 dark:text-zinc-400 dark:border dark:border-zinc-800">
            {new Date(v.started_at).toLocaleString()}
          </span>
        )}
      </div>

      {/* Layout: poster grande + info a destra */}
      <div className="grid gap-5 md:grid-cols-[176px,1fr]">
        <div className="flex items-start justify-center">
          {poster ? (
            <img
              src={poster}
              alt={v.movie?.title}
              className="h-[264px] w-[176px] rounded-2xl border border-gray-200 object-cover shadow-sm dark:border-zinc-700"
            />
          ) : (
            <div className="flex h-[264px] w-[176px] items-center justify-center rounded-2xl border border-dashed text-xs text-gray-500 dark:border-zinc-700 dark:text-zinc-400">
              No poster
            </div>
          )}
        </div>

        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-gray-600 dark:text-zinc-400">
            {releaseYear && <span className="rounded-full border px-2 py-0.5 dark:border-zinc-700">📅 {releaseYear}</span>}
            {Number(v?.movie?.runtime) > 0 && <span className="rounded-full border px-2 py-0.5 dark:border-zinc-700">⏱ {v.movie.runtime} min</span>}
            {genreLine && <span className="rounded-full border px-2 py-0.5 dark:border-zinc-700">{genreLine}</span>}
            {typeof v?.movie?.imdb_rating === "number" ? (
              <span className="rounded-full border px-2 py-0.5 dark:border-zinc-700">★ IMDb {formatScore(v.movie.imdb_rating)}</span>
            ) : typeof v?.movie?.tmdb_vote_average === "number" ? (
              <span className="rounded-full border px-2 py-0.5 dark:border-zinc-700">★ TMDB {formatScore(v.movie.tmdb_vote_average)}</span>
            ) : null}
            {typeof v?.movie?.tmdb_vote_count === "number" && v.movie.tmdb_vote_count > 0 && (
              <span className="rounded-full border px-2 py-0.5 dark:border-zinc-700">
                {v.movie.tmdb_vote_count.toLocaleString()} votes
              </span>
            )}
          </div>

          <p className="mb-4 whitespace-pre-wrap text-[15px] leading-relaxed text-gray-800 dark:text-zinc-300">
            {overview || "No description available."}
          </p>

          <div className="flex items-center gap-4">
            {avg !== null && <ScoreDonut value={avg} />}
            <div className="flex-1">
              <VotesBar entries={entries} avg={avg} />
            </div>
          </div>
          {entries.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {Object.entries(ratings)
                .sort((a, b) => Number(b[1]) - Number(a[1]) || a[0].localeCompare(b[0]))
                .map(([name, score]) => (
                  <VoterChip key={name} name={name} score={Number(score)} />
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
