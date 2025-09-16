import { avgOf } from "./history";
import { corr, median, stddev } from "./math";
import { safeYear } from "./country";

export type SparkItem = { t: number; val: number; title?: string; label?: string };

export function buildVotesGiven(history: any[], user: string): SparkItem[] {
  return history
    .map((h, i) => {
      const v = Number(h?.ratings?.[user]);
      return Number.isFinite(v) ? { t: i, val: v, title: h?.movie?.title } : null;
    })
    .filter(Boolean) as SparkItem[];
}

export function buildVotesReceived(history: any[], user: string): SparkItem[] {
  return history
    .filter((h) => (h?.picked_by ?? h?.pickedBy) === user)
    .map((h, i) => {
      const vals = Object.values(h?.ratings ?? {})
        .map(Number)
        .filter(Number.isFinite);
      if (!vals.length) return null;
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
      return { t: i, val: avg, title: h?.movie?.title, label: `${vals.length} votes` };
    })
    .filter(Boolean) as SparkItem[];
}

export function buildYearDistribution(history: any[], user: string) {
  const dist: Record<number, number> = {};
  history.forEach((h) => {
    if ((h?.picked_by ?? h?.pickedBy) !== user) return;
    const y = safeYear(h?.movie);
    if (y == null) return;
    dist[y] = (dist[y] || 0) + 1;
  });
  return Object.entries(dist)
    .map(([year, count]) => ({ name: String(year), count }))
    .sort((a, b) => Number(a.name) - Number(b.name));
}

export function averageRuntime(history: any[], user: string) {
  const runtimes = history
    .filter((h) => user in (h?.ratings ?? {}))
    .map((h) => h?.movie)
    .map((m: any) => Number(m?.runtime ?? m?.Runtime ?? m?.duration ?? m?.movie_runtime))
    .filter(Number.isFinite);
  return runtimes.length
    ? Math.round(runtimes.reduce((a, b) => a + b, 0) / runtimes.length)
    : null;
}

export function yearsSummary(history: any[], user: string) {
  const ys = history
    .filter((h) => (h?.picked_by ?? h?.pickedBy) === user)
    .map((h) => safeYear(h?.movie))
    .filter((x): x is number => Number.isFinite(x));
  if (!ys.length) return { avg: null, min: null, max: null };
  const avg = Math.round(ys.reduce((a, b) => a + b, 0) / ys.length);
  return { avg, min: Math.min(...ys), max: Math.max(...ys) };
}

export function averageImdbForPicks(history: any[], user: string) {
  const refs = history
    .filter((h) => (h?.picked_by ?? h?.pickedBy) === user)
    .map((h) => h?.movie)
    .map((m: any) =>
      Number(
        m?.imdb_rating ??
        m?.imdbRating ??
        m?.imdb_score ??
        m?.ratings?.imdb ??
        m?.omdb?.imdbRating ??
        m?.vote_average
      )
    )
    .filter(Number.isFinite);
  return refs.length
    ? Math.round((refs.reduce((a, b) => a + b, 0) / refs.length) * 100) / 100
    : null;
}

export function buildTopRated(history: any[], user: string) {
  const picked = history
    .filter((h) => (h?.picked_by ?? h?.pickedBy) === user)
    .map((h) => {
      const vals = Object.values(h?.ratings ?? {})
        .map(Number)
        .filter(Number.isFinite);
      const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
      return { title: h?.movie?.title || "Untitled", avg };
    })
    .filter((r) => r.avg != null) as { title: string; avg: number }[];
  return picked.sort((a, b) => b.avg - a.avg).slice(0, 5);
}

export function pickWinRate(history: any[], user: string) {
  const mine = history.filter((h) => (h?.picked_by ?? h?.pickedBy) === user);
  if (!mine.length) return null;
  const winners = mine.filter((h) => {
    const vals = Object.values(h?.ratings ?? {}).map(Number).filter(Number.isFinite);
    if (!vals.length) return false;
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    return avg >= 8;
  }).length;
  return Math.round((winners / mine.length) * 100);
}

export function collectReceivedVotesOnPicks(
  history: any[],
  user: string,
  includeSelf = false
): number[] {
  const norm = (s?: string) => (s ?? "").trim().toLowerCase();
  const isPickedBy = (h: any) =>
    norm(
      h?.picked_by ??
      h?.pickedBy ??
      h?.picker ??
      h?.movie?.picked_by ??
      h?.movie?.pickedBy ??
      h?.movie?.picker ??
      ""
    ) === norm(user);
  const out: number[] = [];
  history.filter(isPickedBy).forEach((h) => {
    const ratings = h?.ratings ?? {};
    for (const [rater, raw] of Object.entries(ratings)) {
      if (!includeSelf && norm(rater) === norm(user)) continue;
      const v = Number(raw);
      if (Number.isFinite(v)) out.push(v);
    }
  });
  return out;
}

export function affinityWithOthers(history: any[], user: string) {
  const users = new Set<string>();
  history.forEach((h) => Object.keys(h?.ratings ?? {}).forEach((u) => users.add(u)));
  users.delete(user);

  const rows: { user: string; corr: number | null }[] = [];
  for (const other of users) {
    const xs: number[] = [], ys: number[] = [];
    for (const h of history) {
      const r: Record<string, any> = h?.ratings ?? {};
      if (!(user in r) || !(other in r)) continue;
      const a = Number(r[user]);
      const b = Number(r[other]);
      if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
      xs.push(a);
      ys.push(b);
    }
    rows.push({ user: other, corr: corr(xs, ys) });
  }

  const val = rows.filter((r) => r.corr != null) as { user: string; corr: number }[];
  const most = val.slice().sort((a, b) => b.corr - a.corr).slice(0, 3);
  const least = val.slice().sort((a, b) => a.corr - b.corr).slice(0, 3);
  return { most, least };
}

export function userVsCrowdAverages(history: any[], user: string) {
  const userScores: number[] = [];
  const crowdAverages: number[] = [];
  for (const h of history) {
    const r: Record<string, any> = h?.ratings ?? {};
    if (!(user in r)) continue;
    const mine = Number(r[user]);
    if (!Number.isFinite(mine)) continue;
    const vals = Object.values(r).map(Number).filter(Number.isFinite);
    if (!vals.length) continue;
    const crowdAvg = vals.reduce((a, b) => a + b, 0) / vals.length;
    userScores.push(mine);
    crowdAverages.push(crowdAvg);
  }
  const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
  return { avgUser: avg(userScores), avgCrowd: avg(crowdAverages) };
}
