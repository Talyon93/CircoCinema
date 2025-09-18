// src/Utils/exportPeople.ts
import { Viewing } from "./types/viewing";
import { ensureGenres } from "./TMDBHelper";

/* =============== helpers =============== */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function downloadBlob(data: string, mime: string, filename: string) {
  if (typeof window === "undefined") {
    console.warn("downloadBlob: non-browser environment, skip download");
    return;
  }
  const blob = new Blob([data], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function csvEscape(value: any): string {
  if (value == null) return "";
  const s = String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/* =============== EXPORT (enrich-on-the-fly) =============== */
type EnrichOpts = {
  enrich?: boolean;      // se true arricchisce item senza people prima di esportare
  throttleMs?: number;   // attesa fra item (default 180ms)
  logProgress?: boolean; // logga ogni 5 item
};

async function ensurePeopleForViewing(v: Viewing, opts: EnrichOpts) {
  const m: any = v?.movie ?? {};
  const hasPeople =
    (Array.isArray(m?.directors) && m.directors.length > 0) ||
    (Array.isArray(m?.top_cast) && m.top_cast.length > 0);

  if (!opts.enrich || hasPeople) return m;

  const seed: any = {};
  if (m?.id) seed.id = m.id;
  if (m?.title) seed.title = m.title;
  if (m?.imdb_id) seed.imdb_id = m.imdb_id;

  try {
    const enriched = await ensureGenres(seed);
    return { ...m, ...enriched };
  } catch {
    return m;
  }
}

function flattenViewing(v: Viewing, movie: any) {
  const directorsArr = Array.isArray(movie?.directors) ? movie.directors.map((d: any) => d?.name).filter(Boolean) : [];
  const castArr = Array.isArray(movie?.top_cast) ? movie.top_cast.map((c: any) => c?.name).filter(Boolean) : [];

  return {
    id: (v as any)?.id ?? null,
    started_at: (v as any)?.started_at ?? null,
    picked_by: (v as any)?.picked_by ?? null,
    title: movie?.title ?? (v as any)?.title ?? "",
    release_year: movie?.release_year ?? (v as any)?.release_year ?? null,
    imdb_id: movie?.imdb_id ?? (v as any)?.imdb_id ?? null,
    primary_country: movie?.primary_country ?? (v as any)?.primary_country ?? null,
    directors: directorsArr,
    top_cast: castArr,
  };
}

export async function buildPeopleFromHistory(history: Viewing[], opts: EnrichOpts = {}) {
  const { throttleMs = 180, logProgress = true } = opts;
  const out: any[] = [];
  const L = Array.isArray(history) ? history : [];

  for (let i = 0; i < L.length; i++) {
    const v = L[i];
    const movie = await ensurePeopleForViewing(v, opts);
    out.push(flattenViewing(v, movie));
    if (opts.enrich && throttleMs > 0) await sleep(throttleMs);
    if (logProgress && (i % 5 === 0)) console.log(`Export people progress: ${i + 1}/${L.length}`);
  }
  return out;
}

export async function exportPeopleJSON(
  history: Viewing[],
  filename = "people-export.json",
  opts: EnrichOpts = { enrich: true }
) {
  const rows = await buildPeopleFromHistory(history, opts);
  downloadBlob(JSON.stringify(rows, null, 2), "application/json;charset=utf-8", filename);
}

export async function exportPeopleCSV(
  history: Viewing[],
  filename = "people-export.csv",
  opts: EnrichOpts = { enrich: true }
) {
  const rows = await buildPeopleFromHistory(history, opts);
  const header = ["id","started_at","picked_by","title","release_year","imdb_id","primary_country","directors","top_cast"];
  const lines = [
    header.join(","),
    ...rows.map((r) =>
      [
        csvEscape(r.id),
        csvEscape(r.started_at),
        csvEscape(r.picked_by),
        csvEscape(r.title),
        csvEscape(r.release_year),
        csvEscape(r.imdb_id),
        csvEscape(r.primary_country),
        csvEscape((r.directors || []).join("; ")),
        csvEscape((r.top_cast || []).join("; ")),
      ].join(",")
    ),
  ];
  downloadBlob(lines.join("\n"), "text/csv;charset=utf-8", filename);
}

/* =============== BACKFILL & SAVE (definitivo) =============== */
export type SaveHistoryFn = (nextHistory: Viewing[]) => Promise<void>;

type BackfillOptions = {
  throttleMs?: number;   // default 180ms
  onlyMissing?: boolean; // default true
  logEvery?: number;     // default 5
  dryRun?: boolean;      // se true non salva
};

function needsPeople(movie: any) {
  const hasDirs = Array.isArray(movie?.directors) && movie.directors.length > 0;
  const hasCast = Array.isArray(movie?.top_cast) && movie.top_cast.length > 0;
  return !(hasDirs && hasCast);
}

function mergeMoviePeople(original: any, enriched: any) {
  const out = { ...original };

  // priorità ai people nuovi
  ["directors", "top_cast"].forEach((k) => {
    if (Array.isArray(enriched?.[k]) && enriched[k].length > 0) out[k] = enriched[k];
  });

  // copia (solo se mancanti) altri campi utili
  const maybeCopy = (k: string) => {
    if (out[k] == null && enriched?.[k] != null) out[k] = enriched[k];
  };
  [
    "imdb_id","imdb_rating","imdb_votes",
    "tmdb_vote_average","tmdb_vote_count",
    "poster_path","overview","runtime",
    "release_year","original_language","primary_country",
    "omdb",
  ].forEach(maybeCopy);

  return out;
}

/**
 * Backfill completo che arricchisce la history e invoca un saver esterno.
 * Ritorna un piccolo report.
 */
export async function backfillPeopleAndSave(
  history: Viewing[],
  saveHistory: SaveHistoryFn,
  opts: BackfillOptions = {}
) {
  const { throttleMs = 180, onlyMissing = true, logEvery = 5, dryRun = false } = opts;

  if (!Array.isArray(history) || history.length === 0) {
    return { total: 0, updated: 0, skipped: 0, saved: false };
  }

  const next = [...history];
  let updated = 0;
  let skipped = 0;

  for (let i = 0; i < next.length; i++) {
    const v = next[i];
    const m = v?.movie ?? {};

    if (onlyMissing && !needsPeople(m)) {
      skipped++;
      continue;
    }

    const seed: any = {};
    if (m?.id) seed.id = m.id;
    if (m?.title) seed.title = m.title;
    if (m?.imdb_id) seed.imdb_id = m.imdb_id;

    try {
      const enriched = await ensureGenres(seed);
      const merged = mergeMoviePeople(m, enriched || {});
      next[i] = { ...v, movie: merged };
      updated++;
    } catch (err) {
      console.warn("Backfill error on", m?.title || m, err);
      skipped++;
    }

    if (throttleMs > 0) await sleep(throttleMs);
    if (logEvery > 0 && (i + 1) % logEvery === 0) {
      console.log(`Backfill progress: ${i + 1}/${next.length}`);
    }
  }

  let saved = false;
  if (!dryRun) {
    await saveHistory(next);
    saved = true;
  }

  return { total: next.length, updated, skipped, saved };
}
