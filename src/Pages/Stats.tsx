import React from "react";
import { Card } from "../Components/UI/Card";
import { formatScore } from "..//Utils/Utils";
import { AvatarInline } from "../Components/UI/Avatar"; // opzionale: mostrale se disponibile
import { PickedByBadge } from "../Components/UI/PickedByBadge"; // badge con avatar e nome

/* =============================================================
 *  Stats – versione potenziata (grafici, UI accattivante, filtro utente)
 *
 *  - KPI cards animate
 *  - Grafico timeline (sparkline) dell'avg nel tempo
 *  - Classifiche: Most votes / Harshest / Kindest con progress bar
 *  - Generi: top 12 con barre orizzontali
 *  - Top / Flop film con badge
 *  - Pannello "Per Utente": selettore + donut avg, istogramma voti,
 *    bias vs media (quanto vota più alto/basso della media), generi preferiti
 *
 *  Dipendenze: solo React + Tailwind + i tuoi componenti Card/AvatarInline.
 *  Grafici: SVG puro, nessuna lib esterna.
 * ============================================================= */

export function Stats({
  history,
  backfillRuntime, // optional: () => void
  isLoading = false,
}: {
  history: any[];
  backfillRuntime?: () => void;
  isLoading?: boolean;
}) {
  // Avvio backfill runtime se mancano
  React.useEffect(() => {
    if (!backfillRuntime) return;
    const hasRt = history.some((h) => Number((h?.movie as any)?.runtime) > 0);
    if (!hasRt && !isLoading && history.length > 0) backfillRuntime();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history, isLoading, backfillRuntime]);

  // Helpers -----------------------------------------------------

  function refScoreFor(v: any): number | null {
    const m = v?.movie || {};
    const cand =
      m.imdb_rating ?? m.imdbRating ?? m.imdb_score ??
      m?.ratings?.imdb ?? m?.omdb?.imdbRating ?? m.vote_average;
    const n = Number(cand);
    return Number.isFinite(n) ? n : null;
  }

  const avgOf = (r?: Record<string, number> | null) => {
    if (!r) return null;
    const vals = Object.values(r).map(Number).filter((x) => Number.isFinite(x));
    if (!vals.length) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  };

  // Aggregazioni ------------------------------------------------
  const givenMap = new Map<string, { sum: number; n: number; scores: number[] }>(); // voti dati
  const receivedMap = new Map<string, { sum: number; n: number }>(); // avg ricevuto come picker
  const genreCount = new Map<string, number>();
  const userGenreLikes = new Map<string, Map<string, number>>(); // per utente: generi dei voti >= 8
  let totalMinutes = 0;
  let totalMinutesKnown = 0;
  const movieStats: Array<{ id: any; title: string; avg: number; votes: number; date: number; picked_by?: string }>=[];
  const timeline: Array<{ t: number; avg: number }>=[];

  for (const v of history) {
    const ratings = (v?.ratings || {}) as Record<string, number>;
    const entries = Object.entries(ratings);

    // voti dati per utente
    for (const [user, scoreRaw] of entries) {
      const score = Number(scoreRaw);
      const m = givenMap.get(user) || { sum: 0, n: 0, scores: [] };
      m.sum += score;
      m.n += 1;
      m.scores.push(score);
      givenMap.set(user, m);

      // like per generi (>=8)
      if (score >= 8) {
        const arr = (v?.movie?.genres || []) as Array<{ name: string }>;
        const userMap = userGenreLikes.get(user) || new Map<string, number>();
        arr.forEach((g) => {
          const name = g?.name?.trim();
          if (name) userMap.set(name, (userMap.get(name) || 0) + 1);
        });
        userGenreLikes.set(user, userMap);
      }
    }

    // avg ricevuto dal picker
    const avg = avgOf(ratings);
    if (avg != null && v?.picked_by) {
      const r = receivedMap.get(v.picked_by) || { sum: 0, n: 0 };
      r.sum += avg;
      r.n += 1;
      receivedMap.set(v.picked_by, r);
    }

    // generi globali
    const arr = (v?.movie?.genres || []) as Array<{ name: string }>;
    arr.forEach((g) => {
      const name = g?.name?.trim();
      if (name) genreCount.set(name, (genreCount.get(name) || 0) + 1);
    });

    // runtime
    const rt = Number((v?.movie as any)?.runtime);
    if (!Number.isNaN(rt) && rt > 0) {
      totalMinutes += rt;
      totalMinutesKnown += 1;
    }

    // statistiche film + timeline
    if (avg != null) {
      movieStats.push({
        id: v.id,
        title: v?.movie?.title || "Untitled",
        avg,
        votes: entries.length,
        date: v?.started_at ? new Date(v.started_at).getTime() : 0,
        picked_by: v?.picked_by,
      });
      if (v?.started_at) timeline.push({ t: new Date(v.started_at).getTime(), avg });
    }
  }

  // Derivate ordinate ------------------------------------------
  const givenArr = Array.from(givenMap, ([user, { sum, n, scores }]) => ({
    user,
    avg: sum / Math.max(1, n),
    count: n,
    scores,
  })).sort((a, b) => b.count - a.count || a.user.localeCompare(b.user));

  const receivedArr = Array.from(receivedMap, ([user, { sum, n }]) => ({
    user,
    avg: sum / Math.max(1, n),
    count: n,
  })).sort((a, b) => b.avg - a.avg || b.count - a.count);

  const genresArr = Array.from(genreCount, ([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  const bestMovies = movieStats.slice().sort((a, b) => b.avg - a.avg || b.votes - a.votes).slice(0, 5);
  const worstMovies = movieStats.slice().sort((a, b) => a.avg - b.avg || b.votes - a.votes).slice(0, 5);

  const minutesLabel =
    totalMinutesKnown > 0
      ? `${totalMinutes} min · ${totalMinutesKnown} film` 
      : isLoading
        ? "Fetching runtimes…"
        : "—";

  // ==== PER-USER =================================================
  const userOptions = Array.from(
    new Set([...givenArr.map((x) => x.user), ...receivedArr.map((x) => x.user)])
  ).sort((a, b) => a.localeCompare(b));

  const [selectedUser, setSelectedUser] = React.useState<string | null>(userOptions[0] || null);
  React.useEffect(() => {
    // auto sync quando cambia history
    if (selectedUser && userOptions.includes(selectedUser)) return;
    setSelectedUser(userOptions[0] || null);
  }, [history.length]);

  const selGiven = selectedUser ? givenArr.find((u) => u.user === selectedUser) : undefined;
  const selReceived = selectedUser ? receivedArr.find((u) => u.user === selectedUser) : undefined;
  const selGenres = selectedUser ? Array.from(userGenreLikes.get(selectedUser) || [])
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)) : [];

  // Calcolo bias vs media: media delle (voto_utente - avg_film) su tutti i film votati
  const bias = React.useMemo(() => {
    if (!selectedUser) return null;
    let sum = 0, n = 0;
    for (const v of history) {
      const ratings = (v?.ratings || {}) as Record<string, number>;
      if (selectedUser in ratings) {
        const a = avgOf(ratings);
        if (a != null) {
          sum += Number(ratings[selectedUser]) - a;
          n += 1;
        }
      }
    }
    if (!n) return null;
    return sum / n;
  }, [selectedUser, history]);

  // Timeline ordinata per grafico
  const timelineSorted = React.useMemo(() => timeline.slice().sort((a, b) => a.t - b.t), [history.length]);

  // Confronto selezionato vs IMDb: lista con diff
  const userImdbCompare = React.useMemo(() => {
    if (!selectedUser) return { closest: [], farthest: [] as any[] };
    const rows: Array<{ id:any; title:string; userScore:number; ref:number; diff:number }> = [];

    for (const v of history) {
      const userScore = Number(v?.ratings?.[selectedUser]);
      const ref = refScoreFor(v);
      if (!Number.isFinite(userScore) || !Number.isFinite(ref)) continue;
      rows.push({
        id: v.id,
        title: v?.movie?.title || "Untitled",
        userScore,
        ref,
        diff: Math.abs(userScore - ref),
      });
    }

    const byClosest = rows.slice().sort((a, b) => a.diff - b.diff).slice(0, 5);
    const byFarthest = rows.slice().sort((a, b) => b.diff - a.diff).slice(0, 5);
    return { closest: byClosest, farthest: byFarthest };
  }, [selectedUser, history]);

  // Componenti visual ------------------------------------------------
  const LoadingRow = () => (
    <div className="rounded-xl border px-3 py-2 text-sm text-gray-500 dark:border-zinc-700 dark:text-zinc-400">
      <span className="animate-pulse">Loading…</span>
    </div>
  );

  function ProgressBar({ value, max=10 }: { value: number; max?: number }) {
    const pct = Math.max(0, Math.min(100, (value / max) * 100));
    return (
      <div className="h-2 w-28 rounded-full bg-zinc-200 dark:bg-zinc-800">
        <div className="h-2 rounded-full bg-gradient-to-r from-amber-400 to-emerald-500" style={{ width: `${pct}%` }} />
      </div>
    );
  }

  function DiffPill({ user, ref }: { user: number; ref: number }) {
  const diff = Math.abs(user - ref);
  const maxDiff = 9; // scala 1..10 → max 9
  const pct = Math.min(100, (diff / maxDiff) * 100);
  const tone =
    diff <= 0.25 ? "from-emerald-500/20 to-emerald-500/10 ring-emerald-500/30" :
    diff <= 0.75 ? "from-amber-400/20 to-amber-400/10 ring-amber-400/30" :
                   "from-rose-500/20 to-rose-500/10 ring-rose-500/30";

  return (
    <div className={`relative w-40 rounded-full ring-1 bg-gradient-to-br ${tone}`}>
      <div className="h-2 rounded-full bg-white/50 dark:bg-white/10" style={{ width: `${pct}%` }} />
      <div className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold">
        Δ {formatScore(diff)} · you {formatScore(user)} / IMDb {formatScore(ref)}
      </div>
    </div>
  );
}

  function BarRow({ label, value, max }: { label: string; value: number; max: number }) {
    const pct = max ? Math.round((value / max) * 100) : 0;
    return (
      <div className="grid grid-cols-[1fr_auto] items-center gap-3">
        <div>
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="truncate">{label}</span>
            <span className="text-xs tabular-nums">{value}</span>
          </div>
          <div className="h-2 rounded-full bg-zinc-200 dark:bg-zinc-800">
            <div className="h-2 rounded-full bg-gradient-to-r from-sky-500 to-indigo-500" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>
    );
  }

  function Donut({ value, size=96 }: { value: number; size?: number }) {
    const clamped = Math.max(1, Math.min(10, value));
    const pct = (clamped - 1) / 9; // 1..10 → 0..1
    const stroke = 10;
    const r = (size - stroke) / 2;
    const c = Math.PI * 2 * r;
    const dash = c * pct;
    const hue = 20 + pct * 100; // 20→120
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="block">
        <g transform={`translate(${size/2}, ${size/2})`}>
          <circle r={r} cx={0} cy={0} stroke="currentColor" className="text-zinc-300 dark:text-zinc-800" strokeWidth={stroke} fill="none" />
          <circle r={r} cx={0} cy={0} stroke={`hsl(${hue} 80% 50%)`} strokeWidth={stroke} fill="none" strokeDasharray={`${dash} ${c-dash}`} transform="rotate(-90)" strokeLinecap="round" />
          <text x={0} y={6} textAnchor="middle" className="fill-current text-xl font-bold tabular-nums">
            {formatScore(clamped)}
          </text>
        </g>
      </svg>
    );
  }

function Sparkline({ data, height = 120, padding = 12 }: { data: Array<{ t: number; avg: number }>; height?: number; padding?: number }) {
const containerRef = React.useRef<HTMLDivElement>(null);
const [width, setWidth] = React.useState(420);
const gid = (React as any).useId ? (React as any).useId() : "sg";


React.useEffect(() => {
if (!containerRef.current) return;
const ro = new ResizeObserver((entries) => {
for (const e of entries) {
const w = Math.max(260, Math.floor(e.contentRect.width));
setWidth(w);
}
});
ro.observe(containerRef.current);
return () => ro.disconnect();
}, []);


if (!data.length) return <div className="h-[72px] text-sm text-zinc-500">No data</div>;


const xs = data.map((d) => d.t);
const minX = Math.min(...xs), maxX = Math.max(...xs);
const minY = 4, maxY = 10;


const W = width, H = height;
const innerW = W - padding * 2;
const innerH = H - padding * 2;
const nx = (x: number) => padding + (maxX === minX ? 0.5 : (x - minX) / (maxX - minX)) * innerW;
const ny = (y: number) => padding + (1 - (y - minY) / (maxY - minY)) * innerH;


const pts = data.map((p) => ({ x: nx(p.t), y: ny(p.avg) }));
const d = pts.map((p, i) => `${i ? "L" : "M"}${p.x},${p.y}`).join(" ");
const last = pts[pts.length - 1];


return (
<div ref={containerRef} className="w-full">
<svg width={W} height={H} className="block">
{/* grid lines */}
{Array.from({ length: 10 }, (_, i) => i + 1).map((y) => (
<line
key={y}
x1={padding}
x2={W - padding}
y1={ny(y)}
y2={ny(y)}
stroke="currentColor"
className="text-zinc-800 dark:text-zinc-700"
strokeWidth={0.5}
/>
))}
{/* line path */}
<path d={d} fill="none" strokeWidth={2.5} className="text-emerald-500" stroke="currentColor" />
{last && <circle cx={last.x} cy={last.y} r={4} className="text-emerald-500" fill="currentColor" />}
{/* y labels */}
{Array.from({ length: 10 }, (_, i) => i + 1).map((y) => (
<text key={y} x={2} y={ny(y) + 3} className="fill-current text-[10px] text-zinc-500">
{y}
</text>
))}
</svg>
</div>
);
}
  function Histogram({ values }: { values: number[] }) {
    const buckets = Array.from({ length: 10 }, (_, i) => i + 1);
    const counts = buckets.map((b) => values.filter((v) => Math.round(v) === b).length);
    const max = Math.max(1, ...counts);
    return (
      <div className="grid grid-cols-10 items-end gap-1">
        {counts.map((c, i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <div className="w-full rounded-md bg-gradient-to-t from-zinc-300 to-zinc-100 dark:from-zinc-800 dark:to-zinc-700" style={{ height: `${(c / max) * 72 + 4}px` }} />
            <span className="text-[10px] text-zinc-500">{i + 1}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-5">
      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="relative overflow-hidden">
          <div className="text-xs uppercase text-zinc-500">Total movies</div>
          <div className="text-3xl font-extrabold tracking-tight">{history.length}</div>
          <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br from-indigo-500/20 to-emerald-500/20" />
        </Card>

        <Card className="relative overflow-hidden">
          <div className="text-xs uppercase text-zinc-500">Minutes watched</div>
          <div className="flex items-center gap-2 text-3xl font-extrabold tracking-tight">
            <span>{minutesLabel}</span>
            {isLoading && <span className="animate-pulse text-lg">⏳</span>}
          </div>
          <div className="pointer-events-none absolute -left-8 -bottom-8 h-28 w-28 rounded-full bg-gradient-to-br from-amber-500/20 to-pink-500/20" />
        </Card>

        <Card>
          <div className="text-xs uppercase text-zinc-500">Distinct genres</div>
          <div className="text-3xl font-extrabold tracking-tight">{genresArr.length}</div>
        </Card>

        <Card>
          <div className="text-xs uppercase text-zinc-500">Total votes</div>
          <div className="text-3xl font-extrabold tracking-tight">
            {history.reduce((acc, v) => acc + Object.keys(v?.ratings || {}).length, 0)}
          </div>
        </Card>
      </div>

      {/* Timeline media nel tempo */}
      <Card>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-lg font-semibold">📈 Average rating over time</h3>
          <span className="text-xs text-zinc-500">(by viewing date)</span>
        </div>
        <Sparkline data={timelineSorted} />
      </Card>

      {/* Generi più visti */}
      <Card>
        <h3 className="mb-3 text-lg font-semibold">🎭 Most watched genres</h3>
        {isLoading && genresArr.length === 0 ? (
          <LoadingRow />
        ) : genresArr.length === 0 ? (
          <div className="text-sm text-zinc-500">No genre data (ensure TMDB genres present)</div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {genresArr.slice(0, 12).map((g) => (
              <BarRow key={g.name} label={g.name} value={g.count} max={genresArr[0]?.count || 1} />
            ))}
          </div>
        )}
      </Card>

      {/* Leaderboards */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <h3 className="mb-3 text-lg font-semibold">🗳️ Most votes given</h3>
          {isLoading && givenArr.length === 0 ? (
            <LoadingRow />
          ) : givenArr.length === 0 ? (
            <div className="text-sm text-zinc-500">No votes yet.</div>
          ) : (
            <ul className="grid gap-2">
              {givenArr.slice(0, 8).map((u) => (
                <li key={u.user} className="flex items-center justify-between rounded-xl border bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900">
                  <div className="flex min-w-0 items-center gap-2">
                    <AvatarInline name={u.user} size={20} />
                    <span className="truncate">{u.user}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs"><b>{u.count}</b> · avg <b>{formatScore(u.avg)}</b></span>
                    <ProgressBar value={u.avg} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h3 className="mb-3 text-lg font-semibold">🥶 Harshest (lowest avg)</h3>
          {isLoading && givenArr.length === 0 ? (
            <LoadingRow />
          ) : (
            <ul className="grid gap-2">
              {givenArr.slice().sort((a,b)=> a.avg-b.avg).slice(0,3).map((u) => (
                <li key={u.user} className="flex items-center justify-between rounded-xl border bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900">
                  <div className="flex min-w-0 items-center gap-2">
                    <AvatarInline name={u.user} size={20} />
                    <span className="truncate">{u.user}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs">avg <b>{formatScore(u.avg)}</b> · {u.count}</span>
                    <ProgressBar value={u.avg} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h3 className="mb-3 text-lg font-semibold">💖 Kindest (highest avg)</h3>
          {isLoading && givenArr.length === 0 ? (
            <LoadingRow />
          ) : (
            <ul className="grid gap-2">
              {givenArr.slice().sort((a,b)=> b.avg-a.avg).slice(0,3).map((u) => (
                <li key={u.user} className="flex items-center justify-between rounded-xl border bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900">
                  <div className="flex min-w-0 items-center gap-2">
                    <AvatarInline name={u.user} size={20} />
                    <span className="truncate">{u.user}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs">avg <b>{formatScore(u.avg)}</b> · {u.count}</span>
                    <ProgressBar value={u.avg} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Avg ricevuto dai picker */}
      <Card>
        <h3 className="mb-3 text-lg font-semibold">🎬 Avg score received by pickers</h3>
        {isLoading && receivedArr.length === 0 ? (
          <LoadingRow />
        ) : receivedArr.length === 0 ? (
          <div className="text-sm text-zinc-500">No movies with votes yet.</div>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {receivedArr.map((p) => (
              <li key={p.user} className="flex items-center justify-between rounded-xl border bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900">
                <div className="flex min-w-0 items-center gap-2">
                  <AvatarInline name={p.user} size={20} />
                  <span className="truncate">{p.user}</span>
                </div>
                <span className="text-xs">avg <b>{formatScore(p.avg)}</b> · {p.count} movies</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Top / Flop */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h3 className="mb-3 text-lg font-semibold">🏆 Top 5 movies</h3>
          {isLoading && bestMovies.length === 0 ? (
            <LoadingRow />
          ) : bestMovies.length === 0 ? (
            <div className="text-sm text-zinc-500">N/A</div>
          ) : (
            <ol className="grid gap-2">
              {bestMovies.map((m, i) => (
              <li
                key={m.id}
                className="flex items-center justify-between rounded-xl border bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span className="text-zinc-400 tabular-nums">{i + 1}.</span>
                  {!!m.picked_by && <PickedByBadge name={m.picked_by} />}
                  <span className="truncate">{m.title}</span>
                </div>
                <span className="shrink-0 rounded-full border px-2 py-0.5 text-xs dark:border-zinc-700">
                  avg <b>{formatScore(m.avg)}</b> · {m.votes} votes
                </span>
              </li>
              ))}
            </ol>
          )}
        </Card>

        <Card>
          <h3 className="mb-3 text-lg font-semibold">💔 Flop 5 movies</h3>
          {isLoading && worstMovies.length === 0 ? (
            <LoadingRow />
          ) : worstMovies.length === 0 ? (
            <div className="text-sm text-zinc-500">N/A</div>
          ) : (
            <ol className="grid gap-2">
              {worstMovies.map((m, i) => (
                <li
                  key={m.id}
                  className="flex items-center justify-between rounded-xl border bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="text-zinc-400 tabular-nums">{i + 1}.</span>
                    {!!m.picked_by && <PickedByBadge name={m.picked_by} />}
                    <span className="truncate">{m.title}</span>
                  </div>
                  <span className="shrink-0 rounded-full border px-2 py-0.5 text-xs dark:border-zinc-700">
                    avg <b>{formatScore(m.avg)}</b> · {m.votes} votes
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>

      {/* --- Pannello per utente --------------------------------- */}
      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-semibold">👤 Stats per utente</h3>
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500">Select user</span>
            <select
              className="rounded-lg border bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              value={selectedUser || ""}
              onChange={(e) => setSelectedUser(e.target.value || null)}
            >
              {userOptions.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>
        </div>

        {!selectedUser ? (
          <div className="text-sm text-zinc-500">Nessun utente.</div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[auto_1fr]">
            {/* Colonna sinistra: donut & KPI */}
            <div className="grid gap-3">
              <div className="flex flex-col items-center gap-2 rounded-xl border p-4 dark:border-zinc-700">
                <AvatarInline name={selectedUser} size={40} />
                <div className="text-sm font-semibold">{selectedUser}</div>
                <Donut value={selGiven?.avg || 0} />
                <div className="text-xs text-zinc-500">Avg given</div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border p-3 text-sm dark:border-zinc-700">
                  <div className="text-xs uppercase text-zinc-500">Votes given</div>
                  <div className="text-xl font-bold">{selGiven?.count || 0}</div>
                </div>
                <div className="rounded-xl border p-3 text-sm dark:border-zinc-700">
                  <div className="text-xs uppercase text-zinc-500">Avg received</div>
                  <div className="text-xl font-bold">{selReceived ? formatScore(selReceived.avg) : "—"}</div>
                </div>
              </div>

              <div className="rounded-xl border p-3 text-sm dark:border-zinc-700">
                <div className="mb-1 text-xs uppercase text-zinc-500">Bias vs crowd</div>
                <div className="flex items-baseline gap-2">
                  <div className={`text-xl font-bold ${bias!=null && bias>0.05 ? "text-emerald-500" : bias!=null && bias<-0.05 ? "text-rose-500" : ""}`}>
                    {bias==null ? "—" : `${bias>0?"+":""}${formatScore(bias)}`}
                  </div>
                  <span className="text-xs text-zinc-500">(user score − movie avg)</span>
                </div>
              </div>
            </div>

            {/* Colonna destra: istogramma & generi */}
            <div className="grid gap-4">
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="font-semibold">Score distribution</h4>
                  <span className="text-xs text-zinc-500">(rounded to 1..10)</span>
                </div>
                <Histogram values={selGiven?.scores || []} />
              </div>

              <div>
                <h4 className="mb-2 font-semibold">Favourite genres (scores ≥ 8)</h4>
                {selGenres.length === 0 ? (
                  <div className="text-sm text-zinc-500">—</div>
                ) : (
                  <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                    {selGenres.slice(0, 9).map((g) => (
                      <BarRow key={g.name} label={g.name} value={g.count} max={selGenres[0]?.count || 1} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </Card>

      <p className="text-xs text-zinc-500">* Total minutes considerano solo i film con <code>runtime</code> noto (TMDB).</p>
    </div>
  );
}
