import React from "react";
import {
  tmdbDetails,
  omdbRatingFromImdbId,
  fetchMetaForTitle,
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
import { SiImdb } from "react-icons/si";
import ScoreSlider from "./ScoreSlider";
import { Sparkles, Check, X } from "lucide-react";
import { PickerBadgePro } from "./PickerPro";
import { AdvancedMovieDialog } from "./AdvancedMovieDIalog";

// ==== Country helpers (estrazione + fallback + normalizzazione bandiere) ====
// Ritorna un ISO2 (es. "US") usando priorità: TMDB -> OMDb -> companies -> lingua

function isoFromNameOrCode(s: string): string | null {
  const t = s.trim();
  const up = t.toUpperCase();
  // mappa rapida nomi comuni -> ISO2
  const map: Record<string, string> = {
    USA: "US", "UNITED STATES": "US", "UNITED STATES OF AMERICA": "US",
    UK: "GB", "UNITED KINGDOM": "GB",
    ITALY: "IT", FRANCE: "FR", GERMANY: "DE", SPAIN: "ES", CANADA: "CA",
    JAPAN: "JP", CHINA: "CN", INDIA: "IN", AUSTRALIA: "AU", BRAZIL: "BR",
    MEXICO: "MX", "SOUTH KOREA": "KR", "REPUBLIC OF KOREA": "KR", KOREA: "KR",
    RUSSIA: "RU", CZECHIA: "CZ", "CZECH REPUBLIC": "CZ", "HONG KONG": "HK",
    TAIWAN: "TW", IRELAND: "IE", "NEW ZEALAND": "NZ", SWEDEN: "SE",
    NORWAY: "NO", DENMARK: "DK", NETHERLANDS: "NL", BELGIUM: "BE",
    SWITZERLAND: "CH", AUSTRIA: "AT", POLAND: "PL", TURKEY: "TR",
    "UNITED ARAB EMIRATES": "AE",
  };
  if (/^[A-Z]{2}$/.test(up)) return up; // ISO2
  if (/^[A-Z]{3}$/.test(up)) {
    // pochi comuni ISO3
    const iso3: Record<string, string> = { USA: "US", GBR: "GB", ITA: "IT", FRA: "FR", DEU: "DE", ESP: "ES", CAN: "CA", JPN: "JP", CHN: "CN", KOR: "KR", RUS: "RU" };
    return iso3[up] || null;
  }
  return map[up] || null;
}

function uniquePreserve<T>(arr: T[], keyFn: (x: T) => string) {
  const out: T[] = []; const seen = new Set<string>();
  for (const v of arr) { const k = keyFn(v); if (!seen.has(k)) { seen.add(k); out.push(v); } }
  return out;
}

function extractCountries(viewing: any): string[] {
  const m = viewing?.movie || viewing || {};
  const out: string[] = [];

  // 1) TMDB production_countries
  if (Array.isArray(m.production_countries)) {
    for (const c of m.production_countries) {
      const iso = isoFromNameOrCode(String(c?.iso_3166_1 || c?.name || ""));
      if (iso) out.push(iso);
    }
  }

  // 2) TMDB origin_country
  if (Array.isArray(m.origin_country)) {
    for (const code of m.origin_country) {
      const iso = isoFromNameOrCode(String(code));
      if (iso) out.push(iso);
    }
  }

  // 3) OMDb Country come stringa "USA, UK, Italy"
  const omdbCountry = m?.omdb?.Country || viewing?.omdb?.Country || m?.Country;
  if (typeof omdbCountry === "string" && omdbCountry.trim()) {
    for (const part of omdbCountry.split(/[;,]|\/|\|/)) {
      const iso = isoFromNameOrCode(part.trim());
      if (iso) out.push(iso);
    }
  }

  // 4) Fallback: company origin_country
  if (Array.isArray(m.production_companies)) {
    for (const c of m.production_companies) {
      const iso = isoFromNameOrCode(String(c?.origin_country || ""));
      if (iso) out.push(iso);
    }
  }

  // 5) Fallback: lingua originale (mapping soft)
  if (!out.length && typeof m.original_language === "string") {
    const ol = m.original_language.toLowerCase();
    const map: Record<string, string> = {
      en: "US", it: "IT", fr: "FR", de: "DE", es: "ES", pt: "PT", ja: "JP", ko: "KR", zh: "CN", ru: "RU",
      cs: "CZ", sv: "SE", no: "NO", da: "DK", nl: "NL", pl: "PL", tr: "TR", hi: "IN"
    };
    if (map[ol]) out.push(map[ol]);
  }

  // dedupe e limita a 4 bandiere
  return uniquePreserve(out.map(x => x.toUpperCase()), x => x).slice(0, 1);
}

export function HistoryCardExtended({
  v,
  onEdit,
  onMetaResolved,
  rank,
  total,
  currentUser,
  onQuickVote,
  inModal = false,
}: {
  v: any;
  onEdit?: (id: any) => void;
  onMetaResolved?: (viewingId: any, nextMovie: any) => void;
  rank?: number;
  total?: number;
  currentUser?: string;
  onQuickVote?: (viewingId: any, score: number) => void;
  inModal?: boolean;
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


  const [countries, setCountries] = React.useState<string[]>(() => extractCountries(v));
  const [detailsOpen, setDetailsOpen] = React.useState(false);

  React.useEffect(() => {
    setCountries(extractCountries(v));
  }, [v?.id, v?.movie]);

  React.useEffect(() => {
    if (countries.length) return; // abbiamo già qualcosa

    (async () => {
      let changed = false;
      let m = { ...(v?.movie || {}) };

      // Prova TMDB details se abbiamo id
      const tmdbId = (m?.tmdb_id || m?.id) as number | undefined;
      try {
        if (tmdbId) {
          const det = await tmdbDetails(tmdbId);
          if (det?.production_countries && !m.production_countries) {
            m.production_countries = det.production_countries;
            changed = true;
          }
          if (Array.isArray(det?.origin_country) && !m.origin_country) {
            m.origin_country = det.origin_country;
            changed = true;
          }
        }
      } catch { }

      // Prova OMDb se abbiamo imdb_id
      try {
        if (m?.imdb_id && !(m?.omdb?.Country)) {
          const om = await omdbRatingFromImdbId(m.imdb_id);
          if (om?.Country) {
            m = { ...m, omdb: { ...(m.omdb || {}), Country: om.Country } };
            changed = true;
          }
        }
      } catch { }

      if (changed) {
        setCountries(extractCountries({ movie: m }));
        // persisti nel parent se possibile
        onMetaResolved?.(v.id, m);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countries.length, v?.id]);


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

  const hasVoted = currentUser ? Object.prototype.hasOwnProperty.call(ratings, currentUser) : true;

  // quick vote state
  const [qvOpen, setQvOpen] = React.useState(false);
  const [qvScore, setQvScore] = React.useState<number>(7);

  React.useEffect(() => {
    if (!hasVoted && currentUser && typeof ratings[currentUser] === "number") {
      setQvScore(Number(ratings[currentUser]));
    }
  }, [hasVoted, currentUser, ratings]);

  return (
    <div
      className={
        inModal
          ? "p-5"
          : "rounded-3xl border border-gray-200 bg-white p-5 shadow-sm ring-1 ring-black/5 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900/60"
      }
    >
      {/* Header */}
      <div className={`${inModal ? "pr-24" : ""} mb-3 flex items-center gap-3`}>
        {/* Titolo + rank */}
        <div className="min-w-0 flex-1">
          <h3 className="min-w-0 flex items-center gap-2 text-xl font-bold leading-tight text-zinc-900 dark:text-zinc-100">
            {/* Picker */}
            {v.picked_by && (
              <>
                <PickerBadgePro name={v.picked_by} />
                <span className="text-gray-400 dark:text-zinc-600">•</span>
              </>
            )}

            {/* Badge posizione prima del titolo */}
            {showRank && (
              <>
                <span
                  className="inline-flex items-center gap-1.5 rounded-full border border-zinc-600 bg-zinc-800 px-2.5 py-0.5 text-sm font-semibold text-zinc-100 shadow-sm"
                  title="Posizione in classifica"
                >
                  <Trophy className="h-4 w-4 text-amber-400" />
                  <span className="text-sky-400">#{rank}</span>
                  <span className="opacity-70">/</span>
                  <span>{total}</span>
                </span>
                <span className="text-gray-400 dark:text-zinc-600">•</span>
              </>
            )}

            {/* Titolo film */}
            <span className="truncate">{v.movie?.title || "Untitled"}</span>
          </h3>

        </div>


        {/* Azioni + data (gg/mm/aaaa) */}
        <div className="ml-2 flex shrink-0 items-center gap-2">
          {/* Details: stile gemello di Vote (sky) */}
          <button
            onClick={() => setDetailsOpen(true)}
            title="Movie details"
            className="inline-flex items-center gap-1.5 rounded-lg border border-sky-500/40 bg-sky-500/15 px-2.5 py-1.5 text-xs font-semibold text-sky-300 hover:bg-sky-500/25 focus:outline-none focus:ring-2 focus:ring-sky-400/30"
          >
            Details
          </button>

          {/* Vote se serve (lasciato com’è) */}
          {!hasVoted && onQuickVote && (
            <button
              onClick={() => setQvOpen((s) => !s)}
              title="Vote on this movie"
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/25"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Vote
            </button>
          )}

          {/* Edit: ghost discreto */}
          {onEdit && (
            <button
              onClick={onEdit}
              title="Edit"
              className="inline-flex items-center rounded-lg border border-transparent bg-transparent px-2.5 py-1.5 text-xs text-zinc-400 transition-colors hover:bg-zinc-800/40 hover:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-700/40"
            >
              Edit
            </button>
          )}



          {/* Data solo giorno/mese/anno */}
          {v.started_at && (
            <span className="ml-1 rounded-full bg-gray-50 px-2.5 py-1 text-[11px] text-gray-600 ring-1 ring-inset ring-gray-200 dark:bg-zinc-900 dark:text-zinc-400 dark:ring-zinc-800">
              {new Date(v.started_at).toLocaleDateString(undefined, {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
              })}
            </span>
          )}
        </div>
      </div>

      {/* Quick vote panel (appears under header) */}
      {!hasVoted && qvOpen && onQuickVote && (
        <div className="mb-4 rounded-xl border border-zinc-700/70 bg-zinc-900/50 p-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-xs text-zinc-400">
              Choose your score <span className="text-zinc-500">(drag the slider)</span>
            </div>
            <div className="rounded-full border border-zinc-700/70 bg-zinc-900/80 px-2 py-0.5 text-xs font-semibold text-zinc-200">
              {formatScore(qvScore)}
            </div>
          </div>

          <ScoreSlider value={qvScore} onChange={setQvScore} min={1} max={10} step={0.25} />

          <div className="mt-3 flex items-center gap-2">
            <button
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
              onClick={() => {
                onQuickVote(v.id, qvScore);
                setQvOpen(false);
              }}
            >
              <Check className="h-4 w-4" />
              Save
            </button>

            <button
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-700/70 bg-zinc-900/50 px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-800/70"
              onClick={() => setQvOpen(false)}
            >
              <X className="h-4 w-4" />
              Cancel
            </button>
          </div>
        </div>
      )}

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

            {/* Country (una bandiera dal JSON) */}
            {v?.movie?.primary_country && (
              <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-sm border-zinc-300 dark:border-zinc-700">
                <img
                  src={`https://flagcdn.com/24x18/${String(v.movie.primary_country).toLowerCase()}.png`}
                  alt={v.movie.primary_country}
                  title={v.movie.primary_country}
                  className="h-3.5 w-5 rounded-sm shadow-sm"
                  loading="lazy"
                />
              </span>
            )}

            {/* fallback se ci sono solo origin_country */}
            {!v?.movie?.production_countries?.length &&
              Array.isArray(v?.movie?.origin_country) &&
              v.movie.origin_country.length > 0 &&
              (() => {
                const code = (v.movie.origin_country[0] || "").toLowerCase();
                return (
                  <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-sm border-zinc-300 dark:border-zinc-700">
                    <img
                      src={`https://flagcdn.com/24x18/${code}.png`}
                      alt={code}
                      title={code}
                      className="h-3.5 w-5 rounded-sm shadow-sm"
                      loading="lazy"
                    />
                  </span>
                );
              })()}

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
                    <SiImdb className="h-5 w-5 text-yellow-500" />
                    {formatScore(v.movie.imdb_rating)}
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

            {/* Where to watch */}
            {v?.movie?.title && (
              <div className="inline-flex items-center gap-2">
                {watchProviders.netflix && (
                  <a
                    href={`https://www.netflix.com/search?q=${encodeURIComponent(v.movie.title)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-sm border-zinc-300 dark:border-zinc-700 hover:underline"
                    title="Apri su Netflix"
                  >
                    <Play className="h-4 w-4 text-red-500" />
                    Netflix
                  </a>
                )}

                {watchProviders.prime && (
                  <a
                    href={`https://www.primevideo.com/search?phrase=${encodeURIComponent(v.movie.title)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-sm border-zinc-300 dark:border-zinc-700 hover:underline"
                    title="Apri su Prime Video"
                  >
                    <Tv className="h-4 w-4 text-sky-400" />
                    Prime Video
                  </a>
                )}

                {/* Fallback SEMPRE visibile: JustWatch */}
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
      <AdvancedMovieDialog
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        viewing={v}
      />
    </div>
  );

}
