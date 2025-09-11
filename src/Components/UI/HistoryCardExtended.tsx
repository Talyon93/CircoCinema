import React from "react";
import {
  tmdbDetails,
  tmdbSearch,
  omdbRatingFromImdbId,
  mergeMovie,
  fetchMetaForTitle,
  ensureRuntime,
  ensureGenres,
  getPosterUrl,
} from "../../TMDBHelper";
import { Calendar, Timer, Film, Star, Trophy, Play, Tv } from "lucide-react";

// LocalStorage helpers + costanti chiave
import { getMetaCache, setMetaCache } from "../../localStorage";

import { ScoreDonut } from "./ScoreDonut";
import { VotesBar } from "./VotesBar";
import { PickedByBadge } from "./PickedByBadge";
import { VoterChip } from "./VoterChip";
import { formatScore } from "../../Utils/Utils";

export function HistoryCardExtended({
  v,
  onEdit,
  onMetaResolved,
  // NEW: posizione in classifica (opzionale)
  rank,
  total,
}: {
  v: any;
  onEdit?: (id: any) => void;
  onMetaResolved?: (viewingId: any, nextMovie: any) => void;
  rank?: number; // posizione 1-based
  total?: number; // numero totale film in classifica
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
    const needOverview = !v?.movie?.overview && cand.overview && cand.overview.trim();
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
    const cached = (cache as any)[title];
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
          (c as any)[title] = { poster_path: fetched.poster_path, overview: fetched.overview };
          setMetaCache(c);
        }
      } finally {
        inFlightTitleRef.current = null;
      }
    })();
  }, [v?.movie?.title, meta?.poster_path, meta?.overview]);
  // -----------------------------------------------

  const jwSearchUrl = (title: string, year?: string, country = "it") =>
    `https://www.justwatch.com/${country}/search?q=${encodeURIComponent(
      year ? `${title} ${year}` : title
    )}`;

  const poster = meta?.poster_path ? getPosterUrl(meta.poster_path, "w342") : "";
  const overview = (meta?.overview || "").trim();

  // --- Streaming providers (TMDB watch/providers) ---
const [watchProviders, setWatchProviders] = React.useState<{
  netflix: boolean;   // confermato disponibile
  prime: boolean;     // confermato disponibile
  jwLink?: string;    // deep link di TMDB a JustWatch
}>({ netflix: false, prime: false, jwLink: undefined });

