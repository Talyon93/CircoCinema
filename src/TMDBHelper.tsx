// movieDataHelper.ts
/* =========================
   Config & utils
========================= */

const TMDB_API_KEY = "99cb7c79bbe966a91a2ffcb7a3ea3d37";
const OMDB_API_KEY = "c71ea1b7";
const OMDB_URL = "https://www.omdbapi.com/";

const DEFAULT_LANG = "en-US";
const DEFAULT_REGION: string | undefined = undefined; // es. "IT" se vuoi bias nazionali
const MAX_TOP_CAST = 5; // quanti attori principali estrarre

// ——— Fetch con timeout + retry/backoff
async function safeFetch(
  url: string,
  init?: RequestInit,
  { timeoutMs = 9000, retries = 2, backoffMs = 400 }: { timeoutMs?: number; retries?: number; backoffMs?: number } = {}
) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...init, signal: ctrl.signal });
      clearTimeout(t);
      if (res.ok) return res;
      // retry su 429/5xx
      if (res.status === 429 || (res.status >= 500 && res.status <= 599)) {
        if (attempt < retries) await new Promise(r => setTimeout(r, backoffMs * (attempt + 1)));
        else return res; // ultimo tentativo: ritorno comunque per gestire gracefully
      } else {
        return res;
      }
    } catch {
      clearTimeout(t);
      if (attempt < retries) await new Promise(r => setTimeout(r, backoffMs * (attempt + 1)));
      else throw new Error("Network error");
    }
  }
  throw new Error("Unreachable");
}

/* =========================
   Caches
========================= */
const tmdbSearchCache = new Map<string, any[]>();
const tmdbDetailsCache = new Map<number, any>();
const omdbCache = new Map<string, any>();
const tmdbPersonCache = new Map<number, any>();

/* =========================
   TMDB
========================= */

export async function tmdbSearch(query: string) {
  const q = (query || "").trim();
  if (!q) return [] as any[];

  const cacheKey = `${q}|${DEFAULT_LANG}|${DEFAULT_REGION ?? ""}`;
  if (tmdbSearchCache.has(cacheKey)) return tmdbSearchCache.get(cacheKey)!;

  try {
    const url =
      `https://api.themoviedb.org/3/search/movie` +
      `?api_key=${TMDB_API_KEY}` +
      `&query=${encodeURIComponent(q)}` +
      `&language=${encodeURIComponent(DEFAULT_LANG)}` +
      `&include_adult=false` +
      (DEFAULT_REGION ? `&region=${encodeURIComponent(DEFAULT_REGION)}` : "");

    const res = await safeFetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    const results = (data?.results || []) as any[];
    tmdbSearchCache.set(cacheKey, results);
    return results;
  } catch {
    return [];
  }
}

export async function tmdbDetails(tmdbId: number) {
  if (!tmdbId && tmdbId !== 0) return null;
  if (tmdbDetailsCache.has(tmdbId)) return tmdbDetailsCache.get(tmdbId)!;

  try {
    const url =
      `https://api.themoviedb.org/3/movie/${tmdbId}` +
      `?api_key=${TMDB_API_KEY}` +
      `&language=${encodeURIComponent(DEFAULT_LANG)}` +
      // ⟵ aggiungiamo credits per avere registi e cast
      `&append_to_response=external_ids,credits`;

    const res = await safeFetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    tmdbDetailsCache.set(tmdbId, json);
    return json;
  } catch {
    return null;
  }
}

export async function tmdbPersonDetails(personId: number) {
  if (!personId && personId !== 0) return null;
  if (tmdbPersonCache.has(personId)) return tmdbPersonCache.get(personId)!;

  try {
    const url =
      `https://api.themoviedb.org/3/person/${personId}` +
      `?api_key=${TMDB_API_KEY}` +
      `&language=${encodeURIComponent(DEFAULT_LANG)}`;

    const res = await safeFetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    tmdbPersonCache.set(personId, json);
    return json; // contiene profile_path, also_known_as, biography, ecc.
  } catch {
    return null;
  }
}


/* =========================
   OMDb (IMDb ratings + fallback people)
========================= */

