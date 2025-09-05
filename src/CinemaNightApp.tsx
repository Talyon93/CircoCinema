import React, { useEffect, useMemo, useState } from "react";

/**
 * Circo Cinema — Voting with "Picked by", live stats, and nicer UI (no backend)
 * - Start a vote → choose the movie + who picked it
 * - While active: users press "Vote", submit once, then see "Wait for others..."
 * - Realtime between tabs via localStorage storage events
 * - End vote → archived with scores and picked_by
 */

// ============================
// Config / storage keys
// ============================
const TMDB_API_KEY = "99cb7c79bbe966a91a2ffcb7a3ea3d37";
const K_USER = "cn_user";
const K_VIEWINGS = "cn_viewings";
const K_ACTIVE_VOTE = "cn_active_vote";       // { id, movie, picked_by, started_at }
const K_ACTIVE_RATINGS = "cn_active_ratings"; // { [user]: number }

// ============================
// Utilities
// ============================
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

// ============================
// UI primitives
// ============================
function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-gray-200 bg-white p-4 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

function Header({
  user,
  onLogout,
  tab,
  setTab,
}: {
  user: string;
  onLogout: () => void;
  tab: "vote" | "history";
  setTab: (t: "vote" | "history") => void;
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
        <p className="mb-4 text-sm text-gray-600">Pick a nickname for movie nights.</p>
        <div className="flex gap-2">
          <input
            className="flex-1 rounded-xl border px-3 py-2"
            placeholder="e.g. Tommy"
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
        <button
          onClick={search}
          className="rounded-xl bg-black px-4 py-2 text-white disabled:opacity-30"
          disabled={!q || loading}
        >
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
            {r.poster_path && (
              <img
                src={posterUrl(r.poster_path, "w185")}
                alt={r.title}
                className="h-24 w-16 rounded-lg object-cover"
              />
            )}
            <div className="flex-1">
              <div className="font-semibold">
                {r.title}{" "}
                {r.release_date ? (
                  <span className="text-gray-500">({r.release_date?.slice(0, 4)})</span>
                ) : null}
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

/** Card shown after choosing a movie: lets you pick "Picked by" from previous voters or add a new one */
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
        {movie.poster_path && (
          <img
            src={posterUrl(movie.poster_path, "w342")}
            className="h-48 w-32 rounded-xl object-cover"
            alt={movie.title}
          />
        )}
        <div className="flex-1">
          <h3 className="text-xl font-bold">
            {movie.title}{" "}
            {movie.release_date ? <span className="text-gray-500">({movie.release_date.slice(0, 4)})</span> : null}
          </h3>
          <p className="mt-1 whitespace-pre-wrap text-gray-700">{movie.overview}</p>

          <div className="mt-4 grid gap-2">
            <label className="text-sm font-medium">Picked by</label>
            {/* Combo input with datalist of past voters */}
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

          <div className="mt-3 flex gap-2">
            <button
              className="rounded-xl bg-black px-4 py-2 text-white disabled:opacity-30"
              disabled={!valid}
              onClick={() => onStartVoting(movie, pickedBy.trim())}
            >
              Start voting
            </button>
          </div>
        </div>
      </div>
    </Card>
  );
}

