import React, { useEffect, useMemo, useState } from "react";

/**
 * Circo Cinema – complete app
 * - Vote flow with "Picked by", live stats, edit vote
 * - History: Extended + Compact (aligned like spreadsheet row)
 * - Profile: avatar + list of movies you picked
 * - localStorage sync across tabs
 * - Lazy TMDB metadata (poster/overview) caching
 * - Optional seeding if history is empty (tries ./seed or /circo_seed.json)
 */

// ============================
// Config / keys
// ============================
const TMDB_API_KEY = "99cb7c79bbe966a91a2ffcb7a3ea3d37";

const K_USER = "cn_user";
const K_VIEWINGS = "cn_viewings";
const K_ACTIVE_VOTE = "cn_active_vote";       // { id, movie, picked_by, started_at }
const K_ACTIVE_RATINGS = "cn_active_ratings"; // { [user]: number }
const K_PROFILE_PREFIX = "cn_profile_";       // `${K_PROFILE_PREFIX}${username}` -> { avatar?: string }
const K_TMDB_CACHE = "cn_tmdb_cache";         // cache poster/overview per titolo

// ============================
// Helpers
// ============================

// piccola pausa per non bombardare TMDB (opzionale)
const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

/** Completa poster/overview/genres per un film dato, usando TMDB. */
async function enrichFromTmdbByTitleOrId(movie: any) {
  try {
    // se già ha i generi esci
    if (Array.isArray(movie?.genres) && movie.genres.length) return movie;

    // se ho l'id TMDB, prendo i dettagli diretti
    if (movie?.id) {
      const det = await tmdbDetails(movie.id);
      if (det) {
        return {
          ...movie,
          poster_path: movie.poster_path ?? det.poster_path,
          overview: movie.overview ?? det.overview,
          genres: det.genres || [],
        };
      }
    }

    // altrimenti cerco per titolo e poi details
    const title = movie?.title || "";
    if (!title) return movie;

    const search = await tmdbSearch(title);
    const first = search?.[0];
    if (!first?.id) return movie;
    const det = await tmdbDetails(first.id);
    if (!det) return movie;

    return {
      ...movie,
      id: movie.id ?? first.id,
      poster_path: movie.poster_path ?? det.poster_path ?? first.poster_path,
      overview: movie.overview ?? det.overview ?? "",
      genres: det.genres || [],
    };
  } catch {
    return movie;
  }
}

function getAverage(r: Record<string, number> | undefined | null) {
    if (!r) return null;
    const vals = Object.values(r).map(Number);
    if (!vals.length) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }

function posterUrl(p?: string, size: "w185" | "w342" = "w185") {
  if (!p) return "";
  if (p.startsWith("http")) return p;
  return `https://image.tmdb.org/t/p/${size}${p}`;
}
function formatScore(n: number) {
  const s = (Math.round(n * 100) / 100).toFixed(2);
  return s.replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
}
function roundToQuarter(n: number) {
  return Math.round(n / 0.25) * 0.25;
}
function lsGetJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function lsSetJSON(key: string, value: any) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}
function loadAvatarFor(name: string): string | null {
  try {
    const raw = localStorage.getItem(`${K_PROFILE_PREFIX}${name}`);
    if (!raw) return null;
    const obj = JSON.parse(raw || "{}");
    return obj?.avatar || null;
  } catch {
    return null;
  }
}

// TMDB search/details
async function tmdbSearch(query: string) {
  const q = (query || "").trim();
  if (!q) return [] as any[];
  try {
    const url = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(
      q
    )}&language=en-US`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return (data?.results || []) as any[];
  } catch {
    return [];
  }
}
async function tmdbDetails(tmdbId: number) {
  try {
    const url = `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${TMDB_API_KEY}&language=en-US`;
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// Assicura che il movie abbia almeno genres (e, già che ci siamo, completiamo poster/overview se mancano)
async function ensureGenres(movie: any): Promise<any> {
    try {
      // Se i generi ci sono già, esci
      if (Array.isArray(movie?.genres) && movie.genres.length) return movie;
  
      // Se ho un id TMDB, prendo i dettagli completi
      if (movie?.id) {
        const det = await tmdbDetails(movie.id);
        if (det) {
          return {
            ...movie,
            // priorità ai campi già presenti, ma se mancano prendili dai dettagli
            poster_path: movie.poster_path ?? det.poster_path,
            overview: movie.overview ?? det.overview,
            genres: det.genres || [],
          };
        }
      }
    } catch {}
    // fallback: torna com’è
    return movie;
  }
  

// TMDB metadata cache for History seed entries
type MetaCache = Record<string, { poster_path?: string; overview?: string }>;
function getMetaCache(): MetaCache {
  return lsGetJSON<MetaCache>(K_TMDB_CACHE, {});
}
function setMetaCache(cache: MetaCache) {
  lsSetJSON(K_TMDB_CACHE, cache);
}
async function fetchMetaForTitle(title: string): Promise<{ poster_path?: string; overview?: string } | null> {
  const q = (title || "").trim();
  if (!q) return null;

  try {
    // 1) search
    const searchUrl = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(q)}&language=en-US`;
    const sres = await fetch(searchUrl);
    if (!sres.ok) return null;
    const sdata = await sres.json();
    const first = (sdata?.results || [])[0];
    if (!first?.id) return null;

    // 2) details
    const detUrl = `https://api.themoviedb.org/3/movie/${first.id}?api_key=${TMDB_API_KEY}&language=en-US`;
    const dres = await fetch(detUrl);
    if (!dres.ok) return null;
    const det = await dres.json();

    return { poster_path: det?.poster_path || first?.poster_path, overview: det?.overview || "" };
  } catch {
    return null;
  }
}

