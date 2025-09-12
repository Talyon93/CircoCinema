import React from "react";
import { Card } from "../../Components/UI/Card";
import { AvatarInline } from "../../Components/UI/Avatar";
import { formatScore } from "../../Utils/Utils";
import { UserCircleIcon } from "@heroicons/react/24/outline";

import { Donut } from "../ui/Donut";
import { Histogram } from "../ui/Histogram";
import { BarRow } from "../ui/BarRow";
import { DiffPill } from "../ui/DiffPill";
import { Sparkline } from "../charts/Sparkline";
import { Fragment } from "react";
import { Listbox, Transition } from "@headlessui/react";
import { CheckIcon, ChevronUpDownIcon } from "@heroicons/react/20/solid";
/* ===================== Info badge (inline / floating) ===================== */
function InfoBadge({
  text,
  variant = "inline",
  className = "",
}: {
  text: string;
  variant?: "inline" | "floating";
  className?: string;
}) {
  if (variant === "floating") {
    return (
      <div className={`group absolute right-2 top-2 ${className}`}>
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-zinc-600/60 text-[10px] leading-none text-zinc-300 bg-zinc-900/70">
          i
        </span>
        <div className="pointer-events-none absolute right-0 z-20 hidden w-64 translate-y-2 rounded-md border border-zinc-700 bg-zinc-900 p-2 text-xs text-zinc-200 shadow-xl group-hover:block">
          {text}
        </div>
      </div>
    );
  }
  // inline
  return (
    <span className={`relative group inline-flex items-center ${className}`}>
      <span className="ml-2 inline-flex h-5 w-5 items-center justify-center rounded-full border border-zinc-600/60 text-[10px] leading-none text-zinc-300 bg-zinc-900/70">
        i
      </span>
      <div className="pointer-events-none absolute right-0 top-6 z-20 hidden w-64 rounded-md border border-zinc-700 bg-zinc-900 p-2 text-xs text-zinc-200 shadow-xl group-hover:block">
        {text}
      </div>
    </span>
  );
}