export async function omdbRatingFromImdbId(imdbId: string) {
  const id = (imdbId || "").trim();
  if (!id) return null;

  if (omdbCache.has(id)) return omdbCache.get(id)!;

  try {
    const url = `${OMDB_URL}?apikey=${OMDB_API_KEY}&i=${encodeURIComponent(id)}&plot=short&r=json`;
    const res = await safeFetch(url, {}, { timeoutMs: 9000, retries: 1, backoffMs: 500 }).then(r => r.json());
    if (!res || res.Response === "False") return null;

    const imdb_rating_num = Number(res.imdbRating);
    const votes_num =
      typeof res.imdbVotes === "string" ? Number(res.imdbVotes.replace(/,/g, "")) : Number(res.imdbVotes);

    const out = {
      imdb_id: id,
      imdb_rating: Number.isFinite(imdb_rating_num) ? imdb_rating_num : null,
      imdb_votes: Number.isFinite(votes_num) ? votes_num : null,
      omdb: {
        Country: typeof res.Country === "string" ? res.Country : undefined, // usato per pickPrimaryCountryISO2
        Director: typeof res.Director === "string" ? res.Director : undefined, // fallback nomi registi (stringa separata da virgole)
        Actors: typeof res.Actors === "string" ? res.Actors : undefined,     // fallback nomi attori (stringa separata da virgole)
      },
    };
    omdbCache.set(id, out);
    return out;
  } catch {
    return null;
  }
}

/* =========================
   Helpers per People (TMDB + fallback OMDb)
========================= */

function uniqBy<T extends Record<string, any>>(arr: T[], key: string): T[] {
  const seen = new Set<any>();
  const out: T[] = [];
  for (const item of arr) {
    const k = item?.[key];
    if (k == null || seen.has(k)) continue;
    seen.add(k);
    out.push(item);
  }
  return out;
}

function extractDirectorsFromTmdbCredits(credits: any): Array<{ id: number; name: string }> {
  if (!credits?.crew) return [];
  const MAIN_DIRECTOR_JOBS = new Set(["Director", "Co-Director"]);

  const dirs = (credits.crew as any[])
    .filter((c) => typeof c?.job === "string" && MAIN_DIRECTOR_JOBS.has(c.job))
    .map((c) => ({
      id: Number(c.id),
      name: String(c.name || c.original_name || "").trim(),
    }))
    .filter((x) => x.name);

  return uniqBy(dirs, "id");
}

function extractTopCastFromTmdbCredits(credits: any, limit = MAX_TOP_CAST) {
  if (!credits?.cast) return [];
  return (credits.cast as any[])
    .slice() // non mutare
    .sort((a, b) => Number(a.order ?? 999) - Number(b.order ?? 999))
    .slice(0, limit)
    .map(c => ({
      id: Number(c.id),
      name: String(c.name || c.original_name || "").trim(),
      character: typeof c.character === "string" ? c.character : undefined,
      order: Number.isFinite(Number(c.order)) ? Number(c.order) : undefined,
      profile_path: typeof c.profile_path === "string" ? c.profile_path : undefined,
    }))
    .filter(x => x.name);
}

function parsePeopleFromOmdbStrings(omdb: any) {
  const directors: Array<{ id: number | null; name: string }> = [];
  const top_cast: Array<{ id: number | null; name: string; character?: string; order?: number; profile_path?: string }> = [];

  if (typeof omdb?.Director === "string" && omdb.Director.trim()) {
    const parts = omdb.Director.split(",").map((s: string) => s.trim()).filter(Boolean);
    for (const name of parts) directors.push({ id: null, name });
  }
  if (typeof omdb?.Actors === "string" && omdb.Actors.trim()) {
    const parts = omdb.Actors.split(",").map((s: string) => s.trim()).filter(Boolean).slice(0, MAX_TOP_CAST);
    parts.forEach((name: string, i: number) => {
      top_cast.push({ id: null, name, order: i });
    });
  }
  return { directors, top_cast };
}

/* =========================
   Piccole scorciatoie
========================= */

