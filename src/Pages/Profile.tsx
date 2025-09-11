import React from "react";
import { Card } from "../Components/UI/Card";
import { HistoryCardExtended } from "../Components/UI/HistoryCardExtended";
import { fetchAvatarUrl, uploadAvatar, removeAvatar } from "../AvatarStorage";

type TabKey = "picked" | "rated";

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

  function sortByDateDesc(a: any, b: any) {
    const ta = a?.started_at ? new Date(a.started_at).getTime() : 0;
    const tb = b?.started_at ? new Date(b.started_at).getTime() : 0;
    if (ta !== tb) return tb - ta;
    if (typeof a.id === "number" && typeof b.id === "number") return a.id - b.id;
    return 0;
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
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
  }

  async function onClear() {
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
  }

  return (
    <>
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
                  onChange={onFile}
                  disabled={loading}
                />
              </label>

              {avatarUrl && (
                <button
                  className="rounded-xl border px-3 py-2 text-sm dark:border-zinc-700 disabled:opacity-50"
                  onClick={onClear}
                  disabled={loading}
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        </div>
      </Card>

      <Card>
        {/* Tabs */}
        <div className="mb-4 flex items-center gap-2">
          <button
            onClick={() => setTab("picked")}
            className={`rounded-xl px-3 py-2 text-sm transition ${
              tab === "picked"
                ? "bg-zinc-900 text-white dark:bg-zinc-800"
                : "border border-zinc-300 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800/60"
            }`}
          >
            Picked by you
            <span className="ml-2 rounded-md border px-1.5 py-0.5 text-xs dark:border-zinc-600">
              {pickedByMe.length}
            </span>
          </button>

          <button
            onClick={() => setTab("rated")}
            className={`rounded-xl px-3 py-2 text-sm transition ${
              tab === "rated"
                ? "bg-zinc-900 text-white dark:bg-zinc-800"
                : "border border-zinc-300 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800/60"
            }`}
          >
            Your ratings on others
            <span className="ml-2 rounded-md border px-1.5 py-0.5 text-xs dark:border-zinc-600">
              {ratedByMeOnOthers.length}
            </span>
          </button>
        </div>

        {/* Content */}
        {tab === "picked" ? (
          <>
            <h3 className="mb-3 text-lg font-semibold">🎬 Movies you picked</h3>
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
        ) : (
          <RatedGrid rows={ratedByMeOnOthers.slice().sort(sortByDateDesc)} user={user} />
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
        <h3 className="mb-3 text-lg font-semibold">⭐ Your ratings (minimal)</h3>
        <div className="text-sm text-zinc-400">You haven’t rated others’ picks yet.</div>
      </>
    );
  }

  return (
    <>
      <h3 className="mb-3 text-lg font-semibold">⭐ Your ratings (minimal)</h3>
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
              <div className="mt-2 line-clamp-2 text-center text-sm font-medium">
                {title}
              </div>

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

/* Poster: risolve TMDB poster_path e fallback */
function posterUrlFrom(movie: any): string | null {
  const direct =
    movie?.poster_url || movie?.poster || movie?.posterPath || movie?.posterpath;
  if (typeof direct === "string" && direct.startsWith("http")) return direct;

  const path = movie?.poster_path || movie?.posterPath || movie?.poster; // TMDB
  if (typeof path === "string" && path.length > 0) {
    // Se è solo il path TMDB, prefissa con una size piccola
    if (path.startsWith("http")) return path;
    const clean = path.startsWith("/") ? path : `/${path}`;
    return `https://image.tmdb.org/t/p/w92${clean}`;
  }
  return null;
}

function PosterThumb({ url, title }: { url: string | null; title: string }) {
  const [ok, setOk] = React.useState(Boolean(url));
  return ok && url ? (
    <img
      src={url}
      alt={title}
      className="h-14 w-10 rounded-md object-cover bg-zinc-800"
      onError={() => setOk(false)}
    />
  ) : (
    <div
      className="grid h-14 w-10 place-items-center rounded-md bg-zinc-800 text-[10px] text-zinc-300"
      title={title}
      aria-label={title}
    >
      —
    </div>
  );
}

/* ---------- helpers ---------- */
function scoreHue(n: number) {
  const s = Math.max(1, Math.min(10, Number(n) || 1));
  const t = (s - 4) / 6; // 4→0°, 10→120°
  return Math.max(0, Math.min(120, Math.round(t * 120)));
}

function formatDateTime(iso: string) {
  try {
    const d = new Date(iso);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    return `${dd}/${mm}/${yyyy}, ${hh}:${min}`;
  } catch {
    return "";
  }
}