// ============================
// Active vote
// ============================
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
  const [temp, setTemp] = useState<number>(you ?? 7);

  useEffect(() => {
    if (typeof you === "number") setTemp(you);
  }, [you]);

  const submit = () => {
    const fixed = roundToQuarter(temp);
    onSendVote(fixed);
    setOpenVote(false);
  };

  const scores = Object.values(ratings).map(Number) as number[];
  const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;

  return (
    <Card className="p-5">
      <div className="flex gap-4">
        {movie.poster_path && (
          <img src={posterUrl(movie.poster_path, "w342")} className="h-48 w-32 rounded-xl object-cover" alt={movie.title} />
        )}
        <div className="flex-1">
          <div className="flex items-start gap-2">
            <div className="flex-1">
              <div className="text-xl font-bold">Voting in progress · {movie.title}</div>
              {pickedBy && <div className="text-sm text-gray-600">Picked by: <b>{pickedBy}</b></div>}
            </div>
            <div className="rounded-lg bg-gray-50 px-3 py-2 text-sm">
              <div><b>Votes:</b> {scores.length}</div>
              <div><b>Live avg:</b> {avg !== null ? formatScore(avg) : "—"}</div>
            </div>
          </div>

          <p className="mt-2 line-clamp-3 text-gray-700">{movie.overview}</p>

          {!hasVoted ? (
            <div className="mt-4">
              {!openVote ? (
                <button className="rounded-xl bg-black px-4 py-2 text-white" onClick={() => setOpenVote(true)}>
                  Vote
                </button>
              ) : (
                <div className="mt-2 rounded-xl border p-3">
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
            <div className="mt-4 rounded-xl border bg-gray-50 p-3 text-sm">
              ✅ Vote saved. <b>Please wait for others…</b>
            </div>
          )}

          <div className="mt-4 text-sm">
            <div className="mb-1 font-medium">Live votes</div>
            <div className="flex flex-wrap gap-2 text-xs text-gray-700">
              {Object.entries(ratings).map(([n, s]) => (
                <span key={n} className="rounded-lg border bg-white px-2 py-1">
                  {n}: <b>{formatScore(Number(s))}</b>
                </span>
              ))}
            </div>
          </div>

          <div className="mt-4 flex gap-2">
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
// History
// ============================
function HistoryCard({ v }: { v: any }) {
  const ratings = (v.ratings || {}) as Record<string, number>;
  const scores = Object.values(ratings).map(Number) as number[];
  const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;

  return (
    <Card>
      <div className="flex gap-4">
        {v.movie.poster_path && (
          <img src={posterUrl(v.movie.poster_path, "w185")} className="h-24 w-16 rounded-lg object-cover" />
        )}
        <div className="flex-1">
          <div className="flex items-start gap-2">
            <div className="font-semibold">{v.movie.title}</div>
            <div className="text-xs text-gray-500">{new Date(v.started_at).toLocaleString()}</div>
            {v.picked_by && <div className="ml-auto text-xs text-gray-600">Picked by: <b>{v.picked_by}</b></div>}
          </div>
          <div className="text-sm text-gray-700 line-clamp-2">{v.movie.overview}</div>
          <div className="mt-2 flex items-center gap-3 text-xs text-gray-700">
            <span>Votes: <b>{scores.length}</b></span>
            <span>Avg: <b>{avg !== null ? formatScore(avg) : "—"}</b></span>
          </div>
          {Object.keys(ratings).length > 0 && (
            <div className="mt-1 flex flex-wrap gap-2 text-xs text-gray-600">
              {Object.entries(ratings).map(([n, s]) => (
                <span key={n} className="rounded-md border px-2 py-0.5">
                  {n}: <b>{formatScore(Number(s))}</b>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

// ============================
// App
// ============================
export default function CinemaNightApp() {
  const [user, setUser] = useState<string>("");
  const [tab, setTab] = useState<"vote" | "history">("vote");

  const [pickedMovie, setPickedMovie] = useState<any | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [activeVote, setActiveVote] = useState<any | null>(null); // { id, movie, picked_by, started_at }
  const [activeRatings, setActiveRatings] = useState<Record<string, number>>({});

  // Derived: known users from history (people who have voted before)
  const knownUsers = useMemo(() => {
    const set = new Set<string>();
    for (const h of history) {
      Object.keys(h?.ratings || {}).forEach((u) => set.add(u));
      if (h?.picked_by) set.add(h.picked_by);
    }
    // include current user too
    if (user) set.add(user);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [history, user]);

  // Init + realtime sync
  useEffect(() => {
    setUser(lsGetJSON<string | null>(K_USER, "") || "");
    setHistory(lsGetJSON<any[]>(K_VIEWINGS, []));
    setActiveVote(lsGetJSON<any | null>(K_ACTIVE_VOTE, null));
    setActiveRatings(lsGetJSON<Record<string, number>>(K_ACTIVE_RATINGS, {}));

    const onStorage = (e: StorageEvent) => {
      if (e.key === K_ACTIVE_VOTE) setActiveVote(lsGetJSON<any | null>(K_ACTIVE_VOTE, null));
      if (e.key === K_ACTIVE_RATINGS) setActiveRatings(lsGetJSON<Record<string, number>>(K_ACTIVE_RATINGS, {}));
      if (e.key === K_VIEWINGS) setHistory(lsGetJSON<any[]>(K_VIEWINGS, []));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

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

  // Start voting (with pickedBy)
  const startVoting = (movie: any, pickedBy: string) => {
    const session = { id: Date.now(), movie, picked_by: pickedBy, started_at: new Date().toISOString() };
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
        <div className="mx-auto max-w-5xl">
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
                  {pickedMovie && (
                    <StartVoteCard movie={pickedMovie} knownUsers={knownUsers} onStartVoting={startVoting} />
                  )}
                </>
              )}
            </div>
          )}

          {tab === "history" && (
            <div className="mt-2">
              <Card>
                <h3 className="mb-2 text-lg font-semibold">📜 Past nights</h3>
                <div className="grid gap-3">
                  {history.length === 0 && (
                    <div className="text-sm text-gray-600">No entries yet. Start a vote from the “Vote” tab.</div>
                  )}
                  {history.map((v) => (
                    <HistoryCard key={v.id} v={v} />
                  ))}
                </div>
              </Card>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
