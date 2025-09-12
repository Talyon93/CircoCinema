// Pages/Stats.tsx
import React from "react";
import { KpiRow } from "../StatsKit/sections/KpiRow";
import { Timeline } from "../StatsKit/sections/Timeline";
import { Genres } from "../StatsKit/sections/Genres";
import { Leaderboards } from "../StatsKit/sections/Leaderboards";
import { PickerAverages } from "../StatsKit/sections/PickerAverages";
import { TopFlop } from "../StatsKit/sections/TopFlop";
import { GroupImdb } from "../StatsKit/sections/GroupImdb";
import { UserPanelClassic } from "../StatsKit/sections/UserPanelClassic";
import { ImdbDelta } from "../StatsKit/sections/ImdbDelta";
import { ScatterRuntimeSection } from "../StatsKit/sections/ScatterRuntimeSection";
import { RadarSection } from "../StatsKit/sections/RadarSection";
import { SimilarityMatrixSection } from "../StatsKit/sections/SimilarityMatrixSection";
import { DistributionInsightSection } from "../StatsKit/sections/DistributionInsightSection";
import { Achievements } from "../StatsKit/sections/Achievements";

import { avgOf, pearson } from "../StatsKit/utils/math";
import { refScoreFor } from "../StatsKit/utils/refScore";