// ============================
// UI primitives
// ============================
function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-gray-200 bg-white p-4 shadow-sm ${className}`}>{children}</div>;
}

function Header({
  user,
  onLogout,
  tab,
  setTab,
}: {
  user: string;
  onLogout: () => void;
  tab: "vote" | "history" | "profile";
  setTab: (t: "vote" | "history" | "profile") => void;
}) {
  return (
    <div className="flex flex-col gap-2 py-4 md:flex-row md:items-center md:justify-between">
      <h1 className="text-2xl font-bold">🎞️ Circo Cinema</h1>
      <div className="flex items-center gap-4">
        <nav className="flex gap-2">
          <button
            onClick={() => setTab("vote")}
            className={`rounded-xl border px-3 py-2 ${tab === "vote" ? "bg-black text-white" : "bg-white"}`}
          >
            Vote
          </button>
          <button
            onClick={() => setTab("history")}
            className={`rounded-xl border px-3 py-2 ${tab === "history" ? "bg-black text-white" : "bg-white"}`}
          >
            History
          </button>
          <button
            onClick={() => setTab("profile")}
            className={`rounded-xl border px-3 py-2 ${tab === "profile" ? "bg-black text-white" : "bg-white"}`}
          >
            Profile
          </button>
        </nav>
        <span className="text-sm">
          Hi, <b>{user}</b>
        </span>
        <button onClick={onLogout} className="rounded-xl border px-3 py-1">
          Sign out
        </button>
      </div>
    </div>
  );
}

function Login({ onLogin }: { onLogin: (name: string) => void }) {
  const [name, setName] = useState("");
  return (
    <div className="mx-auto mt-24 max-w-md">
      <Card>
        <h2 className="mb-2 text-xl font-semibold">Enter your name</h2>
        <p className="mb-4 text-sm text-gray-600">If you used this name before, your profile image and picks will be restored.</p>
        <div className="flex gap-2">
          <input
            className="flex-1 rounded-xl border px-3 py-2"
            placeholder="e.g. Talyon"
            value={name}
            onChange={(e) => setName(e.target.value.trimStart())}
          />
          <button
            className="rounded-xl bg-black px-4 py-2 text-white disabled:opacity-30"
            disabled={!name}
            onClick={() => onLogin(name)}
          >
            Continue
          </button>
        </div>
      </Card>
    </div>
  );
}

// ============================
// Search + pickers
// ============================
function SearchMovie({ onPick }: { onPick: (movie: any) => void }) {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const search = async () => {
    setErr(null);
    setLoading(true);
    try {
      const res = await tmdbSearch(q);
      setResults(res.slice(0, 12));
    } catch (e: any) {
      setErr(e?.message || "Search error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <label className="text-sm">Search a movie</label>
          <input
            className="w-full rounded-xl border px-3 py-2"
            placeholder="e.g. The Matrix"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search()}
          />
        </div>
        <button onClick={search} className="rounded-xl bg-black px-4 py-2 text-white disabled:opacity-30" disabled={!q || loading}>
          {loading ? "..." : "Search"}
        </button>
      </div>
      {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {results.map((r) => (
          <div
            key={r.id}
            className="flex cursor-pointer gap-3 rounded-xl border p-2 hover:bg-gray-50"
            onClick={() => onPick(r)}
          >
            {r.poster_path && <img src={posterUrl(r.poster_path, "w185")} alt={r.title} className="h-24 w-16 rounded-lg object-cover" />}
            <div className="flex-1">
              <div className="font-semibold">
                {r.title} {r.release_date ? <span className="text-gray-500">({r.release_date?.slice(0, 4)})</span> : null}
              </div>
              <div className="line-clamp-3 text-sm text-gray-700">{r.overview}</div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function RatingBar({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-3">
      <input
        type="range"
        min={1}
        max={10}
        step={0.25}
        value={value}
        onChange={(e) => onChange(parseFloat((e.target as HTMLInputElement).value))}
        className="w-full"
      />
      <div className="w-12 text-center font-semibold">{formatScore(value)}</div>
    </div>
  );
}

/** StartVoteCard: choose movie and "Picked by" */
function StartVoteCard({
  movie,
  knownUsers,
  onStartVoting,
}: {
  movie: any;
  knownUsers: string[];
  onStartVoting: (movie: any, pickedBy: string) => void;
}) {
  const [pickedBy, setPickedBy] = useState("");
  const valid = pickedBy.trim().length > 0;

  return (
    <Card>
      <div className="flex gap-4">
        {movie.poster_path && <img src={posterUrl(movie.poster_path, "w342")} className="h-48 w-32 rounded-xl object-cover" alt={movie.title} />}
        <div className="flex-1">
          <h3 className="text-xl font-bold">
            {movie.title} {movie.release_date ? <span className="text-gray-500">({movie.release_date.slice(0, 4)})</span> : null}
          </h3>
          <p className="mt-1 whitespace-pre-wrap text-gray-700">{movie.overview}</p>

          <div className="mt-4 grid gap-2">
            <label className="text-sm font-medium">Picked by</label>
            <input
              list="known-users"
              className="max-w-sm rounded-xl border px-3 py-2"
              placeholder="Choose a name or type a new one"
              value={pickedBy}
              onChange={(e) => setPickedBy(e.target.value)}
            />
            <datalist id="known-users">
              {knownUsers.map((u) => (
                <option key={u} value={u} />
              ))}
            </datalist>
          </div>

          <div className="mt-3">
            <button className="rounded-xl bg-black px-4 py-2 text-white disabled:opacity-30" disabled={!valid} onClick={() => onStartVoting(movie, pickedBy.trim())}>
              Start voting
            </button>
          </div>
        </div>
      </div>
    </Card>
  );
}

// ============================
// Voting (with Edit vote)
// ============================
function Avatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");
  const avatar = loadAvatarFor(name);
  if (avatar) return <img src={avatar} className="h-8 w-8 rounded-full object-cover" alt={name} />;
  return <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-xs font-semibold">{initials || "?"}</div>;
}

function ActiveVoting({
  movie,
  pickedBy,
  currentUser,
  ratings,
  onSendVote,
  onEnd,
}: {
  movie: any;
  pickedBy?: string;
  currentUser: string;
  ratings: Record<string, number>;
  onSendVote: (score: number) => void;
  onEnd: () => void;
}) {
  const you = ratings[currentUser];
  const hasVoted = typeof you === "number";

  const [openVote, setOpenVote] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [temp, setTemp] = useState<number>(you ?? 7);

  useEffect(() => {
    if (typeof you === "number") setTemp(you);
  }, [you]);

  const submit = () => {
    const fixed = roundToQuarter(temp);
    onSendVote(fixed);
    setOpenVote(false);
    setEditMode(false);
  };

  const entries = Object.entries(ratings) as [string, number][];
  const sorted = entries.sort((a, b) => {
    if (a[0] === currentUser) return -1;
    if (b[0] === currentUser) return 1;
    if (b[1] !== a[1]) return b[1] - a[1];
    return a[0].localeCompare(b[0]);
  });

  const scores = entries.map(([, n]) => Number(n));
  const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;

  return (
    <Card className="p-5">
      <div className="flex flex-col gap-5 md:flex-row">
        {movie.poster_path && <img src={posterUrl(movie.poster_path, "w342")} className="h-48 w-32 flex-shrink-0 rounded-xl object-cover" alt={movie.title} />}

        <div className="flex-1">
          <div className="flex items-start gap-4">
            <div className="flex-1">
              <div className="text-xl font-bold">Voting in progress · {movie.title}</div>
              {pickedBy && (
                <div className="text-sm">
                  <span className="rounded-full bg-black px-2 py-1 text-white">
                    Picked by: <b>{pickedBy}</b>
                  </span>
                </div>
              )}
            </div>
          </div>

          <p className="mt-2 text-gray-700">{movie.overview}</p>

          <div className="mt-3 flex w-full items-stretch gap-3">
            <div className="flex-1 rounded-2xl border bg-gray-50 px-4 py-3">
              <div className="text-xs uppercase text-gray-500">Votes</div>
              <div className="text-2xl font-bold leading-6">{scores.length}</div>
            </div>
            <div className="flex-1 rounded-2xl border bg-gray-50 px-4 py-3">
              <div className="text-xs uppercase text-gray-500">Live avg</div>
              <div className="text-2xl font-bold leading-6">{avg !== null ? formatScore(avg) : "—"}</div>
            </div>
          </div>

          {!hasVoted ? (
            <div className="mt-4">
              {!openVote ? (
                <button className="rounded-xl bg-black px-4 py-2 text-white" onClick={() => setOpenVote(true)}>
                  Vote
                </button>
              ) : (
                <div className="mt-2 rounded-2xl border p-3">
                  <div className="mb-2 text-sm">Choose your score</div>
                  <RatingBar value={temp} onChange={(v) => setTemp(roundToQuarter(v))} />
                  <div className="mt-2 flex gap-2">
                    <button className="rounded-xl bg-black px-4 py-2 text-white" onClick={submit}>
                      Submit vote
                    </button>
                    <button
                      className="rounded-xl border px-3 py-2"
                      onClick={() => {
                        setOpenVote(false);
                        setTemp(you ?? 7);
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              {!editMode ? (
                <div className="mt-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 rounded-2xl border bg-gray-50 p-3 text-sm">
                    <span className="inline-block h-2 w-2 rounded-full bg-green-600" />
                    <span>
                      <b>Vote saved.</b> Please wait for others…
                    </span>
                  </div>
                  <button
                    className="rounded-xl border px-3 py-2"
                    onClick={() => {
                      setTemp(you ?? 7);
                      setEditMode(true);
                    }}
                  >
                    Edit vote
                  </button>
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border p-3">
                  <div className="mb-2 text-sm">
                    Edit your vote <span className="text-gray-500">(current: {formatScore(you)})</span>
                  </div>
                  <RatingBar value={temp} onChange={(v) => setTemp(roundToQuarter(v))} />
                  <div className="mt-2 flex gap-2">
                    <button className="rounded-xl bg-black px-4 py-2 text-white" onClick={submit}>
                      Save
                    </button>
                    <button
                      className="rounded-xl border px-3 py-2"
                      onClick={() => {
                        setEditMode(false);
                        setTemp(you ?? 7);
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          <div className="mt-5">
            <div className="mb-2 text-sm font-semibold">Live votes</div>
            {sorted.length === 0 ? (
              <div className="rounded-xl border bg-white p-3 text-sm text-gray-600">No votes yet — be the first!</div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {sorted.map(([name, score]) => {
                  const isYou = name === currentUser;
                  return (
                    <div key={name} className={`flex items-center gap-3 rounded-2xl border bg-white p-3 ${isYou ? "ring-2 ring-black" : ""}`}>
                      <Avatar name={name} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">
                          {name} {isYou && <span className="ml-1 rounded bg-black px-1.5 py-0.5 text-xs font-semibold text-white">You</span>}
                        </div>
                      </div>
                      <div className="rounded-full border px-2 py-0.5 text-sm font-semibold">{formatScore(score)}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-5">
            <button className="rounded-xl border px-4 py-2" onClick={onEnd}>
              End voting
            </button>
          </div>
        </div>
      </div>
    </Card>
  );
}

// ============================
// History cards (Extended + Compact)
// ============================
function HistoryCardExtended({ v }: { v: any }) {
    const ratings = (v.ratings || {}) as Record<string, number>;
    const scores = Object.values(ratings).map(Number);
    const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
  
    // ---- Colore gradiente per la media (1 → rosso, 10 → verde)
    const avgHue = (() => {
      if (avg == null) return 0;
      const t = Math.max(1, Math.min(10, avg));
      return ((t - 3) / 8) * 120; // 0..120
    })();
  
    // ---- Avatar del picker
    function PickerAvatar({ name }: { name: string }) {
      const avatar = loadAvatarFor(name);
      if (avatar) {
        return (
          <img
            src={avatar}
            alt={name}
            className="h-8 w-8 rounded-full object-cover ring-2 ring-white shadow"
          />
        );
      }
      const initial = name?.[0]?.toUpperCase() || "?";
      return (
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-sm font-bold ring-2 ring-white shadow">
          {initial}
        </div>
      );
    }
  
    // ---- Meta locale + lazy fetch + cache
    const [meta, setMeta] = React.useState<{ poster_path?: string; overview?: string }>(() => ({
      poster_path: v?.movie?.poster_path,
      overview: v?.movie?.overview,
    }));
  
    React.useEffect(() => {
      const title = v?.movie?.title || "";
      if (!title) return;
  
      const needPoster = !meta?.poster_path;
      const needOverview = !meta?.overview;
      if (!needPoster && !needOverview) return;
  
      const cache = getMetaCache();
      const cached = cache[title];
      if (cached && (cached.poster_path || cached.overview)) {
        setMeta(m => ({
          poster_path: m.poster_path || cached.poster_path,
          overview: m.overview || cached.overview,
        }));
        return;
      }
  
      (async () => {
        const fetched = await fetchMetaForTitle(title);
        if (fetched) {
          setMeta(m => ({
            poster_path: m.poster_path || fetched.poster_path,
            overview: m.overview || fetched.overview,
          }));
          const c = getMetaCache();
          c[title] = { poster_path: fetched.poster_path, overview: fetched.overview };
          setMetaCache(c);
        }
      })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [v?.movie?.title]);
  
    const poster = meta?.poster_path || v?.movie?.poster_path;
    const overview = meta?.overview ?? v?.movie?.overview;
  
    return (
      <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm ring-1 ring-black/5 transition hover:shadow-md">
        {/* HEADER */}
        <div className="mb-3 flex flex-wrap items-center gap-3">
          {v.picked_by && (
            <div className="flex items-center gap-2 rounded-full bg-gray-50 px-2 py-1">
              <PickerAvatar name={v.picked_by} />
              <span className="text-sm font-medium">{v.picked_by}</span>
            </div>
          )}
          <div className="mx-1 text-gray-300">•</div>
          <h3 className="min-w-0 text-lg font-semibold leading-tight">
            <span className="break-words">{v.movie?.title || "Untitled"}</span>
          </h3>
          {v.started_at && (
            <span className="ml-auto rounded-full bg-gray-50 px-2.5 py-1 text-xs text-gray-600">
              {new Date(v.started_at).toLocaleString()}
            </span>
          )}
        </div>
  
        {/* BODY: poster + overview */}
        <div className="grid gap-4 md:grid-cols-[120px,1fr]">
          <div className="flex justify-center md:justify-start">
            {poster ? (
              <img
                src={posterUrl(poster, "w185")}
                alt={v.movie?.title}
                className="h-44 w-28 rounded-2xl border border-gray-200 object-cover shadow-sm"
              />
            ) : (
              <div className="flex h-44 w-28 items-center justify-center rounded-2xl border border-dashed text-xs text-gray-500">
                No poster
              </div>
            )}
          </div>
  
          <p className="min-w-0 whitespace-pre-wrap text-[15px] leading-relaxed text-gray-800">
            {overview && overview.trim().length > 0 ? overview : "No description available."}
          </p>
        </div>
  
        {/* FOOTER: media + voti */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {avg !== null && (
            <div
              className="flex items-center gap-2 rounded-full px-3 py-1 text-sm font-bold text-white shadow"
              style={{
                background: `linear-gradient(90deg, hsl(${avgHue} 70% 45%) 0%, hsl(${avgHue} 70% 55%) 100%)`,
              }}
              aria-label={`Average ${formatScore(avg)}`}
              title={`Average ${formatScore(avg)}`}
            >
              {/* stellina svg per un look più pulito */}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-4 w-4"
              >
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.803 2.036a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118L10.95 14.9a1 1 0 00-1.175 0l-2.984 2.083c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.155 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.95-.69l1.895-3.293z" />
              </svg>
              <span>Avg {formatScore(avg)}</span>
              <span className="ml-1 text-xs opacity-85">({scores.length})</span>
            </div>
          )}
  
          <div className="flex flex-wrap gap-2">
            {Object.entries(ratings).map(([n, s]) => (
              <span
                key={n}
                className="rounded-2xl border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs text-gray-800 shadow-sm"
                title={`${n}: ${formatScore(Number(s))}`}
              >
                {n}: {formatScore(Number(s))}
              </span>
            ))}
          </div>
        </div>
      </div>
    );
  }
  
  

function HistoryCardCompact({ v }: { v: any }) {
    const ratings = (v.ratings || {}) as Record<string, number>;
    const scores = Object.values(ratings).map(Number);
    const avg =
      scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
  
    // colore sfumato in base alla media (1 → rosso, 10 → verde)
    const avgHue = (() => {
      if (avg == null) return 0;
      // 1..10 → 0..120 (rosso → verde). Clamp per sicurezza.
      const t = Math.max(1, Math.min(10, avg));
      return ((t - 3) / 8) * 120;
    })();
  
    function PickerAvatar({ name }: { name: string }) {
      const avatar = loadAvatarFor(name);
      if (avatar) {
        return (
          <img
            src={avatar}
            alt={name}
            className="h-7 w-7 rounded-full object-cover ring-2 ring-white shadow"
          />
        );
      }
      const initial = name?.[0]?.toUpperCase() || "?";
      return (
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-200 text-xs font-bold ring-2 ring-white shadow">
          {initial}
        </div>
      );
    }
  
    return (
      <div className="rounded-2xl border border-gray-200 bg-white/80 p-3 shadow-sm transition hover:shadow-md">
        {/* RIGA 1 — picker + titolo */}
        <div className="flex flex-wrap items-center gap-2">
          {v.picked_by && (
            <div className="flex items-center gap-2 rounded-full bg-gray-50 px-2 py-1">
              <PickerAvatar name={v.picked_by} />
              <span className="text-sm font-medium">{v.picked_by}</span>
            </div>
          )}
          <div className="mx-1 text-gray-300">•</div>
          <div className="min-w-0 text-[15px] font-semibold leading-tight">
            <span className="break-words">{v.movie?.title || "Untitled"}</span>
          </div>
        </div>
  
        {/* RIGA 2 — media + voti */}
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {avg !== null && (
            <div
              className="flex items-center gap-2 rounded-full px-3 py-1 text-sm font-bold text-white shadow"
              style={{
                background: `linear-gradient(90deg, hsl(${avgHue} 70% 45%) 0%, hsl(${avgHue} 70% 55%) 100%)`,
              }}
              aria-label={`Average ${formatScore(avg)}`}
              title={`Average ${formatScore(avg)}`}
            >
              <span className="leading-none">★</span>
              <span>Avg {formatScore(avg)}</span>
            </div>
          )}
  
          <div className="flex flex-wrap gap-2">
            {Object.entries(ratings).map(([n, s]) => (
              <span
                key={n}
                className="rounded-2xl border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs text-gray-800 shadow-sm"
                title={`${n}: ${formatScore(Number(s))}`}
              >
                {n}: {formatScore(Number(s))}
              </span>
            ))}
          </div>
        </div>
      </div>
    );
  }
  
  
  function HistoryFilters({
    pickers,
    genres,
    picker,
    setPicker,
    genre,
    setGenre,
    sort,
    setSort,
    onReset
  }: {
    pickers: string[];
    genres: string[];
    picker: string;
    setPicker: (v: string) => void;
    genre: string;
    setGenre: (v: string) => void;
    sort: "date-desc" | "date-asc" | "avg-desc" | "avg-asc" | "votes-desc" | "votes-asc";
    setSort: (v: "date-desc" | "date-asc" | "avg-desc" | "avg-asc" | "votes-desc" | "votes-asc") => void;
    onReset: () => void;
  }) {
    return (
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="grid gap-3 md:grid-cols-3">
          {/* Picker */}
          <div className="flex flex-col">
            <label className="text-xs text-gray-600">Picked by</label>
            <select
              className="rounded-xl border px-3 py-2"
              value={picker}
              onChange={(e) => setPicker(e.target.value)}
            >
              <option value="">All</option>
              {pickers.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
  
          {/* Genre */}
          <div className="flex flex-col">
            <label className="text-xs text-gray-600">Genre</label>
            <select
              className="rounded-xl border px-3 py-2"
              value={genre}
              onChange={(e) => setGenre(e.target.value)}
            >
              <option value="">All</option>
              {genres.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>
  
          {/* Sort */}
          <div className="flex flex-col">
            <label className="text-xs text-gray-600">Sort by</label>
            <select
              className="rounded-xl border px-3 py-2"
              value={sort}
              onChange={(e) =>
                setSort(e.target.value as any)
              }
            >
              <option value="date-desc">Date ↓ (newest)</option>
              <option value="date-asc">Date ↑ (oldest)</option>
              <option value="avg-desc">Average ↓</option>
              <option value="avg-asc">Average ↑</option>
              <option value="votes-desc">Votes count ↓</option>
              <option value="votes-asc">Votes count ↑</option>
            </select>
          </div>
        </div>
  
        <div className="flex gap-2">
          <button className="rounded-xl border px-3 py-2" onClick={onReset}>
            Reset
          </button>
        </div>
      </div>
    );
  }
  

// ============================
// Profile – avatar + list of movies you picked (reuse HistoryCardExtended)
// ============================
function Profile({ user, history, onAvatarSaved }: { user: string; history: any[]; onAvatarSaved?: () => void }) {
  const profileKey = `${K_PROFILE_PREFIX}${user}`;
  const [avatar, setAvatar] = useState<string | null>(loadAvatarFor(user));
  const pickedByMe = useMemo(() => history.filter((h) => h?.picked_by === user), [history, user]);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      setAvatar(dataUrl);
      lsSetJSON(profileKey, { avatar: dataUrl });
      onAvatarSaved?.();
    };
    reader.readAsDataURL(file);
  }
  function clearAvatar() {
    localStorage.removeItem(profileKey);
    setAvatar(null);
    onAvatarSaved?.();
  }

  return (
    <>
      <Card>
        <h3 className="mb-3 text-lg font-semibold">👤 Your profile</h3>
        <div className="flex items-start gap-3">
          {avatar ? (
            <img src={avatar} className="h-20 w-20 rounded-full object-cover" alt={user} />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gray-200 text-xl font-bold">
              {user.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div>
            <div className="text-sm text-gray-700">
              Logged in as <b>{user}</b>
            </div>
            <div className="mt-2 flex gap-2">
              <label className="cursor-pointer rounded-xl border px-3 py-2 text-sm">
                Change image
                <input type="file" accept="image/*" onChange={onFile} className="hidden" />
              </label>
              {avatar && (
                <button className="rounded-xl border px-3 py-2 text-sm" onClick={clearAvatar}>
                  Remove
                </button>
              )}
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <h3 className="mb-3 text-lg font-semibold">🎬 Movies you picked</h3>
        <div className="grid gap-3">
          {pickedByMe.length === 0 ? (
            <div className="text-sm text-gray-600">No movies yet. Start one from the “Vote” tab.</div>
          ) : (
            pickedByMe
              .slice()
              .sort((a, b) => {
                const ta = a?.started_at ? new Date(a.started_at).getTime() : 0;
                const tb = b?.started_at ? new Date(b.started_at).getTime() : 0;
                if (ta !== tb) return tb - ta;
                if (typeof a.id === "number" && typeof b.id === "number") return a.id - b.id;
                return 0;
              })
              .map((v) => <HistoryCardExtended key={v.id} v={v} />)
          )}
        </div>
      </Card>
    </>
  );
}

// ============================
// App
// ============================

export default function CinemaNightApp() {

    
  const [user, setUser] = useState<string>("");
  const [tab, setTab] = useState<"vote" | "history" | "profile">("vote");

  const [pickedMovie, setPickedMovie] = useState<any | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [activeVote, setActiveVote] = useState<any | null>(null);
  const [activeRatings, setActiveRatings] = useState<Record<string, number>>({});
  const [historyMode, setHistoryMode] = useState<"extended" | "compact">("extended");

    // Filters / sort for History
    const [filterPicker, setFilterPicker] = useState<string>("");
    const [filterGenre, setFilterGenre] = useState<string>("");
    const [sortKey, setSortKey] = useState<"date-desc" | "date-asc" | "avg-desc" | "avg-asc" | "votes-desc" | "votes-asc">("date-desc");
    const [isBackfilling, setIsBackfilling] = useState(false);


    const backfillHistoryGenres = async () => {
        if (isBackfilling) return;
        setIsBackfilling(true);
        try {
          const list = lsGetJSON<any[]>(K_VIEWINGS, []);
          let changed = false;
      
          // aggiorna in serie (meno rischio rate-limit); puoi fare in parallelo se vuoi.
          for (let i = 0; i < list.length; i++) {
            const v = list[i];
            const hasGenres = Array.isArray(v?.movie?.genres) && v.movie.genres.length > 0;
            if (hasGenres) continue;
      
            const enriched = await enrichFromTmdbByTitleOrId(v.movie);
            if (enriched !== v.movie) {
              list[i] = { ...v, movie: enriched };
              changed = true;
            }
            // pausa delicata per TMDB
            await sleep(200);
          }
      
          if (changed) {
            lsSetJSON(K_VIEWINGS, list);
            setHistory(list);
          }
        } finally {
          setIsBackfilling(false);
        }
      };
      


    // only pickers that actually picked something
    const pickerOptions = useMemo(() => {
        const s = new Set<string>();
        for (const h of history) if (h?.picked_by) s.add(h.picked_by);
        return Array.from(s).sort((a, b) => a.localeCompare(b));
    }, [history]);
    
    // genres present in history (TMDB details add movie.genres: {id,name}[])
    const genreOptions = useMemo(() => {
        const s = new Set<string>();
        for (const h of history) {
        const arr = (h?.movie?.genres || []) as Array<{ id: number; name: string }>;
        arr?.forEach((g) => g?.name && s.add(g.name));
        }
        return Array.from(s).sort((a, b) => a.localeCompare(b));
    }, [history]);


    const filteredSortedHistory = useMemo(() => {
        let L = history.slice();
      
        // filter by picker
        if (filterPicker) L = L.filter(h => (h?.picked_by || "") === filterPicker);
      
        // filter by genre (movie.genres array)
        if (filterGenre) {
          L = L.filter(h => {
            const arr = (h?.movie?.genres || []) as Array<{ id: number; name: string }>;
            return arr?.some(g => g?.name === filterGenre);
          });
        }
      
        // sort
        L.sort((a, b) => {
          const aDate = a?.started_at ? new Date(a.started_at).getTime() : 0;
          const bDate = b?.started_at ? new Date(b.started_at).getTime() : 0;
          const aAvg = getAverage(a?.ratings);
          const bAvg = getAverage(b?.ratings);
          const aVotes = a?.ratings ? Object.keys(a.ratings).length : 0;
          const bVotes = b?.ratings ? Object.keys(b.ratings).length : 0;
      
          switch (sortKey) {
            case "date-asc":
              return aDate - bDate;
            case "date-desc":
              return bDate - aDate;
            case "avg-asc":
              return (aAvg ?? -Infinity) - (bAvg ?? -Infinity);
            case "avg-desc":
              return (bAvg ?? -Infinity) - (aAvg ?? -Infinity);
            case "votes-asc":
              return aVotes - bVotes;
            case "votes-desc":
              return bVotes - aVotes;
            default:
              return 0;
          }
        });
      
        return L;
      }, [history, filterPicker, filterGenre, sortKey]);
      
  // Known users from history (for datalist)
  const knownUsers = useMemo(() => {
    const set = new Set<string>();
    for (const h of history) {
      Object.keys(h?.ratings || {}).forEach((u) => set.add(u));
      if (h?.picked_by) set.add(h.picked_by);
    }
    if (user) set.add(user);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
    }, [history, user]);

    // Init + realtime sync + seed if empty
    useEffect(() => {
        (async () => {
        setUser(lsGetJSON<string | null>(K_USER, "") || "");

        // history with optional seeding
    let hist = lsGetJSON<any[]>(K_VIEWINGS, []);
    if (hist.length === 0) {
    // try dynamic import of ./seed (if exists)
    try {
        // @ts-ignore
        const mod = await import("./seed");
        if (Array.isArray(mod?.CIRCO_SEED) && mod.CIRCO_SEED.length) {
        hist = mod.CIRCO_SEED as any[];
        }
    } catch {}
    // fallback: try /circo_seed.json in public
    if (hist.length === 0) {
        try {
        const res = await fetch("/circo_seed.json");
        if (res.ok) {
            const arr = await res.json();
            if (Array.isArray(arr) && arr.length) hist = arr;
        }
        } catch {}
    }
    if (hist.length > 0) {
        // 🔄 inverti l'ordine del CSV/seed: ultima riga in cima
        hist = hist.slice().reverse();
        lsSetJSON(K_VIEWINGS, hist);
    }
    }
    setHistory(hist);
      setActiveVote(lsGetJSON<any | null>(K_ACTIVE_VOTE, null));
      setActiveRatings(lsGetJSON<Record<string, number>>(K_ACTIVE_RATINGS, {}));

      const onStorage = (e: StorageEvent) => {
        if (e.key === K_ACTIVE_VOTE) setActiveVote(lsGetJSON<any | null>(K_ACTIVE_VOTE, null));
        if (e.key === K_ACTIVE_RATINGS) setActiveRatings(lsGetJSON<Record<string, number>>(K_ACTIVE_RATINGS, {}));
        if (e.key === K_VIEWINGS) setHistory(lsGetJSON<any[]>(K_VIEWINGS, []));
      };
      window.addEventListener("storage", onStorage);
      return () => window.removeEventListener("storage", onStorage);
    })();
  }, []);

  useEffect(() => {
    const hasAnyGenre = history.some(
      (h) => Array.isArray(h?.movie?.genres) && h.movie.genres.length > 0
    );
    if (!hasAnyGenre && history.length > 0) {
      backfillHistoryGenres();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history.length]);

  // Auth
  const login = (name: string) => {
    localStorage.setItem(K_USER, name);
    setUser(name);
  };
  const logout = () => {
    localStorage.removeItem(K_USER);
    setUser("");
  };

  // Search pick
  const onPick = async (res: any) => {
    const details = await tmdbDetails(res.id);
    setPickedMovie(details || res);
  };

  const startVoting = async (movie: any, pickedBy: string) => {
    // completa i metadati (soprattutto genres) dal TMDB se servono
    const movieWithGenres = await ensureGenres(movie);
  
    const session = {
      id: Date.now(),
      movie: {
        ...movieWithGenres,
        genres: Array.isArray(movieWithGenres?.genres) ? movieWithGenres.genres : [],
      },
      picked_by: pickedBy,
      started_at: new Date().toISOString(),
    };
  
    lsSetJSON(K_ACTIVE_VOTE, session);
    lsSetJSON(K_ACTIVE_RATINGS, {});
    setActiveVote(session);
    setActiveRatings({});
  };
  

  // Send vote
  const sendVote = (score: number) => {
    if (!user || !activeVote) return;
    const next = { ...activeRatings, [user]: roundToQuarter(score) };
    lsSetJSON(K_ACTIVE_RATINGS, next);
    setActiveRatings(next);
  };

  // End voting → archive
  const endVoting = () => {
    if (!activeVote) return;
    const entry = {
      id: activeVote.id,
      started_at: activeVote.started_at,
      picked_by: activeVote.picked_by,
      movie: activeVote.movie,
      ratings: activeRatings,
    };
    const L = lsGetJSON<any[]>(K_VIEWINGS, []);
    L.unshift(entry);
    lsSetJSON(K_VIEWINGS, L);
    localStorage.removeItem(K_ACTIVE_VOTE);
    localStorage.removeItem(K_ACTIVE_RATINGS);
    setHistory(L);
    setActiveVote(null);
    setActiveRatings({});
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 text-gray-900">
      {!user ? (
        <Login onLogin={login} />
      ) : (
        <div className="mx-auto max-w-6xl">
          <Header user={user} onLogout={logout} tab={tab} setTab={setTab} />

          {tab === "vote" && (
            <div className="mt-2 grid gap-4">
              {activeVote ? (
                <ActiveVoting
                  movie={activeVote.movie}
                  pickedBy={activeVote.picked_by}
                  currentUser={user}
                  ratings={activeRatings}
                  onSendVote={sendVote}
                  onEnd={endVoting}
                />
              ) : (
                <>
                  <SearchMovie onPick={onPick} />
                  {pickedMovie && <StartVoteCard movie={pickedMovie} knownUsers={knownUsers} onStartVoting={startVoting} />}
                </>
              )}
            </div>
          )}

{tab === "history" && (
  <div className="mt-2">
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-lg font-semibold">📜 Past nights</h3>
        <button
          className="rounded-xl border px-3 py-1 text-sm"
          onClick={() =>
            setHistoryMode(historyMode === "extended" ? "compact" : "extended")
          }
        >
          Switch to {historyMode === "extended" ? "Compact" : "Extended"} view
        </button>
      </div>

      {/* ── Filters + Sort ───────────────────────────────────────────── */}
      {(() => {
        // options
        const pickerOptions = Array.from(
          new Set(history.map((h) => h?.picked_by).filter(Boolean))
        ).sort((a: string, b: string) => a.localeCompare(b));

        const genreOptions = Array.from(
          new Set(
            history.flatMap((h) =>
              ((h?.movie?.genres as Array<{ name: string }>) || []).map(
                (g) => g?.name
              )
            )
          )
        )
          .filter(Boolean)
          .sort((a: string, b: string) => a.localeCompare(b));

        return (
          <div className="grid gap-3 md:grid-cols-4">
            {/* Picker */}
            <div className="flex flex-col">
              <label className="text-xs text-gray-600">Picked by</label>
              <select
                className="rounded-xl border px-3 py-2"
                value={filterPicker}
                onChange={(e) => setFilterPicker(e.target.value)}
              >
                <option value="">All</option>
                {pickerOptions.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            {/* Genre */}
            <div className="flex flex-col">
              <label className="text-xs text-gray-600">Genre</label>
              <select
                className="rounded-xl border px-3 py-2"
                value={filterGenre}
                onChange={(e) => setFilterGenre(e.target.value)}
              >
                <option value="">All</option>
                {genreOptions.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>

            {/* Sort */}
            <div className="flex flex-col">
              <label className="text-xs text-gray-600">Sort by</label>
              <select
                className="rounded-xl border px-3 py-2"
                value={sortKey}
                onChange={(e) =>
                  setSortKey(
                    e.target.value as
                      | "date-desc"
                      | "date-asc"
                      | "avg-desc"
                      | "avg-asc"
                      | "votes-desc"
                      | "votes-asc"
                  )
                }
              >
                <option value="date-desc">Date ↓ (newest)</option>
                <option value="date-asc">Date ↑ (oldest)</option>
                <option value="avg-desc">Average ↓</option>
                <option value="avg-asc">Average ↑</option>
                <option value="votes-desc">Votes count ↓</option>
                <option value="votes-asc">Votes count ↑</option>
              </select>
            </div>

            {/* Reset */}
            <div className="flex items-end">
              <button
                className="w-full rounded-xl border px-3 py-2"
                onClick={() => {
                  setFilterPicker("");
                  setFilterGenre("");
                  setSortKey("date-desc");
                }}
              >
                Reset
              </button>
            </div>
          </div>
        );
      })()}

      {/* ── Results ─────────────────────────────────────────────────── */}
      <div className="mt-4 grid gap-3">
        {history.length === 0 && (
          <div className="text-sm text-gray-600">
            No entries yet. Start a vote from the “Vote” tab.
          </div>
        )}

        {(() => {
          // filter
          let L = history.slice();
          if (filterPicker) L = L.filter((h) => h?.picked_by === filterPicker);
          if (filterGenre) {
            L = L.filter((h) =>
              ((h?.movie?.genres as Array<{ name: string }>) || []).some(
                (g) => g?.name === filterGenre
              )
            );
          }

          // helpers
          const getAvg = (r?: Record<string, number> | null) => {
            if (!r) return null;
            const vals = Object.values(r).map(Number);
            if (!vals.length) return null;
            return vals.reduce((a, b) => a + b, 0) / vals.length;
          };

          // sort
          L.sort((a, b) => {
            const aDate = a?.started_at ? new Date(a.started_at).getTime() : 0;
            const bDate = b?.started_at ? new Date(b.started_at).getTime() : 0;
            const aAvg = getAvg(a?.ratings);
            const bAvg = getAvg(b?.ratings);
            const aVotes = a?.ratings ? Object.keys(a.ratings).length : 0;
            const bVotes = b?.ratings ? Object.keys(b.ratings).length : 0;

            switch (sortKey) {
              case "date-asc":
                return aDate - bDate;
              case "date-desc":
                return bDate - aDate;
              case "avg-asc":
                return (aAvg ?? -Infinity) - (bAvg ?? -Infinity);
              case "avg-desc":
                return (bAvg ?? -Infinity) - (aAvg ?? -Infinity);
              case "votes-asc":
                return aVotes - bVotes;
              case "votes-desc":
                return bVotes - aVotes;
              default:
                return 0;
            }
          });

          return L.map((v) =>
            historyMode === "extended" ? (
              <HistoryCardExtended key={v.id} v={v} />
            ) : (
              <HistoryCardCompact key={v.id} v={v} />
            )
          );
        })()}
      </div>
    </Card>
  </div>
)}


          {tab === "profile" && (
            <div className="mt-2 grid gap-4">
              <Profile user={user} history={history} onAvatarSaved={() => {}} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}