export async function fetchMetaForTitle(title: string): Promise<{ poster_path?: string; overview?: string } | null> {
  const q = (title || "").trim();
  if (!q) return null;

  try {
    const results = await tmdbSearch(q);
    const first = results?.[0];
    if (!first?.id) return null;

    const det = await tmdbDetails(first.id);
    return {
      poster_path: det?.poster_path ?? first?.poster_path,
      overview: det?.overview ?? first?.overview ?? "",
    };
  } catch {
    return null;
  }
}

/* =========================
   Merge & Normalization
========================= */

export function mergeMovie(base: any, det: any) {
  const release_year =
    (det?.release_date || base?.release_date || "").slice(0, 4) ||
    base?.release_year ||
    null;

  // ——— People da TMDB
  const tmdbDirectors = extractDirectorsFromTmdbCredits(det?.credits);
  const tmdbTopCast = extractTopCastFromTmdbCredits(det?.credits);

  // ——— Fallback da OMDb se mancano
  let directors = tmdbDirectors;
  let top_cast = tmdbTopCast;

  if ((!directors || directors.length === 0 || !top_cast || top_cast.length === 0) && base?.omdb) {
    const parsed = parsePeopleFromOmdbStrings(base.omdb);
    if (directors.length === 0 && parsed.directors.length > 0) directors = parsed.directors as any;
    if (top_cast.length === 0 && parsed.top_cast.length > 0) top_cast = parsed.top_cast as any;
  }

  return {
    ...base,
    id: base?.id ?? det?.id,
    poster_path: base?.poster_path ?? det?.poster_path,
    overview: base?.overview ?? det?.overview ?? "",
    genres: Array.isArray(det?.genres) ? det.genres : (base?.genres || []), // TMDB forma: [{id,name}]
    runtime: det?.runtime ?? base?.runtime,
    release_year,
    tmdb_vote_average:
      typeof det?.vote_average === "number"
        ? det.vote_average
        : base?.tmdb_vote_average,
    tmdb_vote_count:
      typeof det?.vote_count === "number"
        ? det.vote_count
        : base?.tmdb_vote_count,
    imdb_id: det?.external_ids?.imdb_id ?? base?.imdb_id,
    original_language: det?.original_language ?? base?.original_language,
    production_countries: det?.production_countries ?? base?.production_countries,
    origin_country: det?.origin_country ?? base?.origin_country,
    production_companies: det?.production_companies ?? base?.production_companies,

    // —— NEW: people
    directors,  // Array<{ id, name }>
    top_cast,   // Array<{ id, name, character?, order?, profile_path? }>
  };
}

// === COUNTRY: scegli 1 ISO2 principale da vari campi (TMDB/OMDb/companies/lang) ===
export function pickPrimaryCountryISO2(m: any): string | null {
  if (!m) return null;

  // 1) TMDB production_countries
  let code: string | null =
    (m?.production_countries?.[0]?.iso_3166_1 as string | undefined) || null;

  // 2) TMDB origin_country
  if (!code && Array.isArray(m?.origin_country) && m.origin_country.length > 0) {
    code = String(m.origin_country[0]);
  }

  // 3) OMDb Country: "USA, Canada" -> prendi il primo e mappa
  if (!code && typeof m?.omdb?.Country === "string" && m.omdb.Country.trim()) {
    const first = m.omdb.Country.split(/[;,]|\/|\|/)[0].trim();
    const map: Record<string, string> = {
      USA: "US", "UNITED STATES": "US", "UNITED STATES OF AMERICA": "US",
      UK: "GB", "UNITED KINGDOM": "GB", "GREAT BRITAIN": "GB",
      CANADA: "CA", ITALY: "IT", FRANCE: "FR", GERMANY: "DE", SPAIN: "ES",
      JAPAN: "JP", CHINA: "CN",
      "SOUTH KOREA": "KR", "REPUBLIC OF KOREA": "KR", KOREA: "KR",
      RUSSIA: "RU", "RUSSIAN FEDERATION": "RU",
      "SOVIET UNION": "RU", SU: "RU",
      "CZECH REPUBLIC": "CZ", CZECHIA: "CZ",
      "HONG KONG": "HK", TAIWAN: "TW",
      MEXICO: "MX", BRAZIL: "BR", IRELAND: "IE", AUSTRALIA: "AU",
      INDIA: "IN", TURKEY: "TR", NETHERLANDS: "NL", SWEDEN: "SE", DENMARK: "DK",
      NORWAY: "NO", POLAND: "PL", PORTUGAL: "PT",
    };
    const up = first.toUpperCase();
    code = /^[A-Z]{2}$/.test(up) ? up : (map[up] || null);
  }

  // 4) Fallback: prima production company con origin_country
  if (!code && Array.isArray(m?.production_companies)) {
    const pc = m.production_companies.find((x: any) => x?.origin_country);
    if (pc?.origin_country) code = String(pc.origin_country);
  }

  // 5) Fallback: lingua originale -> paese tipico
  if (!code && typeof m?.original_language === "string") {
    const mapLang: Record<string, string> = {
      en:"US",it:"IT",fr:"FR",de:"DE",es:"ES",pt:"PT",ja:"JP",ko:"KR",zh:"CN",ru:"RU",
      cs:"CZ",sv:"SE",no:"NO",da:"DK",nl:"NL",pl:"PL",tr:"TR",hi:"IN"
    };
    code = mapLang[m.original_language.toLowerCase()] || null;
  }

  return code ? code.toUpperCase() : null;
}