/* ===================== Helpers & types ===================== */
const avgOf = (r?: Record<string, number> | null) => {
  if (!r) return null;
  const vals = Object.values(r).map(Number).filter(Number.isFinite);
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
};
const median = (arr: number[]) => {
  if (!arr.length) return null;
  const a = [...arr].sort((x, y) => x - y);
  const mid = Math.floor(a.length / 2);
  return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
};
const stddev = (arr: number[]) => {
  if (arr.length < 2) return null;
  const m = arr.reduce((a, b) => a + b, 0) / arr.length;
  const v = arr.reduce((s, x) => s + (x - m) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(v);
};

function safeYear(m?: any): number | null {
  const yCand =
    m?.year ??
    m?.Year ??
    (typeof m?.release_year === "number" ? m.release_year : undefined) ??
    (typeof m?.first_air_date === "string" ? m.first_air_date?.slice(0, 4) : undefined) ??
    (typeof m?.release_date === "string" ? m.release_date?.slice(0, 4) : undefined);
  const y = Number(yCand);
  return Number.isFinite(y) ? y : null;
}
function safeRuntime(m?: any): number | null {
  const rCand = m?.runtime ?? m?.Runtime ?? m?.duration ?? m?.movie_runtime;
  const r = Number(rCand);
  return Number.isFinite(r) ? r : null;
}
function safeCountries(m?: any): string[] {
  // TMDB: production_countries: [{iso_3166_1, name}], origin_country: ["US", ...]
  const pc = Array.isArray(m?.production_countries) ? m?.production_countries.map((c: any) => c?.iso_3166_1 || c?.name).filter(Boolean) : [];
  const oc = Array.isArray(m?.origin_country) ? m.origin_country : [];
  const c = [...pc, ...oc].filter(Boolean);
  return Array.from(new Set(c));
}

function refScoreFor(v: any): number | null {
  const m = v?.movie || {};
  const cand =
    m.imdb_rating ?? m.imdbRating ?? m.imdb_score ??
    m?.ratings?.imdb ?? m?.omdb?.imdbRating ?? m.vote_average;
  const n = Number(cand);
  return Number.isFinite(n) ? n : null;
}

type GivenRow = { user: string; avg: number; count: number; scores: number[] };
type ReceivedRow = { user: string; avg: number; count: number };

type Props = {
  history: any[];
  givenArr: GivenRow[];
  receivedArr: ReceivedRow[];
  userGenreLikes: Map<string, Map<string, { pos: number; tot: number }>>;
  selectedUser: string | null;
  onSelectUser: (u: string | null) => void;
  userOptions: string[];
  below?: React.ReactNode;
};

type SparkItem = { t: number; val: number; title?: string; label?: string };

/* ===================== Sparkline builders ===================== */
function toOrderKey(v: any, idxFallback: number) {
  const ts =
    Date.parse(v?.started_at || v?.date || v?.created_at || "") || 0;
  return ts || idxFallback;
}
function buildVotesGiven(history: any[], user: string): SparkItem[] {
  return history
    .map((h, i) => {
      const v = Number(h?.ratings?.[user]);
      return Number.isFinite(v)
        ? { t: toOrderKey(h, i), val: v, title: h?.movie?.title }
        : null;
    })
    .filter(Boolean)
    .sort((a: any, b: any) => a.t - b.t)
    .map((p: any, i: number) => ({ ...p, t: i }));
}
function buildVotesReceived(history: any[], user: string): SparkItem[] {
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
    .filter(Boolean)
    .sort((a: any, b: any) => a.t - b.t) as SparkItem[];
}

/* ===================== Extra stats builders ===================== */
function buildYearDistribution(history: any[], user: string) {
  const dist: Record<string, number> = {};
  history.forEach((h) => {
    if (!(user in (h?.ratings ?? {}))) return;
    const y = safeYear(h?.movie);
    if (y == null) return;
    const decade = Math.floor(y / 10) * 10;
    dist[decade] = (dist[decade] || 0) + 1;
  });
  const rows = Object.entries(dist)
    .map(([dec, count]) => ({ name: `${dec}s`, count }))
    .sort((a, b) => Number(a.name) - Number(b.name));
  return rows;
}
function buildTopRated(history: any[], user: string) {
  // top by received avg when they picked
  const picked = history
    .filter((h) => (h?.picked_by ?? h?.pickedBy) === user)
    .map((h) => {
      const vals = Object.values(h?.ratings ?? {}).map(Number).filter(Number.isFinite);
      const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
      return { title: h?.movie?.title || "Untitled", avg };
    })
    .filter((r) => r.avg != null) as { title: string; avg: number }[];
  return picked.sort((a, b) => b.avg - a.avg).slice(0, 5);
}
function averageRuntime(history: any[], user: string) {
  const runtimes = history
    .filter((h) => user in (h?.ratings ?? {}))
    .map((h) => safeRuntime(h?.movie))
    .filter((x): x is number => Number.isFinite(x as number));
  return runtimes.length
    ? Math.round(runtimes.reduce((a, b) => a + b, 0) / runtimes.length)
    : null;
}
function yearsSummary(history: any[], user: string) {
  const ys = history
    .filter((h) => user in (h?.ratings ?? {}))
    .map((h) => safeYear(h?.movie))
    .filter((x): x is number => Number.isFinite(x as number));
  if (!ys.length) return { avg: null as number | null, min: null, max: null };
  const avg = Math.round(ys.reduce((a, b) => a + b, 0) / ys.length);
  return { avg, min: Math.min(...ys), max: Math.max(...ys) };
}
function hitRate(history: any[], user: string) {
  const scores = history.map((h) => Number(h?.ratings?.[user])).filter(Number.isFinite);
  if (!scores.length) return null;
  const hits = scores.filter((s) => s >= 8).length;
  return Math.round((hits / scores.length) * 100);
}
function pickWinRate(history: any[], user: string) {
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

/* ---------- New: pick metrics, distributions, correlations ---------- */
function votesReceivedHistogram(history: any[], user: string): number[] {
  // returns list of averages (one per pick) to feed Histogram
  return history
    .filter((h) => (h?.picked_by ?? h?.pickedBy) === user)
    .map((h) => {
      const vals = Object.values(h?.ratings ?? {}).map(Number).filter(Number.isFinite);
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    })
    .filter((x): x is number => Number.isFinite(x as number));
}
function runtimeBuckets(history: any[], user: string) {
  const buckets = { Short: 0, Medium: 0, Long: 0 };
  history.forEach((h) => {
    if (!(user in (h?.ratings ?? {}))) return;
    const r = safeRuntime(h?.movie);
    if (r == null) return;
    if (r < 90) buckets.Short++;
    else if (r <= 120) buckets.Medium++;
    else buckets.Long++;
  });
  return [
    { name: "Short (<90)", count: buckets.Short },
    { name: "Medium (90–120)", count: buckets.Medium },
    { name: "Long (>120)", count: buckets.Long },
  ];
}
function countryDistribution(history: any[], user: string) {
  const map = new Map<string, number>();
  for (const h of history) {
    if (!(user in (h?.ratings ?? {}))) continue;
    const cs = safeCountries(h?.movie);
    if (!cs.length) continue;
    for (const c of cs) map.set(c, (map.get(c) || 0) + 1);
  }
  return Array.from(map, ([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 9);
}
function pickPolarization(history: any[], user: string) {
  // average stdev across the user's picks (based on all voters per movie)
  const stdevs: number[] = [];
  for (const h of history) {
    if ((h?.picked_by ?? h?.pickedBy) !== user) continue;
    const vals = Object.values(h?.ratings ?? {}).map(Number).filter(Number.isFinite);
    if (vals.length >= 2) stdevs.push(stddev(vals)!);
  }
  return stdevs.length ? Math.round((stdevs.reduce((a, b) => a + b, 0) / stdevs.length) * 100) / 100 : null;
}
function pickBiasVsImdb(history: any[], user: string) {
  // average (received avg − IMDb) on picks
  const diffs: number[] = [];
  for (const h of history) {
    if ((h?.picked_by ?? h?.pickedBy) !== user) continue;
    const vals = Object.values(h?.ratings ?? {}).map(Number).filter(Number.isFinite);
    if (!vals.length) continue;
    const avgR = vals.reduce((a, b) => a + b, 0) / vals.length;
    const ref = refScoreFor(h);
    if (ref == null) continue;
    diffs.push(avgR - ref);
  }
  return diffs.length ? Math.round((diffs.reduce((a, b) => a + b, 0) / diffs.length) * 100) / 100 : null;
}
function corr(a: number[], b: number[]) {
  const n = Math.min(a.length, b.length);
  if (n < 2) return null;
  const ax = a.slice(0, n), bx = b.slice(0, n);
  const ma = ax.reduce((s, x) => s + x, 0) / n;
  const mb = bx.reduce((s, x) => s + x, 0) / n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) {
    const xa = ax[i] - ma, xb = bx[i] - mb;
    num += xa * xb; da += xa * xa; db += xb * xb;
  }
  const den = Math.sqrt(da * db);
  return den ? Math.round((num / den) * 100) / 100 : null;
}
function corrWithGroup(history: any[], user: string) {
  // align on co-rated movies; compare user's rating vs average of others
  const xs: number[] = [], ys: number[] = [];
  for (const h of history) {
    const ratings = h?.ratings ?? {};
    if (!(user in ratings)) continue;
    const mine = Number(ratings[user]);
    if (!Number.isFinite(mine)) continue;
    const others = Object.entries(ratings)
      .filter(([u]) => u !== user)
      .map(([, v]) => Number(v))
      .filter(Number.isFinite);
    if (!others.length) continue;
    const avgO = others.reduce((a, b) => a + b, 0) / others.length;
    xs.push(mine); ys.push(avgO);
  }
  return corr(xs, ys);
}
function corrWithImdb(history: any[], user: string) {
  const xs: number[] = [], ys: number[] = [];
  for (const h of history) {
    const ratings = h?.ratings ?? {};
    if (!(user in ratings)) continue;
    const mine = Number(ratings[user]);
    if (!Number.isFinite(mine)) continue;
    const ref = refScoreFor(h);
    if (ref == null) continue;
    xs.push(mine); ys.push(ref);
  }
  return corr(xs, ys);
}

function averageImdbForPicks(history: any[], user: string) {
  // media IMDb dei film portati da "user"
  const refs = history
    .filter((h) => (h?.picked_by ?? h?.pickedBy) === user)
    .map((h) => refScoreFor(h))
    .filter((x): x is number => Number.isFinite(x as number));

  return refs.length
    ? Math.round((refs.reduce((a, b) => a + b, 0) / refs.length) * 100) / 100
    : null;
}


function biasZScore(history: any[], user: string) {
  // compute per-movie (user - crowd) and z-score vs all users' biases
  const biases: number[] = [];
  const allBiases: number[] = [];
  const users = new Set<string>();
  history.forEach((h) => Object.keys(h?.ratings ?? {}).forEach((u) => users.add(u)));
  const everyone = Array.from(users);

  for (const h of history) {
    const r = h?.ratings ?? {};
    const a = avgOf(r);
    if (a == null) continue;
    for (const u of Object.keys(r)) {
      const b = Number(r[u]) - a;
      if (Number.isFinite(b)) {
        if (u === user) biases.push(b);
        allBiases.push(b);
      }
    }
  }
  if (!biases.length || allBiases.length < 3) return null;
  const mu = allBiases.reduce((s, x) => s + x, 0) / allBiases.length;
  const sd = stddev(allBiases)!;
  if (!sd) return null;
  const myAvg = biases.reduce((s, x) => s + x, 0) / biases.length;
  return Math.round(((myAvg - mu) / sd) * 100) / 100;
}
function affinityWithOthers(history: any[], user: string) {
  const users = new Set<string>();
  history.forEach((h) => Object.keys(h?.ratings ?? {}).forEach((u) => users.add(u)));
  users.delete(user);
  const rows: { user: string; corr: number | null }[] = [];
  for (const other of users) {
    const xs: number[] = [], ys: number[] = [];
    for (const h of history) {
      const r = h?.ratings ?? {};
      if (!(user in r) || !(other in r)) continue;
      const a = Number(r[user]); const b = Number(r[other]);
      if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
      xs.push(a); ys.push(b);
    }
    rows.push({ user: other, corr: corr(xs, ys) });
  }
  const val = rows.filter((r) => r.corr != null) as { user: string; corr: number }[];
  const most = val.slice().sort((a, b) => b.corr - a.corr).slice(0, 3);
  const least = val.slice().sort((a, b) => a.corr - b.corr).slice(0, 3);
  return { most, least };
}
function imdbBiasSpark(history: any[], user: string): SparkItem[] {
  // per pick: received avg - imdb
  const items: SparkItem[] = [];
  let idx = 0;
  for (const h of history) {
    if ((h?.picked_by ?? h?.pickedBy) !== user) continue;
    const vals = Object.values(h?.ratings ?? {}).map(Number).filter(Number.isFinite);
    if (!vals.length) continue;
    const avgR = vals.reduce((a, b) => a + b, 0) / vals.length;
    const ref = refScoreFor(h);
    if (ref == null) continue;
    items.push({ t: idx++, val: Math.round((avgR - ref) * 100) / 100, title: h?.movie?.title });
  }
  return items;
}
function pickWinRateSpark(history: any[], user: string): SparkItem[] {
  // cumulative win-rate over picks
  const items: SparkItem[] = [];
  const picks = history.filter((h) => (h?.picked_by ?? h?.pickedBy) === user);
  let wins = 0;
  picks.forEach((h, i) => {
    const vals = Object.values(h?.ratings ?? {}).map(Number).filter(Number.isFinite);
    const avgR = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    if (avgR >= 8) wins++;
    items.push({ t: i, val: Math.round(((wins / (i + 1)) * 100)) / 100, title: h?.movie?.title, label: `${wins}/${i + 1}` });
  });
  return items;
}

/* ===================== Fancy compare card (inline info) ===================== */
function CompareAvgCard({
  received,
  imdb,
}: {
  received: number | null | undefined;
  imdb: number | null | undefined;
}) {
  const r = typeof received === "number" ? received : null;
  const i = typeof imdb === "number" ? imdb : null;
  const delta = r != null && i != null ? r - i : null;

  const fmt = (v: number | null) =>
    v == null ? "—" : v.toFixed(2).replace(/\.00$/, "");
  const barPct = (v: number | null) => Math.max(0, Math.min(10, v ?? 0)) * 10;

  const deltaTone =
    delta == null
      ? { text: "text-zinc-300", bg: "bg-zinc-700/40", icon: "–" }
      : delta > 0.05
      ? { text: "text-emerald-500", bg: "bg-emerald-500/10", icon: "▲" }
      : delta < -0.05
      ? { text: "text-rose-500", bg: "bg-rose-500/10", icon: "▼" }
      : { text: "text-amber-400", bg: "bg-amber-500/10", icon: "•" };

  return (
    <div className="relative rounded-xl border p-3 pr-7 dark:border-zinc-700">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-xs uppercase tracking-wide text-zinc-500 flex items-center gap-2">
          Avg received vs IMDb (their picks)
          <InfoBadge  variant="floating" text="Confronta la media dei voti ricevuti dai film proposti dall’utente con la media IMDb degli stessi film. Δ = received − IMDb." />
        </div>
        <div
          className={`hidden items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${deltaTone.bg} ${deltaTone.text} md:flex`}
          title="Differenza: received − IMDb"
        >
          <span className="leading-none">{deltaTone.icon}</span>
          <span className="leading-none">
            {delta == null ? "—" : `${delta > 0 ? "+" : ""}${delta.toFixed(2)}`}
          </span>
        </div>
      </div>

      <div className="flex items-end justify-between gap-4">
        <div className="flex-1">
          <div className="text-[11px] uppercase text-zinc-400">Avg received</div>
          <div className="text-[28px] font-bold leading-none">{fmt(r)}</div>
        </div>
        <div className="flex-1 text-right">
          <div className="text-[11px] uppercase text-zinc-400">Avg IMDb</div>
          <div className="text-[28px] font-bold leading-none">{fmt(i)}</div>
        </div>
      </div>

      <div className="mt-3 rounded-lg bg-zinc-900/60 p-2">
        <div className="relative h-2 w-full rounded-full bg-zinc-700/40">
          <div className="absolute left-0 top-0 h-2 rounded-full bg-sky-500/50" style={{ width: `${barPct(i)}%` }} />
          <div className="absolute left-0 top-0 h-2 rounded-full bg-emerald-500/90" style={{ width: `${barPct(r)}%` }} />
          <div className="absolute -top-0.5 h-3 w-3 -translate-x-1/2 rounded-full border border-white/30 bg-sky-400/90" style={{ left: `${barPct(i)}%` }} />
          <div className="absolute -top-0.5 h-3 w-3 -translate-x-1/2 rounded-full border border-white/30 bg-emerald-400" style={{ left: `${barPct(r)}%` }} />
          <div className="absolute inset-y-0 left-1/2 w-px bg-white/15" />
          <div className="absolute inset-y-0 left-[80%] w-px bg-white/10" />
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-zinc-500">
          <span>0</span><span>5</span><span>10</span>
        </div>
        <div className="mt-2 flex items-center gap-3 text-[11px]">
          <span className="inline-flex items-center gap-1 text-zinc-400">
            <span className="inline-block h-2 w-3 rounded bg-emerald-500/90" /> Received
          </span>
          <span className="inline-flex items-center gap-1 text-zinc-400">
            <span className="inline-block h-2 w-3 rounded bg-sky-500/70" /> IMDb
          </span>
        </div>
      </div>
    </div>
  );
}

/* ===================== Component ===================== */
export function UserPanelClassic({
  history,
  givenArr,
  receivedArr,
  userGenreLikes,
  selectedUser,
  onSelectUser,
  userOptions,
  below,
}: Props) {
  const selGiven = React.useMemo(
    () => (selectedUser ? givenArr.find((u) => u.user === selectedUser) : undefined),
    [selectedUser, givenArr]
  );
  const selReceived = React.useMemo(
    () => (selectedUser ? receivedArr.find((u) => u.user === selectedUser) : undefined),
    [selectedUser, receivedArr]
  );

  const avgImdbPicks = React.useMemo(
    () => (selectedUser ? averageImdbForPicks(history, selectedUser) : null),
    [history, selectedUser]
  );

  const dataGiven = React.useMemo(
    () => (selectedUser ? buildVotesGiven(history, selectedUser) : []),
    [history, selectedUser]
  );
  const dataReceived = React.useMemo(
    () => (selectedUser ? buildVotesReceived(history, selectedUser) : []),
    [history, selectedUser]
  );

  const bias = React.useMemo(() => {
    if (!selectedUser) return null;
    let sum = 0, n = 0;
    for (const v of history) {
      const ratings = (v?.ratings || {}) as Record<string, number>;
      if (selectedUser in ratings) {
        const a = avgOf(ratings);
        if (a != null) { sum += Number(ratings[selectedUser]) - a; n += 1; }
      }
    }
    return n ? sum / n : null;
  }, [selectedUser, history]);

  const selGenres = React.useMemo(() => {
    if (!selectedUser) return [];
    const m = userGenreLikes.get(selectedUser) || new Map<string, { pos: number; tot: number }>();
    return Array.from(m, ([name, v]) => ({ name, count: v.pos, tot: v.tot }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
      .slice(0, 9);
  }, [selectedUser, userGenreLikes]);

  const userImdbCompare = React.useMemo(() => {
    if (!selectedUser) return { closest: [] as any[], farthest: [] as any[] };
    const rows: Array<{ id: any; title: string; userScore: number; ref: number; diff: number }> = [];
    for (const v of history) {
      const userScore = Number(v?.ratings?.[selectedUser]);
      const ref = refScoreFor(v);
      if (!Number.isFinite(userScore) || !Number.isFinite(ref)) continue;
      rows.push({ id: v.id, title: v?.movie?.title || "Untitled", userScore, ref, diff: Math.abs(userScore - ref) });
    }
    const byClosest = rows.slice().sort((a, b) => a.diff - b.diff).slice(0, 5);
    const byFarthest = rows.slice().sort((a, b) => b.diff - a.diff).slice(0, 5);
    return { closest: byClosest, farthest: byFarthest };
  }, [selectedUser, history]);

  // nuove stats
  const yearDist = React.useMemo(
    () => (selectedUser ? buildYearDistribution(history, selectedUser) : []),
    [history, selectedUser]
  );
  const topRatedPicks = React.useMemo(
    () => (selectedUser ? buildTopRated(history, selectedUser) : []),
    [history, selectedUser]
  );
  const avgRt = React.useMemo(
    () => (selectedUser ? averageRuntime(history, selectedUser) : null),
    [history, selectedUser]
  );
  const { avg: avgYear, min: minYear, max: maxYear } = React.useMemo(
    () => (selectedUser ? yearsSummary(history, selectedUser) : { avg: null, min: null, max: null }),
    [history, selectedUser]
  );
  const kScores = React.useMemo(() => {
    const arr = selectedUser
      ? history.map((h) => Number(h?.ratings?.[selectedUser])).filter(Number.isFinite)
      : [];
    return {
      median: median(arr),
      stdev: stddev(arr),
      hitRate: hitRate(history, selectedUser || ""),
      count: arr.length,
    };
  }, [history, selectedUser]);
  const kPickWin = React.useMemo(
    () => (selectedUser ? pickWinRate(history, selectedUser) : null),
    [history, selectedUser]
  );

  // new computed groups
  const receivedHist = React.useMemo(
    () => (selectedUser ? votesReceivedHistogram(history, selectedUser) : []),
    [history, selectedUser]
  );
  const runtimeDist = React.useMemo(
    () => (selectedUser ? runtimeBuckets(history, selectedUser) : []),
    [history, selectedUser]
  );
  const countryDist = React.useMemo(
    () => (selectedUser ? countryDistribution(history, selectedUser) : []),
    [history, selectedUser]
  );
  const pol = React.useMemo(
    () => (selectedUser ? pickPolarization(history, selectedUser) : null),
    [history, selectedUser]
  );
  const pbImdb = React.useMemo(
    () => (selectedUser ? pickBiasVsImdb(history, selectedUser) : null),
    [history, selectedUser]
  );
  const corrGroup = React.useMemo(
    () => (selectedUser ? corrWithGroup(history, selectedUser) : null),
    [history, selectedUser]
  );
  const corrImdb = React.useMemo(
    () => (selectedUser ? corrWithImdb(history, selectedUser) : null),
    [history, selectedUser]
  );
  const zBias = React.useMemo(
    () => (selectedUser ? biasZScore(history, selectedUser) : null),
    [history, selectedUser]
  );
  const affinity = React.useMemo(
    () => (selectedUser ? affinityWithOthers(history, selectedUser) : { most: [], least: [] }),
    [history, selectedUser]
  );
  const sparkBias = React.useMemo(
    () => (selectedUser ? imdbBiasSpark(history, selectedUser) : []),
    [history, selectedUser]
  );
  const sparkWin = React.useMemo(
    () => (selectedUser ? pickWinRateSpark(history, selectedUser) : []),
    [history, selectedUser]
  );

  /* ===================== UI ===================== */
  return (
    <Card>
{/* Header */}
<div className="mb-4">
  {/* selettore centrato e grande */}
  <div className="mt-3 flex w-full justify-center">
    <div className="w-80 md:w-96">
      <Listbox value={selectedUser ?? ""} onChange={(val) => onSelectUser(val || null)}>
        <div className="relative">
          <Listbox.Button className="relative w-full cursor-default rounded-xl border border-zinc-700 bg-zinc-900 py-2.5 pl-4 pr-12 text-left text-base shadow-md focus:outline-none focus-visible:border-sky-500 focus-visible:ring-2 focus-visible:ring-sky-500/40">
            <span className="flex items-center gap-2">
              {selectedUser && <AvatarInline name={selectedUser} size={22} />}
              <span className="truncate">{selectedUser || "Seleziona utente"}</span>
            </span>
            <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
              <ChevronUpDownIcon className="h-5 w-5 text-zinc-400" aria-hidden="true" />
            </span>
          </Listbox.Button>

          <Transition
            as={Fragment}
            leave="transition ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <Listbox.Options className="absolute z-50 mt-2 max-h-72 w-full overflow-auto rounded-xl border border-zinc-700 bg-zinc-900 p-1 text-sm shadow-2xl ring-1 ring-black/5 focus:outline-none">
              {userOptions.map((u, idx) => (
                <Listbox.Option
                  key={idx}
                  value={u}
                  className={({ active }) =>
                    `relative cursor-default select-none rounded-lg px-3 py-2 ${
                      active ? "bg-sky-600 text-white" : "text-zinc-200"
                    }`
                  }
                >
                  {({ selected, active }) => (
                    <div className="flex items-center gap-2">
                      <AvatarInline name={u} size={20} />
                      <span className={`truncate ${selected ? "font-medium" : ""}`}>{u}</span>
                      {selected && (
                        <CheckIcon
                          className={`ml-auto h-4 w-4 ${active ? "text-white" : "text-sky-400"}`}
                        />
                      )}
                    </div>
                  )}
                </Listbox.Option>
              ))}
            </Listbox.Options>
          </Transition>
        </div>
      </Listbox>
    </div>
  </div>
</div>

      {!selectedUser ? (
        <div className="text-sm text-zinc-500">Nessun utente.</div>
      ) : (
        <div className="grid gap-2 lg:grid-cols-[minmax(260px,320px)_minmax(0,1fr)] xl:grid-cols-[minmax(400px,400px)_minmax(0,1fr)]">
          {/* ===== Left column: profile + KPI + trends ===== */}
          <div className="grid gap-3">
            <div className="relative overflow-hidden rounded-xl border p-4 pr-7 dark:border-zinc-700">
              <InfoBadge variant="floating" text="Media dei voti che questo utente assegna ai film visti (Avg given)." />
              <div className="flex items-center gap-3">
                
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{selectedUser}</div>
                  <div className="text-xs text-zinc-500">Profile</div>
                </div>
                <div className="ml-auto shrink-0">
                  <div className="w-28">
                    <Donut value={selGiven?.avg || 0} />
                  </div>
                  <div className="mt-1 text-center text-xs text-zinc-500">Avg given</div>
                </div>
              </div>
            </div>


            {/* KPI grid */}
            <div className="grid grid-cols-3 gap-3 md:grid-cols-3">

              <div className="col-span-1 md:col-span-3">
                <CompareAvgCard received={selReceived?.avg} imdb={avgImdbPicks} />
              </div>

              {/* Bias */}
            <div className="relative rounded-xl border p-4 pr-7 text-sm dark:border-zinc-700 md:col-span-3">
              <InfoBadge variant="floating" text="Differenza media tra il voto dell’utente e la media degli altri sullo stesso film (user − crowd)." />
              <div className="mb-1 text-xs uppercase text-zinc-500">Bias vs crowd</div>
              <div className="flex items-baseline gap-2">
                <div
                  className={`text-xl font-bold ${
                    bias != null && bias > 0.05 ? "text-emerald-500"
                    : bias != null && bias < -0.05 ? "text-rose-500"
                    : ""
                  }`}
                >
                  {bias == null ? "—" : `${bias > 0 ? "+" : ""}${formatScore(bias)}`}
                </div>
                <span className="text-xs text-zinc-500">(user score − movie avg)</span>
              </div>
              <div className="mt-1 text-xs text-zinc-400">
                z-score: {zBias != null ? zBias : "—"} • corr IMDb: {corrImdb != null ? corrImdb : "—"} • corr group: {corrGroup != null ? corrGroup : "—"}
              </div>
            </div>

              <div className="relative rounded-xl border p-3 pr-7 text-sm dark:border-zinc-700">
                <InfoBadge variant="floating" text="Percentuale dei voti dell’utente che sono ≥ 8." />
                <div className="text-xs uppercase text-zinc-500">Hit rate ≥ 8</div>
                <div className="text-xl font-bold">
                  {kScores.hitRate ?? "—"}{kScores.hitRate != null ? "%" : ""}
                </div>
              </div>
              <div className="relative rounded-xl border p-3 pr-7 text-sm dark:border-zinc-700">
                <InfoBadge variant="floating" text="Valore centrale della distribuzione dei voti dell’utente." />
                <div className="text-xs uppercase text-zinc-500">Median</div>
                <div className="text-xl font-bold">
                  {kScores.median != null ? formatScore(kScores.median) : "—"}
                </div>
              </div>
              <div className="relative rounded-xl border p-3 pr-7 text-sm dark:border-zinc-700">
                <InfoBadge variant="floating" text="Numero totale di voti espressi da questo utente." />
                <div className="text-xs uppercase text-zinc-500">Votes given</div>
                <div className="text-xl font-bold">{selGiven?.count || 0}</div>
              </div>
              <div className="relative rounded-xl border p-3 pr-7 text-sm dark:border-zinc-700">
                <InfoBadge variant="floating" text="Dispersione dei voti dell’utente (deviazione standard)." />
                <div className="text-xs uppercase text-zinc-500">Std. dev</div>
                <div className="text-xl font-bold">
                  {kScores.stdev != null ? formatScore(kScores.stdev) : "—"}
                </div>
              </div>


              {/* New: pick success + polarization */}
              <div className="relative rounded-xl border p-3 pr-7 text-sm dark:border-zinc-700">
                <InfoBadge variant="floating" text="Percentuale dei film portati che hanno media ricevuta ≥ 8." />
                <div className="text-xs uppercase text-zinc-500">Pick success rate</div>
                <div className="text-xl font-bold">{kPickWin != null ? `${kPickWin}%` : "—"}</div>
              </div>
              <div className="relative rounded-xl border p-3 pr-7 text-sm dark:border-zinc-700">
                <InfoBadge variant="floating" text="Polarizzazione: media delle deviazioni standard dei voti ricevuti dai film che ha portato (più alto = più divisivi)." />
                <div className="text-xs uppercase text-zinc-500">Polarization</div>
                <div className="text-xl font-bold">{pol != null ? pol : "—"}</div>
              </div>
            </div>


            {/* Sparklines */}
            <div className="relative overflow-hidden rounded-xl border p-3 dark:border-zinc-700">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-xs uppercase text-zinc-500">Votes given — timeline</div>
                <InfoBadge text="Andamento dei voti assegnati dall’utente nel tempo." />
              </div>
              <div className="w-full overflow-hidden">
                <Sparkline data={dataGiven} height={84} />
              </div>
            </div>
            <div className="relative overflow-hidden rounded-xl border p-3 dark:border-zinc-700">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-xs uppercase text-zinc-500">Votes received — their picks</div>
                <InfoBadge text="Media dei voti ricevuti dai film portati dall’utente, nell’ordine temporale." />
              </div>
              <div className="w-full overflow-hidden">
                <Sparkline data={dataReceived} height={84} />
              </div>
            </div>

            {/* New: Sparkline bias IMDb & win-rate */}
            <div className="relative overflow-hidden rounded-xl border p-3 dark:border-zinc-700">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-xs uppercase text-zinc-500">IMDb bias — picks timeline</div>
                <InfoBadge text="Differenza (media ricevuta − IMDb) per ciascun film portato, nel tempo." />
              </div>
              <div className="w-full overflow-hidden">
                <Sparkline
  data={sparkBias}          // [{t, val, ...}]
  height={84}
  mode="delta"
  yDomain={[-2, 2]}         // bias tipico ~ [-1, +1]
  gridForAvg={false}
/>
              </div>
            </div>
            <div className="relative overflow-hidden rounded-xl border p-3 dark:border-zinc-700">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-xs uppercase text-zinc-500">Pick win-rate — timeline</div>
                <InfoBadge text="Andamento cumulativo della percentuale di pick con media ricevuta ≥ 8." />
              </div>
              <div className="w-full overflow-hidden">
                <Sparkline
  data={sparkBias}          // [{t, val, ...}]
  height={84}
  mode="delta"
  yDomain={[-2, 2]}         // bias tipico ~ [-1, +1]
  gridForAvg={false}
/>
              </div>
            </div>
          </div>

          {/* ===== Right column: distributions + lists ===== */}
          <div className="grid min-w-0 gap-4">
            <div className="relative overflow-hidden rounded-xl border p-4 dark:border-zinc-700">
              <div className="mb-2 flex items-center justify-between">
                <h4 className="font-semibold">Score distribution</h4>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-500">(rounded to 1..10)</span>
                  <InfoBadge text="Distribuzione dei voti dell’utente su scala 1–10 (arrotondati)." />
                </div>
              </div>
              <Histogram values={selGiven?.scores || []} />
            </div>

            {/* New: received distribution */}
            <div className="relative overflow-hidden rounded-xl border p-4 dark:border-zinc-700">
              <div className="mb-2 flex items-center justify-between">
                <h4 className="font-semibold">Received (their picks) — distribution</h4>
                <InfoBadge text="Distribuzione delle medie dei voti ricevuti dai film che ha portato (1–10)." />
              </div>
              <Histogram values={receivedHist} />
            </div>

            <div className="relative overflow-hidden rounded-xl border p-4 dark:border-zinc-700">
              <div className="mb-2 flex items-center justify-between">
                <h4 className="font-semibold">Favourite genres (scores ≥ 8)</h4>
                <InfoBadge text="Generi preferiti: conteggio dei film votati ≥ 8 dall’utente per ciascun genere." />
              </div>
              {(selGenres?.length ?? 0) === 0 ? (
                <div className="text-sm text-zinc-500">—</div>
              ) : (
                <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                  {selGenres.map((g) => (
                    <BarRow key={g.name} label={g.name} value={g.count} max={selGenres[0]?.count || 1} />
                  ))}
                </div>
              )}
            </div>

            <div className="relative overflow-hidden rounded-xl border p-4 dark:border-zinc-700">
              <div className="mb-2 flex items-center justify-between">
                <h4 className="font-semibold">Film by decade</h4>
                <div className="flex items-center">
                  <span className="text-xs text-zinc-500 mr-2">
                    {avgYear ? `avg ${avgYear} • oldest ${minYear} • newest ${maxYear}` : "—"}
                  </span>
                  <InfoBadge text="Conteggio dei film per decade tra quelli votati dall’utente. In alto: anno medio, più vecchio e più recente." />
                </div>
              </div>
              {yearDist.length === 0 ? (
                <div className="text-sm text-zinc-500">—</div>
              ) : (
                <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                  {yearDist.map((y) => (
                    <BarRow key={y.name} label={y.name} value={y.count} max={Math.max(...yearDist.map(d => d.count)) || 1} />
                  ))}
                </div>
              )}
            </div>

            {/* New: runtime buckets & countries */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="relative overflow-hidden rounded-xl border p-4 dark:border-zinc-700">
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="font-semibold">Runtime buckets</h4>
                  <InfoBadge text="Distribuzione per durata: <90, 90–120, >120 minuti." />
                </div>
                <div className="grid gap-2">
                  {runtimeDist.map((r) => (
                    <BarRow key={r.name} label={r.name} value={r.count} max={Math.max(...runtimeDist.map(x => x.count)) || 1} />
                  ))}
                </div>
              </div>
              <div className="relative overflow-hidden rounded-xl border p-4 dark:border-zinc-700">
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="font-semibold">Countries</h4>
                  <InfoBadge text="Top paesi di produzione dei film che ha visto/votato (se disponibili nei metadati)." />
                </div>
                {countryDist.length === 0 ? (
                  <div className="text-sm text-zinc-500">—</div>
                ) : (
                  <div className="grid gap-2">
                    {countryDist.map((c) => (
                      <BarRow key={c.name} label={c.name} value={c.count} max={countryDist[0]?.count || 1} />
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="relative overflow-hidden rounded-xl border p-4 dark:border-zinc-700">
              <div className="mb-1 flex items-center justify-between">
                <h4 className="font-semibold">⏱️ Average runtime</h4>
                <InfoBadge text="Durata media (in minuti) dei film che l’utente ha visto/votato." />
              </div>
              <div className="text-lg">{avgRt != null ? `${avgRt} min` : "—"}</div>
            </div>

            {/* New: top 3 received on picks */}
            <div className="relative overflow-hidden rounded-xl border p-4 dark:border-zinc-700">
              <div className="mb-2 flex items-center justify-between">
                <h4 className="font-semibold">Top received when they pick</h4>
                <InfoBadge text="I 3 film che hanno ricevuto la media più alta quando sono stati portati da questo utente." />
              </div>
              {topRatedPicks.length === 0 ? (
                <div className="text-sm text-zinc-500">—</div>
              ) : (
                <ol className="grid gap-1">
                  {topRatedPicks.slice(0,3).map((t, i) => (
                    <li key={i} className="flex items-center justify-between">
                      <span className="truncate">{i+1}. {t.title}</span>
                      <span className="font-semibold">{formatScore(t.avg)}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>

            {/* Pick vs IMDb summary */}
            <div className="relative overflow-hidden rounded-xl border p-4 dark:border-zinc-700">
              <div className="mb-2 flex items-center justify-between">
                <h4 className="font-semibold">Pick bias vs IMDb (avg)</h4>
                <InfoBadge text="Media di (voti ricevuti − IMDb) per i film portati. Positivo: il gruppo ha apprezzato più di IMDb." />
              </div>
              <div className={`text-lg font-semibold ${pbImdb != null ? (pbImdb>0 ? "text-emerald-400" : pbImdb<0 ? "text-rose-400" : "") : ""}`}>
                {pbImdb != null ? (pbImdb>0?"+":"") + pbImdb.toFixed(2) : "—"}
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="relative overflow-hidden rounded-xl border p-3 dark:border-zinc-700">
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="font-semibold">🎯 Closest to IMDb</h4>
                  <InfoBadge text="Film in cui il voto dell’utente è più vicino al riferimento IMDb." />
                </div>
                {userImdbCompare.closest.length === 0 ? (
                  <div className="text-sm text-zinc-500">—</div>
                ) : (
                  <ol className="grid gap-2">
                    {userImdbCompare.closest.map((r, i) => (
                      <li key={r.id} className="flex items-center gap-3 rounded-xl bg-zinc-50 px-2 py-1.5 dark:bg-zinc-900/60">
                        <span className="min-w-[160px] truncate text-sm font-medium">
                          {i + 1}. {r.title}
                        </span>
                        <DiffPill variant="closest" user={r.userScore} imdb={r.ref} />
                      </li>
                    ))}
                  </ol>
                )}
              </div>
              <div className="relative overflow-hidden rounded-xl border p-3 dark:border-zinc-700">
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="font-semibold">⚡ Farthest from IMDb</h4>
                  <InfoBadge text="Film in cui il voto dell’utente è più lontano dal riferimento IMDb." />
                </div>
                {userImdbCompare.farthest.length === 0 ? (
                  <div className="text-sm text-zinc-500">—</div>
                ) : (
                  <ol className="grid gap-2">
                    {userImdbCompare.farthest.map((r, i) => (
                      <li key={r.id} className="flex items-center gap-3 rounded-xl bg-zinc-50 px-2 py-1.5 dark:bg-zinc-900/60">
                        <span className="min-w-[160px] truncate text-sm font-medium">
                          {i + 1}. {r.title}
                        </span>
                        <DiffPill variant="farthest" user={r.userScore} imdb={r.ref} />
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </div>

            {/* Affinity */}
            <div className="relative overflow-hidden rounded-xl border p-4 dark:border-zinc-700">
              <div className="mb-2 flex items-center justify-between">
                <h4 className="font-semibold">Affinity with others</h4>
                <InfoBadge text="Correlazione di voto con gli altri utenti: più alto = gusti simili." />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <div className="mb-1 text-xs uppercase text-zinc-500">Most similar</div>
                  {affinity.most.length === 0 ? (
                    <div className="text-sm text-zinc-500">—</div>
                  ) : (
                    <ol className="grid gap-1">
                      {affinity.most.map((r) => (
                        <li key={r.user} className="flex items-center justify-between">
                          <span className="truncate">{r.user}</span>
                          <span className="font-semibold">{r.corr.toFixed(2)}</span>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
                <div>
                  <div className="mb-1 text-xs uppercase text-zinc-500">Most different</div>
                  {affinity.least.length === 0 ? (
                    <div className="text-sm text-zinc-500">—</div>
                  ) : (
                    <ol className="grid gap-1">
                      {affinity.least.map((r) => (
                        <li key={r.user} className="flex items-center justify-between">
                          <span className="truncate">{r.user}</span>
                          <span className="font-semibold">{r.corr.toFixed(2)}</span>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {below && (
        <>
          <div className="mt-4 border-t border-zinc-800/60" />
          <div className="pt-4">{below}</div>
        </>
      )}
    </Card>
  );
}
