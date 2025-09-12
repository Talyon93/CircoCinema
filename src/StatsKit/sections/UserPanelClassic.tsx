import React from "react";
import { Card } from "../../Components/UI/Card";
import { AvatarInline } from "../../Components/UI/Avatar";
import { formatScore } from "../../Utils/Utils";
import { UserCircleIcon, HeartIcon, TrophyIcon } from "@heroicons/react/24/outline";

import { Donut } from "../ui/Donut";
import { Histogram } from "../ui/Histogram";
import { BarRow } from "../ui/BarRow";
import { DiffPill } from "../ui/DiffPill";
import { Sparkline } from "../charts/Sparkline";
import { Fragment } from "react";
import { Listbox, Transition } from "@headlessui/react";
import { CheckIcon, ChevronUpDownIcon } from "@heroicons/react/20/solid";
import { ArrowUpRightIcon, ArrowDownRightIcon } from "@heroicons/react/24/solid";

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

function mean(arr: number[]) {
  const v = arr.filter((n) => Number.isFinite(n));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-md bg-zinc-800 px-1.5 py-0.5 text-[11px] text-zinc-300">
      {children}
    </span>
  );
}


function userVsCrowdAverages(history: any[], user: string) {
  if (!Array.isArray(history) || !user) return { avgUser: null, avgCrowd: null, delta: null };

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

  const avg = (arr: number[]) =>
    arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

  const avgUser = avg(userScores);
  const avgCrowd = avg(crowdAverages);
  const delta = avgUser != null && avgCrowd != null ? avgUser - avgCrowd : null;

  return { avgUser, avgCrowd, delta };
}



function formatDelta(n: number) {
  const s = n.toFixed(2);
  return (n > 0 ? "+" : "") + s;
}

function DiffBadge({ value }: { value: number | null | undefined }) {
  if (value == null) return null;
  const positive = value > 0;
  const cls = positive ? "bg-emerald-500/15 text-emerald-400" : "bg-rose-500/15 text-rose-400";
  return (
    <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${cls}`}>
      {formatDelta(value)}
    </span>
  );
}

function ComparisonBar({
  a, b,
  min = 0, max = 10,
  labels = ["A", "B"],
}: {
  a: number | null | undefined;
  b: number | null | undefined;
  min?: number; max?: number;
  labels?: [string, string] | string[];
}) {
  const pct = (v: number) => Math.max(0, Math.min(100, ((v - min) / (max - min)) * 100));
  return (
    <div className="mt-2">
      <div className="relative h-2 w-full rounded-full bg-zinc-800">
        {typeof a === "number" && (
          <div className="absolute -top-1.5 h-5 w-5 -translate-x-1/2">
            <div className="h-2 w-2 rounded-full bg-emerald-400" style={{ position:"absolute", left:`${pct(a)}%`, top:"6px" }} />
          </div>
        )}
        {typeof b === "number" && (
          <div className="absolute -top-1.5 h-5 w-5 -translate-x-1/2">
            <div className="h-2 w-2 rounded-full bg-sky-400" style={{ position:"absolute", left:`${pct(b)}%`, top:"6px" }} />
          </div>
        )}
        {/* tacche 0/5/10 */}
        <div className="absolute -top-1 left-0 text-[10px] text-zinc-500">0</div>
        <div className="absolute -top-1 left-1/2 -translate-x-1/2 text-[10px] text-zinc-500">5</div>
        <div className="absolute -top-1 right-0 text-[10px] text-zinc-500">10</div>
      </div>
      <div className="mt-2 flex items-center gap-4 text-xs">
        <div className="flex items-center gap-1 text-zinc-400">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          <span>{labels[0]}</span>
        </div>
        <div className="flex items-center gap-1 text-zinc-400">
          <span className="h-2 w-2 rounded-full bg-sky-400" />
          <span>{labels[1]}</span>
        </div>
      </div>
    </div>
  );
}

function ComparisonCard({
  title,
  leftLabel, leftValue,
  rightLabel, rightValue,
  deltaRightMinusLeft = false,
  hint,
}: {
  title: string;
  leftLabel: string; leftValue: number | null | undefined;
  rightLabel: string; rightValue: number | null | undefined;
  /** di default Δ = left − right; se true, Δ = right − left */
  deltaRightMinusLeft?: boolean;
  hint?: string;
}) {
  const hasBoth = leftValue != null && rightValue != null;
  const d = hasBoth
    ? (deltaRightMinusLeft ? (rightValue! - leftValue!) : (leftValue! - rightValue!))
    : null;

  return (
    <div className="relative overflow-hidden rounded-xl border p-4 dark:border-zinc-700">
      {hint && <InfoBadge variant="floating" text={hint} />}
      <div className="mb-1 flex items-center justify-between">
        <div className="text-xs uppercase text-zinc-500">{title}</div>
        <DiffBadge value={d ?? null} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="text-[11px] uppercase text-zinc-500">{leftLabel}</div>
          <div className="text-2xl font-semibold">{leftValue != null ? leftValue.toFixed(2) : "—"}</div>
        </div>
        <div className="text-right">
          <div className="text-[11px] uppercase text-zinc-500">{rightLabel}</div>
          <div className="text-2xl font-semibold">{rightValue != null ? rightValue.toFixed(2) : "—"}</div>
        </div>
      </div>

      <ComparisonBar a={leftValue ?? 0} b={rightValue ?? 0} labels={[leftLabel, rightLabel]} />
    </div>
  );
}


function StatFoot({
  items,
}: {
  items: Array<{ label: string; value: React.ReactNode }>;
}) {
  return (
    <div className="mt-2 grid grid-cols-2 gap-2 border-t border-zinc-800/60 pt-2 text-[11px] text-zinc-400 md:grid-cols-3">
      {items.map((it, i) => (
        <div key={i} className="flex justify-between gap-2">
          <span className="truncate">{it.label}</span>
          <span className="shrink-0 font-medium text-zinc-200">{it.value}</span>
        </div>
      ))}
    </div>
  );
}

/* Badge delta con freccia */
function DeltaBadge({ value }: { value: number | null | undefined }) {
  if (value == null) return null;
  const up = value > 0;
  const Icon = up ? ArrowUpRightIcon : ArrowDownRightIcon;
  const cls = up ? "bg-emerald-500/15 text-emerald-400" : "bg-rose-500/15 text-rose-400";
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold ${cls}`}>
      <Icon className="h-4 w-4" />
      {(value > 0 ? "+" : "") + value.toFixed(2)}
    </span>
  );
}

