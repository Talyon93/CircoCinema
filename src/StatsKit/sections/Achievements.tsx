// sections/Achievements.tsx
import React from "react";
import { Card } from "../../Components/UI/Card";
import { formatScore } from "../../Utils/Utils";
import {
  SparklesIcon,
  StarIcon,
  TrophyIcon,
  UsersIcon,
  ChartBarIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  BoltIcon,
  FireIcon,
  HeartIcon,
  XCircleIcon,
  AcademicCapIcon,
  ClockIcon,
  Bars3CenterLeftIcon,
} from "@heroicons/react/24/outline";
import { Avatar } from "../../Components/UI/Avatar"; // ⟵ usa il tuo Avatar

/* ===================== InfoBadge (stile UserPanelClassic) ===================== */
function InfoBadge({ text, className = "" }: { text: string; className?: string }) {
  return (
    <div className={`group absolute right-2 top-2 ${className}`}>
      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-zinc-600/60 text-[10px] leading-none text-zinc-400 bg-zinc-900/60">
        i
      </span>
      <div className="pointer-events-none absolute right-0 z-20 hidden w-64 translate-y-2 rounded-md border border-zinc-700 bg-zinc-900 p-2 text-xs text-zinc-200 shadow-xl group-hover:block">
        {text}
      </div>
    </div>
  );
}

/* =========================================
   Tipi e util di base
========================================= */
type NormViewing = {
  title: string;
  year?: number;
  picker?: string | null;
  ratings: Record<string, number>;
  numVotes: number;
  avg: number; // NaN se zero voti
  std?: number;
  imdb?: number | null;
  poster?: string | null;
  runtime?: number | null;
  date?: string | null;
};

function normalizeViewing(v: any): NormViewing | null {
  if (!v) return null;
  const title = v?.movie?.title ?? v?.title ?? "(sconosciuto)";
  const year = readYear(v);
  const picker = v?.picked_by ?? v?.picker ?? v?.owner ?? v?.added_by ?? null;
  const ratings: Record<string, number> = v?.ratings ?? v?.votes ?? {};
  const scores = Object.values(ratings).map(toNum).filter(isFiniteNum);

  const imdb = readImdb(v);
  const date = readDate(v);
  const runtime = readRuntime(v);
  const poster = readPoster(v);

  if (!scores.length) {
    return { title, year, picker, ratings: {}, numVotes: 0, avg: NaN, std: undefined, runtime, poster, imdb, date };
  }
  const a = avg(scores);
  const s2 = variance(scores);
  return {
    title,
    year,
    picker,
    ratings,
    numVotes: scores.length,
    avg: a,
    std: Math.sqrt(s2),
    imdb,
    poster,
    runtime,
    date,
  };
}

function readImdb(v: any): number | null {
  const raw =
    v?.movie?.imdb_rating ??
    v?.meta?.imdb?.rating ??
    v?.omdb?.imdbRating ??
    v?.imdbRating ??
    null;
  const n = raw != null ? Number(raw) : null;
  return n != null && Number.isFinite(n) ? n : null;
}

function readYear(v: any): number | undefined {
  const current = new Date().getFullYear();
  const inRange = (n: number) => Number.isFinite(n) && n >= 1888 && n <= current + 1;

  const candidates: any[] = [
    v?.movie?.year,
    v?.movie?.Year,
    v?.movie?.releaseYear,
    v?.movie?.release_year,
    v?.movie?.releaseDate,
    v?.movie?.release_date,
    v?.movie?.released,
    v?.meta?.year,
    v?.meta?.release_year,
    v?.meta?.omdb?.Year,
    v?.meta?.omdb?.Released,
    v?.meta?.imdb?.Year,
    v?.omdb?.Year,
    v?.omdb?.Released,
    v?.year,
    v?.release_year,
    v?.released,
  ].filter((x) => x != null);

  const tryParse = (c: any): number | undefined => {
    if (typeof c === "number") return inRange(c) ? c : undefined;
    if (typeof c === "string") {
      const iso = c.match(/^(?<y>\d{4})-\d{2}-\d{2}$/)?.groups?.y;
      if (iso) {
        const n = Number(iso);
        return inRange(n) ? n : undefined;
      }
      const m = c.match(/(18|19|20|21)\d{2}/);
      if (m) {
        const n = Number(m[0]);
        return inRange(n) ? n : undefined;
      }
      const n = Number(c.trim());
      return inRange(n) ? n : undefined;
    }
    return undefined;
  };

  for (const c of candidates) {
    const n = tryParse(c);
    if (n !== undefined) return n;
  }

  const maybeTitle = v?.movie?.title ?? v?.title ?? "";
  if (typeof maybeTitle === "string") {
    const m = maybeTitle.match(/\((?<y>(18|19|20|21)\d{2})\)/)?.groups?.y;
    if (m) {
      const n = Number(m);
      if (inRange(n)) return n;
    }
  }
  return undefined;
}

function readDate(v: any): string | null {
  return v?.started_at ?? v?.date ?? v?.created_at ?? null;
}

const TMDB_BASE = "https://image.tmdb.org/t/p/";
function tmdbUrl(path?: string | null, size: "w92" | "w154" | "w185" | "w342" | "w500" | "w780" | "original" = "w185") {
  if (!path) return null;
  const s = String(path).trim();
  if (!s) return null;
  if (s.startsWith("http")) return s;           // già una URL completa
  if (s.startsWith("/")) return `${TMDB_BASE}${size}${s}`; // path TMDB
  return null; // non riconosciuto
}

function readPoster(v: any): string | null {
  // candidati più comuni nelle tue history
  const candidates = [
    v?.movie?.poster_path,
    v?.poster_path,
    v?.movie?.posterUrl,
    v?.movie?.posterURL,
    v?.poster_url,
    v?.posterURL,
    v?.movie?.poster,          // può essere path o URL
    v?.movie?.Poster,          // OMDb
    v?.meta?.poster,
    v?.meta?.omdb?.Poster,
    v?.omdb?.Poster,
    v?.poster,
  ];

  for (const raw of candidates) {
    if (!raw) continue;
    const s = String(raw).trim();
    // 1) Se è già una URL http(s), usala e basta
    if (s.startsWith("http")) return s;
    // 2) Se è un path TMDB ("/abc123.jpg"), costruisci la URL
    if (s.startsWith("/")) {
      const url = tmdbUrl(s, "w185");
      if (url) return url;
    }
  }
  return null;
}

function readRuntime(v: any): number | null {
  const raw =
    v?.movie?.runtime ??
    v?.meta?.runtime ??
    v?.omdb?.Runtime ??
    v?.runtime ??
    null;
  if (raw == null) return null;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string") {
    const m = raw.match(/(\d+)\s*min/i);
    if (m) return Number(m[1]);
    const n = Number(raw);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function toShortDate(iso: string) {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString();
  } catch {
    return "";
  }
}

function hasVotes(v: NormViewing) {
  return Number.isFinite(v.avg) && v.numVotes > 0;
}

