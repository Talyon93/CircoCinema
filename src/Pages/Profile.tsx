import React from "react";
import { Card } from "../Components/UI/Card";
import { HistoryCardExtended } from "../Components/UI/HistoryCardExtended";
import { fetchAvatarUrl, uploadAvatar, removeAvatar } from "../AvatarStorage";
import { Film, Star, BarChart3 } from "lucide-react";

type TabKey = "picked" | "rated" | "stats";

export function Profile({
  user,
  history,
  onAvatarSaved,
}: {
  user: string;
  history: any[];
  onAvatarSaved?: () => void;
}) {
  const [avatarUrl, setAvatarUrl] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [tab, setTab] = React.useState<TabKey>("picked");

  // ---- Avatar load ----
  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchAvatarUrl(user)
      .then((url) => alive && setAvatarUrl(url))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [user]);

  // ---- Datasets per tab ----
  const pickedByMe = React.useMemo(
    () => history.filter((h) => h?.picked_by === user),
    [history, user]
  );

  const ratedByMeOnOthers = React.useMemo(
    () =>
      history.filter((h) => {
        const mine = h?.ratings ? h.ratings[user] : undefined;
        const hasMyRating = typeof mine === "number" && Number.isFinite(mine);
        const pickedByOther = h?.picked_by && h.picked_by !== user;
        return Boolean(hasMyRating && pickedByOther);
      }),
    [history, user]
  );

  // ---- Dataset e aggregazioni per le MIE stats (solo film dove ho votato) ----
  const myHistory = React.useMemo(
    () => history.filter((h) => h?.ratings && h.ratings[user] != null),
    [history, user]
  );

  const avgOf = (r?: Record<string, number> | null) => {
    if (!r) return null;
    const vals = Object.values(r).map(Number).filter((x) => Number.isFinite(x));
    if (!vals.length) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  };

  let minutes = 0;
  let moviesWithRuntime = 0;
  let votesGiven = 0;
  let sumGiven = 0;
  const scoreList: number[] = [];
  const genreLikes = new Map<string, number>();

  for (const v of myHistory) {
    const mine = Number(v?.ratings?.[user]);
    if (Number.isFinite(mine)) {
      votesGiven += 1;
      sumGiven += mine;
      scoreList.push(mine);
      if (mine >= 8) {
        const arr = (v?.movie?.genres || []) as Array<{ name: string }>;
        arr.forEach((g) => {
          const name = g?.name?.trim();
          if (name) genreLikes.set(name, (genreLikes.get(name) || 0) + 1);
        });
      }
    }
    const rt = Number((v?.movie as any)?.runtime);
    if (!Number.isNaN(rt) && rt > 0) {
      minutes += rt;
      moviesWithRuntime += 1;
    }
  }

  const totalMoviesIHaveVoted = myHistory.length;
  const minutesLabel =
    moviesWithRuntime > 0 ? `${minutes} min · ${moviesWithRuntime} film` : "—";
  const avgGiven = votesGiven ? sumGiven / votesGiven : 0;

  // Avg ricevuto quando ho scelto io
  let receivedSum = 0,
    receivedN = 0;
  for (const v of history) {
    if (v?.picked_by === user) {
      const a = avgOf(v?.ratings);
      if (a != null) {
        receivedSum += a;
        receivedN += 1;
      }
    }
  }
  const avgReceived = receivedN ? receivedSum / receivedN : null;

  // Bias vs crowd (mia_voto − media_film)
  let biasSum = 0,
    biasN = 0;
  for (const v of myHistory) {
    const a = avgOf(v?.ratings);
    const mine = Number(v?.ratings?.[user]);
    if (a != null && Number.isFinite(mine)) {
      biasSum += mine - a;
      biasN += 1;
    }
  }
  const bias = biasN ? biasSum / biasN : null;

  // Generi preferiti (>=8)
  const favGenres = Array.from(genreLikes, ([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, 9);

  // ---- UI: Tab selector (pillole con indicatore) ----
    const tabs: Array<{ key: TabKey; label: string; count: number; icon: React.ReactNode }> = [
    { key: "picked", label: "Picked", count: pickedByMe.length, icon: <Film className="h-4 w-4" /> },
    { key: "rated", label: "Rated", count: ratedByMeOnOthers.length, icon: <Star className="h-4 w-4" /> },
    { key: "stats", label: "Stats", count: myHistory.length, icon: <BarChart3 className="h-4 w-4" /> },
    ];
  const activeIndex = tabs.findIndex((t) => t.key === tab);

  function sortByDateDesc(a: any, b: any) {
    const ta = a?.started_at ? new Date(a.started_at).getTime() : 0;
    const tb = b?.started_at ? new Date(b.started_at).getTime() : 0;
    if (ta !== tb) return tb - ta;
    if (typeof a.id === "number" && typeof b.id === "number") return a.id - b.id;
    return 0;
  }

  return (
    <>
      {/* ---------- Header profilo ---------- */}
      <Card>
        <h3 className="mb-3 text-lg font-semibold">👤 Your profile</h3>

        <div className="flex items-start gap-3">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              className="h-20 w-20 rounded-full object-cover"
              alt={user}
              onError={() => setAvatarUrl(null)}
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gray-200 text-xl font-bold dark:bg-zinc-800 dark:text-white">
              {user.slice(0, 2).toUpperCase()}
            </div>
          )}

          <div>
            <div className="text-sm text-gray-700 dark:text-zinc-300">
              Logged in as <b>{user}</b>
            </div>

            <div className="mt-2 flex gap-2">
              <label
                className={`cursor-pointer rounded-xl border px-3 py-2 text-sm dark:border-zinc-700 ${
                  loading ? "pointer-events-none opacity-50" : ""
                }`}
              >
                {loading ? "Uploading..." : "Change image"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      setLoading(true);
                      const url = await uploadAvatar(user, file);
                      setAvatarUrl(url);
                      onAvatarSaved?.();
                    } catch (err) {
                      console.error("Avatar upload failed:", err);
                      alert("Upload avatar non riuscito.");
                    } finally {
                      setLoading(false);
                      e.currentTarget.value = "";
                    }
                  }}
                  disabled={loading}
                />
              </label>

              {avatarUrl && (
                <button
                  className="rounded-xl border px-3 py-2 text-sm dark:border-zinc-700 disabled:opacity-50"
                  onClick={async () => {
                    try {
                      setLoading(true);
                      await removeAvatar(user);
                      setAvatarUrl(null);
                      onAvatarSaved?.();
                    } catch (err) {
                      console.error("Remove avatar failed:", err);
                      alert("Rimozione avatar non riuscita.");
                    } finally {
                      setLoading(false);
                    }
                  }}
                  disabled={loading}
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* ---------- Tabs + contenuto ---------- */}
      <Card>
        {/* Selettore tabs */}
        <div className="mb-4">
          <div className="relative mx-auto grid w-full max-w-xl grid-cols-3 rounded-2xl border border-zinc-300 bg-white p-1 text-sm dark:border-zinc-700 dark:bg-zinc-900">
            {/* Indicatore animato */}
            <div
              className="absolute top-1 bottom-1 w-[calc(33.333%-0.5rem)] rounded-xl bg-zinc-100 transition-[transform] duration-200 ease-out dark:bg-zinc-800"
              style={{ transform: `translateX(calc(${activeIndex} * 100% + ${activeIndex * 0.5}rem))` }}
            />
            {tabs.map((t) => {
              const active = t.key === tab;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`relative z-10 flex items-center justify-center gap-2 rounded-xl px-3 py-2 transition ${
                    active ? "text-white md:text-white dark:text-white" : "text-zinc-700 dark:text-zinc-300"
                  } ${active ? "font-semibold" : "hover:text-black dark:hover:text-white"}`}
                >
                  <span className="opacity-90">{t.icon}</span>
                  <span>{t.label}</span>
                  <span
                    className={`rounded-md border px-1.5 py-0.5 text-[11px] tabular-nums ${
                      active ? "border-zinc-700/40 bg-zinc-700/40 text-white" : "border-zinc-300 dark:border-zinc-700"
                    }`}
                  >
                    {t.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Contenuto */}
        {tab === "picked" && (
          <>
            <div className="grid gap-3">
              {pickedByMe.length === 0 ? (
                <div className="text-sm text-gray-600 dark:text-zinc-400">
                  No movies yet. Start one from the “Vote” tab.
                </div>
              ) : (
                pickedByMe
                  .slice()
                  .sort(sortByDateDesc)
                  .map((v) => <HistoryCardExtended key={v.id} v={v} />)
              )}
            </div>
          </>
        )}

        {tab === "rated" && (
          <RatedGrid rows={ratedByMeOnOthers.slice().sort(sortByDateDesc)} user={user} />
        )}

        {tab === "stats" && (
          <>
            {/* KPI personali */}
            <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <KPI title="TOTAL MOVIES" value={totalMoviesIHaveVoted} />
              <KPI title="MINUTES WATCHED" value={minutesLabel} />
              <KPI
                title="DISTINCT GENRES"
                value={
                  new Set(
                    myHistory
                      .flatMap((h: any) =>
                        (h?.movie?.genres || [])
                          .map((g: any) => g?.name?.trim())
                          .filter(Boolean)
                      )
                  ).size
                }
              />
              <KPI title="TOTAL VOTES" value={votesGiven} />
            </div>

            {/* Pannello per-utente */}
            <div className="grid gap-4 lg:grid-cols-[auto_1fr]">
              {/* Colonna sinistra */}
              <div className="grid gap-3">
                <div className="flex flex-col items-center gap-2 rounded-xl border p-4 dark:border-zinc-700">
                  <div className="grid h-10 w-10 place-items-center rounded-full bg-zinc-800 text-sm font-bold text-white">
                    {(user?.[0] || "?").toUpperCase()}
                  </div>
                  <div className="text-sm font-semibold">{user}</div>
                  <Donut value={avgGiven || 0} />
                  <div className="text-xs text-zinc-500">Avg given</div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <SmallKPI label="VOTES GIVEN" value={votesGiven} />
                  <SmallKPI label="AVG RECEIVED" value={avgReceived != null ? formatScore(avgReceived) : "—"} />
                </div>

                <div className="rounded-xl border p-3 text-sm dark:border-zinc-700">
                  <div className="mb-1 text-xs uppercase text-zinc-500">BIAS VS CROWD</div>
                  <div className="flex items-baseline gap-2">
                    <div
                      className={`text-xl font-bold ${
                        bias != null && bias > 0.05
                          ? "text-emerald-500"
                          : bias != null && bias < -0.05
                          ? "text-rose-500"
                          : ""
                      }`}
                    >
                      {bias == null ? "—" : `${bias > 0 ? "+" : ""}${formatScore(bias)}`}
                    </div>
                    <span className="text-xs text-zinc-500">(user score − movie avg)</span>
                  </div>
                </div>
              </div>

              {/* Colonna destra */}
              <div className="grid gap-4">
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <h4 className="font-semibold">Score distribution</h4>
                    <span className="text-xs text-zinc-500">(rounded to 1..10)</span>
                  </div>
                  <Histogram values={scoreList} />
                </div>

                <div>
                  <h4 className="mb-2 font-semibold">Favourite genres (scores ≥ 8)</h4>
                  {favGenres.length === 0 ? (
                    <div className="text-sm text-zinc-500">—</div>
                  ) : (
                    <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                      {favGenres.map((g, i) => (
                        <BarRow key={g.name + i} label={g.name} value={g.count} max={favGenres[0]?.count || 1} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </Card>
    </>
  );
}

/* ======================= Rated: tabella minimale ======================= */

function RatedGrid({ rows, user }: { rows: any[]; user: string }) {
  if (rows.length === 0) {
    return (
      <>
        <div className="text-sm text-zinc-400">You haven’t rated others’ picks yet.</div>
      </>
    );
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((v) => {
          const title = v?.movie?.title || "Untitled";
          const myScore = Number(v?.ratings?.[user]);
          const url = posterUrlFrom(v?.movie);

          const hue = scoreHue(myScore);
          const badgeStyle = {
            background: `hsl(${hue} 70% 18%)`,
            borderColor: `hsl(${hue} 70% 35%)`,
            color: `hsl(${hue} 90% 85%)`,
          } as React.CSSProperties;

          return (
            <div
              key={v.id}
              className="flex flex-col items-center rounded-xl border border-zinc-800/70 bg-zinc-900/60 p-3"
            >
              {/* Poster */}
              <div className="h-40 w-28 overflow-hidden rounded-md bg-zinc-800">
                {url ? (
                  <img src={url} alt={title} className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full w-full place-items-center text-xs text-zinc-400">
                    —
                  </div>
                )}
              </div>

              {/* Titolo */}
              <div className="mt-2 line-clamp-2 text-center text-sm font-medium">{title}</div>

              {/* Voto */}
              <div
                className="mt-2 inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-sm font-bold"
                style={badgeStyle}
                title="Your rating"
              >
                {myScore.toFixed(1)}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

/* ---------- Poster helpers ---------- */
function posterUrlFrom(movie: any): string | null {
  const direct =
    movie?.poster_url || movie?.poster || movie?.posterPath || movie?.posterpath;
  if (typeof direct === "string" && direct.startsWith("http")) return direct;

  const path = movie?.poster_path || movie?.posterPath || movie?.poster; // TMDB
  if (typeof path === "string" && path.length > 0) {
    if (path.startsWith("http")) return path;
    const clean = path.startsWith("/") ? path : `/${path}`;
    return `https://image.tmdb.org/t/p/w92${clean}`;
  }
  return null;
}

/* ---------- UI helpers ---------- */
function KPI({ title, value }: { title: string; value: React.ReactNode }) {
  return (
    <Card className="relative overflow-hidden">
      <div className="text-xs uppercase text-zinc-500">{title}</div>
      <div className="text-3xl font-extrabold tracking-tight">{value}</div>
      <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br from-indigo-500/20 to-emerald-500/20" />
    </Card>
  );
}

function SmallKPI({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border p-3 text-sm dark:border-zinc-700">
      <div className="text-xs uppercase text-zinc-500">{label}</div>
      <div className="text-xl font-bold">{value}</div>
    </div>
  );
}

function Donut({ value, size = 96 }: { value: number; size?: number }) {
  const clamped = Math.max(1, Math.min(10, value || 1));
  const pct = (clamped - 1) / 9; // 1..10 -> 0..1
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = Math.PI * 2 * r;
  const dash = c * pct;
  const hue = 20 + pct * 100; // 20→120
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="block">
      <g transform={`translate(${size / 2}, ${size / 2})`}>
        <circle
          r={r}
          cx={0}
          cy={0}
          stroke="currentColor"
          className="text-zinc-300 dark:text-zinc-800"
          strokeWidth={stroke}
          fill="none"
        />
        <circle
          r={r}
          cx={0}
          cy={0}
          stroke={`hsl(${hue} 80% 50%)`}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${dash} ${c - dash}`}
          transform="rotate(-90)"
          strokeLinecap="round"
        />
        <text x={0} y={6} textAnchor="middle" className="fill-current text-xl font-bold tabular-nums">
          {formatScore(clamped)}
        </text>
      </g>
    </svg>
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
          <div
            className="w-full rounded-md bg-gradient-to-t from-zinc-300 to-zinc-100 dark:from-zinc-800 dark:to-zinc-700"
            style={{ height: `${(c / max) * 72 + 4}px` }}
          />
          <span className="text-[10px] text-zinc-500">{i + 1}</span>
        </div>
      ))}
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
          <div
            className="h-2 rounded-full bg-gradient-to-r from-sky-500 to-indigo-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function scoreHue(n: number) {
  const s = Math.max(1, Math.min(10, Number(n) || 1));
  const t = (s - 4) / 6; // 4→0°, 10→120°
  return Math.max(0, Math.min(120, Math.round(t * 120)));
}

function formatScore(n: number) {
  return (Math.round(n * 100) / 100).toFixed(n % 1 === 0 ? 0 : 1);
}