function OldStyleBar({
  a, b, min = 0, max = 10,
  leftLabel = "A", rightLabel = "B",
}: { a: number | null | undefined; b: number | null | undefined; min?: number; max?: number; leftLabel?: string; rightLabel?: string; }) {
  const clamp = (v: number) => Math.max(0, Math.min(100, ((v - min) / (max - min)) * 100));
  const aPct = typeof a === "number" ? clamp(a) : 0;
  const bPct = typeof b === "number" ? clamp(b) : 0;

  // colore: verde se a>=b, rosso se a<b
  const fillColor =
    a != null && b != null && a < b ? "bg-rose-500/60" : "bg-emerald-500/60";

  return (
    <div className="mt-4">
      <div className="relative h-2 w-full rounded-full bg-zinc-800">
        <div className={`absolute left-0 top-0 h-2 rounded-full ${fillColor}`} style={{ width: `${aPct}%` }} />
        {typeof a === "number" && (
          <div className="absolute -top-[3px] h-3 w-3 -translate-x-1/2 rounded-full border-2 border-zinc-900 bg-emerald-400 shadow"
               style={{ left: `${aPct}%` }} />
        )}
        {typeof b === "number" && (
          <div className="absolute -top-[3px] h-3 w-3 -translate-x-1/2 rounded-full border-2 border-zinc-900 bg-sky-400 shadow"
               style={{ left: `${bPct}%` }} />
        )}
        <div className="absolute -bottom-4 left-0 text-[10px] text-zinc-500">0</div>
        <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[10px] text-zinc-500">5</div>
        <div className="absolute -bottom-4 right-0 text-[10px] text-zinc-500">10</div>
      </div>
      <div className="mt-4 flex items-center gap-4 text-xs">
        <div className="flex items-center gap-1 text-zinc-400"><span className="h-2 w-2 rounded-full bg-emerald-400" />{leftLabel}</div>
        <div className="flex items-center gap-1 text-zinc-400"><span className="h-2 w-2 rounded-full bg-sky-400" />{rightLabel}</div>
      </div>
    </div>
  );
}


/* Card “vecchio stile”: titolo + Δ, numeri grandi ai lati, barra sotto */
function OldStyleCompareCard({
  title,
  leftLabel, leftValue,
  rightLabel, rightValue,
  hint,
}: {
  title: string;
  leftLabel: string; leftValue: number | null | undefined;
  rightLabel: string; rightValue: number | null | undefined;
  hint?: string;
}) {
  const hasBoth = leftValue != null && rightValue != null;
  const delta = hasBoth ? Number(leftValue) - Number(rightValue) : null;

  return (
    <div className="relative overflow-hidden rounded-xl border p-4 dark:border-zinc-700">
      {hint && <InfoBadge variant="floating" text={hint} />}
      <div className="mb-2 flex items-center justify-between">
        <div className="text-xs uppercase text-zinc-500">{title}</div>
        <DeltaBadge value={delta} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="text-[11px] uppercase text-zinc-500">{leftLabel}</div>
          <div className="text-3xl font-semibold md:text-4xl">
            {typeof leftValue === "number" ? leftValue.toFixed(2) : "—"}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[11px] uppercase text-zinc-500">{rightLabel}</div>
          <div className="text-3xl font-semibold md:text-4xl">
            {typeof rightValue === "number" ? rightValue.toFixed(2) : "—"}
          </div>
        </div>
      </div>

      <OldStyleBar a={leftValue} b={rightValue} leftLabel={leftLabel} rightLabel={rightLabel} />
    </div>
  );
}