function avg(arr: number[]) {
  return arr.reduce((s, x) => s + x, 0) / arr.length;
}
function variance(arr: number[]) {
  const m = avg(arr);
  return arr.reduce((s, x) => s + (x - m) ** 2, 0) / arr.length;
}
function isFiniteNum(x: any): x is number {
  return typeof x === "number" && Number.isFinite(x);
}
function toNum(x: any) {
  const n = Number(x);
  return Number.isFinite(n) ? n : NaN;
}

function maxBy<T>(arr: T[], sel: (t: T) => number) {
  if (!arr.length) return null as any;
  let best: T | null = null;
  let bestV = -Infinity;
  for (const it of arr) {
    const v = sel(it);
    if (v > bestV) {
      bestV = v;
      best = it;
    }
  }
  return best;
}
function minBy<T>(arr: T[], sel: (t: T) => number) {
  if (!arr.length) return null as any;
  let best: T | null = null;
  let bestV = Infinity;
  for (const it of arr) {
    const v = sel(it);
    if (v < bestV) {
      bestV = v;
      best = it;
    }
  }
  return best;
}
function mapValues<T extends Record<string, any>, R>(obj: T, f: (v: any, k: string) => R): Record<string, R> {
  const out: Record<string, R> = {};
  for (const k of Object.keys(obj)) out[k] = f(obj[k], k);
  return out;
}
function topLabelCount(counter: Record<string, number>, eligible?: Set<string>) {
  const entries = Object.entries(counter).filter(([k]) => !eligible || eligible.has(k));
  if (!entries.length) return null;
  const best = entries.reduce((a, b) => (b[1] > a[1] ? b : a));
  return { label: best[0], count: best[1] };
}
function topLabelAvg(buckets: Record<string, number[]>, mode: "max" | "min", eligible?: Set<string>) {
  const entries = Object.entries(buckets).filter(
    ([k, arr]) => arr.length > 0 && (!eligible || eligible.has(k))
  );
  if (!entries.length) return null;
  const withAvg = entries.map(([k, arr]) => [k, avg(arr)] as const);
  const best =
    mode === "max"
      ? withAvg.reduce((a, b) => (b[1] > a[1] ? b : a))
      : withAvg.reduce((a, b) => (b[1] < a[1] ? b : a));
  return { label: best[0], value: best[1] };
}
function normalizeName(s: string) {
  return (s || "").trim().toLowerCase();
}

/* =========================================
   YEARLY — definita PRIMA
========================================= */
function computeYearly(
  items: NormViewing[],
  minRatingsForUserStats: number,
  minPicksForPickerStats: number,
) {
  if (!items.length) return null;
  const bestFilm = maxBy(items.filter(hasVotes), (v) => v.avg);

  const pickerAvg: Record<string, number[]> = {};
  const presence: Record<string, number> = {};
  const picksCount: Record<string, number> = {};

  for (const v of items) {
    Object.keys(v.ratings).forEach((u) => (presence[u] = (presence[u] ?? 0) + 1));
    if (v.picker) {
      picksCount[v.picker] = (picksCount[v.picker] ?? 0) + 1;
      if (hasVotes(v)) (pickerAvg[v.picker] ??= []).push(v.avg);
    }
  }

  const eligiblePickers = new Set(
    Object.keys(picksCount).filter((p) => (picksCount[p] ?? 0) >= minPicksForPickerStats)
  );
  const mvp = topLabelAvg(pickerAvg, "max", eligiblePickers);

  const userGiven: Record<string, number[]> = {};
  for (const v of items) {
    Object.entries(v.ratings).forEach(([u, s]) => (userGiven[u] ??= []).push(s));
  }
  const eligibleUsers = new Set(
    Object.keys(userGiven).filter((u) => (userGiven[u]?.length ?? 0) >= minRatingsForUserStats)
  );
  const mostPresence = topLabelCount(presence, eligibleUsers);

  return {
    bestFilm: bestFilm && { label: bestFilm.title, value: bestFilm.avg, img: bestFilm.poster ?? null },
    mvpPicker: mvp,
    mostPresence,
  };
}

/* =========================================
   Calcolo “tuo film preferito”
========================================= */
function bestForCurrentUser(items: NormViewing[], aliases: string[]) {
  if (!aliases.length) return null;
  const aliasSet = new Set(aliases.map(normalizeName));
  const rows: { title: string; score: number }[] = [];
  for (const v of items) {
    for (const [u, s] of Object.entries(v.ratings)) {
      if (aliasSet.has(normalizeName(u))) {
        const n = Number(s);
        if (Number.isFinite(n)) rows.push({ title: v.title, score: n });
      }
    }
  }
  if (!rows.length) return null;
  return rows.reduce((a, b) => (b.score > a.score ? b : a));
}

/* ============== Helpers per storage dinamico e safe ============== */
type LSModule = { K_VIEWINGS?: string; K_USER?: string; lsGetJSON?: <T>(k: string, d: T) => T };

async function loadLocalStorageModule(): Promise<LSModule | null> {
  try {
    const mod: any = await import("../../localStorage");
    return {
      K_VIEWINGS: mod?.K_VIEWINGS,
      K_USER: mod?.K_USER,
      lsGetJSON: mod?.lsGetJSON,
    };
  } catch {
    return null;
  }
}

function safeGetLS<T>(key: string, def: T): T {
  if (typeof window === "undefined") return def;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : def;
  } catch {
    return def;
  }
}

function safeGetUserFromLS(keys: string[]): string {
  if (typeof window === "undefined") return "";
  for (const k of keys) {
    try {
      const v = window.localStorage.getItem(k);
      if (v && v.trim()) return v.trim();
    } catch { }
  }
  return "";
}

/* =========================================
   Props
========================================= */
type Props = {
  history?: any[];
  minRatingsForUserStats?: number;   // default 10
  minPicksForPickerStats?: number;   // default 3
  autoLoad?: boolean;
  currentUser?: string;
  currentUserAliases?: string[];
};

