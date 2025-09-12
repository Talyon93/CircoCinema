
// utils/refScore.ts
export function refScoreFor(v: any): number | null {
  const m = v?.movie || {};
  const cand =
    m.imdb_rating ?? m.imdbRating ?? m.imdb_score ??
    m?.ratings?.imdb ?? m?.omdb?.imdbRating ?? m.vote_average;
  const n = Number(cand);
  return Number.isFinite(n) ? n : null;
}
