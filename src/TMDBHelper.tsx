const TMDB_API_KEY = "99cb7c79bbe966a91a2ffcb7a3ea3d37";
const OMDB_API_KEY = "c71ea1b7";

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
  try {
    if (!OMDB_API_KEY || !imdbId) return null;
    const res = await fetch(`https://www.omdbapi.com/?apikey=${OMDB_API_KEY}&i=${imdbId}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.Response !== "True") return null;
    return {
      imdb_rating: data.imdbRating !== "N/A" ? parseFloat(data.imdbRating) : null,
      imdb_votes:
        data.imdbVotes && data.imdbVotes !== "N/A"
          ? parseInt(String(data.imdbVotes).replace(/,/g, ""), 10)
          : null,
    };
  } catch {
    return null;
  }
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