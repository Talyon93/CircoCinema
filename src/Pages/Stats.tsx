// Pages/Stats.tsx
import React from "react";
import { Timeline } from "../StatsKit/sections/Timeline";
import { Genres } from "../StatsKit/sections/Genres";
import { Leaderboards } from "../StatsKit/sections/Leaderboards";
import { PickerAverages } from "../StatsKit/sections/PickerAverages";
import { TopFlop } from "../StatsKit/sections/TopFlop";
import { GroupImdb } from "../StatsKit/sections/GroupImdb";
import { UserPanelClassic } from "../StatsKit/sections/UserPanelClassic/index";
import { ImdbDelta } from "../StatsKit/sections/ImdbDelta";
import { ScatterRuntimeSection } from "../StatsKit/sections/ScatterRuntimeSection";
import { SimilarityMatrixSection } from "../StatsKit/sections/SimilarityMatrixSection";
import { DistributionInsightSection } from "../StatsKit/sections/DistributionInsightSection";
import { Achievements } from "../StatsKit/sections/Achievements";
import { tmdbPersonDetails } from "../TMDBHelper";

import { avgOf, pearson } from "../Utils/math";
import { refScoreFor } from "../Utils/refScore";

import { BarChart3, User, Trophy, CalendarRange, Medal, Sparkles, Timer, Users, Crown, Clapperboard } from "lucide-react";
import ReactDOM from "react-dom";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

/* ===================== UI helpers (solo per l'hero) ===================== */
const cn = (...a: Array<string | false | null | undefined>) => a.filter(Boolean).join(" ");
const Glass = ({ className = "", children }: { className?: string; children: React.ReactNode }) => (
  <div className={cn("rounded-3xl border border-zinc-800/70 bg-zinc-950/70 ring-1 ring-black/5 shadow-[0_10px_30px_-15px_rgba(0,0,0,.7)] backdrop-blur", className)}>
    {children}
  </div>
);
function KPITile({
  label, value, sub, gradient = "from-sky-400/25 via-fuchsia-400/20 to-emerald-400/20",
}: { label: string; value: React.ReactNode; sub?: React.ReactNode; gradient?: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-zinc-800/70 bg-zinc-900/60 p-4">
      <div className={cn("pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full blur-2xl", `bg-gradient-to-br ${gradient}`)} />
      <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">{label}</div>
      <div className="mt-1 text-3xl font-extrabold tracking-tight text-zinc-50">{value}</div>
      {sub && <div className="mt-1 text-xs text-zinc-400">{sub}</div>}
    </div>
  );
}

/* ===================== Helpers locali ===================== */
function extractYear(v: any): number | null {
  const m = v?.movie ?? {};
  const candidates: Array<unknown> = [
    v?.year, m?.year, m?.releaseYear, m?.release_year, m?.release_date,
    m?.first_air_date, m?.air_date, m?.premiere_date, m?.date, m?.Year,
    m?.imdb?.year, m?.tmdb?.release_date,
  ];
  for (const c of candidates) {
    if (c == null) continue;
    if (typeof c === "number" && Number.isFinite(c)) {
      if (c >= 1888 && c <= 2100) return c;
      continue;
    }
    if (typeof c === "string") {
      const m = c.match(/(\d{4})/);
      if (m) {
        const y = Number(m[1]);
        if (y >= 1888 && y <= 2100) return y;
      }
    }
  }
  return null;
}

const tmdbImg = (p?: string | null, size: "w92" | "w154" | "w185" | "original" = "w154") =>
  p ? (p.startsWith("http") ? p : `https://image.tmdb.org/t/p/${size}${p}`) : null;

/** Sezione: distribuzione per anno/decade – SOLO barre con count>0 */
function YearsSection({
  years,
  decades,
}: {
  years: Array<{ year: number; count: number }>;
  decades: Array<{ decade: number; count: number }>;
}) {
  const [mode, setMode] = React.useState<"year" | "decade">("year");

  const data = mode === "year"
    ? years.filter(d => d.count > 0).map(d => ({ label: String(d.year), value: d.count }))
    : decades.filter(d => d.count > 0).map(d => ({ label: `${d.decade}s`, value: d.count }));

  const maxCount = data.reduce((m, d) => Math.max(m, d.value), 0);

  return (
    <div className="rounded-xl border border-zinc-700/60 bg-zinc-900/40 p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
          <CalendarRange className="h-4 w-4 opacity-70" />
          Distribution by {mode === "year" ? "year" : "decade"} of release
        </h3>
        <div className="flex gap-1 rounded-lg border border-zinc-700/60 p-1">
          <button
            className={`px-2 py-1 text-xs rounded-md ${mode === "year" ? "bg-zinc-700 text-white" : "text-zinc-300 hover:text-white"}`}
            onClick={() => setMode("year")}
          >
            Anni
          </button>
          <button
            className={`px-2 py-1 text-xs rounded-md ${mode === "decade" ? "bg-zinc-700 text-white" : "text-zinc-300 hover:text-white"}`}
            onClick={() => setMode("decade")}
          >
            Decadi
          </button>
        </div>
      </div>

      <div className="h-56 w-full">
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 16, left: 8 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: "#d4d4d8", fontSize: 10 }}
              interval={0}
              angle={-45}
              textAnchor="end"
              height={38}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fill: "#a1a1aa", fontSize: 10 }}
              width={24}
              domain={[0, Math.max(3, maxCount)]}
            />
            <Tooltip
              cursor={{ fill: "rgba(255,255,255,0.05)" }}
              contentStyle={{ background: "#0a0a0a", border: "1px solid #3f3f46", borderRadius: 8 }}
              labelStyle={{ color: "#fafafa" }}
              formatter={(v: any) => [v, "Count"]}
            />
            <Bar dataKey="value" radius={[4, 4, 0, 0]} fill="#60a5fa" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ===================== Component principale ===================== */