/* =========================================
   Component
========================================= */
export function Achievements({
  history,
  minRatingsForUserStats = 10,
  minPicksForPickerStats = 3,
  autoLoad = true,
  currentUser,
  currentUserAliases = [],
}: Props) {
  const [autoHistory, setAutoHistory] = React.useState<any[] | null>(null);
  const [lsMod, setLsMod] = React.useState<LSModule | null>(null);

  React.useEffect(() => {
    loadLocalStorageModule().then(setLsMod);
  }, []);

  React.useEffect(() => {
    let mounted = true;
    if (!autoLoad) return;
    const hasIncoming = Array.isArray(history) && history.length > 0;
    if (hasIncoming) return;

    (async () => {
      try {
        const mod = await import("../../storage");
        if (mod?.ensureLiveFileExists) await mod.ensureLiveFileExists();
        const first = (await mod?.loadHistoryLive?.()) ?? [];
        if (mounted && first.length) setAutoHistory(first);
        const unsub = await mod?.subscribeHistoryLive?.((next: any[]) => {
          if (mounted) setAutoHistory(next ?? []);
        });
        return () => { if (typeof unsub === "function") unsub(); };
      } catch {
        const KEY = (lsMod?.K_VIEWINGS as string) || "CN_VIEWINGS";
        const lsGet = lsMod?.lsGetJSON
          ? () => lsMod!.lsGetJSON!(KEY, [] as any[])
          : () => safeGetLS<any[]>(KEY, []);
        const cached = lsGet();
        if (mounted) setAutoHistory(Array.isArray(cached) ? cached : []);
        if (typeof window !== "undefined") {
          const onStorage = (ev: StorageEvent) => {
            if (ev.key === KEY) {
              const next = lsGet();
              if (mounted) setAutoHistory(Array.isArray(next) ? next : []);
            }
          };
          window.addEventListener("storage", onStorage);
          return () => window.removeEventListener("storage", onStorage);
        }
      }
    })();

    return () => { mounted = false; };
  }, [autoLoad, history, lsMod]);

  const effectiveUser = React.useMemo(() => {
    if (currentUser && String(currentUser).trim()) return currentUser.trim();
    const key = (lsMod?.K_USER as string) || "CN_USER";
    if (lsMod?.lsGetJSON && lsMod.K_USER) {
      try {
        const u = lsMod.lsGetJSON<string>(key, "");
        if (u && u.trim()) return u.trim();
      } catch { }
    }
    const fallback = safeGetUserFromLS([key, "USER"]);
    return fallback;
  }, [currentUser, lsMod]);

  const effectiveAliases = React.useMemo(() => {
    const base = [effectiveUser, ...currentUserAliases].filter(Boolean);
    return Array.from(new Set(base.map((n) => normalizeName(n))));
  }, [effectiveUser, currentUserAliases]);

  const effectiveHistory = React.useMemo(() => {
    if (Array.isArray(history) && history.length) return history;
    if (Array.isArray(autoHistory)) return autoHistory;
    return [];
  }, [history, autoHistory]);

  const data = React.useMemo(
    () =>
      computeHallOfFame(
        effectiveHistory,
        minRatingsForUserStats,
        minPicksForPickerStats,
        effectiveAliases
      ),
    [effectiveHistory, minRatingsForUserStats, minPicksForPickerStats, effectiveAliases]
  );

  return (
    <Card>
      <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold">
        <SparklesIcon className="h-5 w-5" />
        Hall of Fame
      </h3>

      {/* Podium */}
      <Section title="🥇 Podium" gridClassName="grid gap-3 sm:grid-cols-1">
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
<Podium
  title="Top 3 movies"
  hint="The three movies with the highest internal average rating. In case of a tie, the one with more votes wins."
  accent="amber"
  items={(data.top3Films ?? []).map((f) => ({
    label: f.title,
    subLeft: `${f.numVotes} votes`,
    right: `avg ${formatScore(f.avg)}`,
    img: (f as any).img ?? null,
  }))}
/>

          <Podium
  title="Top 3 pickers"
  hint="Pickers ranked by the average of the ratings received by their movies. Only eligible pickers are considered."
  accent="amber"
  items={(data.top3Pickers ?? []).map((p) => ({
    label: p.picker,
    subLeft: `${p.count} movies`,
    right: `avg ${formatScore(p.avg)}`,
    // usa il tuo Avatar così compaiono le foto (es. Gnevas)
    thumb: <Avatar name={p.picker} size={36} />,
  }))}
/>
        </div>
      </Section>

      {/* Movies & Votes */}
      <Section title="🎬 Movies & Votes">
        <Badge
          icon={TrophyIcon}
          color="amber"
          label="Best movie"
          value={data.bestFilm?.label ?? "—"}
          sub={scoreSub(data.bestFilm?.value)}
          hint="Movie with the highest internal average rating."
          leftSlot={<PosterThumb src={data.bestFilm?.img} alt={data.bestFilm?.label} />}
        />
        <Badge
          icon={XCircleIcon}
          color="rose"
          label="Worst movie"
          value={data.worstFilm?.label ?? "—"}
          sub={scoreSub(data.worstFilm?.value)}
          hint="Movie with the lowest internal average rating."
          leftSlot={<PosterThumb src={data.worstFilm?.img} alt={data.worstFilm?.label} />}
        />
        <Badge
          icon={UsersIcon}
          color="indigo"
          label="Most voted movie"
          value={data.mostVotedFilm?.label ?? "—"}
          sub={countSub(data.mostVotedFilm?.count, "votes")}
          hint="Movie that received the highest number of votes in a single night."
          leftSlot={<PosterThumb src={data.mostVotedFilm?.img} alt={data.mostVotedFilm?.label} />}
        />
        <Badge
          icon={ChartBarIcon}
          color="fuchsia"
          label="Most divisive movie"
          value={data.mostDivisiveFilm?.label ?? "—"}
          sub={stdSub(data.mostDivisiveFilm?.std)}
          hint="Movie with the highest standard deviation among ratings."
          leftSlot={<PosterThumb src={data.mostDivisiveFilm?.img} alt={data.mostDivisiveFilm?.label} />}
        />
        <Badge
          icon={ClockIcon}
          color="slate"
          label="Longest movie"
          value={data.longestFilm?.label ?? "—"}
          sub={data.longestFilm ? `${data.longestFilm.minutes} min` : undefined}
          hint="The movie with the longest runtime."
          leftSlot={<PosterThumb src={data.longestFilm?.img} alt={data.longestFilm?.label} />}
        />
        <Badge
          icon={ClockIcon}
          color="slate"
          label="Shortest movie"
          value={data.shortestFilm?.label ?? "—"}
          sub={data.shortestFilm ? `${data.shortestFilm.minutes} min` : undefined}
          hint="The movie with the shortest runtime."
          leftSlot={<PosterThumb src={data.shortestFilm?.img} alt={data.shortestFilm?.label} />}
        />
        <Badge
          icon={AcademicCapIcon}
          color="slate"
          label="Oldest movie"
          value={data.oldestFilm?.label ?? "—"}
          sub={data.oldestFilm ? `${data.oldestFilm.year}` : undefined}
          hint="The movie with the earliest release year."
          leftSlot={<PosterThumb src={data.oldestFilm?.img} alt={data.oldestFilm?.label} />}
        />
        <Badge
          icon={AcademicCapIcon}
          color="slate"
          label="Newest movie"
          value={data.newestFilm?.label ?? "—"}
          sub={data.newestFilm ? `${data.newestFilm.year}` : undefined}
          hint="The most recent release watched."
          leftSlot={<PosterThumb src={data.newestFilm?.img} alt={data.newestFilm?.label} />}
        />
      </Section>

      {/* People & Attendance */}
      <Section title="👥 People & Attendance">
        <Badge
          icon={UsersIcon}
          color="sky"
          label="Most attendance"
          value={data.mostPresence?.label ?? "—"}
          sub={countSub(data.mostPresence?.count, "attendances")}
          hint="Who attended and voted the most among eligible users."
          leftSlot={data.mostPresence?.label ? <Avatar name={data.mostPresence.label} size={36} /> : undefined}
        />
        <Badge
          icon={BoltIcon}
          color="yellow"
          label="Most movies proposed"
          value={data.mostPicks?.label ?? "—"}
          sub={countSub(data.mostPicks?.count, "movies")}
          hint="Who proposed the highest number of movies among eligible pickers."
          leftSlot={data.mostPicks?.label ? <Avatar name={data.mostPicks.label} size={36} /> : undefined}
        />
        <Badge
          icon={ArrowTrendingUpIcon}
          color="green"
          label="Highest ratings received"
          value={data.highestAvgReceived?.label ?? "—"}
          sub={scoreSub(data.highestAvgReceived?.value, "average received")}
          hint="Average ratings obtained by the picker’s movies. Higher is better."
          leftSlot={data.highestAvgReceived?.label ? <Avatar name={data.highestAvgReceived.label} size={36} /> : undefined}
        />
        <Badge
          icon={ArrowTrendingDownIcon}
          color="red"
          label="Lowest ratings received"
          value={data.lowestAvgReceived?.label ?? "—"}
          sub={scoreSub(data.lowestAvgReceived?.value, "average received")}
          hint="Average ratings obtained by the picker’s movies. Lower is worse."
          leftSlot={data.lowestAvgReceived?.label ? <Avatar name={data.lowestAvgReceived.label} size={36} /> : undefined}
        />
        <Badge
          icon={ClockIcon}
          color="slate"
          label="Longest movies"
          value={data.longestPicker?.label ?? "—"}
          sub={data.longestPicker ? `${formatMaybe(data.longestPicker.minutes, 0)} min avg` : undefined}
          hint="Picker whose movies have the longest average runtime."
          leftSlot={data.longestPicker?.label ? <Avatar name={data.longestPicker.label} size={36} /> : undefined}
        />
        <Badge
          icon={ClockIcon}
          color="slate"
          label="Shortest movies"
          value={data.shortestPicker?.label ?? "—"}
          sub={data.shortestPicker ? `${formatMaybe(data.shortestPicker.minutes, 0)} min avg` : undefined}
          hint="Picker whose movies have the shortest average runtime."
          leftSlot={data.shortestPicker?.label ? <Avatar name={data.shortestPicker.label} size={36} /> : undefined}
        />
        <Badge
          icon={HeartIcon}
          color="pink"
          label='Most "10s" received'
          value={data.mostTensReceived?.label ?? "—"}
          sub={countSub(data.mostTensReceived?.count, "10s")}
          hint="Total number of 10s received by a picker’s movies across all nights. Only eligible pickers are considered."
          leftSlot={data.mostTensReceived?.label ? <Avatar name={data.mostTensReceived.label} size={36} /> : undefined}
        />
        <Badge
          icon={XCircleIcon}
          color="orange"
          label='Most "< 4" received'
          value={data.mostOnesReceived?.label ?? "—"}
          sub={countSub(data.mostOnesReceived?.count, "ratings < 4")}
          hint="Total number of ratings below 4 received by a picker’s movies across all nights. Only eligible pickers are considered."
          leftSlot={data.mostOnesReceived?.label ? <Avatar name={data.mostOnesReceived.label} size={36} /> : undefined}
        />
        <Badge
          icon={ArrowTrendingUpIcon}
          color="emerald"
          label="Most generous to self"
          value={data.mostGenerousSelf?.label ?? "—"}
          sub={data.mostGenerousSelf ? `+${formatMaybe(data.mostGenerousSelf.gap, 2)} vs avg` : undefined}
          hint="Picker who rates their own movies higher compared to the group average."
          leftSlot={data.mostGenerousSelf?.label ? <Avatar name={data.mostGenerousSelf.label} size={36} /> : undefined}
        />
        <Badge
          icon={ArrowTrendingDownIcon}
          color="rose"
          label="Most self-critical"
          value={data.mostCriticalSelf?.label ?? "—"}
          sub={data.mostCriticalSelf ? `${formatMaybe(data.mostCriticalSelf.gap, 2)} vs avg` : undefined}
          hint="Picker who rates their own movies lower compared to the group average."
          leftSlot={data.mostCriticalSelf?.label ? <Avatar name={data.mostCriticalSelf.label} size={36} /> : undefined}
        />
        <Badge
          icon={Bars3CenterLeftIcon}
          color="slate"
          label="Top voter"
          value={data.topVoter?.label ?? "—"}
          sub={countSub(data.topVoter?.count, "ratings given")}
          hint="The person who cast the most ratings among eligible users."
          leftSlot={data.topVoter?.label ? <Avatar name={data.topVoter.label} size={36} /> : undefined}
        />
      </Section>

      {/* Nights */}
      <Section title="🌙 Nights">
        <Badge
          icon={UsersIcon}
          color="cyan"
          label="Most attended night"
          value={data.nightMostParticipants?.label ?? "—"}
          sub={countSub(data.nightMostParticipants?.count, "voters")}
          hint="The night with the highest number of voters."
          leftSlot={<PosterThumb src={data.nightMostParticipants?.img} alt={data.nightMostParticipants?.label} />}
        />
        <Badge
          icon={UsersIcon}
          color="cyan"
          label="Least attended night"
          value={data.nightLeastParticipants?.label ?? "—"}
          sub={countSub(data.nightLeastParticipants?.count, "voters")}
          hint="The night with the lowest number of voters."
          leftSlot={
            <PosterThumb
              src={data.nightLeastParticipants?.img}
              alt={data.nightLeastParticipants?.label}
            />
          }
        />

        <Badge
          icon={AcademicCapIcon}
          color="slate"
          label="First night"
          value={data.firstNight?.label ?? "—"}
          sub={data.firstNight?.date ?? undefined}
          hint="The first recorded night."
          leftSlot={<PosterThumb src={data.firstNight?.img} alt={data.firstNight?.label} />}
        />
      </Section>

      {/* Profiles */}
      <Section title="🏅 Profiles">
        <Badge
          icon={ClockIcon}
          color="teal"
          label="Mr. Consistency"
          value={data.mrConsistency?.label ?? "—"}
          sub={stdSub(data.mrConsistency?.std)}
          hint="User with the lowest variability in given ratings among eligible users."
          leftSlot={data.mrConsistency?.label ? <Avatar name={data.mrConsistency.label} size={36} /> : undefined}
        />
        <Badge
          icon={ArrowTrendingDownIcon}
          color="rose"
          label="Mr. Critic"
          value={data.mrCritic?.label ?? "—"}
          sub={scoreSub(data.mrCritic?.value, "average given")}
          hint="Eligible user with the lowest average rating given."
          leftSlot={data.mrCritic?.label ? <Avatar name={data.mrCritic.label} size={36} /> : undefined}
        />
        <Badge
          icon={ArrowTrendingUpIcon}
          color="emerald"
          label="Mr. Generous"
          value={data.mrGenerous?.label ?? "—"}
          sub={scoreSub(data.mrGenerous?.value, "average given")}
          hint="Eligible user with the highest average rating given."
          leftSlot={data.mrGenerous?.label ? <Avatar name={data.mrGenerous.label} size={36} /> : undefined}
        />
      </Section>

      {/* Meta */}
      <Section title="🧪 Meta">
        <Badge
          icon={ArrowTrendingUpIcon}
          color="green"
          label="Underdog"
          value={data.underdog?.label ?? "—"}
          sub={data.underdog ? `IMDb ${formatMaybe(data.underdog.imdb)} → ${formatScore(data.underdog.avg)}` : undefined}
          hint="Largest positive gap between internal average and IMDb."
          leftSlot={<PosterThumb src={data.underdog?.img} alt={data.underdog?.label} />}
        />
        <Badge
          icon={ArrowTrendingDownIcon}
          color="red"
          label="Overrated"
          value={data.overrated?.label ?? "—"}
          sub={data.overrated ? `IMDb ${formatMaybe(data.overrated.imdb)} → ${formatScore(data.overrated.avg)}` : undefined}
          hint="Largest negative gap between internal average and IMDb."
          leftSlot={<PosterThumb src={data.overrated?.img} alt={data.overrated?.label} />}
        />
      </Section>

      {/* Yearly */}
      {data.currentYear && data.yearly && (
        <Section title={`📅 ${data.currentYear} — Year highlights`}>
          <Badge
            icon={TrophyIcon}
            color="amber"
            label="Best movie of the year"
            value={data.yearly.bestFilm?.label ?? "—"}
            sub={scoreSub(data.yearly.bestFilm?.value)}
            hint="The movie with the highest average among those watched this year."
            leftSlot={<PosterThumb src={(data.yearly as any)?.bestFilm?.img} alt={data.yearly.bestFilm?.label} />}
          />
          <Badge
            icon={ArrowTrendingUpIcon}
            color="green"
            label="MVP of the year"
            value={data.yearly.mvpPicker?.label ?? "—"}
            sub={scoreSub(data.yearly.mvpPicker?.value)}
            hint="Picker with the highest average across chosen movies during the year. Only eligible pickers are considered."
            leftSlot={data.yearly.mvpPicker?.label ? <Avatar name={data.yearly.mvpPicker.label} size={36} /> : undefined}
          />
          <Badge
            icon={UsersIcon}
            color="sky"
            label="Most attendance this year"
            value={data.yearly.mostPresence?.label ?? "—"}
            sub={countSub(data.yearly.mostPresence?.count, "attendances")}
            hint="Who attended the most during the current year among eligible users."
            leftSlot={data.yearly.mostPresence?.label ? <Avatar name={data.yearly.mostPresence.label} size={36} /> : undefined}
          />
        </Section>
      )}

      <RulesBlock minRatingsForUserStats={minRatingsForUserStats} minPicksForPickerStats={minPicksForPickerStats} />
    </Card>
  );
}

