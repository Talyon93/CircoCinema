import { useEffect, useState } from "react";
import { tmdbDetails, tmdbSearch, mergeMovie, ensureRuntime, ensureGenres, omdbRatingFromImdbId, normalizeSingleCountry } from "../TMDBHelper";
import { persistHistoryLive } from "../storage";
import { Viewing } from "../types/viewing";

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

async function enrichFromTmdbByTitleOrId(movie: any) {
  return await ensureGenres(movie);
}

export function useHistoryBackfills(history: Viewing[], setHistory: (h: Viewing[]) => void) {
  const [isBackfillingRuntime, setIsBackfillingRuntime] = useState(false);
  const [isBackfillingRatings, setIsBackfillingRatings] = useState(false);
  const [isBackfillingGenres, setIsBackfillingGenres] = useState(false);

  // Genres
  async function backfillHistoryGenres() {
    if (isBackfillingGenres) return;
    setIsBackfillingGenres(true);
    try {
      const list = history.slice();
      let changed = false;

      for (let i = 0; i < list.length; i++) {
        const v = list[i];
        const hasGenres = Array.isArray(v?.movie?.genres) && v.movie.genres.length > 0;
        if (hasGenres) continue;

        const enriched = await enrichFromTmdbByTitleOrId(v.movie);
        if (enriched !== v.movie) {
          list[i] = { ...v, movie: enriched };
          changed = true;
        }
        await sleep(200);
      }

      if (changed) {
        setHistory(list);
        await persistHistoryLive(list);
      }
    } finally {
      setIsBackfillingGenres(false);
    }
  }

  // Ratings meta (IMDb/TMDB/OMDb) + primary_country
  async function backfillRatingsMeta() {
    if (isBackfillingRatings) return;
    setIsBackfillingRatings(true);
    try {
      const list = history.slice();
      let changed = false;

      for (let i = 0; i < list.length; i++) {
        const v = list[i];
        let m = { ...(v?.movie || {}) };

        let det: any = null;
        if (m?.id) det = await tmdbDetails(m.id);
        else if (m?.title) {
          const s = await tmdbSearch(m.title);
          const first = s?.[0];
          if (first?.id) det = await tmdbDetails(first.id);
        }
        if (det) {
          m = mergeMovie(m, det);
          if (Array.isArray(det.production_countries)) m.production_countries = det.production_countries;
          if (Array.isArray(det.origin_country))       m.origin_country       = det.origin_country;
        }

        if (!m?.release_year && m?.release_date) m.release_year = String(m.release_date).slice(0, 4);

        const needImdbRating = m?.imdb_id && (m.imdb_rating == null || m.imdb_votes == null);
        const needOmdbCountry = m?.imdb_id && !(m?.omdb?.Country);
        if (m?.imdb_id && (needImdbRating || needOmdbCountry)) {
          const om = await omdbRatingFromImdbId(m.imdb_id);
          if (om) m = { ...m, ...om };
        }
        if (m?.Country && !m?.omdb?.Country) {
          m.omdb = { ...(m.omdb || {}), Country: m.Country };
          delete (m as any).Country;
        }

        m = normalizeSingleCountry(m);

        if (JSON.stringify(m) !== JSON.stringify(v.movie)) {
          list[i] = { ...v, movie: m };
          changed = true;
        }

        await sleep(220);
      }

      if (changed) {
        setHistory(list);
        await persistHistoryLive(list);
      }
    } finally {
      setIsBackfillingRatings(false);
    }
  }

  // Runtime
  async function backfillHistoryRuntime() {
    if (isBackfillingRuntime) return;
    setIsBackfillingRuntime(true);
    try {
      const list = history.slice();
      let changed = false;

      for (let i = 0; i < list.length; i++) {
        const v = list[i];
        const rt = Number((v?.movie as any)?.runtime);
        if (!Number.isNaN(rt) && rt > 0) continue;

        const withRt = await ensureRuntime(v.movie);
        if (withRt !== v.movie) {
          list[i] = { ...v, movie: withRt };
          changed = true;
        }
        await sleep(200);
      }

      if (changed) {
        setHistory(list);
        await persistHistoryLive(list);
      }
    } finally {
      setIsBackfillingRuntime(false);
    }
  }

  // Auto-trigger backfills come in originale
  useEffect(() => {
    if (!history.length || isBackfillingRatings) return;
    const missing = history.some((h) => {
      const m = h?.movie || {};
      return m.imdb_rating == null && m.tmdb_vote_average == null;
    });
    if (missing) backfillRatingsMeta();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history.length, isBackfillingRatings]);

  useEffect(() => {
    const hasAnyGenre = history.some((h) => Array.isArray(h?.movie?.genres) && h.movie.genres.length > 0);
    if (!hasAnyGenre && history.length > 0) backfillHistoryGenres();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history.length]);

  useEffect(() => {
    if (history.length === 0 || isBackfillingRuntime) return;
    const hasAnyRuntime = history.some((h) => {
      const rt = Number((h?.movie as any)?.runtime);
      return !Number.isNaN(rt) && rt > 0;
    });
    const hasMissingRuntime = history.some((h) => {
      const rt = Number((h?.movie as any)?.runtime);
      return Number.isNaN(rt) || rt <= 0;
    });
    if (!hasAnyRuntime && hasMissingRuntime) backfillHistoryRuntime();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history.length, isBackfillingRuntime]);

  return {
    isBackfillingRuntime,
    isBackfillingRatings,
    isBackfillingGenres,
    backfillHistoryRuntime,
    backfillRatingsMeta,
    backfillHistoryGenres,
  };
}
