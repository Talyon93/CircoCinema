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
  date?: string | null;
};

function normalizeViewing(v: any): NormViewing | null {
  if (!v) return null;
  const title = v?.movie?.title ?? v?.title ?? "(sconosciuto)";
  const year = v?.movie?.year ?? v?.year ?? undefined;
  const picker = v?.picked_by ?? v?.picker ?? v?.owner ?? v?.added_by ?? null;
  const ratings: Record<string, number> = v?.ratings ?? v?.votes ?? {};
  const scores = Object.values(ratings).map(toNum).filter(isFiniteNum);

  const imdb = readImdb(v);
  const date = readDate(v);

  if (!scores.length) {
    return { title, year, picker, ratings: {}, numVotes: 0, avg: NaN, std: undefined, imdb, date };
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
function readDate(v: any): string | null {
  return v?.started_at ?? v?.date ?? v?.created_at ?? null;
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
function topLabelCount(counter: Record<string, number>) {
  const entries = Object.entries(counter);
  if (!entries.length) return null;
  const best = entries.reduce((a, b) => (b[1] > a[1] ? b : a));
  return { label: best[0], count: best[1] };
}
function topLabelAvg(buckets: Record<string, number[]>, mode: "max" | "min") {
  const entries = Object.entries(buckets).filter(([, arr]) => arr.length > 0);
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
   YEARLY — definita PRIMA, così è sempre disponibile
========================================= */
function computeYearly(items: NormViewing[], minVotesForUserStats: number) {
  if (!items.length) return null;
  const bestFilm = maxBy(items.filter(hasVotes), (v) => v.avg);

  const pickerAvg: Record<string, number[]> = {};
  const presence: Record<string, number> = {};

  for (const v of items) {
    Object.keys(v.ratings).forEach((u) => (presence[u] = (presence[u] ?? 0) + 1));
    if (v.picker && hasVotes(v)) (pickerAvg[v.picker] ??= []).push(v.avg);
  }

  const mvp = topLabelAvg(pickerAvg, "max");
  const mostPresence = topLabelCount(presence);

  return {
    bestFilm: bestFilm && { label: bestFilm.title, value: bestFilm.avg },
    mvpPicker: mvp,
    mostPresence,
  };
}

/* =========================================
   Calcolo “tuo film preferito” — usa SOLO current user/alias
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
    } catch {}
  }
  return "";
}

/* =========================================
   Props
========================================= */
type Props = {
  history?: any[];
  minVotesForUserStats?: number;
  autoLoad?: boolean;
  currentUser?: string;
  currentUserAliases?: string[];
};

/* =========================================
   Component
========================================= */
export function Achievements({
  history,
  minVotesForUserStats = 5,
  autoLoad = true,
  currentUser,
  currentUserAliases = [],
}: Props) {
  const [autoHistory, setAutoHistory] = React.useState<any[] | null>(null);
  const [lsMod, setLsMod] = React.useState<LSModule | null>(null);

  // Carica modulo localStorage (opzionale)
  React.useEffect(() => {
    loadLocalStorageModule().then(setLsMod);
  }, []);

  // Autoload (live -> localStorage)
  React.useEffect(() => {
    let mounted = true;
    if (!autoLoad) return;
    const hasIncoming = Array.isArray(history) && history.length > 0;
    if (hasIncoming) return;

    (async () => {
      // 1) LIVE
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
        // 2) Fallback: localStorage
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

  // Current user affidabile
  const effectiveUser = React.useMemo(() => {
    if (currentUser && String(currentUser).trim()) return currentUser.trim();
    const key = (lsMod?.K_USER as string) || "CN_USER";
    if (lsMod?.lsGetJSON && lsMod.K_USER) {
      try {
        const u = lsMod.lsGetJSON<string>(key, "");
        if (u && u.trim()) return u.trim();
      } catch {}
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
    () => computeHallOfFame(effectiveHistory, minVotesForUserStats, effectiveAliases),
    [effectiveHistory, minVotesForUserStats, effectiveAliases]
  );

  const nMin = minVotesForUserStats;

  return (
    <Card>
      <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold">
        <SparklesIcon className="h-5 w-5" />
        Hall of Fame
      </h3>

      {/* Podio */}
      <Section title="🥇 Podio" gridClassName="grid gap-3 sm:grid-cols-1">
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
          <Podium
            title="Top 3 film (media)"
            hint="I tre film con la media voti interna più alta (a parità di media, vince chi ha più voti)."
            items={(data.top3Films ?? []).map((f) => ({
              label: f.title,
              sub: `media ${formatScore(f.avg)} — ${f.numVotes} voti`,
            }))}
          />
          <Podium
            title="Top 3 picker (media ricevuta)"
            hint="I tre proponenti con la media più alta sui film scelti (considera tutte le loro proposte)."
            items={(data.top3Pickers ?? []).map((p) => ({
              label: p.picker,
              sub: `media ${formatScore(p.avg)} su ${p.count} film`,
            }))}
          />
        </div>
      </Section>

      {/* Film & Voti */}
      <Section title="🎬 Film & Voti">
        <Badge icon={TrophyIcon} color="amber" label="Miglior film" value={data.bestFilm?.label ?? "—"} sub={scoreSub(data.bestFilm?.value)} hint="Film con la media voti interna più alta." />
        <Badge icon={XCircleIcon} color="rose" label="Peggior film" value={data.worstFilm?.label ?? "—"} sub={scoreSub(data.worstFilm?.value)} hint="Film con la media voti interna più bassa." />
        <Badge icon={UsersIcon} color="indigo" label="Film più votato" value={data.mostVotedFilm?.label ?? "—"} sub={countSub(data.mostVotedFilm?.count, "voti")} hint="Film che ha ricevuto più voti in una serata (più presenze)." />
        <Badge icon={ChartBarIcon} color="fuchsia" label="Film più divisivo" value={data.mostDivisiveFilm?.label ?? "—"} sub={stdSub(data.mostDivisiveFilm?.std)} hint="Film con la deviazione standard più alta tra i voti (opinioni più distanti)." />
        <Badge icon={StarIcon} color="emerald" label="Film più amato da te" value={data.yourFavFilm?.label ?? "—"} sub={scoreSub(data.yourFavFilm?.value)} hint="Il film a cui TU hai dato il voto più alto (alias inclusi)." />
      </Section>

      {/* Persone & Presenze */}
      <Section title="👥 Persone & Presenze">
        <Badge icon={UsersIcon} color="sky" label="Più presenze" value={data.mostPresence?.label ?? "—"} sub={countSub(data.mostPresence?.count, "presenze")} hint="Chi ha partecipato e votato più volte in totale." />
        <Badge icon={BoltIcon} color="yellow" label="Più film proposti" value={data.mostPicks?.label ?? "—"} sub={countSub(data.mostPicks?.count, "film")} hint="Chi ha portato il maggior numero di film." />
        <Badge icon={ArrowTrendingUpIcon} color="green" label="Voti più alti ricevuti (picker)" value={data.highestAvgReceived?.label ?? "—"} sub={scoreSub(data.highestAvgReceived?.value, "media ricevuta")} hint="Media dei voti ottenuti dai film scelti dal proponente (più alto = meglio)." />
        <Badge icon={ArrowTrendingDownIcon} color="red" label="Voti più bassi ricevuti (picker)" value={data.lowestAvgReceived?.label ?? "—"} sub={scoreSub(data.lowestAvgReceived?.value, "media ricevuta")} hint="Media dei voti ottenuti dai film scelti dal proponente (più basso = peggio)." />
        <Badge icon={HeartIcon} color="pink" label='Record di "10" ricevuti' value={data.mostTensReceived?.label ?? "—"} sub={countSub(data.mostTensReceived?.count, "voti 10")} hint="Totale di 10 ricevuti dai film scelti da quel proponente (sommati su tutte le serate)." />
        <Badge icon={XCircleIcon} color="orange" label='Record di "1" ricevuti' value={data.mostOnesReceived?.label ?? "—"} sub={countSub(data.mostOnesReceived?.count, "voti 1")} hint="Totale di 1 ricevuti dai film scelti da quel proponente (sommati su tutte le serate)." />
        <Badge icon={Bars3CenterLeftIcon} color="slate" label="Top voter (più voti dati)" value={data.topVoter?.label ?? "—"} sub={countSub(data.topVoter?.count, "voti dati")} hint="La persona che ha espresso più voti complessivi (presenze attive)." />
      </Section>

      {/* Serate */}
      <Section title="🌙 Serate">
        <Badge icon={UsersIcon} color="cyan" label="Serata più partecipata" value={data.nightMostParticipants?.label ?? "—"} sub={countSub(data.nightMostParticipants?.count, "votanti")} hint="La serata con il maggior numero di votanti." />
        <Badge icon={ArrowTrendingUpIcon} color="lime" label="Serata con voti più alti" value={data.nightHighestAvg?.label ?? "—"} sub={scoreSub(data.nightHighestAvg?.value)} hint="La serata con la media dei voti più alta." />
        <Badge icon={ArrowTrendingDownIcon} color="violet" label="Serata con voti più bassi" value={data.nightLowestAvg?.label ?? "—"} sub={scoreSub(data.nightLowestAvg?.value)} hint="La serata con la media dei voti più bassa." />
        <Badge icon={AcademicCapIcon} color="slate" label="Prima serata" value={data.firstNight?.label ?? "—"} sub={data.firstNight?.date ?? undefined} hint="La prima serata registrata nello storico." />
        <Badge icon={FireIcon} color="red" label="Record Night" value={data.recordNight?.label ?? "—"} sub={scoreSub(data.recordNight?.value)} hint="La migliore media serata di sempre." />
      </Section>

      {/* Profili */}
      <Section title="🏅 Profili">
        <Badge icon={ClockIcon} color="teal" label="Mr. Consistency" value={data.mrConsistency?.label ?? "—"} sub={stdSub(data.mrConsistency?.std)} hint={`Utente con la minore variabilità nei voti dati (almeno ${nMin} voti).`} />
        <Badge icon={ArrowTrendingDownIcon} color="rose" label="Mr. Critico" value={data.mrCritic?.label ?? "—"} sub={scoreSub(data.mrCritic?.value, "media data")} hint={`Utente con la media dei voti più bassa tra quelli che hanno dato almeno ${nMin} voti.`} />
        <Badge icon={ArrowTrendingUpIcon} color="emerald" label="Mr. Generoso" value={data.mrGenerous?.label ?? "—"} sub={scoreSub(data.mrGenerous?.value, "media data")} hint={`Utente con la media dei voti più alta tra quelli che hanno dato almeno ${nMin} voti.`} />
      </Section>

      {/* Meta (IMDB) */}
      <Section title="🧪 Meta (se disponibili)">
        <Badge icon={ArrowTrendingUpIcon} color="green" label="Underdog" value={data.underdog?.label ?? "—"} sub={data.underdog ? `IMDb ${formatMaybe(data.underdog.imdb)} → ${formatScore(data.underdog.avg)}` : undefined} hint="Differenza più positiva: media interna molto più alta del voto IMDb." />
        <Badge icon={ArrowTrendingDownIcon} color="red" label="Overrated" value={data.overrated?.label ?? "—"} sub={data.overrated ? `IMDb ${formatMaybe(data.overrated.imdb)} → ${formatScore(data.overrated.avg)}` : undefined} hint="Differenza più negativa: IMDb alto ma media interna più bassa." />
      </Section>

      {/* Annuali */}
      {data.currentYear && data.yearly && (
        <Section title={`📅 ${data.currentYear}: Speciali dell'anno`}>
          <Badge icon={TrophyIcon} color="amber" label="Miglior film dell'anno" value={data.yearly.bestFilm?.label ?? "—"} sub={scoreSub(data.yearly.bestFilm?.value)} hint="Il film con la media più alta tra quelli visti nell'anno corrente." />
          <Badge icon={ArrowTrendingUpIcon} color="green" label="MVP dell'anno (media ricevuta)" value={data.yearly.mvpPicker?.label ?? "—"} sub={scoreSub(data.yearly.mvpPicker?.value)} hint="Il proponente con la media più alta sui film scelti durante l'anno." />
          <Badge icon={UsersIcon} color="sky" label="Più presenze nell'anno" value={data.yearly.mostPresence?.label ?? "—"} sub={countSub(data.yearly.mostPresence?.count, "presenze")} hint="Chi ha partecipato più volte nell'anno corrente." />
        </Section>
      )}
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

function Badge({
  icon: Icon,
  color,
  label,
  value,
  sub,
  hint,
}: {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  color:
    | "amber" | "rose" | "indigo" | "fuchsia" | "emerald" | "sky" | "yellow"
    | "green" | "red" | "orange" | "cyan" | "lime" | "violet" | "slate" | "teal" | "pink";
  label: string;
  value: string;
  sub?: string;
  /** Testo mostrato nel tooltip. */
  hint?: string;
}) {
  const cls = colorToCls(color);
  const titleText = hint ? (sub ? `${hint} • ${sub}` : hint) : sub ?? "";
  return (
    <div
      className={`relative flex items-center gap-3 rounded-2xl border px-3 py-2 ${cls.border} ${cls.bg}`}
      title={titleText}
    >
      <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${cls.chipBg} ${cls.text}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <div className="truncate text-sm font-medium">{label}</div>
        <div className="truncate text-xs text-zinc-300">
          <span className="font-semibold">{value}</span>
          {sub ? <span className="text-zinc-400"> — {sub}</span> : null}
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

function scoreSub(v?: number, label = "media") {
  return v == null ? undefined : `${label}: ${formatScore(v)}`;
}
function countSub(n?: number, label = "volte") {
  return n == null ? undefined : `${n} ${label}`;
}
function stdSub(std?: number) {
  return std == null ? undefined : `deviazione: ${formatMaybe(std, 2)}`;
}
function formatMaybe(v?: number, digits = 1) {
  return v == null || Number.isNaN(v) ? "—" : v.toFixed(digits);
}

/* =========================================
   Podio
========================================= */
function Podium({
  title,
  items,
  hint,
}: {
  title: string;
  items: { label: string; sub?: string }[];
  /** Tooltip della “i” in alto a destra */
  hint?: string;
}) {
  const top = (items ?? []).slice(0, 3);
  return (
    <div className="relative rounded-2xl border border-amber-500/30 bg-amber-500/5 p-3" title={hint}>
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-300">
        <TrophyIcon className="h-4 w-4" />
        {title}
      </div>
      <ol className="space-y-1">
        {top.map((it, i) => (
          <li key={i} className="flex items-center gap-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-500/10 text-sm font-bold text-amber-300">
              {i + 1}
            </span>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{it.label}</div>
              {it.sub && <div className="truncate text-xs text-zinc-400">{it.sub}</div>}
            </div>
          </li>
        ))}
        {!top.length && <div className="text-xs text-zinc-500">—</div>}
      </ol>

      {hint && <InfoBadge text={hint} />}
    </div>
  );
}

/* =========================================
   Core: computeHallOfFame
========================================= */
function computeHallOfFame(history: any[], minVotesForUserStats: number, userAliases: string[]) {
  const items = (history || []).map(normalizeViewing).filter(Boolean) as NormViewing[];

  // Film-level
  const filmByAvg = maxBy(items.filter(hasVotes), (v) => v.avg);
  const filmByMinAvg = minBy(items.filter(hasVotes), (v) => v.avg);
  const filmByVotes = maxBy(items, (v) => v.numVotes);
  const filmByStd = maxBy(items.filter((v) => v.std != null), (v) => v.std ?? -Infinity);

  // Tuo film preferito
  const yourBest = bestForCurrentUser(items, userAliases);

  // Presence & user stats
  const presenceCount: Record<string, number> = {};
  const userGiven: Record<string, number[]> = {};
  const pickerAvgReceived: Record<string, number[]> = {};
  const pickerTens: Record<string, number> = {};
  const pickerOnes: Record<string, number> = {};
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
      const ones = Object.values(v.ratings).filter((s) => s === 1).length;
      pickerTens[v.picker] = (pickerTens[v.picker] ?? 0) + tens;
      pickerOnes[v.picker] = (pickerOnes[v.picker] ?? 0) + ones;
    }
  }

  const mostPresence = topLabelCount(presenceCount);
  const topVoter = mostPresence ? { label: mostPresence.label, count: (userGiven[mostPresence.label] ?? []).length } : null;
  const mostPicks = topLabelCount(picksCount);
  const highestAvgReceived = topLabelAvg(pickerAvgReceived, "max");
  const lowestAvgReceived = topLabelAvg(pickerAvgReceived, "min");
  const mostTensReceived = topLabelCount(pickerTens);
  const mostOnesReceived = topLabelCount(pickerOnes);

  // Nights
  const nightMostParticipants = maxBy(items, (v) => v.numVotes);
  const nightHighestAvg = maxBy(items.filter(hasVotes), (v) => v.avg);
  const nightLowestAvg = minBy(items.filter(hasVotes), (v) => v.avg);
  const recordNight = nightHighestAvg;
  const firstNight = minBy(items.filter((v) => v.date), (v) => (v.date ? new Date(v.date).getTime() : Infinity));

  // Profili
  const userAvgs = mapValues(userGiven, avg);
  const eligibleAvgs = Object.entries(userAvgs).filter(([u]) => (userGiven[u] ?? []).length >= minVotesForUserStats);
  const mrGenerous = eligibleAvgs.length ? eligibleAvgs.reduce((a, b) => (b[1] > a[1] ? b : a)) : null;
  const mrCritic = eligibleAvgs.length ? eligibleAvgs.reduce((a, b) => (b[1] < a[1] ? b : a)) : null;

  const userVars = mapValues(userGiven, (arr) => (arr.length >= minVotesForUserStats ? variance(arr) : Infinity));
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
    .filter((x) => hasVotes(x))
    .sort((a, b) => b.avg - a.avg || b.numVotes - a.numVotes)
    .slice(0, 3)
    .map((x) => ({ title: x.title, avg: x.avg, numVotes: x.numVotes }));

  const pickerAvgArr = Object.entries(pickerAvgReceived)
    .map(([picker, arr]) => ({ picker, avg: arr.length ? avg(arr) : NaN, count: arr.length }))
    .filter((x) => Number.isFinite(x.avg) && x.count > 0)
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
    ? computeYearly(items.filter((it) => it.date && new Date(it.date!).getFullYear() === currentYear), minVotesForUserStats)
    : null;

  return {
    bestFilm: filmByAvg && { label: filmByAvg.title, value: filmByAvg.avg },
    worstFilm: filmByMinAvg && { label: filmByMinAvg.title, value: filmByMinAvg.avg },
    mostVotedFilm: filmByVotes && { label: filmByVotes.title, count: filmByVotes.numVotes },
    mostDivisiveFilm: filmByStd && { label: filmByStd.title, std: filmByStd.std ?? undefined },
    yourFavFilm: yourBest && { label: yourBest.title, value: yourBest.score },

    mostPresence,
    mostPicks,
    highestAvgReceived,
    lowestAvgReceived,
    mostTensReceived,
    mostOnesReceived,
    topVoter,

    nightMostParticipants: nightMostParticipants && { label: nightMostParticipants.title, count: nightMostParticipants.numVotes },
    nightHighestAvg: nightHighestAvg && { label: nightHighestAvg.title, value: nightHighestAvg.avg },
    nightLowestAvg: nightLowestAvg && { label: nightLowestAvg.title, value: nightLowestAvg.avg },
    recordNight: recordNight && { label: recordNight.title, value: recordNight.avg },
    firstNight: firstNight && { label: firstNight.title, date: firstNight.date ? toShortDate(firstNight.date) : undefined },

    mrConsistency: mrConsistency && { label: mrConsistency[0], std: Math.sqrt(mrConsistency[1] as number) },
    mrGenerous: mrGenerous && { label: mrGenerous[0], value: mrGenerous[1] },
    mrCritic: mrCritic && { label: mrCritic[0], value: mrCritic[1] },

    underdog: underdog && { label: underdog.title, imdb: underdog.imdb!, avg: underdog.avg },
    overrated: overrated && { label: overrated.title, imdb: overrated.imdb!, avg: overrated.avg },

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
