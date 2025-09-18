// Pages/Stats.tsx
import React from "react";
import { KpiRow } from "../StatsKit/sections/KpiRow";
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

import { avgOf, pearson } from "../Utils/math";
import { refScoreFor } from "../Utils/refScore";

import { BarChart3, User, Trophy, CalendarRange, Medal, Sparkles, Timer } from "lucide-react";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  AreaChart,
  Area,
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
function stddev(values: number[]): number {
  if (!values.length) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

// Estrazione anno ultra-tollerante
function extractYear(v: any): number | null {
  const m = v?.movie ?? {};
  const candidates: Array<unknown> = [
    v?.year,
    m?.year,
    m?.releaseYear,
    m?.release_year,
    m?.release_date,
    m?.first_air_date,
    m?.air_date,
    m?.premiere_date,
    m?.date,
    m?.Year,
    m?.imdb?.year,
    m?.tmdb?.release_date,
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

    (v?.movie?.genres || []).forEach((g: any) => {
      const name = g?.name?.trim();
      if (name) genreCount.set(name, (genreCount.get(name) || 0) + 1);
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

  // Achievements (come nel tuo file)
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
  const participants = givenMap.size; // utenti che hanno votato almeno una volta
  const sparkData = timelineSorted.map(d => ({ t: d.t, y: d.avg }));
  const distinctGenres = genresArr.length;
  const totalVotes = history.reduce((acc, v) => acc + Object.keys(v?.ratings || {}).length, 0);

  // ===================== TABS =====================
  const [tab, setTab] = React.useState<"general" | "personal" | "achievements">("general");
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const order: Array<typeof tab> = ["general", "personal", "achievements"];
      const idx = order.indexOf(tab);
      if (idx < 0) return;
      const next = e.key === "ArrowLeft" ? (idx + order.length - 1) % order.length : (idx + 1) % order.length;
      setTab(order[next]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tab]);

  return (
    <div className="space-y-6">
      {/* ===================== HERO (NUOVO) ===================== */}
      <Glass className="relative px-5 py-6">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-1 text-[11px] uppercase tracking-wider text-sky-300">
            <Sparkles className="h-3.5 w-3.5" />
            Live Circo Cinema stats
          </div>
          <h1 className="mt-2 text-3xl font-extrabold leading-tight text-zinc-50">Dashboard</h1>
          <p className="mt-1 text-sm text-zinc-400">Ratings, trends, and discoveries from your screenings.</p>
        </div>

        {/* KPI tiles (non toccano le tab) */}
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

      {/* ===================== Selettore tab (INVARIATO) ===================== */}
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

      {/* ===================== Contenuto tab (TUTTO COME PRIMA) ===================== */}
      {tab === "general" && (
        <div className="space-y-6">
          {/* Timeline */}
          <section className="rounded-xl border border-zinc-700/60 bg-zinc-900/40 p-4 space-y-3">
            <h2 className="flex items-center gap-2 text-base font-semibold text-zinc-100">
              <CalendarRange className="h-5 w-5 opacity-80" />
              Trend over time
            </h2>
            <Timeline data={timelineMain.slice().sort((a, b) => a.t - b.t)} />
            <ImdbDelta data={timelineDelta.slice().sort((a, b) => a.t - b.t)} />
          </section>

          {/* Runtime + distribuzioni */}
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
              <SimilarityMatrixSection users={Array.from(new Set(userOrder))} cells={cellsOrdered} />
            </div>
          </section>

          {/* Generi e anni */}
          <section className="rounded-xl border border-zinc-700/60 bg-zinc-900/40 p-4 space-y-3">
            <Genres items={genresArr} isLoading={isLoading} />
            <YearsSection years={yearsArr} decades={decadesArr} />
          </section>

          {/* Leaderboards & Top/Flop */}
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

      {tab === "achievements" && (
        <Achievements
          bestStreak={weeklyAvg.filter(w => w.avg >= 7.5).length ? 1 : 0 /* legacy */}
          streakThreshold={7.5}
          recordNight={movieStats.length ? { title: movieStats.reduce((b, m) => (m.avg > b.avg ? m : b), movieStats[0]).title, avg: movieStats.reduce((b, m) => (m.avg > b.avg ? m : b), movieStats[0]).avg } : null}
          milestones={milestones}
        />
      )}

      {/* mobile dock (decorativo) */}
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