// icone (lucide-react)
import { BarChart3, User, Trophy } from "lucide-react";

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
  let totalMinutes = 0, totalMinutesKnown = 0;

  const movieStats: Array<{ id:any; title:string; avg:number; votes:number; date:number; picked_by?:string; runtime?:number; ref?:number }> = [];
  const timelineMain: Array<{ t:number; avg:number; title?:string; label?:string }> = [];
  const timelineDelta: Array<{ t:number; val:number; title?:string; label?:string }> = [];
  const beeswarmValues: Array<{ score:number; key:string }> = [];

  for (const v of history) {
    const ratings = (v?.ratings || {}) as Record<string, number>;
    const entries = Object.entries(ratings);

    for (const [user, scoreRaw] of entries) {
      const score = Number(scoreRaw);
      const m = givenMap.get(user) || { sum: 0, n: 0, scores: [] };
      m.sum += score; m.n += 1; m.scores.push(score); givenMap.set(user, m);
      beeswarmValues.push({ score, key: `${v.id}:${user}` });

      const arr = (v?.movie?.genres || []) as Array<{ name: string }>;
      const umap = userGenreLikes.get(user) || new Map<string, { pos:number; tot:number }>();
      arr.forEach(g => {
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

    const rt = Number((v?.movie as any)?.runtime);
    if (!Number.isNaN(rt) && rt > 0) { totalMinutes += rt; totalMinutesKnown += 1; }

    if (avg != null) {
      const t = v?.started_at ? new Date(v.started_at).getTime() : 0;
      const ref = refScoreFor(v);
      movieStats.push({ id: v.id, title: v?.movie?.title || "Untitled", avg, votes: entries.length, date: t, picked_by: v?.picked_by, runtime: rt>0?rt:undefined, ref: ref ?? undefined });
      if (t) {
        timelineMain.push({ t, avg, title: v?.movie?.title || "Untitled", label: new Date(t).toLocaleDateString() });
        if (ref!=null) timelineDelta.push({ t, val: avg - ref, title: v?.movie?.title || "Untitled", label: new Date(t).toLocaleDateString() });
      }
    }
  }

  const givenArr = Array.from(givenMap, ([user, { sum, n, scores }]) => ({ user, avg: sum / Math.max(1, n), count: n, scores }))
    .sort((a, b) => b.count - a.count || a.user.localeCompare(b.user));
  const receivedArr = Array.from(receivedMap, ([user, { sum, n }]) => ({ user, avg: sum / Math.max(1, n), count: n }))
    .sort((a, b) => b.avg - a.avg || b.count - a.count);
  const genresArr = Array.from(genreCount, ([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  const bestMovies = movieStats.slice().sort((a, b) => b.avg - a.avg || b.votes - a.votes).slice(0, 5);
  const worstMovies = movieStats.slice().sort((a, b) => a.avg - b.avg || b.votes - a.votes).slice(0, 5);
  const minutesLabel = totalMinutesKnown > 0 ? `${totalMinutes} min · ${totalMinutesKnown} film` : isLoading ? "Fetching runtimes…" : "—";

  const userOptions = Array.from(new Set([...givenArr.map(x => x.user), ...receivedArr.map(x => x.user)])).sort((a, b) => a.localeCompare(b));
  const [selectedUser, setSelectedUser] = React.useState<string | null>(userOptions[0] || null);
  React.useEffect(() => { if (selectedUser && userOptions.includes(selectedUser)) return; setSelectedUser(userOptions[0] || null); }, [history.length]);

  const timelineSorted = React.useMemo(() => timelineMain.slice().sort((a,b)=>a.t-b.t), [history.length]);
  const deltaSorted = React.useMemo(() => timelineDelta.slice().sort((a,b)=>a.t-b.t), [history.length]);

  // Radar data
  const axesByUser: Record<string, Array<{label:string; value:number}>> = {};
  for (const u of userOptions){
    const m = userGenreLikes.get(u);
    if (!m) { axesByUser[u] = []; continue; }
    const arr = Array.from(m, ([label, v])=>({ label, ...v }))
      .sort((a,b)=> b.tot - a.tot)
      .slice(0, 6)
      .map(g=> ({ label: g.label, value: g.tot ? g.pos/g.tot : 0 }));
    axesByUser[u] = arr;
  }

  // Similarity matrix
  const users = userOptions;
  const movieMap: Map<any, Map<string, number>> = new Map();
  for (const v of history) {
    const r = v?.ratings || {};
    const mm = new Map<string, number>();
    for (const [u,s] of Object.entries(r)) mm.set(u, Number(s));
    movieMap.set(v.id, mm);
  }
  const cells: Array<{ i:number; j:number; corr:number; n:number }> = [];
  for (let i=0;i<users.length;i++){
    for (let j=0;j<users.length;j++){
      const A: number[] = [], B: number[] = [];
      for (const mm of movieMap.values()){
        if (mm.has(users[i]) && mm.has(users[j])) { A.push(mm.get(users[i])!); B.push(mm.get(users[j])!); }
      }
      const n = A.length;
      const corr = n>=2 ? pearson(A,B) : 0;
      cells.push({ i, j, corr, n });
    }
  }
  const userOrder = users.map((u,i)=>({
    u, i,
    avg: cells.filter(c=>c.i===i && c.i!==c.j).map(c=>c.corr).reduce((a,b)=>a+b,0)/Math.max(1, users.length-1)
  })).sort((a,b)=> b.avg - a.avg).map(x=> x.u);
  const orderIndex = new Map(userOrder.map((u,i)=>[u,i]));
  const cellsOrdered = cells.map(c=> ({ i: orderIndex.get(users[c.i])!, j: orderIndex.get(users[c.j])!, corr: c.corr, n: c.n }));
  const usersOrdered = userOrder;

  // Group vs IMDb
  const groupRows: Array<{ id:any; title:string; avg:number; ref:number; diff:number }> = [];
  for (const v of history) {
    const a = avgOf(v?.ratings); const ref = refScoreFor(v);
    if (a == null || ref == null) continue;
    groupRows.push({ id: v.id, title: v?.movie?.title || "Untitled", avg: a, ref, diff: Math.abs(a - ref) });
  }
  const groupClosest = groupRows.slice().sort((a,b)=> a.diff - b.diff).slice(0,5);
  const groupFarthest = groupRows.slice().sort((a,b)=> b.diff - a.diff).slice(0,5);

  // Achievements
  const weekMs = 7*24*3600*1000;
  const sortedByTime = history.slice().filter(v=>v.started_at).sort((a,b)=> new Date(a.started_at).getTime() - new Date(b.started_at).getTime());
  const buckets = new Map<number, number[]>();
  for (const v of sortedByTime) {
    const t = new Date(v.started_at).getTime();
    const w = Math.floor(t / weekMs)*weekMs;
    const a = avgOf(v.ratings); if (a==null) continue;
    const arr = buckets.get(w) || []; arr.push(a); buckets.set(w, arr);
  }
  const weeklyAvg = Array.from(buckets, ([w, arr])=> ({ w, avg: (arr.reduce((x,y)=>x+y,0)/arr.length) })).sort((a,b)=>a.w-b.w);
  const streakThreshold = 7.5;
  let bestStreak = 0, cur = 0;
  for (const w of weeklyAvg) { if (w.avg >= streakThreshold) { cur++; bestStreak = Math.max(bestStreak, cur); } else cur=0; }
  const recordNight = movieStats.length ? movieStats.reduce((best, m)=> (m.avg > best.avg ? m : best), movieStats[0]) : null;
  const milestones: string[] = [];
  if (history.length >= 50) milestones.push("🎉 50° film");
  if (history.length >= 100) milestones.push("🏆 100° film");
  const pickerCounts = new Map<string, number>();
  for (const m of movieStats) { if (m.picked_by) pickerCounts.set(m.picked_by, (pickerCounts.get(m.picked_by)||0)+1); }
  for (const [u,c] of pickerCounts) if (c>=10) milestones.push(`🎬 ${u}: 10ª scelta`);

  // ===================== TABS =====================
  const [tab, setTab] = React.useState<"general" | "personal" | "achievements">("general");

  // conteggi per badge in header tab
  const generalCount = history.length;
  const personalCount = React.useMemo(() => {
    if (!selectedUser) return 0;
    const found = givenArr.find(x => x.user === selectedUser);
    return found ? found.count : 0;
  }, [givenArr, selectedUser]);
  const achievementsCount = milestones.length + (recordNight ? 1 : 0) + (bestStreak > 0 ? 1 : 0);

  // gestione tastiera (←/→ per cambiare tab)
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
      {/* Selettore tab - stile pill/segmented */}
      <div className="flex justify-center">
        <div
          role="tablist"
          aria-label="Stats tabs"
          className="flex items-center gap-2 rounded-2xl border border-zinc-700/70 bg-zinc-900/40 px-2 py-2 shadow-inner"
        >
          {/* GENERAL */}
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
            <span className="text-sm font-medium">Stats generali</span>
          </button>

          {/* PERSONAL */}
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
            <span className="text-sm font-medium">Stats personali</span>
          </button>

          {/* ACHIEVEMENTS */}
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

      {/* Contenuto tab */}
      {tab === "general" && (
        <div className="grid gap-5">
          <KpiRow
            totalMovies={history.length}
            minutesLabel={minutesLabel}
            distinctGenres={genresArr.length}
            totalVotes={history.reduce((acc, v) => acc + Object.keys(v?.ratings || {}).length, 0)}
            isLoading={isLoading}
          />
          <Timeline data={timelineSorted} />
          <ImdbDelta data={deltaSorted} />
          <ScatterRuntimeSection
            points={movieStats
              .filter(m => Number.isFinite(m.runtime) && Number.isFinite(m.avg))
              .map(m => ({ x: m.runtime as number, y: m.avg, size: m.votes, title: m.title }))}
          />
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="h-full">
              <DistributionInsightSection values={beeswarmValues.map(v => v.score)} />
            </div>
            <div className="h-full">
              <SimilarityMatrixSection users={usersOrdered} cells={cellsOrdered} />
            </div>
          </div>
          <Genres items={genresArr} isLoading={isLoading} />
          <Leaderboards givenArr={givenArr} isLoading={isLoading} />
          <PickerAverages items={receivedArr} isLoading={isLoading} />
          <TopFlop bestMovies={bestMovies} worstMovies={worstMovies} isLoading={isLoading} />
          <GroupImdb closest={groupClosest} farthest={groupFarthest} />
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
            userOptions={userOptions}
          />
        </div>
      )}

      {tab === "achievements" && (
        <Achievements
          bestStreak={bestStreak}
          streakThreshold={streakThreshold}
          recordNight={recordNight ? { title: recordNight.title, avg: recordNight.avg } : null}
          milestones={milestones}
        />
      )}

      <p className="text-xs text-zinc-500">
        * Total minutes considerano solo i film con <code>runtime</code> noto (TMDB). IMDb delta calcolato su film con rating IMDb disponibile.
      </p>
    </div>
  );
}