/* =========================================
   UI helpers
========================================= */
function Section({
  title,
  children,
  gridClassName = "grid gap-2 sm:grid-cols-2 lg:grid-cols-3",
}: {
  title: string;
  children: React.ReactNode;
  gridClassName?: string;
}) {
  return (
    <div className="mb-4">
      <div className="mb-2 text-sm font-semibold text-zinc-400">{title}</div>
      <div className={gridClassName}>{children}</div>
    </div>
  );
}

/* Poster thumbnail */
function PosterThumb({ src, alt = "" }: { src?: string | null; alt?: string }) {
  if (!src) {
    return (
      <div className="h-12 w-8 rounded-md ring-1 ring-white/10 bg-zinc-800/60 grid place-items-center text-[10px] text-zinc-400">
        N/A
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      className="h-12 w-8 rounded-md ring-1 ring-white/10 object-cover"
      loading="lazy"
      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
    />
  );
}

/* Badge con slot sinistro */
function Badge({
  icon: Icon,
  color,
  label,
  value,
  sub,
  hint,
  leftSlot,
}: {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  color:
    | "amber" | "rose" | "indigo" | "fuchsia" | "emerald" | "sky" | "yellow"
    | "green" | "red" | "orange" | "cyan" | "lime" | "violet" | "slate" | "teal" | "pink";
  label: string;
  value: string;
  sub?: string;
  hint?: string;
  leftSlot?: React.ReactNode;
}) {
  const cls = colorToCls(color);
  const titleText = hint ? (sub ? `${hint} • ${sub}` : hint) : sub ?? "";

  return (
    <div
      className={`relative flex items-center gap-3 rounded-2xl border px-3 py-2 ${cls.border} ${cls.bg}`}
      title={titleText}
    >
      {leftSlot ? (
        <div className="shrink-0">{leftSlot}</div>
      ) : (
        <div
          className={`flex h-9 w-9 items-center justify-center rounded-xl ${cls.chipBg} ${cls.text}`}
        >
          <Icon className="h-5 w-5" />
        </div>
      )}

      <div className="min-w-0">
        <div className="truncate text-sm font-medium text-zinc-200">{label}</div>
        <div className="truncate text-sm">
          <span className="font-bold text-white text-base">{value}</span>
          {sub ? (
            <span className="ml-1 text-zinc-400 font-medium">— {sub}</span>
          ) : null}
        </div>
      </div>

      {hint && <InfoBadge text={hint} />}
    </div>
  );
}

function colorToCls(color: Parameters<typeof Badge>[0]["color"]) {
  const map: Record<string, { border: string; bg: string; chipBg: string; text: string }> = {
    amber: { border: "border-amber-500/40", bg: "bg-amber-500/5", chipBg: "bg-amber-500/15", text: "text-amber-300" },
    rose: { border: "border-rose-500/40", bg: "bg-rose-500/5", chipBg: "bg-rose-500/15", text: "text-rose-300" },
    indigo: { border: "border-indigo-500/40", bg: "bg-indigo-500/5", chipBg: "bg-indigo-500/15", text: "text-indigo-300" },
    fuchsia: { border: "border-fuchsia-500/40", bg: "bg-fuchsia-500/5", chipBg: "bg-fuchsia-500/15", text: "text-fuchsia-300" },
    emerald: { border: "border-emerald-500/40", bg: "bg-emerald-500/5", chipBg: "bg-emerald-500/15", text: "text-emerald-300" },
    sky: { border: "border-sky-500/40", bg: "bg-sky-500/5", chipBg: "bg-sky-500/15", text: "text-sky-300" },
    yellow: { border: "border-yellow-500/40", bg: "bg-yellow-500/5", chipBg: "bg-yellow-500/15", text: "text-yellow-300" },
    green: { border: "border-green-500/40", bg: "bg-green-500/5", chipBg: "bg-green-500/15", text: "text-green-300" },
    red: { border: "border-red-500/40", bg: "bg-red-500/5", chipBg: "bg-red-500/15", text: "text-red-300" },
    orange: { border: "border-orange-500/40", bg: "bg-orange-500/5", chipBg: "bg-orange-500/15", text: "text-orange-300" },
    cyan: { border: "border-cyan-500/40", bg: "bg-cyan-500/5", chipBg: "bg-cyan-500/15", text: "text-cyan-300" },
    lime: { border: "border-lime-500/40", bg: "bg-lime-500/5", chipBg: "bg-lime-500/15", text: "text-lime-300" },
    violet: { border: "border-violet-500/40", bg: "bg-violet-500/5", chipBg: "bg-violet-500/15", text: "text-violet-300" },
    slate: { border: "border-slate-500/40", bg: "bg-slate-500/5", chipBg: "bg-slate-500/15", text: "text-slate-300" },
    teal: { border: "border-teal-500/40", bg: "bg-teal-500/5", chipBg: "bg-teal-500/15", text: "text-teal-300" },
    pink: { border: "border-pink-500/40", bg: "bg-pink-500/5", chipBg: "bg-pink-500/15", text: "text-pink-300" },
  };
  return map[color];
}

function scoreSub(v?: number, label = "average") {
  return v == null ? undefined : `${label}: ${formatScore(v)}`;
}
function countSub(n?: number, label = "times") {
  return n == null ? undefined : `${n} ${label}`;
}
function stdSub(std?: number) {
  return std == null ? undefined : `deviation: ${formatMaybe(std, 2)}`;
}
function formatMaybe(v?: number, digits = 1) {
  return v == null || Number.isNaN(v) ? "—" : v.toFixed(digits);
}

/* =========================================
   Podio
========================================= */

/* ==== Mini components ==================================================== */
const Medal: React.FC<{ rank: number }> = ({ rank }) => {
  const idx = Number.isFinite(rank) ? Math.min(Math.max(Math.floor(rank) - 1, 0), 2) : 0;
  const cfg = [
    { bg: "bg-yellow-400/20", text: "text-yellow-300" }, // 1
    { bg: "bg-zinc-400/20",  text: "text-zinc-200"  },   // 2
    { bg: "bg-amber-600/20", text: "text-amber-300" },   // 3
  ][idx];
  return (
    <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold ${cfg.bg} ${cfg.text}`}>
      {idx + 1}
    </span>
  );
};

const ScorePill: React.FC<{
  children: React.ReactNode;
  accent?: "amber" | "emerald" | "sky" | "fuchsia";
  size?: "sm" | "lg";
}> = ({ children, accent = "amber", size = "sm" }) => {
  const map = {
    amber: "from-amber-500/20 to-amber-500/10 text-amber-300 ring-amber-400/30",
    emerald: "from-emerald-500/20 to-emerald-500/10 text-emerald-300 ring-emerald-400/30",
    sky: "from-sky-500/20 to-sky-500/10 text-sky-300 ring-sky-400/30",
    fuchsia: "from-fuchsia-500/20 to-fuchsia-500/10 text-fuchsia-300 ring-fuchsia-400/30",
  }[accent];
  const sizing = size === "lg" ? "px-3 py-1 text-sm" : "px-2 py-0.5 text-sm";
  return (
    <span className={`inline-flex items-center rounded-full ring-1 bg-gradient-to-b ${map} ${sizing} backdrop-blur-sm`}>
      {children}
    </span>
  );
};

const PodiumThumb: React.FC<{ img?: string | null; name?: string; big?: boolean }> = ({ img, name, big }) => {
  const posterClass = big ? "h-12 w-9" : "h-10 w-7";
  if (img) {
    return (
      <div className="relative shrink-0">
        <img
          src={img}
          alt={name ?? ""}
          className={`${posterClass} rounded-md object-cover ring-1 ring-white/10`}
          loading="lazy"
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
        />
        {/* aura glow */}
        <div className="pointer-events-none absolute -inset-1 rounded-lg bg-amber-500/0 blur-md group-hover:bg-amber-400/10 transition-colors" />
      </div>
    );
  }
  // fallback bubble
  return (
    <div className={`${big ? "h-12 w-12" : "h-10 w-10"} rounded-full bg-zinc-800/70 grid place-items-center text-xs text-zinc-300 ring-1 ring-white/10`}>
      {(name ?? "•").slice(0,1)}
    </div>
  );
};
/* ==== PODIUM PRO ======================================================== */
function Podium({
  title,
  hint,
  items,
  accent = "amber",
}: {
  title: string;
  hint?: string;
  accent?: "amber" | "emerald" | "sky" | "fuchsia";
  items: Array<{
    label: string;
    subLeft?: string;         // "7 votes" / "8 movies"
    right?: string;           // "avg 9.14"
    img?: string | null;      // poster (film)
    avatarName?: string;      // fallback bubble name
    thumb?: React.ReactNode;  // override esplicito (es. <Avatar .../>)
  }>;
}) {
  const titleColor = {
    amber: "text-amber-300",
    emerald: "text-emerald-300",
    sky: "text-sky-300",
    fuchsia: "text-fuchsia-300",
  }[accent];

  const borderColor = {
    amber: "border-amber-500/30",
    emerald: "border-emerald-500/30",
    sky: "border-sky-500/30",
    fuchsia: "border-fuchsia-500/30",
  }[accent];

  const headerBg = {
    amber: "bg-amber-500/5",
    emerald: "bg-emerald-500/5",
    sky: "bg-sky-500/5",
    fuchsia: "bg-fuchsia-500/5",
  }[accent];

  const first = items[0];
  const rest = items.slice(1);

  return (
    <div className={`relative rounded-2xl border ${borderColor} ${headerBg} p-3`}>
      {/* header */}
      <div className={`mb-2 flex items-center gap-2 text-sm font-semibold ${titleColor}`}>
        <TrophyIcon className="h-4 w-4" />
        {title}
      </div>

      {/* FEATURED #1 */}
      {first ? (
        <div className="group relative mb-2 rounded-xl border border-white/10 bg-white/5 px-2 py-1.5 ring-1 ring-black/0 hover:ring-white/10 transition">
          {/* crown */}
          <div className="absolute -top-2 left-10 text-yellow-300/90 drop-shadow">
            <svg width="18" height="18" viewBox="0 0 24 24"><path fill="currentColor" d="M5 18h14l-1-9-4 3-3-6-3 6-4-3z"/></svg>
          </div>
          {/* shine */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl">
            <div className="absolute -left-1 top-0 h-full w-12 -skew-x-12 bg-white/8 blur-[2px] opacity-0 group-hover:opacity-100 animate-podium-shine" />
          </div>
          <div className="grid grid-cols-[auto,auto,1fr,auto] items-center gap-3">
            <Medal rank={1} />
            {first.thumb
              ? <div className="shrink-0">{first.thumb}</div>
              : <PodiumThumb img={first.img ?? null} name={first.avatarName ?? first.label} big />}
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{first.label}</div>
              {first.subLeft && <div className="truncate text-xs text-zinc-400">{first.subLeft}</div>}
            </div>
            {first.right ? <ScorePill size="lg">{first.right}</ScorePill> : <div />}
          </div>
        </div>
      ) : null}

      {/* #2 & #3 */}
      <ol className="space-y-1.5">
        {rest.map((it, i) => (
          <li
            key={i}
            className="group relative grid grid-cols-[auto,auto,1fr,auto] items-center gap-3 rounded-xl px-2 py-1 hover:bg-white/5 transition"
          >
            <Medal rank={i + 2} />
            {it.thumb ? <div className="shrink-0">{it.thumb}</div> : <PodiumThumb img={it.img ?? null} name={it.avatarName ?? it.label} />}
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{it.label}</div>
              {it.subLeft && <div className="truncate text-xs text-zinc-400">{it.subLeft}</div>}
            </div>
            {it.right ? <ScorePill>{it.right}</ScorePill> : <div />}
          </li>
        ))}
        {!first && items.length === 0 && <div className="text-xs text-zinc-500">—</div>}
      </ol>

      {hint && <InfoBadge text={hint} />}
      {/* keyframes locali */}
      <style>{`
        @keyframes podium-shine {
          0%   { transform: translateX(-20%) }
          100% { transform: translateX(120%) }
        }
        .animate-podium-shine { animation: podium-shine 1.2s ease-in-out 1; }
      `}</style>
    </div>
  );
}
/* =========================================
   Rules block
========================================= */
function RulesBlock({
  minRatingsForUserStats,
  minPicksForPickerStats,
}: {
  minRatingsForUserStats: number;
  minPicksForPickerStats: number;
}) {
  return (
    <div className="mt-4 rounded-2xl border border-zinc-700/60 bg-zinc-900/40 p-3">
      <div className="mb-1 text-sm font-semibold text-zinc-300">Rules</div>
      <ul className="list-disc pl-5 text-xs text-zinc-400 space-y-1">
        <li>Users are eligible after at least {minRatingsForUserStats} ratings given.</li>
        <li>Pickers are eligible after at least {minPicksForPickerStats} movies proposed.</li>
        <li>Most divisive is based on the highest standard deviation of ratings.</li>
        <li>Ties are broken by the higher number of votes where applicable.</li>
        <li>Year highlights use the same eligibility rules within the current year.</li>
      </ul>
    </div>
  );
}

/* =========================================
   Core: computeHallOfFame
========================================= */
function computeHallOfFame(
  history: any[],
  minRatingsForUserStats: number,
  minPicksForPickerStats: number,
  userAliases: string[]
) {
  const items = (history || []).map(normalizeViewing).filter(Boolean) as NormViewing[];

  // Film-level
  const filmByAvg = maxBy(items.filter(hasVotes), (v) => v.avg);
  const filmByMinAvg = minBy(items.filter(hasVotes), (v) => v.avg);
  const filmByVotes = maxBy(items, (v) => v.numVotes);
  const filmByStd = maxBy(items.filter((v) => v.std != null), (v) => v.std ?? -Infinity);

  const NOW = new Date().getFullYear();
  const yearItems = items.filter(
    (v) => typeof v.year === "number" && Number.isFinite(v.year) && v.year >= 1888 && v.year <= NOW + 1
  );
  const filmByYearMin = minBy(yearItems, (v) => v.year as number);
  const filmByYearMax = maxBy(yearItems, (v) => v.year as number);

  const withRuntime = items.filter((v) => Number.isFinite(v.runtime as number));
  const filmByRuntimeMax = maxBy(withRuntime, (v) => (v.runtime as number));
  const filmByRuntimeMin = minBy(withRuntime, (v) => (v.runtime as number));

  // Tuo film preferito
  const yourBest = bestForCurrentUser(items, userAliases);

  // Presence & user stats
  const presenceCount: Record<string, number> = {};
  const userGiven: Record<string, number[]> = {};
  const pickerAvgReceived: Record<string, number[]> = {};
  const pickerTens: Record<string, number> = {};
  const pickerOnes: Record<string, number> = {};
  const pickerRuntime: Record<string, number[]> = {};
  const pickerSelfGaps: Record<string, number[]> = {};
  const picksCount: Record<string, number> = {};

  for (const v of items) {
    Object.keys(v.ratings).forEach((u) => {
      presenceCount[u] = (presenceCount[u] ?? 0) + 1;
      (userGiven[u] ??= []).push(v.ratings[u]);
    });

    if (v.picker) {
      picksCount[v.picker] = (picksCount[v.picker] ?? 0) + 1;
      if (hasVotes(v)) (pickerAvgReceived[v.picker] ??= []).push(v.avg);

      const tens = Object.values(v.ratings).filter((s) => s === 10).length;
      const ones = Object.values(v.ratings).filter((s) => s < 4).length;
      pickerTens[v.picker] = (pickerTens[v.picker] ?? 0) + tens;
      pickerOnes[v.picker] = (pickerOnes[v.picker] ?? 0) + ones;

      const rt = v.runtime;
      if (Number.isFinite(rt as number)) (pickerRuntime[v.picker] ??= []).push(rt as number);

      if (hasVotes(v)) {
        const selfVote = v.ratings[v.picker];
        if (Number.isFinite(selfVote)) {
          const gap = (selfVote as number) - v.avg;
          (pickerSelfGaps[v.picker] ??= []).push(gap);
        }
      }
    }
  }

  const eligibleUsers = new Set(
    Object.keys(userGiven).filter((u) => (userGiven[u]?.length ?? 0) >= minRatingsForUserStats)
  );
  const eligiblePickers = new Set(
    Object.keys(picksCount).filter((p) => (picksCount[p] ?? 0) >= minPicksForPickerStats)
  );

  const mostPresence = topLabelCount(presenceCount, eligibleUsers);
  const topVoter = mostPresence
    ? { label: mostPresence.label, count: (userGiven[mostPresence.label] ?? []).length }
    : null;
  const mostPicks = topLabelCount(picksCount, eligiblePickers);
  const highestAvgReceived = topLabelAvg(pickerAvgReceived, "max", eligiblePickers);
  const lowestAvgReceived = topLabelAvg(pickerAvgReceived, "min", eligiblePickers);
  const mostTensReceived = topLabelCount(pickerTens, eligiblePickers);
  const mostOnesReceived = topLabelCount(pickerOnes, eligiblePickers);

  const selfAvgGaps = Object.entries(pickerSelfGaps)
    .filter(([p, arr]) => arr.length > 0 && eligiblePickers.has(p))
    .map(([p, arr]) => [p, avg(arr)] as const);

  const mostGenerousSelf = selfAvgGaps.length
    ? selfAvgGaps.reduce((a, b) => (b[1] > a[1] ? b : a))
    : null;
  const mostCriticalSelf = selfAvgGaps.length
    ? selfAvgGaps.reduce((a, b) => (b[1] < a[1] ? b : a))
    : null;

  const longestPickerAvg = topLabelAvg(pickerRuntime, "max", eligiblePickers);
  const shortestPickerAvg = topLabelAvg(pickerRuntime, "min", eligiblePickers);

  // Nights
  const nightsWithVotes = items.filter((v) => v.numVotes > 0);

  const nightMostParticipants = maxBy(nightsWithVotes, (v) => v.numVotes);
  const nightLeastParticipants = minBy(nightsWithVotes, (v) => v.numVotes);

  const nightHighestAvg = maxBy(items.filter(hasVotes), (v) => v.avg);
  const nightLowestAvg = minBy(items.filter(hasVotes), (v) => v.avg);
  const recordNight = nightHighestAvg;
  const firstNight = minBy(
    items.filter((v) => v.date),
    (v) => (v.date ? new Date(v.date).getTime() : Infinity)
  );


  // Profili con soglia
  const userAvgs = mapValues(userGiven, avg);
  const eligibleAvgs = Object.entries(userAvgs).filter(
    ([u]) => (userGiven[u] ?? []).length >= minRatingsForUserStats
  );
  const mrGenerous = eligibleAvgs.length ? eligibleAvgs.reduce((a, b) => (b[1] > a[1] ? b : a)) : null;
  const mrCritic = eligibleAvgs.length ? eligibleAvgs.reduce((a, b) => (b[1] < a[1] ? b : a)) : null;

  const userVars = mapValues(userGiven, (arr) => (arr.length >= minRatingsForUserStats ? variance(arr) : Infinity));
  const eligibleVars = Object.entries(userVars).filter(([, v]) => Number.isFinite(v));
  const mrConsistency = eligibleVars.length
    ? eligibleVars.reduce((a, b) => ((b[1] as number) < (a[1] as number) ? b : a))
    : null;

  // Meta
  const withImdb = items.filter((v) => v.imdb != null && hasVotes(v));
  const underdog = maxBy(withImdb, (v) => v.avg - (v.imdb as number));
  const overrated = maxBy(withImdb, (v) => (v.imdb as number) - v.avg);

  // Podii
const top3Films = [...items]
  .filter(hasVotes)
  .sort((a, b) => b.avg - a.avg || b.numVotes - a.numVotes)
  .slice(0, 3)
  .map((x) => ({ title: x.title, avg: x.avg, numVotes: x.numVotes, img: x.poster ?? null }));


  const pickerAvgArr = Object.entries(pickerAvgReceived)
    .map(([picker, arr]) => ({
      picker,
      avg: arr.length ? avg(arr) : NaN,
      count: arr.length,
      totalPicked: picksCount[picker] ?? arr.length,
    }))
    .filter((x) => Number.isFinite(x.avg) && x.count > 0 && (x.totalPicked >= minPicksForPickerStats))
    .sort((a, b) => b.avg - a.avg || b.count - a.count)
    .slice(0, 3);

  // Yearly
  const years = Array.from(
    new Set(
      items
        .map((it) => (it.date ? new Date(it.date).getFullYear() : null))
        .filter((y): y is number => Number.isFinite(y as number))
    )
  ).sort((a, b) => b - a);
  const currentYear = years[0];
  const yearly = currentYear
    ? computeYearly(
      items.filter((it) => it.date && new Date(it.date!).getFullYear() === currentYear),
      minRatingsForUserStats,
      minPicksForPickerStats,
    )
    : null;

  return {
    bestFilm: filmByAvg && { label: filmByAvg.title, value: filmByAvg.avg, img: filmByAvg.poster ?? null },
    worstFilm: filmByMinAvg && { label: filmByMinAvg.title, value: filmByMinAvg.avg, img: filmByMinAvg.poster ?? null },
    mostVotedFilm: filmByVotes && { label: filmByVotes.title, count: filmByVotes.numVotes, img: filmByVotes.poster ?? null },
    mostDivisiveFilm: filmByStd && { label: filmByStd.title, std: filmByStd.std ?? undefined, img: filmByStd.poster ?? null },

    oldestFilm: filmByYearMin && { label: filmByYearMin.title, year: filmByYearMin.year, img: filmByYearMin.poster ?? null },
    newestFilm: filmByYearMax && { label: filmByYearMax.title, year: filmByYearMax.year, img: filmByYearMax.poster ?? null },

    longestFilm: filmByRuntimeMax && { label: filmByRuntimeMax.title, minutes: filmByRuntimeMax.runtime as number, img: filmByRuntimeMax.poster ?? null },
    shortestFilm: filmByRuntimeMin && { label: filmByRuntimeMin.title, minutes: filmByRuntimeMin.runtime as number, img: filmByRuntimeMin.poster ?? null },

    yourFavFilm: yourBest && { label: yourBest.title, value: yourBest.score },

    mostPresence,
    mostPicks,
    highestAvgReceived,
    lowestAvgReceived,
    mostTensReceived,
    mostOnesReceived,

    mostGenerousSelf: mostGenerousSelf && { label: mostGenerousSelf[0], gap: mostGenerousSelf[1] },
    mostCriticalSelf: mostCriticalSelf && { label: mostCriticalSelf[0], gap: mostCriticalSelf[1] },

    longestPicker: longestPickerAvg && { label: longestPickerAvg.label, minutes: longestPickerAvg.value },
    shortestPicker: shortestPickerAvg && { label: shortestPickerAvg.label, minutes: shortestPickerAvg.value },

    topVoter,

    nightMostParticipants: nightMostParticipants && { label: nightMostParticipants.title, count: nightMostParticipants.numVotes, img: nightMostParticipants.poster ?? null },
    nightLeastParticipants:
      nightLeastParticipants && {
        label: nightLeastParticipants.title,
        count: nightLeastParticipants.numVotes,
        img: nightLeastParticipants.poster ?? null,
      },
    nightHighestAvg: nightHighestAvg && { label: nightHighestAvg.title, value: nightHighestAvg.avg, img: nightHighestAvg.poster ?? null },
    nightLowestAvg: nightLowestAvg && { label: nightLowestAvg.title, value: nightLowestAvg.avg, img: nightLowestAvg.poster ?? null },
    recordNight: recordNight && { label: recordNight.title, value: recordNight.avg, img: recordNight.poster ?? null },
    firstNight: firstNight && { label: firstNight.title, date: firstNight.date ? toShortDate(firstNight.date) : undefined, img: firstNight.poster ?? null },

    mrConsistency: mrConsistency && { label: mrConsistency[0], std: Math.sqrt(mrConsistency[1] as number) },
    mrGenerous: mrGenerous && { label: mrGenerous[0], value: mrGenerous[1] },
    mrCritic: mrCritic && { label: mrCritic[0], value: mrCritic[1] },

    underdog: underdog && { label: underdog.title, imdb: underdog.imdb!, avg: underdog.avg, img: underdog.poster ?? null },
    overrated: overrated && { label: overrated.title, imdb: overrated.imdb!, avg: overrated.avg, img: overrated.poster ?? null },

    top3Films,
    top3Pickers: pickerAvgArr,

    currentYear,
    yearly,
  };
}

/* =========================================
   Export default
========================================= */
export default Achievements;
