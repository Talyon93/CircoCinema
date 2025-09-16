// Profile.tsx
import React from "react";
import { Card } from "../Components/UI/Card";
import { HistoryCardExtended } from "../Components/UI/HistoryCardExtended";
import { fetchAvatarUrl, uploadAvatar, removeAvatar } from "../AvatarStorage";
import { Film, Star, BarChart3 } from "lucide-react";
// ⬇️ Usa lo stesso componente delle "Stats personali"
import { UserPanelClassic } from "../StatsKit/sections/UserPanelClassic/index"; // stesso path usato in Stats.tsx

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

  // ===================== Aggregazioni per "Stats personali" (come in Stats.tsx) =====================
  const avgOf = (r?: Record<string, number> | null) => {
    if (!r) return null;
    const vals = Object.values(r).map(Number).filter((x) => Number.isFinite(x));
    if (!vals.length) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  };

  // givenArr: per-utente media dei voti dati e conteggi
  const givenMap = React.useMemo(() => {
    const gm = new Map<string, { sum: number; n: number; scores: number[] }>();
    for (const v of history) {
      const ratings = (v?.ratings || {}) as Record<string, number>;
      for (const [u, sRaw] of Object.entries(ratings)) {
        const s = Number(sRaw);
        if (!Number.isFinite(s)) continue;
        const item = gm.get(u) || { sum: 0, n: 0, scores: [] };
        item.sum += s; item.n += 1; item.scores.push(s);
        gm.set(u, item);
      }
    }
    return gm;
  }, [history]);

  const givenArr = React.useMemo(
    () =>
      Array.from(givenMap, ([u, { sum, n, scores }]) => ({
        user: u,
        avg: sum / Math.max(1, n),
        count: n,
        scores,
      })).sort((a, b) => b.count - a.count || a.user.localeCompare(b.user)),
    [givenMap]
  );

  // receivedArr: per-utente media ricevuta sui film che ha portato
  const receivedMap = React.useMemo(() => {
    const rm = new Map<string, { sum: number; n: number }>();
    for (const v of history) {
      const a = avgOf(v?.ratings);
      const picker = v?.picked_by;
      if (a == null || !picker) continue;
      const cur = rm.get(picker) || { sum: 0, n: 0 };
      cur.sum += a; cur.n += 1;
      rm.set(picker, cur);
    }
    return rm;
  }, [history]);

  const receivedArr = React.useMemo(
    () =>
      Array.from(receivedMap, ([u, { sum, n }]) => ({
        user: u,
        avg: sum / Math.max(1, n),
        count: n,
      })).sort((a, b) => b.avg - a.avg || b.count - a.count),
    [receivedMap]
  );

  // userGenreLikes: per-utente mappa dei generi (totali e “positivi” ≥8)
  const userGenreLikes = React.useMemo(() => {
    const map = new Map<string, Map<string, { pos: number; tot: number }>>();
    for (const v of history) {
      const ratings = (v?.movie?.genres || []) as Array<{ name: string }>;
      const rMap = v?.ratings || {};
      for (const [u, sRaw] of Object.entries(rMap)) {
        const s = Number(sRaw);
        if (!Number.isFinite(s)) continue;
        const gmap = map.get(u) || new Map<string, { pos: number; tot: number }>();
        ratings.forEach((g) => {
          const name = g?.name?.trim();
          if (!name) return;
          const prev = gmap.get(name) || { pos: 0, tot: 0 };
          prev.tot += 1;
          if (s >= 8) prev.pos += 1;
          gmap.set(name, prev);
        });
        map.set(u, gmap);
      }
    }
    return map;
  }, [history]);

  // ---- UI ----
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
              style={{
                transform: `translateX(calc(${
                  ["picked", "rated", "stats"].indexOf(tab) // activeIndex
                } * 100% + ${
                  ["picked", "rated", "stats"].indexOf(tab) * 0.5
                }rem))`,
              }}
            />
            {[
              { key: "picked", label: "Picked", count: pickedByMe.length, icon: <Film className="h-4 w-4" /> },
              { key: "rated", label: "Rated", count: ratedByMeOnOthers.length, icon: <Star className="h-4 w-4" /> },
              { key: "stats", label: "Stats", count: (givenArr.find(g => g.user === user)?.count) ?? 0, icon: <BarChart3 className="h-4 w-4" /> },
            ].map((t) => {
              const active = t.key === tab;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key as TabKey)}
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
        )}

        {tab === "rated" && (
          <RatedGrid rows={ratedByMeOnOthers.slice().sort(sortByDateDesc)} user={user} />
        )}

        {/* ⬇️ QUI: stesse "Stats personali" del tab Stats → personali */}
        {tab === "stats" && (
          <div className="grid gap-5">
            <UserPanelClassic
              history={history}
              givenArr={givenArr}
              receivedArr={receivedArr}
              userGenreLikes={userGenreLikes}
              selectedUser={user}
              onSelectUser={() => {}}
              userOptions={[user]}
            />
          </div>
        )}
      </Card>
    </>
  );
}

/* ======================= Rated: tabella minimale ======================= */
function RatedGrid({ rows, user }: { rows: any[]; user: string }) {
  if (rows.length === 0) {
    return <div className="text-sm text-zinc-400">You haven’t rated others’ picks yet.</div>;
  }

  return (
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
            <div className="h-40 w-28 overflow-hidden rounded-md bg-zinc-800">
              {url ? (
                <img src={url} alt={title} className="h-full w-full object-cover" />
              ) : (
                <div className="grid h-full w-full place-items-center text-xs text-zinc-400">—</div>
              )}
            </div>

            <div className="mt-2 line-clamp-2 text-center text-sm font-medium">{title}</div>

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

function scoreHue(n: number) {
  const s = Math.max(1, Math.min(10, Number(n) || 1));
  const t = (s - 4) / 6; // 4→0°, 10→120°
  return Math.max(0, Math.min(120, Math.round(t * 120)));
}