// === NORMALIZZA: tieni solo primary_country nel movie ===
export function normalizeSingleCountry(m: any): any {
  if (!m) return m;
  const iso = pickPrimaryCountryISO2(m);
  const out: any = { ...m };
  if (iso) out.primary_country = iso;

  // pulizia campi rumorosi
  delete out.production_countries;
  delete out.origin_country;
  if (out.omdb && "Country" in out.omdb) delete out.omdb.Country;
  if ("Country" in out) delete out.Country; // ✅ rimuove il flat compat residuo

  return out;
}

/* =========================
   Ensure helpers
========================= */

export async function ensureGenres(movie: any): Promise<any> {
  try {
    let out = { ...movie };
    let det: any = null;

    if (movie?.id) {
      det = await tmdbDetails(movie.id);
      if (det) out = mergeMovie(out, det);
    }

    if (!out?.id && movie?.title) {
      const search = await tmdbSearch(movie.title);
      const first = search?.[0];
      if (first?.id) {
        det = await tmdbDetails(first.id);
        out = det
          ? mergeMovie(out, det)
          : {
              ...out,
              id: first.id,
              poster_path: out.poster_path ?? first.poster_path,
              overview: out.overview ?? first.overview ?? "",
            };
      }
    }

    // IMDb rating (se possibile)
    if (!out.imdb_rating && out.imdb_id) {
      const omdb = await omdbRatingFromImdbId(out.imdb_id);
      if (omdb) out = { ...out, ...omdb };

      // Se ancora mancano people, prova a parsare OMDb
      if ((!out.directors || out.directors.length === 0) || (!out.top_cast || out.top_cast.length === 0)) {
        const parsed = parsePeopleFromOmdbStrings(omdb?.omdb);
        if ((!out.directors || out.directors.length === 0) && parsed.directors.length > 0) {
          out.directors = parsed.directors as any;
        }
        if ((!out.top_cast || out.top_cast.length === 0) && parsed.top_cast.length > 0) {
          out.top_cast = parsed.top_cast as any;
        }
      }
    }

    // normalizzazione country
    out = normalizeSingleCountry(out);

    return out;
  } catch {
    return movie;
  }
}

export async function ensureRuntime(movie: any): Promise<any> {
  // Per ora è lo stesso flusso; se in futuro vuoi arricchire runtime da altre fonti, hai già il gancio.
  try {
    return await ensureGenres(movie);
  } catch {
    return movie;
  }
}

/* =========================
   Images
========================= */

export function getPosterUrl(p?: string, size: "w185" | "w342" | "w500" | "original" = "w185") {
  if (!p) return "";
  if (p.startsWith("http")) return p;
  return `https://image.tmdb.org/t/p/${size}${p}`;
}

export function getProfileUrl(p?: string, size: "w92" | "w154" | "w185" | "w342" | "original" = "w154") {
  if (!p) return "";
  if (p.startsWith("http")) return p;
  return `https://image.tmdb.org/t/p/${size}${p}`;
}