export function Stats({
  history,
  backfillRuntime,
  isLoading = false,
}: { history: any[]; backfillRuntime?: () => void; isLoading?: boolean }) {
  React.useEffect(() => {
    if (!backfillRuntime) return;
    const hasRt = history.some((h) => Number((h?.movie as any)?.runtime) > 0);
    if (!hasRt && !isLoading && history.length > 0) backfillRuntime();
  }, [history, isLoading, backfillRuntime]);

  // ===================== Aggregazioni =====================
  const givenMap = new Map<string, { sum: number; n: number; scores: number[] }>();
  const receivedMap = new Map<string, { sum: number; n: number }>();
  const genreCount = new Map<string, number>();
  const userGenreLikes = new Map<string, Map<string, { pos: number; tot: number }>>();
  const yearCount = new Map<number, number>();
  let totalMinutes = 0, totalMinutesKnown = 0;

  // --- People ---
  const directorCount = new Map<string, number>();
  const actorCount = new Map<string, number>();
  const directorFilms = new Map<string, Set<string>>();
  const actorFilms = new Map<string, Set<string>>();
  const directorExtra = new Map<string, { profile_path?: string | null; personId?: number | null }>();
  const actorExtra = new Map<string, { profile_path?: string | null }>();

  type MovieStat = {
    id: any;
    title: string;
    avg: number;
    votes: number;
    date: number;
    picked_by?: string;
    runtime?: number;
    ref?: number;
    scores?: number[];
  };

  const movieStats: MovieStat[] = [];
  const timelineMain: Array<{ t: number; avg: number; title?: string; label?: string }> = [];
  const timelineDelta: Array<{ t: number; val: number; title?: string; label?: string }> = [];
  const beeswarmValues: Array<{ score: number; key: string }> = [];

  for (const v of history) {
    const ratings = (v?.ratings || {}) as Record<string, number>;
    const entries = Object.entries(ratings);

    for (const [user, scoreRaw] of entries) {
      const score = Number(scoreRaw);
      const m = givenMap.get(user) || { sum: 0, n: 0, scores: [] };
      m.sum += score; m.n += 1; m.scores.push(score); givenMap.set(user, m);
      beeswarmValues.push({ score, key: `${v.id}:${user}` });

      const arr = (v?.movie?.genres || []) as Array<{ name: string }>;
      const umap = userGenreLikes.get(user) || new Map<string, { pos: number; tot: number }>();
      arr.forEach((g) => {
        const name = g?.name?.trim(); if (!name) return;
        const prev = umap.get(name) || { pos: 0, tot: 0 };
        prev.tot += 1; if (score >= 8) prev.pos += 1;
        umap.set(name, prev);
      });
      userGenreLikes.set(user, umap);
    }

    const avg = avgOf(ratings);
    if (avg != null && v?.picked_by) {
      const r = receivedMap.get(v.picked_by) || { sum: 0, n: 0 };
      r.sum += avg; r.n += 1; receivedMap.set(v.picked_by, r);
    }

    // Generi
    (v?.movie?.genres || []).forEach((g: any) => {
      const name = g?.name?.trim();
      if (name) genreCount.set(name, (genreCount.get(name) || 0) + 1);
    });

    // People: prendi SOLO il primo regista (primary) + top_cast
    const dirs = Array.isArray(v?.movie?.directors) ? v.movie.directors : [];
    if (dirs[0]?.name) {
      const d0 = dirs[0];
      directorCount.set(d0.name, (directorCount.get(d0.name) || 0) + 1);
      const set = directorFilms.get(d0.name) || new Set<string>();
      if (v?.movie?.title) set.add(v.movie.title);
      directorFilms.set(d0.name, set);

      const ex = directorExtra.get(d0.name) || {};
      if (ex.profile_path == null && d0.profile_path != null) ex.profile_path = d0.profile_path;
      if (ex.personId == null && typeof d0.id === "number") ex.personId = d0.id;
      directorExtra.set(d0.name, ex);
    }

    (v?.movie?.top_cast || []).forEach((c: any) => {
      if (!c?.name) return;
      actorCount.set(c.name, (actorCount.get(c.name) || 0) + 1);
      const set = actorFilms.get(c.name) || new Set<string>();
      if (v?.movie?.title) set.add(v.movie.title);
      actorFilms.set(c.name, set);

      const ex = actorExtra.get(c.name) || {};
      if (ex.profile_path == null && c.profile_path != null) ex.profile_path = c.profile_path;
      actorExtra.set(c.name, ex);
    });

    // Year
    const year = extractYear(v);
    if (year != null) yearCount.set(year, (yearCount.get(year) || 0) + 1);

    // Runtime
    const rt = Number((v?.movie as any)?.runtime);
    if (!Number.isNaN(rt) && rt > 0) { totalMinutes += rt; totalMinutesKnown += 1; }

    // Aggregati per-film
    if (avg != null) {
      const t = v?.started_at ? new Date(v.started_at).getTime() : 0;
      const ref = refScoreFor(v);
      const scores = entries.map(([, s]) => Number(s)).filter((x) => Number.isFinite(x));
      const stat: MovieStat = {
        id: v.id,
        title: v?.movie?.title || "Untitled",
        avg,
        votes: entries.length,
        date: t,
        picked_by: v?.picked_by,
        runtime: rt > 0 ? rt : undefined,
        ref: ref ?? undefined,
        scores,
      };
      movieStats.push(stat);
      if (t) {
        timelineMain.push({ t, avg, title: stat.title, label: new Date(t).toLocaleDateString() });
        if (ref != null) timelineDelta.push({ t, val: avg - ref, title: stat.title, label: new Date(t).toLocaleDateString() });
      }
    }
  }

  const givenArr = Array.from(givenMap, ([user, { sum, n, scores }]) => ({ user, avg: sum / Math.max(1, n), count: n, scores }))
    .sort((a, b) => b.count - a.count || a.user.localeCompare(b.user));
  const receivedArr = Array.from(receivedMap, ([user, { sum, n }]) => ({ user, avg: sum / Math.max(1, n), count: n }))
    .sort((a, b) => b.avg - a.avg || b.count - a.count);
  const genresArr = Array.from(genreCount, ([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  // === People arrays ===
  type PeopleItem = { name: string; count: number; films: string[]; image: string | null; personId?: number | null };

  const directorsArr: PeopleItem[] = Array.from(directorCount, ([name, count]) => {
    const ex = directorExtra.get(name) || {};
    return {
      name,
      count,
      films: Array.from(directorFilms.get(name) || []),
      image: tmdbImg(ex.profile_path, "w154"),
      personId: ex.personId ?? null,
    };
  }).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  const actorsArr: PeopleItem[] = Array.from(actorCount, ([name, count]) => {
    const ex = actorExtra.get(name) || {};
    return {
      name,
      count,
      films: Array.from(actorFilms.get(name) || []),
      image: tmdbImg(ex.profile_path, "w154"),
    };
  }).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  const [directorPhotoMap, setDirectorPhotoMap] = React.useState<Record<string, string | null>>({});
  React.useEffect(() => {
    let abort = false;
    (async () => {
      const missing = directorsArr.filter(d => !d.image && d.personId).slice(0, 24);
      if (!missing.length) return;
      const out: Record<string, string | null> = {};
      for (const d of missing) {
        try {
          const det = await tmdbPersonDetails(d.personId as number);
          if (abort) return;
          out[d.name] = tmdbImg(det?.profile_path, "w154");
          await new Promise(r => setTimeout(r, 120)); // rate-limit soft
        } catch {
          out[d.name] = null;
        }
      }
      if (!abort) setDirectorPhotoMap(prev => ({ ...prev, ...out }));
    })();
    return () => { abort = true; };
  }, [directorsArr.map(d => d.personId).join(",")]);


  // Years + Decades
  const yearsArr = Array.from(yearCount, ([year, count]) => ({ year, count })).sort((a, b) => a.year - b.year);
  const decadesArr = React.useMemo(() => {
    const map = new Map<number, number>();
    for (const { year, count } of yearsArr) {
      const d = Math.floor(year / 10) * 10;
      map.set(d, (map.get(d) || 0) + count);
    }
    return Array.from(map, ([decade, count]) => ({ decade, count })).sort((a, b) => a.decade - b.decade);
  }, [yearsArr]);

  const bestMovies = movieStats.slice().sort((a, b) => b.avg - a.avg || b.votes - a.votes).slice(0, 5);
  const worstMovies = movieStats.slice().sort((a, b) => a.avg - b.avg || b.votes - a.votes).slice(0, 5);
  const minutesLabel = totalMinutesKnown > 0 ? `${totalMinutes} min · ${totalMinutesKnown} film` : isLoading ? "Fetching runtimes…" : "—";

  const userOptions = Array.from(new Set([...givenArr.map(x => x.user), ...receivedArr.map(x => x.user)])).sort((a, b) => a.localeCompare(b));
  const [selectedUser, setSelectedUser] = React.useState<string | null>(userOptions[0] || null);
  React.useEffect(() => { if (selectedUser && userOptions.includes(selectedUser)) return; setSelectedUser(userOptions[0] || null); }, [history.length]);

  const timelineSorted = React.useMemo(() => timelineMain.slice().sort((a, b) => a.t - b.t), [history.length]);
  const deltaSorted = React.useMemo(() => timelineDelta.slice().sort((a, b) => a.t - b.t), [history.length]);

  // Similarità
  const users = userOptions;
  const movieMap: Map<any, Map<string, number>> = new Map();
  for (const v of history) {
    const r = v?.ratings || {};
    const mm = new Map<string, number>();
    for (const [u, s] of Object.entries(r)) mm.set(u, Number(s));
    movieMap.set(v.id, mm);
  }
  const cells: Array<{ i: number; j: number; corr: number; n: number }> = [];
  for (let i = 0; i < users.length; i++) {
    for (let j = 0; j < users.length; j++) {
      const A: number[] = [], B: number[] = [];
      for (const mm of movieMap.values()) {
        if (mm.has(users[i]) && mm.has(users[j])) { A.push(mm.get(users[i])!); B.push(mm.get(users[j])!); }
      }
      const n = A.length;
      const corr = n >= 2 ? pearson(A, B) : 0;
      cells.push({ i, j, corr, n });
    }
  }
  const userOrder = users.map((u, i) => ({
    u, i,
    avg: cells.filter(c => c.i === i && c.i !== c.j).map(c => c.corr).reduce((a, b) => a + b, 0) / Math.max(1, users.length - 1)
  })).sort((a, b) => b.avg - a.avg).map(x => x.u);
  const orderIndex = new Map(userOrder.map((u, i) => [u, i]));
  const cellsOrdered = cells.map(c => ({ i: orderIndex.get(users[c.i])!, j: orderIndex.get(users[c.j])!, corr: c.corr, n: c.n }));
  const usersOrdered = userOrder;

  // Group vs IMDb
  const groupRows: Array<{ id: any; title: string; avg: number; ref: number; diff: number }> = [];
  for (const v of history) {
    const a = avgOf(v?.ratings); const ref = refScoreFor(v);
    if (a == null || ref == null) continue;
    groupRows.push({ id: v.id, title: v?.movie?.title || "Untitled", avg: a, ref, diff: Math.abs(a - ref) });
  }
  const groupClosest = groupRows.slice().sort((a, b) => a.diff - b.diff).slice(0, 5);
  const groupFarthest = groupRows.slice().sort((a, b) => b.diff - a.diff).slice(0, 5);

  // Achievements
  const weekMs = 7 * 24 * 3600 * 1000;
  const sortedByTime = history.slice().filter(v => v.started_at).sort((a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime());
  const buckets = new Map<number, number[]>();
  for (const v of sortedByTime) {
    const t = new Date(v.started_at).getTime();
    const w = Math.floor(t / weekMs) * weekMs;
    const a = avgOf(v.ratings); if (a == null) continue;
    const arr = buckets.get(w) || []; arr.push(a); buckets.set(w, arr);
  }
  const weeklyAvg = Array.from(buckets, ([w, arr]) => ({ w, avg: (arr.reduce((x, y) => x + y, 0) / arr.length) })).sort((a, b) => a.w - b.w);
  const milestones: string[] = [];
  if (history.length >= 50) milestones.push("🎉 50° film");
  if (history.length >= 100) milestones.push("🏆 100° film");

  // === Dati per HERO ===
  const participants = givenMap.size;
  const distinctGenres = genresArr.length;
  const totalVotes = history.reduce((acc, v) => acc + Object.keys(v?.ratings || {}).length, 0);

  // ===================== TABS =====================
  const [tab, setTab] = React.useState<"general" | "personal" | "people" | "achievements">("general");

  // --- People UI (sottotab Directors/Actors) ---

  function Avatar({ name, image, size = 56 }: { name: string; image: string | null; size?: number }) {
    const initials = name.split(/\s+/).slice(0, 2).map(s => s[0]).join("").toUpperCase();
    return image ? (
      <img src={image} alt={name} className="rounded-full object-cover" style={{ width: size, height: size }} loading="lazy" />
    ) : (
      <div className="rounded-full bg-gradient-to-br from-fuchsia-500 to-cyan-400 text-zinc-900 font-bold grid place-items-center"
        style={{ width: size, height: size }}>
        {initials}
      </div>
    );
  }

  function RowFilmsTooltip({
    anchorRef,
    films,
    max = 10,
    open,
    onClose,
  }: {
    anchorRef: React.RefObject<HTMLDivElement>;
    films: string[];
    max?: number;
    open: boolean;
    onClose: () => void;
  }) {
    const [pos, setPos] = React.useState<{ left: number; top: number } | null>(null);

    React.useEffect(() => {
      if (!open || !anchorRef.current) return;
      const r = anchorRef.current.getBoundingClientRect();
      // centro orizzontale della row; 8px sotto
      setPos({ left: r.left + r.width / 2, top: r.bottom + 8 });

      const close = () => onClose();
      window.addEventListener("scroll", close, true);
      window.addEventListener("resize", close);
      return () => {
        window.removeEventListener("scroll", close, true);
        window.removeEventListener("resize", close);
      };
    }, [open, anchorRef, onClose]);

    if (!open || !pos || films.length === 0) return null;

    const shown = films.slice(0, max);
    const more = Math.max(0, films.length - shown.length);

    return ReactDOM.createPortal(
      <div
        className="fixed z-[9999]"
        style={{ left: pos.left, top: pos.top, transform: "translateX(-50%)" }}
        onMouseLeave={onClose}
      >
        <div className="mx-auto h-2 w-2 -translate-y-1 rotate-45 border-l border-t border-zinc-700 bg-zinc-900" />
        <div className="rounded-xl border border-zinc-700 bg-zinc-900/95 px-3 py-2 shadow-2xl backdrop-blur-md">
          <ul className="space-y-1 text-xs leading-5 text-zinc-200">
            {shown.map((t, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-[6px] inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-zinc-400/80" />
                <span className="truncate max-w-[320px]">{t}</span>
              </li>
            ))}
          </ul>
          {more > 0 && (
            <div className="mt-1.5 text-[11px] text-zinc-400">+{more} more</div>
          )}
        </div>
      </div>,
      document.body
    );
  }


function PeopleSection() {
  const [peopleTab, setPeopleTab] = React.useState<"directors" | "actors">("directors");
  const baseItems = peopleTab === "directors" ? directorsArr : actorsArr;
  const items = baseItems.map(it =>
    peopleTab === "directors" ? { ...it, image: directorPhotoMap[it.name] ?? it.image } : it
  );
  const total = items.reduce((a, b) => a + b.count, 0);
  const top3 = items.slice(0, 3);
  const rest = items.slice(3);

  const Badge = ({ c, i }: { c: number; i: 1 | 2 | 3 }) => (
    <span
      className={`ml-2 rounded-full px-1.5 py-0.5 text-[11px] border ${
        i === 1
          ? "border-yellow-400/40 text-yellow-300"
          : i === 2
          ? "border-zinc-300/40 text-zinc-200"
          : "border-amber-500/40 text-amber-400"
      }`}
    >
      {c}
    </span>
  );

  // Tooltip compatto per il podio (nessun hook qui)
  function HoverFilms({ films, max = 10 }: { films: string[]; max?: number }) {
    if (!films?.length) return null;
    const shown = films.slice(0, max);
    const more = Math.max(0, films.length - shown.length);

    return (
      <div
        className={[
          "pointer-events-none absolute left-1/2 top-full z-20 hidden -translate-x-1/2 pt-2 group-hover:block",
          "opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0",
          "transition-all duration-150 ease-out",
        ].join(" ")}
        aria-hidden="true"
      >
        <div className="mx-auto h-2 w-2 rotate-45 border-l border-t border-zinc-700 bg-zinc-900"></div>
        <div className="pointer-events-none max-w-[320px] rounded-xl border border-zinc-700 bg-zinc-900/95 px-3 py-2 shadow-2xl backdrop-blur-md">
          <ul className="space-y-1 text-xs leading-5 text-zinc-200">
            {shown.map((t, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-[6px] inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-zinc-400/80" />
                <span className="truncate">{t}</span>
              </li>
            ))}
          </ul>
          {more > 0 && <div className="mt-1.5 text-[11px] text-zinc-400">+{more} more</div>}
        </div>
      </div>
    );
  }

  // Riga lista: qui è ok usare hook perché è un componente separato
  type RowItem = { name: string; count: number; films: string[]; image: string | null };
  function PeopleRow({
    item,
    index,
    maxCount,
  }: {
    item: RowItem;
    index: number;
    maxCount: number;
  }) {
    const rowRef = React.useRef<HTMLDivElement>(null);
    const [open, setOpen] = React.useState(false);

    const pct = maxCount ? Math.round((item.count / maxCount) * 100) : 0;
    const initials = item.name
      .split(/\s+/)
      .slice(0, 2)
      .map((s) => s[0])
      .join("")
      .toUpperCase();

    return (
      <div
        ref={rowRef}
        className="group relative flex items-center gap-3 px-3 py-2.5"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      >
        <div className="w-6 text-right text-xs text-zinc-500">{index + 4}</div>

        {item.image ? (
          <img
            src={item.image}
            alt={item.name}
            className="h-9 w-9 rounded-full object-cover ring-1 ring-white/10"
            loading="lazy"
          />
        ) : (
          <div className="grid h-9 w-9 place-items-center rounded-full bg-zinc-800 text-[11px] text-zinc-200">
            {initials}
          </div>
        )}

        <div className="flex-1">
          <div className="text-sm text-zinc-100">{item.name}</div>
          <div className="mt-1 h-1.5 w-full rounded-full bg-zinc-800">
            <div
              className="h-1.5 rounded-full bg-gradient-to-r from-sky-400 to-indigo-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        <div className="ml-2 text-xs text-zinc-400">{item.count}</div>

        {/* Tooltip in portal: non viene tagliato dallo scroll container */}
        <RowFilmsTooltip anchorRef={rowRef} films={item.films || []} max={10} open={open} onClose={() => setOpen(false)} />
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-zinc-700/60 bg-zinc-900/40 p-4 md:p-5 space-y-4">
      {/* Tabs */}
      <div className="flex items-center gap-2" role="tablist" aria-label="People tabs">
        <Users className="h-5 w-5 opacity-80" />
        <div className="relative inline-flex items-center rounded-lg bg-zinc-800/70 p-1">
          <span
            aria-hidden="true"
            className="absolute inset-y-1 left-1 w-1/2 rounded-md bg-zinc-100 transition-transform duration-200"
            style={{ transform: peopleTab === "actors" ? "translateX(100%)" : "translateX(0%)" }}
          />
          <button
            role="tab"
            aria-selected={peopleTab === "directors"}
            onClick={() => setPeopleTab("directors")}
            className={`relative z-10 px-3 py-1.5 text-sm font-medium rounded-md ${
              peopleTab === "directors" ? "text-zinc-900" : "text-zinc-300 hover:text-white"
            }`}
          >
            Directors
          </button>
          <button
            role="tab"
            aria-selected={peopleTab === "actors"}
            onClick={() => setPeopleTab("actors")}
            className={`relative z-10 px-3 py-1.5 text-sm font-medium rounded-md ${
              peopleTab === "actors" ? "text-zinc-900" : "text-zinc-300 hover:text-white"
            }`}
          >
            Actors
          </button>
        </div>

        <div className="ml-auto text-xs text-zinc-400">
          <span className="inline-flex items-center gap-1">
            <Clapperboard className="h-4 w-4" /> {total} appearances
          </span>
        </div>
      </div>

{/* Podio */}
{top3.length > 0 && (
  <div
    className="grid grid-cols-3 gap-3 md:gap-4 items-end"
    role="list"
    aria-label="Winners podium"
  >
    {top3.map((p, idx) => {
      const initials = p.name.split(/\s+/).slice(0, 2).map(s => s[0]).join("").toUpperCase();

      // ordine visivo: 2°, 1°, 3°
      const colOrder = idx === 0 ? 1 : idx === 1 ? 0 : 2;
      const stepH   = idx === 0 ? "h-24 md:h-28" : idx === 1 ? "h-16 md:h-20" : "h-14 md:h-16";
      const ring    = idx === 0 ? "from-yellow-300/30 to-amber-500/20" : idx === 1 ? "from-zinc-300/30 to-zinc-500/20" : "from-rose-400/30 to-pink-500/20";
      const crown   = idx === 0 ? "text-yellow-400" : idx === 1 ? "text-zinc-200" : "text-amber-600";
      const medalBg = idx === 0
        ? "bg-gradient-to-r from-yellow-300 to-amber-500 text-zinc-900"
        : idx === 1
        ? "bg-gradient-to-r from-zinc-300 to-zinc-500 text-zinc-900"
        : "bg-gradient-to-r from-rose-400 to-pink-500 text-zinc-900";
      const place = idx === 0 ? "1st" : idx === 1 ? "2nd" : "3rd";

      return (
        <div key={p.name} role="listitem" className={`order-${colOrder} relative flex flex-col items-center`} aria-label={`${place}: ${p.name}`}>
          {/* Card */}
          <div
            className={[
              "group relative flex flex-col items-center overflow-visible rounded-2xl",
              "border border-zinc-700/60 bg-zinc-900/70 px-4 pt-4 pb-3",
              idx === 0 ? "z-10 scale-105 shadow-xl" : "shadow-md",
            ].join(" ")}
            style={{ transformOrigin: "bottom center" }}
          >
            {/* glow ring */}
            <div className={`pointer-events-none absolute -inset-0.5 rounded-2xl bg-gradient-to-br ${ring} blur-xl opacity-60`} />

            {/* avatar + crown */}
            <div className="relative mb-2">
              {p.image ? (
                <img src={p.image} alt={p.name} className="h-16 w-16 rounded-full object-cover ring-2 ring-white/10" loading="lazy" />
              ) : (
                <div className="grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-fuchsia-500 to-cyan-400 text-zinc-900 font-bold">
                  {initials}
                </div>
              )}
              <span className="absolute -top-2 -right-2 grid h-7 w-7 place-items-center rounded-full bg-zinc-900 border border-zinc-700">
                <Crown className={`h-4 w-4 ${crown}`} />
              </span>
            </div>

            {/* name + count */}
            <div className="text-sm font-semibold text-white text-center">{p.name}</div>
            <div className="text-[11px] text-zinc-400">{p.count} appearances</div>

            {/* barra decorativa */}
            <div className="mt-3 h-1.5 w-24 rounded-full bg-zinc-800">
              <div className="h-1.5 w-full rounded-full bg-gradient-to-r from-sky-400 to-indigo-500" />
            </div>

            {/* tooltip (film) */}
            <div className="relative mt-1">
              <HoverFilms films={p.films} />
            </div>
          </div>

          {/* Basamento “podio” con badge */}
          <div
            className={[
              "mt-2 w-full rounded-xl border border-zinc-700/60 bg-zinc-900/80 flex items-center justify-center",
              stepH,
            ].join(" ")}
          >
            <span
              className={[
                "rounded-full px-2 py-0.5 text-[11px] font-semibold shadow",
                medalBg,
              ].join(" ")}
            >
              {place}
            </span>
          </div>
        </div>
      );
    })}
  </div>
)}

      {/* Lista */}
      {rest.length > 0 && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/40">
          <div className="relative max-h-72 overflow-y-auto divide-y divide-zinc-800">
            {rest.map((it, idx) => (
              <PeopleRow key={it.name} item={it} index={idx} maxCount={rest[0]?.count || it.count} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

  return (
    <div className="space-y-6">
      {/* HERO */}
      <Glass className="relative px-5 py-6">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-1 text-[11px] uppercase tracking-wider text-sky-300">
            <Sparkles className="h-3.5 w-3.5" />
            Live Circo Cinema stats
          </div>
          <h1 className="mt-2 text-3xl font-extrabold leading-tight text-zinc-50">Dashboard</h1>
          <p className="mt-1 text-sm text-zinc-400">Ratings, trends, and discoveries from your screenings.</p>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <KPITile label="Total movies" value={history.length} gradient="from-sky-400/25 via-sky-300/15 to-transparent" />
          <KPITile
            label="Minutes watched"
            value={<>{totalMinutesKnown ? `${totalMinutes}` : "—"} <span className="text-base font-semibold">min</span></>}
            sub={totalMinutesKnown ? `${totalMinutesKnown} film` : undefined}
            gradient="from-rose-400/25 via-fuchsia-300/15 to-transparent"
          />
          <KPITile label="Distinct genres" value={distinctGenres} gradient="from-emerald-400/25 via-emerald-300/15 to-transparent" />
          <KPITile label="Total votes" value={totalVotes} gradient="from-indigo-400/25 via-indigo-300/15 to-transparent" />
          <KPITile label="Participants" value={participants} gradient="from-amber-400/25 via-amber-300/15 to-transparent" />
        </div>
      </Glass>

      {/* TABS */}
      <div className="flex justify-center">
        <div
          role="tablist"
          aria-label="Stats tabs"
          className="flex items-center gap-2 rounded-2xl border border-zinc-700/70 bg-zinc-900/40 px-2 py-2 shadow-inner"
        >
          <button
            role="tab"
            aria-selected={tab === "general"}
            onClick={() => setTab("general")}
            className={[
              "group inline-flex items-center gap-2 rounded-xl px-3 py-2 transition",
              tab === "general"
                ? "bg-zinc-800/80 border border-zinc-600 text-white shadow-sm"
                : "text-zinc-300 hover:text-white hover:bg-zinc-800/40 border border-transparent",
            ].join(" ")}
          >
            <BarChart3 className="h-4 w-4 opacity-80" />
            <span className="text-sm font-medium">General stats</span>
          </button>

          <button
            role="tab"
            aria-selected={tab === "personal"}
            onClick={() => setTab("personal")}
            className={[
              "group inline-flex items-center gap-2 rounded-xl px-3 py-2 transition",
              tab === "personal"
                ? "bg-zinc-800/80 border border-zinc-600 text-white shadow-sm"
                : "text-zinc-300 hover:text-white hover:bg-zinc-800/40 border border-transparent",
            ].join(" ")}
          >
            <User className="h-4 w-4 opacity-80" />
            <span className="text-sm font-medium">Personal stats</span>
          </button>

          <button
            role="tab"
            aria-selected={tab === "people"}
            onClick={() => setTab("people")}
            className={[
              "group inline-flex items-center gap-2 rounded-xl px-3 py-2 transition",
              tab === "people"
                ? "bg-zinc-800/80 border border-zinc-600 text-white shadow-sm"
                : "text-zinc-300 hover:text-white hover:bg-zinc-800/40 border border-transparent",
            ].join(" ")}
          >
            <Users className="h-4 w-4 opacity-80" />
            <span className="text-sm font-medium">People</span>
          </button>

          <button
            role="tab"
            aria-selected={tab === "achievements"}
            onClick={() => setTab("achievements")}
            className={[
              "group inline-flex items-center gap-2 rounded-xl px-3 py-2 transition",
              tab === "achievements"
                ? "bg-zinc-800/80 border border-zinc-600 text-white shadow-sm"
                : "text-zinc-300 hover:text-white hover:bg-zinc-800/40 border border-transparent",
            ].join(" ")}
          >
            <Trophy className="h-4 w-4 opacity-80" />
            <span className="text-sm font-medium">Achievements</span>
          </button>
        </div>
      </div>

      {/* CONTENUTO */}
      {tab === "general" && (
        <div className="space-y-6">
          <section className="rounded-xl border border-zinc-700/60 bg-zinc-900/40 p-4 space-y-3">
            <h2 className="flex items-center gap-2 text-base font-semibold text-zinc-100">
              <CalendarRange className="h-5 w-5 opacity-80" />
              Trend over time
            </h2>
            <Timeline data={timelineSorted} />
            <ImdbDelta data={deltaSorted} />
          </section>

          <section className="rounded-xl border border-zinc-700/60 bg-zinc-900/40 p-4 space-y-3">
            <h2 className="flex items-center gap-2 text-base font-semibold text-zinc-100">
              <Medal className="h-5 w-5 opacity-80" />
              Distributions & similarity
            </h2>
            <ScatterRuntimeSection
              points={movieStats
                .filter(m => Number.isFinite(m.runtime) && Number.isFinite(m.avg))
                .map(m => ({ x: m.runtime as number, y: m.avg, size: m.votes, title: m.title }))}
            />
            <div className="grid gap-4 lg:grid-cols-2">
              <DistributionInsightSection values={beeswarmValues.map(v => v.score)} />
              <SimilarityMatrixSection users={[...new Set(usersOrdered)]} cells={cellsOrdered} />
            </div>
          </section>

          <section className="rounded-xl border border-zinc-700/60 bg-zinc-900/40 p-4 space-y-3">
            <Genres items={genresArr} isLoading={isLoading} />
            <YearsSection years={yearsArr} decades={decadesArr} />
          </section>

          <section className="rounded-xl border border-zinc-700/60 bg-zinc-900/40 p-4 space-y-3">
            <Leaderboards givenArr={givenArr} isLoading={isLoading} />
            <PickerAverages items={receivedArr} isLoading={isLoading} />
            <TopFlop bestMovies={bestMovies} worstMovies={worstMovies} isLoading={isLoading} />
            <GroupImdb closest={groupClosest} farthest={groupFarthest} />
          </section>
        </div>
      )}

      {tab === "personal" && selectedUser && (
        <div className="grid gap-5">
          <UserPanelClassic
            history={history}
            givenArr={givenArr}
            receivedArr={receivedArr}
            userGenreLikes={userGenreLikes}
            selectedUser={selectedUser}
            onSelectUser={(u) => setSelectedUser(u)}
            userOptions={Array.from(new Set([...givenArr.map(x => x.user), ...receivedArr.map(x => x.user)])).sort((a, b) => a.localeCompare(b))}
          />
        </div>
      )}

      {tab === "people" && <PeopleSection />}

      {tab === "achievements" && (
        <Achievements
          bestStreak={weeklyAvg.filter(w => w.avg >= 7.5).length ? 1 : 0}
          streakThreshold={7.5}
          recordNight={movieStats.length ? { title: movieStats.reduce((b, m) => (m.avg > b.avg ? m : b), movieStats[0]).title, avg: movieStats.reduce((b, m) => (m.avg > b.avg ? m : b), movieStats[0]).avg } : null}
          milestones={milestones}
        />
      )}

      {/* mobile dock */}
      <div className="fixed inset-x-3 bottom-3 z-20 block md:hidden">
        <div className="rounded-2xl border border-zinc-800/70 bg-zinc-950/80 px-3 py-2 text-[11px] text-zinc-300 shadow-lg backdrop-blur">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1">
              <BarChart3 className="h-3.5 w-3.5 opacity-80" /> {history.length} movies
            </span>
            <span className="inline-flex items-center gap-1">
              <Timer className="h-3.5 w-3.5 opacity-80" /> {minutesLabel}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