function quickStats(nums: number[]) {
  const x = nums.filter((n) => Number.isFinite(n));
  if (!x.length) return null;
  const sum = x.reduce((a, b) => a + b, 0);
  const avg = sum / x.length;
  const sort = [...x].sort((a, b) => a - b);
  const mid = Math.floor(sort.length / 2);
  const med = sort.length % 2 ? sort[mid] : (sort[mid - 1] + sort[mid]) / 2;
  const min = sort[0], max = sort[sort.length - 1];
  const sd =
    x.length > 1
      ? Math.sqrt(x.map((n) => (n - avg) ** 2).reduce((a, b) => a + b, 0) / (x.length - 1))
      : 0;
  const pHit = Math.round((x.filter((n) => n >= 8).length / x.length) * 100);
  return { count: x.length, avg, med, sd, min, max, pHit };
}

const avgOf = (r?: Record<string, number> | null) => {
  if (!r) return null;
  const vals = Object.values(r).map(Number).filter(Number.isFinite);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
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

// Year safe da vari formati di movie
function safeYear(m?: any): number | null {
  const yCand =
    m?.year ??
    m?.Year ??
    m?.release_year ??
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

// --- country helpers (1 sola country per film) ---
function primaryCountryName(src?: any): string | null {
  if (!src) return null;
  const m = src.movie ?? src;

  // 1) campo normalizzato che salviamo nel JSON
  let cand: any =
    m?.primary_country ??
    m?.movie?.primary_country ??
    null;

  // 2) fallback OMDb
  if (!cand) {
    const omdbC = m?.omdb?.Country || m?.Country; // stringa "United States, UK"
    if (typeof omdbC === "string" && omdbC.trim()) {
      cand = omdbC.split(/[,/|;]/)[0]?.trim();
    }
  }

  // 3) fallback TMDB production_countries (prendi la prima)
  if (!cand && Array.isArray(m?.production_countries) && m.production_countries.length) {
    cand = m.production_countries[0]?.name || m.production_countries[0]?.english_name || m.production_countries[0]?.iso_3166_1;
  }

  // 4) fallback TMDB origin_country (è array di codici ISO)
  if (!cand && Array.isArray(m?.origin_country) && m.origin_country.length) {
    cand = m.origin_country[0];
  }

  if (!cand) return null;

  // normalizza ISO → nome e alias comuni
  const isoToName: Record<string, string> = {
    US: "United States", USA: "United States",
    GB: "United Kingdom", UK: "United Kingdom",
    IT: "Italy", FR: "France", DE: "Germany",
    ES: "Spain", CA: "Canada", JP: "Japan",
    KR: "Korea, Republic of", CN: "China",
    HK: "Hong Kong SAR China", TW: "Taiwan, Province of China",
    IN: "India", AU: "Australia", BR: "Brazil", MX: "Mexico",
  };
  const alias: Record<string, string> = {
    "United States of America": "United States",
    "Republic of Korea": "Korea, Republic of",
    "South Korea": "Korea, Republic of",
    "Czech Republic": "Czechia",
    Russia: "Russian Federation",
    "Viet Nam": "Vietnam",
    "Soviet Union": "Russia",
      SU: "Russia",
  };

  const raw = String(cand).trim();
  const up = raw.toUpperCase();
  if (isoToName[up]) return isoToName[up];
  return alias[raw] || raw;
}


function safeCountries(src?: any): string[] {
  if (!src) return [];

  // cerco sia nel viewing che nel movie
  const root: any[] = [];
  if (src) root.push(src);
  if (src?.movie) root.push(src.movie);

  const isCountryLikeKey = (k: string) =>
    /country|countries|origin[_ ]?country|production[_ ]?countries/i.test(k);

  const normalize = (s?: string) => (s || "").trim();

  const isoToName: Record<string, string> = {
    US: "United States",
    USA: "United States",
    GB: "United Kingdom",
    UK: "United Kingdom",
    IT: "Italy",
    FR: "France",
    DE: "Germany",
    ES: "Spain",
    CA: "Canada",
    JP: "Japan",
    KR: "Korea, Republic of",
    CN: "China",
    HK: "Hong Kong SAR China",
    TW: "Taiwan, Province of China",
    IN: "India",
    AU: "Australia",
    BR: "Brazil",
    MX: "Mexico",
  };

  const aliasMap: Record<string, string> = {
    "United States of America": "United States",
    "Republic of Korea": "Korea, Republic of",
    "South Korea": "Korea, Republic of",
    "S Korea": "Korea, Republic of",
    "Korea South": "Korea, Republic of",
    "Czech Republic": "Czechia",
    Russia: "Russian Federation",
    "Viet Nam": "Vietnam",
    "Soviet Union": "Russia",
    SU: "Russia",

  };

  const pushFromValue = (acc: string[], v: any) => {
    if (!v) return;

    // stringhe: "USA, UK, Italy"
    if (typeof v === "string") {
      v.split(/[;,]|\/|\|/).forEach((piece) => {
        const s = normalize(piece);
        if (!s) return;
        const up = s.toUpperCase();
        if (isoToName[up]) acc.push(isoToName[up]);
        else acc.push(aliasMap[s] || s);
      });
      return;
    }

    // array
    if (Array.isArray(v)) {
      v.forEach((item) => pushFromValue(acc, item));
      return;
    }

    // oggetti con possibili campi noti
    if (typeof v === "object") {
      const cand =
        v?.name ??
        v?.english_name ??
        v?.native_name ??
        v?.iso_3166_1 ??
        v?.iso2 ??
        v?.code;
      if (cand) {
        pushFromValue(acc, cand);
        return;
      }
      // fallback: se l'oggetto è anonimo, scandaglia keys comuni
      const maybe = ["name", "country", "countries", "iso_3166_1", "code"];
      for (const k of maybe) {
        if (v && v[k]) pushFromValue(acc, v[k]);
      }
    }
  };

  // deep scan (BFS) limitato
  const raw: string[] = [];
  const queue: any[] = [...root];
  let steps = 0;
  const MAX_STEPS = 5000;

  while (queue.length && steps++ < MAX_STEPS) {
    const cur = queue.shift();
    if (!cur) continue;

    if (typeof cur === "object") {
      for (const [k, val] of Object.entries(cur)) {
        if (isCountryLikeKey(k)) {
          pushFromValue(raw, val);
        }
        // continua a scendere (tenendo il limite)
        if (val && typeof val === "object") queue.push(val);
      }
    }
  }

  // normalizza e deduplica preservando ordine
  const normed = raw
    .map((c) => {
      const s = normalize(c);
      const up = s.toUpperCase();
      if (isoToName[up]) return isoToName[up];
      return aliasMap[s] || s;
    })
    .filter(Boolean);

  const out: string[] = [];
  const seen = new Set<string>();
  for (const c of normed) {
    const key = c.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(c);
    }
  }
  return out;
}

function refScoreFor(v: any): number | null {
  const m = v?.movie || {};
  const cand =
    m.imdb_rating ??
    m.imdbRating ??
    m.imdb_score ??
    m?.ratings?.imdb ??
    m?.omdb?.imdbRating ??
    m.vote_average;
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
  const dist: Record<number, number> = {};
  history.forEach((h) => {
    if (!isPickedBy(h, user)) return;
    const y = safeYear(h?.movie);
    if (y == null) return;
    dist[y] = (dist[y] || 0) + 1;
  });
  return Object.entries(dist)
    .map(([year, count]) => ({ name: String(year), count }))
    .sort((a, b) => Number(a.name) - Number(b.name));
}

function CompareAvgCard({
  received,
  imdb,
}: {
  received?: number | null;
  imdb?: number | null;
}) {
  const hasBoth = received != null && imdb != null;
  const diff = hasBoth ? Number((received! - imdb!).toFixed(2)) : null;
  const diffClass =
    diff == null ? "" : diff > 0 ? "text-emerald-400" : diff < 0 ? "text-rose-400" : "";

  return (
    <div className="relative rounded-xl border p-4 pr-7 text-sm dark:border-zinc-700">
      <div className="mb-1 flex items-center justify-between">
        <div className="text-xs uppercase text-zinc-500">Group vs IMDb (their picks)</div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-[11px] uppercase text-zinc-500">Avg received</div>
          <div className="text-xl font-semibold">
            {received != null ? received.toFixed(2) : "—"}
          </div>
        </div>
        <div>
          <div className="text-[11px] uppercase text-zinc-500">Avg IMDb</div>
          <div className="text-xl font-semibold">
            {imdb != null ? imdb.toFixed(2) : "—"}
          </div>
        </div>
      </div>

      <div className="mt-2 text-xs text-zinc-500">
        Δ group−IMDb:{" "}
        <span className={`font-semibold ${diffClass}`}>
          {diff == null ? "—" : (diff > 0 ? "+" : "") + diff.toFixed(2)}
        </span>
      </div>
    </div>
  );
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
  const ys = history.filter((h) => isPickedBy(h, user)).map((h) => safeYear(h?.movie)).filter((x): x is number => Number.isFinite(x));
  if (!ys.length) return { avg: null, min: null, max: null };
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
function collectReceivedVotesOnPicks(history: any[], user: string, includeSelf = false): number[] {
  const norm = (s?: string) => (s ?? "").trim().toLowerCase();

  const isPickedBy = (h: any) => {
    const picker =
      h?.picked_by ?? h?.pickedBy ?? h?.picker ??
      h?.movie?.picked_by ?? h?.movie?.pickedBy ?? h?.movie?.picker ?? "";
    return norm(picker) === norm(user);
  };

  const out: number[] = [];
  history
    .filter(isPickedBy)
    .forEach((h) => {
      const ratings = h?.ratings ?? {};
      for (const [rater, raw] of Object.entries(ratings)) {
        if (!includeSelf && norm(rater) === norm(user)) continue; // escludi il voto del picker
        const v = Number(raw);
        if (Number.isFinite(v)) out.push(v);
      }
    });
  return out;
}

// --- NORMALIZATION HELPERS ---
function normUser(u?: string | null) {
  return (u ?? "").trim().toLowerCase();
}

// Estrae il "proponente" in modo robusto, qualunque sia il campo
function getPicker(h: any): string {
  return (
    h?.picked_by ?? h?.pickedBy ?? h?.picker ??
    h?.movie?.picked_by ?? h?.movie?.pickedBy ?? h?.movie?.picker ?? ""
  );
}

function toT(view: any, fallbackIndex: number) {
  const ts = Date.parse(view?.started_at || view?.date || view?.created_at || "");
  return Number.isFinite(ts) && ts > 0 ? ts : fallbackIndex;
}

// True se il viewing è stato portato da `user`
function isPickedBy(h: any, user: string) {
  return normUser(getPicker(h)) === normUser(user);
}

function runtimeBuckets(history: any[], user: string) {
  const counts = { short: 0, medium: 0, long: 0 };
  history.filter((h) => isPickedBy(h, user)).forEach((h) => {
    const r = safeRuntime(h?.movie);
    if (!r) return;
    if (r < 90) counts.short++;
    else if (r <= 120) counts.medium++;
    else counts.long++;
  });
  return [
    { name: "Short (<90)", count: counts.short },
    { name: "Medium (90–120)", count: counts.medium },
    { name: "Long (>120)", count: counts.long },
  ];
}


function countryDistribution(history: any[], user: string) {
  const dist: Record<string, number> = {};

  history
    .filter((h) => isPickedBy(h, user))
    .forEach((h) => {
      const c = primaryCountryName(h);
      if (!c) return;
      dist[c] = (dist[c] || 0) + 1;
    });

  return Object.entries(dist)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
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

function pickWinRateSpark(
  history: any[],
  user: string,
  opts: { mode?: "vote" | "pick"; includeSelf?: boolean } = {}
): SparkItem[] {
  const { mode = "vote", includeSelf = false } = opts;

  const norm = (s?: string) => (s ?? "").trim().toLowerCase();
  const isPickedBy = (h: any) => {
    const p =
      h?.picked_by ?? h?.pickedBy ?? h?.picker ??
      h?.movie?.picked_by ?? h?.movie?.pickedBy ?? h?.movie?.picker ?? "";
    return norm(p) === norm(user);
  };
  const toT = (h: any, idx: number) => {
    const ts = Date.parse(h?.started_at || h?.date || h?.created_at || "");
    return Number.isFinite(ts) && ts > 0 ? ts : idx;
  };
  const avgOf = (r?: Record<string, number> | null) => {
    if (!r) return null;
    const v = Object.values(r).map(Number).filter(Number.isFinite);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  };

  const picks = history.filter(isPickedBy).sort((a, b) => toT(a, 0) - toT(b, 0));

  // cumulati per modalità 'vote'
  let cumWinsVotes = 0, cumTotVotes = 0;
  // cumulati per modalità 'pick'
  let cumWinsPicks = 0, cumTotPicks = 0;

  const out: SparkItem[] = [];

  for (let i = 0; i < picks.length; i++) {
    const h = picks[i];
    const ratings = h?.ratings ?? {};

    const vals = Object.entries(ratings)
      .filter(([rater]) => includeSelf || norm(rater) !== norm(user))
      .map(([, v]) => Number(v))
      .filter(Number.isFinite);

    const winsThis = vals.filter((v) => v >= 8).length;
    const totThis = vals.length;
    const title = h?.movie?.title || "Untitled";

    let pct = 0;
    let label = "";

    if (mode === "vote") {
      // cumulato per VOTI
      cumWinsVotes += winsThis;
      cumTotVotes += totThis;
      const thisPct = totThis ? Math.round((winsThis / totThis) * 100) : 0;
      pct = cumTotVotes ? Math.round((cumWinsVotes / cumTotVotes) * 100) : 0;
      label = `${winsThis}/${totThis} ≥8 • ${thisPct}%  —  cum ${cumWinsVotes}/${cumTotVotes} = ${pct}%`;
    } else {
      // cumulato per PICK (vittoria se media ricevuta ≥ 8)
      cumTotPicks += 1;
      const avg = avgOf(h?.ratings ?? {});
      if (avg != null && avg >= 8) cumWinsPicks += 1;
      pct = Math.round((cumWinsPicks / cumTotPicks) * 100);
      label = `pick ${cumWinsPicks}/${cumTotPicks} won • ${pct}%`;
    }

    out.push({ t: toT(h, i + 1), val: pct, title, label });
  }
  return out;
}

/* ===== Ordinale per rank gentili ===== */
function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
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


  console.log("DEBUG countries The Whale",
    history
      .filter(h => (h?.movie?.title || "").toLowerCase() === "the whale")
      .map(h => ({
        fromSafe: safeCountries(h),
        rawMovie: h.movie,
        omdbView: h?.omdb?.Country,
        omdbMovie: h?.movie?.omdb?.Country,
        tmdbPC: h?.movie?.tmdb?.production_countries || h?.movie?.production_countries,
        origin: h?.movie?.origin_country
      }))
  );
  const selGiven = React.useMemo(() => (selectedUser ? givenArr.find((u) => u.user === selectedUser) : undefined), [selectedUser, givenArr]);
  const selReceived = React.useMemo(() => (selectedUser ? receivedArr.find((u) => u.user === selectedUser) : undefined), [selectedUser, receivedArr]);

  // >>> NEW: classifica “gentili” (avg given discendente, poi count)
  const kindness = React.useMemo(() => {
    const sorted = givenArr.slice().sort((a, b) => b.avg - a.avg || b.count - a.count);
    const total = sorted.length;
    const idx = selectedUser ? sorted.findIndex((r) => r.user === selectedUser) : -1;
    const rank = idx >= 0 ? idx + 1 : null;
    const perc = rank != null ? Math.round((1 - (rank - 1) / total) * 100) : null; // percentile "più gentile di X%"
    return { rank, total, perc };
  }, [givenArr, selectedUser]);

  const yearDist = React.useMemo(() => (selectedUser ? buildYearDistribution(history, selectedUser) : []), [history, selectedUser]);
  const { avg: avgYear, min: minYear, max: maxYear } = React.useMemo(() => (selectedUser ? yearsSummary(history, selectedUser) : { avg: null, min: null, max: null }), [history, selectedUser]);

  const receivedHist = React.useMemo(
    () => (selectedUser ? collectReceivedVotesOnPicks(history, selectedUser) : []),
    [history, selectedUser]
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

  const topRatedPicks = React.useMemo(
    () => (selectedUser ? buildTopRated(history, selectedUser) : []),
    [history, selectedUser]
  );
  const avgRt = React.useMemo(
    () => (selectedUser ? averageRuntime(history, selectedUser) : null),
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

  const runtimeDist = React.useMemo(() => (selectedUser ? runtimeBuckets(history, selectedUser) : []), [history, selectedUser]);
  const countryDist = React.useMemo(() => (selectedUser ? countryDistribution(history, selectedUser) : []), [history, selectedUser]);

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
    () =>
      selectedUser
        ? pickWinRateSpark(history, selectedUser, { mode: "vote", includeSelf: false })
        : [],
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
          {/* ===== Left column: profile + KPI + CARDS (no sparklines) ===== */}
<div className="grid gap-3">
  {/* Profile */}
  <div className="relative overflow-hidden rounded-xl border p-4 pr-7 dark:border-zinc-700">
    <InfoBadge
      variant="floating"
      text="Media dei voti che questo utente assegna. Sotto: voti totali e posizione nella classifica dei 'gentili'."
    />
    <div className="flex items-center gap-3">
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold">{selectedUser}</div>
        <div className="text-xs text-zinc-500">Profile</div>
        <div className="mt-2 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-400 ring-1 ring-emerald-400/30">
            <HeartIcon className="h-3.5 w-3.5" />
            <span>{selGiven?.count ?? 0} votes</span>
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-300 ring-1 ring-amber-400/30">
            <TrophyIcon className="h-3.5 w-3.5" />
            <span>{kindness.rank != null ? `#${kindness.rank}/${kindness.total}` : "—"}</span>
            {kindness.perc != null && <span className="ml-1 opacity-80">({kindness.perc}° pct)</span>}
          </span>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-zinc-400 md:grid-cols-3">
          <div className="flex justify-between gap-2">
            <span>Avg received</span>
            <span className="font-medium text-zinc-200">
              {selReceived?.avg != null ? selReceived.avg.toFixed(2) : "—"}
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span>Avg IMDb (picks)</span>
            <span className="font-medium text-zinc-200">
              {avgImdbPicks != null ? avgImdbPicks.toFixed(2) : "—"}
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span>Picks</span>
            <span className="font-medium text-zinc-200">
              {history.filter(h => (h?.picked_by ?? h?.pickedBy) === selectedUser).length}
            </span>
          </div>
        </div>
      </div>

      <div className="ml-auto shrink-0">
        <div className="w-28"><Donut value={selGiven?.avg || 0} /></div>
        <div className="mt-1 text-center text-xs text-zinc-500">Avg given</div>
      </div>
    </div>
  </div>

{/* AVG RECEIVED vs IMDb (their picks) */}
<OldStyleCompareCard
  title="AVG RECEIVED vs IMDb (their picks)"
  leftLabel="Received"
  leftValue={selReceived?.avg ?? null}
  rightLabel="IMDb"
  rightValue={avgImdbPicks ?? null}
  hint="Media dei voti ricevuti dai film portati vs IMDb degli stessi titoli."
/>

{/* USER vs CROWD (co-rated) */}
{(() => {
  const { avgUser, avgCrowd } = selectedUser ? userVsCrowdAverages(history, selectedUser) : { avgUser: null, avgCrowd: null };
  return (
    <OldStyleCompareCard
      title="USER vs CROWD (co-rated)"
      leftLabel="Voted"
      leftValue={avgUser}
      rightLabel="Movie avg"
      rightValue={avgCrowd}
      hint="Media voti dati dall’utente vs media complessiva del film sugli stessi titoli."
    />
  );
})()}


  {/* Top received + footer compatto */}
  <div className="relative overflow-hidden rounded-xl border p-4 dark:border-zinc-700">
    <div className="mb-2 flex items-center justify-between">
      <h4 className="font-semibold">Top received when they pick</h4>
      {avgRt != null && <Chip>Avg runtime {avgRt} min</Chip>}
      <InfoBadge text="I 3 film portati con media più alta." />
    </div>

    {topRatedPicks.length === 0 ? (
      <div className="text-sm text-zinc-500">—</div>
    ) : (
      <ol className="grid gap-1">
        {topRatedPicks.slice(0, 3).map((t, i) => (
          <li key={i} className="flex items-center justify-between">
            <span className="truncate">{i + 1}. {t.title}</span>
            <span className="font-semibold">{formatScore(t.avg)}</span>
          </li>
        ))}
      </ol>
    )}

    <div className="mt-3 grid grid-cols-3 gap-2 border-t border-zinc-800/60 pt-2 text-[11px] text-zinc-400">
      <div className="flex justify-between gap-2">
        <span>Years avg</span><span className="font-medium text-zinc-200">{avgYear ?? "—"}</span>
      </div>
      <div className="flex justify-between gap-2">
        <span>Oldest</span><span className="font-medium text-zinc-200">{minYear ?? "—"}</span>
      </div>
      <div className="flex justify-between gap-2">
        <span>Newest</span><span className="font-medium text-zinc-200">{maxYear ?? "—"}</span>
      </div>
    </div>
  </div>

  {/* Recent activity */}
  {(() => {
    const norm = (s?: string) => (s ?? "").trim().toLowerCase();
    const isPickedBy = (h: any) =>
      norm(h?.picked_by ?? h?.pickedBy ?? h?.picker ?? h?.movie?.picked_by ?? h?.movie?.pickedBy ?? "") === norm(selectedUser);
    const orderKey = (h: any, i: number) => {
      const ts = Date.parse(h?.started_at || h?.date || h?.created_at || "");
      return Number.isFinite(ts) && ts > 0 ? ts : i;
    };
    const sorted = history.slice().sort((a, b) => orderKey(b, 0) - orderKey(a, 0));
    const lastVote = sorted.find(h => Number.isFinite(Number(h?.ratings?.[selectedUser])));
    const lastPick = sorted.find(isPickedBy);
    const now = Date.now();
    const d30 = 30 * 24 * 60 * 60 * 1000;
    const votes30 = sorted.filter(h => {
      const t = Date.parse(h?.started_at || h?.date || h?.created_at || "");
      const v = Number(h?.ratings?.[selectedUser]);
      return Number.isFinite(t) && (now - t) <= d30 && Number.isFinite(v);
    }).length;
    const myPicks = history.filter(isPickedBy);
    const pickWins = myPicks.filter(h => {
      const vals = Object.values(h?.ratings ?? {}).map(Number).filter(Number.isFinite);
      if (!vals.length) return false;
      const avg = vals.reduce((a,b)=>a+b,0)/vals.length;
      return avg >= 8;
    }).length;

    return (
      <div className="relative overflow-hidden rounded-xl border p-4 dark:border-zinc-700">
        <div className="mb-2 flex items-center justify-between">
          <h4 className="font-semibold">Recent activity</h4>
          <InfoBadge text="Ultimo voto, ultima pick e attività degli ultimi 30 giorni." />
        </div>
        <div className="grid gap-2 text-sm">
          <div className="flex items-center justify-between">
            <div className="truncate text-zinc-400">Last vote</div>
            <div className="ml-3 truncate text-right">
              {lastVote ? (
                <>
                  <span className="font-medium">{lastVote?.movie?.title || "Untitled"}</span>
                  <span className="ml-2 rounded-md bg-zinc-800 px-1.5 py-0.5 text-xs">
                    {formatScore(Number(lastVote.ratings[selectedUser]))}
                  </span>
                </>
              ) : "—"}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="truncate text-zinc-400">Last pick</div>
            <div className="ml-3 truncate text-right">
              {lastPick ? (
                (() => {
                  const vals = Object.values(lastPick?.ratings ?? {}).map(Number).filter(Number.isFinite);
                  const avg = vals.length ? (vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(2) : "—";
                  return (
                    <>
                      <span className="font-medium">{lastPick?.movie?.title || "Untitled"}</span>
                      <span className="ml-2 rounded-md bg-zinc-800 px-1.5 py-0.5 text-xs">{avg}</span>
                    </>
                  );
                })()
              ) : "—"}
            </div>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 border-t border-zinc-800/60 pt-2 text-[11px] text-zinc-400">
          <div className="flex justify-between gap-2"><span>Votes (30d)</span><span className="font-medium text-zinc-200">{votes30}</span></div>
          <div className="flex justify-between gap-2"><span>Total picks</span><span className="font-medium text-zinc-200">{myPicks.length}</span></div>
          <div className="flex justify-between gap-2"><span>Pick wins ≥8</span><span className="font-medium text-zinc-200">{pickWins}</span></div>
        </div>
      </div>
    );
  })()}

  {/* Milestones */}
  <div className="relative overflow-hidden rounded-xl border p-4 dark:border-zinc-700">
    <div className="mb-2 flex items-center justify-between">
      <h4 className="font-semibold">Milestones & scope</h4>
      <InfoBadge text="Panoramica sintetica: film votati, picks, paesi e copertura anni." />
    </div>
    <div className="grid grid-cols-2 gap-3 text-sm">
      <div><div className="text-[11px] uppercase text-zinc-500">Movies rated</div><div className="text-lg font-semibold">{selGiven?.count || 0}</div></div>
      <div><div className="text-[11px] uppercase text-zinc-500">Picks total</div><div className="text-lg font-semibold">{history.filter(h => (h?.picked_by ?? h?.pickedBy) === selectedUser).length}</div></div>
      <div><div className="text-[11px] uppercase text-zinc-500">Countries</div><div className="text-lg font-semibold">{countryDist.length || "—"}</div></div>
      <div><div className="text-[11px] uppercase text-zinc-500">Years span</div><div className="text-lg font-semibold">{yearDist.length ? `${minYear ?? "—"}–${maxYear ?? "—"}` : "—"}</div></div>
    </div>
    <div className="mt-3 grid grid-cols-3 gap-2 border-t border-zinc-800/60 pt-2 text-[11px] text-zinc-400">
      <div className="flex justify-between gap-2"><span>Top genre</span><span className="font-medium text-zinc-200">{selGenres[0]?.name ?? "—"}</span></div>
      <div className="flex justify-between gap-2"><span>Genres ≥8</span><span className="font-medium text-zinc-200">{selGenres?.length ?? 0}</span></div>
      <div className="flex justify-between gap-2"><span>Avg IMDb (picks)</span><span className="font-medium text-zinc-200">{avgImdbPicks != null ? avgImdbPicks.toFixed(2) : "—"}</span></div>
    </div>
  </div>

  {/* Affinity */}
  <div className="relative overflow-hidden rounded-xl border p-4 dark:border-zinc-700">
    <div className="mb-2 flex items-center justify-between">
      <h4 className="font-semibold">Affinity with others</h4>
      <InfoBadge text="Correlazione di voto con gli altri utenti." />
    </div>
    <div className="grid gap-3 sm:grid-cols-2">
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

          {/* ===== Right column: distributions + SPARKLINES ===== */}
          <div className="grid min-w-0 gap-4">
            {/* Score distribution */}
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

            {/* Received distribution (their picks) */}
            <div className="relative overflow-hidden rounded-xl border p-4 dark:border-zinc-700">
              <div className="mb-2 flex items-center justify-between">
                <h4 className="font-semibold">Received (their picks) — distribution</h4>
                <InfoBadge text="Distribuzione di tutti i voti ricevuti dai film che ha portato (1–10)." />
              </div>
              <Histogram values={receivedHist} />
            </div>

            {/* Favourite genres */}
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

            {/* Film by decade (ora per anno o decade secondo tua scelta) */}
            <div className="relative overflow-hidden rounded-xl border p-4 dark:border-zinc-700">
              <div className="mb-2 flex items-center justify-between">
                <h4 className="font-semibold">Film by decade</h4>
                <div className="flex items-center">
                  <span className="text-xs text-zinc-500 mr-2">
                    {avgYear ? `avg ${avgYear} • oldest ${minYear} • newest ${maxYear}` : "—"}
                  </span>
                  <InfoBadge text="Conteggio per anno/decade dei film portati." />
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

            {/* Runtime buckets & Countries */}
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
                  <InfoBadge text="Top paesi di produzione dei film che ha portato (se disponibili)." />
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

            {/* ——— TUTTE LE SPARKLINE QUI A DESTRA ——— */}
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

            <div className="relative overflow-hidden rounded-xl border p-3 dark:border-zinc-700">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-xs uppercase text-zinc-500">IMDb bias — picks timeline</div>
                <InfoBadge text="Differenza (media ricevuta − IMDb) per ciascun film portato, nel tempo." />
              </div>
              <div className="w-full overflow-hidden">
                <Sparkline
                  data={sparkBias}
                  height={84}
                  mode="delta"
                  yDomain={[-2, 2]}
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
                  data={sparkWin}
                  height={84}
                    mode="percent"
                  yDomain={[0, 100]}
                  gridForAvg={false}
                />
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
