const TMDB_API_KEY = "99cb7c79bbe966a91a2ffcb7a3ea3d37";
const OMDB_API_KEY = "c71ea1b7";
const OMDB_URL = "https://www.omdbapi.com/";

export async function tmdbSearch(query: string) {
  const q = (query || "").trim();
  if (!q) return [] as any[];
  try {
    const url = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(
      q
    )}&language=en-US`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return (data?.results || []) as any[];
  } catch {
    return [];
  }
}

export async function tmdbDetails(tmdbId: number) {
  try {
    const url = `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${TMDB_API_KEY}&language=en-US&append_to_response=external_ids`;
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function omdbRatingFromImdbId(imdbId: string) {
  if (!imdbId) return null;

  const url = `${OMDB_URL}?apikey=${OMDB_API_KEY}&i=${encodeURIComponent(imdbId)}&plot=short&r=json`;
  const res = await fetch(url).then(r => r.json()).catch(() => null);
  if (!res || res.Response === "False") return null;

  const imdb_rating = Number(res.imdbRating);
  const imdb_votes = typeof res.imdbVotes === "string" ? Number(res.imdbVotes.replace(/,/g, "")) : null;

  // ✚ questa è la riga importante: porta su la country di OMDb
  const Country = typeof res.Country === "string" ? res.Country : undefined; // es: "USA, Canada"

    return {
    imdb_id: imdbId,
    imdb_rating: Number.isFinite(imdb_rating) ? imdb_rating : null,
    imdb_votes: Number.isFinite(imdb_votes) ? imdb_votes : null,
    omdb: { Country: typeof res.Country === "string" ? res.Country : undefined },
    Country: res.Country, // flat compat (verrà ripulito)
  };
}


export async function fetchMetaForTitle(title: string): Promise<{ poster_path?: string; overview?: string } | null> {
  const q = (title || "").trim();
  if (!q) return null;

  try {
    // 1) search
    const searchUrl = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(q)}&language=en-US`;
    const sres = await fetch(searchUrl);
    if (!sres.ok) return null;
    const sdata = await sres.json();
    const first = (sdata?.results || [])[0];
    if (!first?.id) return null;

    // 2) details
    const detUrl = `https://api.themoviedb.org/3/movie/${first.id}?api_key=${TMDB_API_KEY}&language=en-US`;
    const dres = await fetch(detUrl);
    if (!dres.ok) return null;
    const det = await dres.json();

    return { poster_path: det?.poster_path || first?.poster_path, overview: det?.overview || "" };
  } catch {
    return null;
  }
}

export function mergeMovie(base: any, det: any) {
  const release_year =
    (det?.release_date || base?.release_date || "").slice(0, 4) ||
    base?.release_year ||
    null;

  return {
    ...base,
    id: base?.id ?? det?.id,
    poster_path: base?.poster_path ?? det?.poster_path,
    overview: base?.overview ?? det?.overview ?? "",
    genres: Array.isArray(det?.genres) ? det.genres : (base?.genres || []),
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
        UK: "GB", "UNITED KINGDOM": "GB",
        CANADA: "CA", ITALY: "IT", FRANCE: "FR", GERMANY: "DE", SPAIN: "ES",
        JAPAN: "JP", CHINA: "CN",
        "SOUTH KOREA": "KR", "REPUBLIC OF KOREA": "KR",
        RUSSIA: "RU", "RUSSIAN FEDERATION": "RU",
        "SOVIET UNION": "RU", SU: "RU",        // 👈 fix URSS
        "CZECH REPUBLIC": "CZ", CZECHIA: "CZ",
        "HONG KONG": "HK", TAIWAN: "TW",
        MEXICO: "MX", BRAZIL: "BR", IRELAND: "IE", AUSTRALIA: "AU"
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
  if (iso) m.primary_country = iso;
  delete (m as any).production_countries;
  delete (m as any).origin_country;
  if (m.omdb && "Country" in m.omdb) delete (m.omdb as any).Country;
  return m;
}


// Assicura che il movie abbia almeno genres (e, già che ci siamo, completiamo poster/overview se mancano)
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

    // IMDb rating (se possibile), altrimenti useremo tmdb_vote_average in UI
    if (!out.imdb_rating && out.imdb_id) {
      const omdb = await omdbRatingFromImdbId(out.imdb_id);
      if (omdb) out = { ...out, ...omdb };
    }

    return out;
  } catch {
    return movie;
  }
}

export async function ensureRuntime(movie: any): Promise<any> {
  try {
    return await ensureGenres(movie);
  } catch {
    return movie;
  }
}


export function getPosterUrl(p?: string, size: "w185" | "w342" = "w185") {
  if (!p) return "";
  if (p.startsWith("http")) return p;
  return `https://image.tmdb.org/t/p/${size}${p}`;
}