React.useEffect(() => {
  const apiKey = (import.meta as any)?.env?.VITE_TMDB_API_KEY;
  const tmdbId = (v?.movie?.tmdb_id || v?.movie?.id) as number | undefined;
  const mediaType = v?.movie?.media_type === "tv" ? "tv" : "movie";
  if (!tmdbId || !apiKey) {
    // fallback solo con euristiche
    const producedBy = (v?.movie?.production_companies || []).map((c: any) => String(c?.name || "").toLowerCase());
    const homepage = String(v?.movie?.homepage || "").toLowerCase();
    const heuristicNetflix = producedBy.includes("netflix") || homepage.includes("netflix.com");
    setWatchProviders((p) => ({ ...p, netflix: heuristicNetflix }));
    return;
  }

  const region = "IT";
  (async () => {
    try {
      const url = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}/watch/providers?api_key=${apiKey}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("providers fetch failed");
      const data = await res.json();
      const r = data?.results?.[region] || data?.results?.US;

      const arrs = [
        ...(Array.isArray(r?.flatrate) ? r.flatrate : []),
        ...(Array.isArray(r?.buy) ? r.buy : []),
        ...(Array.isArray(r?.rent) ? r.rent : []),
        ...(Array.isArray(r?.ads) ? r.ads : []),
      ];

      const hasProvider = (id: number) => arrs.some((p: any) => Number(p?.provider_id) === id);

      // TMDB provider ids
      const NETFLIX_ID = 8;
      const PRIME_ID = 9;

      let netflix = hasProvider(NETFLIX_ID);
      let prime = hasProvider(PRIME_ID);

      // euristica extra se TMDB non ha dati regionali
      if (!netflix) {
        const producedBy = (v?.movie?.production_companies || []).map((c: any) => String(c?.name || "").toLowerCase());
        const homepage = String(v?.movie?.homepage || "").toLowerCase();
        netflix = producedBy.includes("netflix") || homepage.includes("netflix.com");
      }

      const jwLink = typeof r?.link === "string" ? r.link : undefined;
      setWatchProviders({ netflix, prime, jwLink });
    } catch {
      // solo euristiche
      const producedBy = (v?.movie?.production_companies || []).map((c: any) => String(c?.name || "").toLowerCase());
      const homepage = String(v?.movie?.homepage || "").toLowerCase();
      const heuristicNetflix = producedBy.includes("netflix") || homepage.includes("netflix.com");
      setWatchProviders((p) => ({ ...p, netflix: heuristicNetflix }));
    }
  })();
}, [v?.movie?.tmdb_id, v?.movie?.id, v?.movie?.media_type]);


  React.useEffect(() => {
    const tmdbId = (v?.movie?.tmdb_id || v?.movie?.id) as number | undefined;
    const apiKey = (import.meta as any)?.env?.VITE_TMDB_API_KEY;
    if (!tmdbId || !apiKey) return;

    const region = "IT"; // default Italia, fallback US
    (async () => {
      try {
        const url = `https://api.themoviedb.org/3/movie/${tmdbId}/watch/providers?api_key=${apiKey}`;
        const res = await fetch(url);
        if (!res.ok) return;
        const data = await res.json();
        const r = data?.results?.[region] || data?.results?.US;

        const flatrate: any[] = Array.isArray(r?.flatrate) ? r.flatrate : [];
        const buy: any[] = Array.isArray(r?.buy) ? r.buy : [];
        const rent: any[] = Array.isArray(r?.rent) ? r.rent : [];

        // TMDB provider_id: Netflix=8, Prime Video=9
        const has = (arr: any[], id: number) => arr?.some((p) => Number(p?.provider_id) === id);

        const netflix = has(flatrate, 8) || has(buy, 8) || has(rent, 8);
        const prime = has(flatrate, 9) || has(buy, 9) || has(rent, 9);
        const jwLink = typeof r?.link === "string" ? r.link : undefined;

        setWatchProviders({ netflix, prime, jwLink });
      } catch {
        // noop
      }
    })();
  }, [v?.movie?.tmdb_id, v?.movie?.id]);

  // --- UI helpers (ring & bar) ---
  const AvgRing = ({ value }: { value: number }) => {
    const r = 26,
      c = 2 * Math.PI * r,
      pct = Math.max(0, Math.min(100, ((value - 1) / 9) * 100));
    return (
      <div className="relative h-16 w-16">
        <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90">
          <circle cx="32" cy="32" r={r} strokeWidth="8" className="fill-none stroke-zinc-800/60" />
          <circle
            cx="32"
            cy="32"
            r={r}
            strokeWidth="8"
            className="fill-none stroke-lime-400"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c - (pct / 100) * c}
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center text-sm font-bold">
          {formatScore(value)}
        </div>
      </div>
    );
  };

  const showRank = typeof rank === "number" && typeof total === "number" && total > 0;

  const RankBadge = ({ pos, tot }: { pos: number; tot: number }) => (
    <span
      className="ml-2 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs text-gray-700 dark:text-zinc-300 dark:border-zinc-700"
      title="Posizione in classifica (media voti)"
    >
      <Trophy className="h-4 w-4 text-amber-400" />
      <span>
        #{pos}/{tot}
      </span>
    </span>
  );

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
          {showRank && <RankBadge pos={rank as number} tot={total as number} />}
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
          {/* META */}
          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-gray-600 dark:text-zinc-400">
            {releaseYear && (
              <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-sm border-zinc-300 dark:border-zinc-700">
                <Calendar className="h-4 w-4 text-blue-400" />
                {releaseYear}
              </span>
            )}

            {Number(v?.movie?.runtime) > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-sm border-zinc-300 dark:border-zinc-700">
                <Timer className="h-4 w-4 text-pink-400" />
                {v.movie.runtime} min
              </span>
            )}

            {genreLine && (
              <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-sm border-zinc-300 dark:border-zinc-700">
                <Film className="h-4 w-4 text-green-400" />
                {genreLine}
              </span>
            )}

            {/* Rating + votes (un unico badge) */}
            {(() => {
              const imdbId = v?.movie?.imdb_id as string | undefined;

              if (typeof v?.movie?.imdb_rating === "number") {
                const votes =
                  typeof v?.movie?.imdb_votes === "number" && v.movie.imdb_votes > 0
                    ? v.movie.imdb_votes
                    : null;

                const content = (
                  <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-sm border-zinc-300 dark:border-zinc-700 underline-offset-2">
                    <Star className="h-4 w-4 text-yellow-400" fill="currentColor" stroke="none" />
                    IMDb {formatScore(v.movie.imdb_rating)}
                    {votes ? (
                      <span className="ml-1 text-gray-500 dark:text-zinc-400">
                        • {votes.toLocaleString()} votes
                      </span>
                    ) : null}
                  </span>
                );

                // Se abbiamo l'ID IMDb, rendiamo tutto il badge cliccabile
                return imdbId ? (
                  <a
                    href={`https://www.imdb.com/title/${imdbId}/`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Open on IMDb"
                    className="no-underline hover:underline"
                  >
                    {content}
                  </a>
                ) : (
                  content
                );
              }

              if (typeof v?.movie?.tmdb_vote_average === "number") {
                const votes =
                  typeof v?.movie?.tmdb_vote_count === "number" && v.movie.tmdb_vote_count > 0
                    ? v.movie.tmdb_vote_count
                    : null;

                return (
                  <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-sm border-zinc-300 dark:border-zinc-700">
                    <Star className="h-4 w-4 text-sky-400" fill="currentColor" stroke="none" />
                    TMDB {formatScore(v.movie.tmdb_vote_average)}
                    {votes ? (
                      <span className="ml-1 text-gray-500 dark:text-zinc-400">
                        • {votes.toLocaleString()} votes
                      </span>
                    ) : null}
                  </span>
                );
              }

              return null;
            })()}

// helper: URL ricerca JustWatch (corretto)
const jwSearchUrl = (title: string, year?: string, country = "it") =>
  `https://www.justwatch.com/${country}/search?q=${encodeURIComponent(year ? `${title} ${year}` : title)}`;

{v?.movie?.title && (
  <div className="inline-flex items-center gap-2">
    {/* Netflix */}
    <a
      href={`https://www.netflix.com/search?q=${encodeURIComponent(v.movie.title)}`}
      target="_blank"
      rel="noopener noreferrer"
      className={
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-sm dark:border-zinc-700 hover:underline " +
        (watchProviders.netflix ? "border-red-500/40 text-red-400" : "border-zinc-300 text-current")
      }
      title={watchProviders.netflix ? "Disponibile su Netflix" : "Cerca su Netflix"}
    >
      <Play className={"h-4 w-4 " + (watchProviders.netflix ? "text-red-500" : "")} />
      Netflix
      {!watchProviders.netflix && <span className="ml-1 opacity-70">(search)</span>}
    </a>

    {/* Prime Video */}
    <a
      href={`https://www.primevideo.com/search?phrase=${encodeURIComponent(v.movie.title)}`}
      target="_blank"
      rel="noopener noreferrer"
      className={
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-sm dark:border-zinc-700 hover:underline " +
        (watchProviders.prime ? "border-sky-500/40 text-sky-400" : "border-zinc-300 text-current")
      }
      title={watchProviders.prime ? "Disponibile su Prime Video" : "Cerca su Prime Video"}
    >
      <Tv className={"h-4 w-4 " + (watchProviders.prime ? "text-sky-400" : "")} />
      Prime Video
      {!watchProviders.prime && <span className="ml-1 opacity-70">(search)</span>}
    </a>

    {/* JustWatch: sempre visibile */}
    <a
      href={watchProviders.jwLink || jwSearchUrl(v.movie.title, releaseYear || undefined)}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-sm border-zinc-300 dark:border-zinc-700 hover:underline"
      title="Dove guardarlo (JustWatch)"
    >
      <Play className="h-4 w-4" />
      Where to watch
    </a>
  </div>
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
