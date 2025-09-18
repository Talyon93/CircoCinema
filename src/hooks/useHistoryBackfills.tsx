import { useEffect, useState, useRef } from "react";
import { ensureGenres, ensureRuntime } from "../TMDBHelper"; // o "../movieDataHelper" se lo hai rinominato
import { persistHistoryLive } from "../storage";
import { Viewing } from "../types/viewing";

/** Piccolo helper per evitare run concorrenti duplicati */
function useBusyFlag(initial = false) {
  const [busy, setBusy] = useState(initial);
  const lock = useRef<Promise<void> | null>(null);
  return {
    busy,
    async run<T>(fn: () => Promise<T>): Promise<T> {
      if (busy || lock.current) return fn(); // non bloccare ma non impostare due volte busy
      setBusy(true);
      const p = fn();
      lock.current = p.then(() => undefined).catch(() => undefined) as any;
      try {
        return await p;
      } finally {
        setBusy(false);
        lock.current = null;
      }
    },
  };
}

/** confronta solo i campi che tendiamo a modificare col backfill */
function shallowChangedMovie(a: any, b: any) {
  const keys = new Set([
    "poster_path", "overview", "genres", "runtime",
    "imdb_id", "imdb_rating", "imdb_votes", "tmdb_vote_average",
    "primary_country",
  ]);
  const ak = JSON.stringify({
    poster_path: a?.poster_path,
    overview: a?.overview,
    genres: Array.isArray(a?.genres) ? a.genres.map((g: any) => g?.name || g).join("|") : null,
    runtime: a?.runtime ?? null,
    imdb_id: a?.imdb_id ?? null,
    imdb_rating: a?.imdb_rating ?? null,
    imdb_votes: a?.imdb_votes ?? null,
    tmdb_vote_average: a?.tmdb_vote_average ?? null,
    primary_country: a?.primary_country ?? null,
  });
  const bk = JSON.stringify({
    poster_path: b?.poster_path,
    overview: b?.overview,
    genres: Array.isArray(b?.genres) ? b.genres.map((g: any) => g?.name || g).join("|") : null,
    runtime: b?.runtime ?? null,
    imdb_id: b?.imdb_id ?? null,
    imdb_rating: b?.imdb_rating ?? null,
    imdb_votes: b?.imdb_votes ?? null,
    tmdb_vote_average: b?.tmdb_vote_average ?? null,
    primary_country: b?.primary_country ?? null,
  });
  return ak !== bk;
}

/** Limita la concorrenza: evita di aprire troppe connessioni */
async function mapWithConcurrency<T, R>(items: T[], worker: (it: T, i: number) => Promise<R>, concurrency = 2) {
  const results: R[] = new Array(items.length) as any;
  let i = 0;
  const runners = new Array(Math.min(concurrency, items.length)).fill(0).map(async () => {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await worker(items[idx], idx);
    }
  });
  await Promise.all(runners);
  return results;
}

export function useHistoryBackfills(history: Viewing[], setHistory: (h: Viewing[]) => void) {
  const genresBusy = useBusyFlag(false);
  const ratingsBusy = useBusyFlag(false);
  const runtimeBusy = useBusyFlag(false);

  /** ===== GENRES + poster/overview + imdb/tmdb + primary_country =====
   *  Usa ensureGenres che:
   *  - risolve TMDB per id/titolo
   *  - fonde i dettagli
   *  - prende rating OMDb se c'è imdb_id
   *  - normalizza country => primary_country
   */
  async function backfillHistoryGenres() {
    await genresBusy.run(async () => {
      if (!history.length) return;
      const list = history.slice();
      let changed = false;

      const targets = list.filter((v) => !Array.isArray(v?.movie?.genres) || v.movie.genres.length === 0);
      if (!targets.length) return;

      await mapWithConcurrency(targets, async (v) => {
        const enriched = await ensureGenres(v.movie);
        if (shallowChangedMovie(v.movie, enriched)) {
          const idx = list.findIndex((x) => x.id === v.id);
          if (idx >= 0) {
            list[idx] = { ...v, movie: enriched };
            changed = true;
          }
        }
      }, 2);

      if (changed) {
        setHistory(list);
        await persistHistoryLive(list);
      }
    });
  }

  /** ===== RATINGS META (IMDb/TMDB) + primary_country se mancanti =====
   *  Riusa ensureGenres perché copre anche i rating + normalizzazione.
   */
  async function backfillRatingsMeta() {
    await ratingsBusy.run(async () => {
      if (!history.length) return;
      const list = history.slice();
      let changed = false;

      const targets = list.filter((v) => {
        const m = v?.movie || {};
        const missingRating = m.imdb_rating == null && m.tmdb_vote_average == null;
        const missingCountry = !m.primary_country;
        return missingRating || missingCountry;
      });
      if (!targets.length) return;

      await mapWithConcurrency(targets, async (v) => {
        const enriched = await ensureGenres(v.movie);
        if (shallowChangedMovie(v.movie, enriched)) {
          const idx = list.findIndex((x) => x.id === v.id);
          if (idx >= 0) {
            list[idx] = { ...v, movie: enriched };
            changed = true;
          }
        }
      }, 2);

      if (changed) {
        setHistory(list);
        await persistHistoryLive(list);
      }
    });
  }

  /** ===== RUNTIME =====
   *  Usa ensureRuntime (attualmente delega a ensureGenres) ma resta separato per chiarezza futura.
   */
  async function backfillHistoryRuntime() {
    await runtimeBusy.run(async () => {
      if (!history.length) return;
      const list = history.slice();
      let changed = false;

      const targets = list.filter((v) => {
        const rt = Number((v?.movie as any)?.runtime);
        return !Number.isFinite(rt) || rt <= 0;
      });
      if (!targets.length) return;

      await mapWithConcurrency(targets, async (v) => {
        const enriched = await ensureRuntime(v.movie);
        if (shallowChangedMovie(v.movie, enriched)) {
          const idx = list.findIndex((x) => x.id === v.id);
          if (idx >= 0) {
            list[idx] = { ...v, movie: enriched };
            changed = true;
          }
        }
      }, 2);

      if (changed) {
        setHistory(list);
        await persistHistoryLive(list);
      }
    });
  }

  // Trigger automatici, ma idempotenti (con busy flag)
  useEffect(() => {
    if (!history.length) return;
    // 1) Ratings/country
    const needRatings = history.some((h) => {
      const m = h?.movie || {};
      return (m.imdb_rating == null && m.tmdb_vote_average == null) || !m.primary_country;
    });
    if (needRatings && !ratingsBusy.busy) backfillRatingsMeta();

    // 2) Generi
    const needGenres = history.some((h) => !Array.isArray(h?.movie?.genres) || h.movie.genres.length === 0);
    if (needGenres && !genresBusy.busy) backfillHistoryGenres();

    // 3) Runtime
    const needRuntime = history.some((h) => {
      const rt = Number((h?.movie as any)?.runtime);
      return !Number.isFinite(rt) || rt <= 0;
    });
    if (needRuntime && !runtimeBusy.busy) backfillHistoryRuntime();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history.length]);

  return {
    isBackfillingRuntime: runtimeBusy.busy,
    isBackfillingRatings: ratingsBusy.busy,
    isBackfillingGenres: genresBusy.busy,
    backfillHistoryRuntime,
    backfillRatingsMeta,
    backfillHistoryGenres,
  };
}
