import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

// TMDB helpers
import {
  tmdbDetails,
  tmdbSearch,
  omdbRatingFromImdbId,
  mergeMovie,
  fetchMetaForTitle,
  ensureRuntime,
  ensureGenres,
  getPosterUrl,
} from "./TMDBHelper";

// Supabase
import { sb } from "./supabaseClient";

// Stato condiviso (tabella cn_state)
import {
  loadSharedState,
  saveSharedState,
  subscribeSharedState,
  setRatingAtomic,
} from "./state";

// History LIVE only
import {
  loadHistoryLive,
  persistHistoryLive,
  subscribeHistoryLive,
  ensureLiveFileExists,
} from "./storage";

// LocalStorage helpers + costanti
import {
  K_USER,
  K_VIEWINGS,
  K_ACTIVE_VOTE,
  K_ACTIVE_RATINGS,
  K_THEME,
  lsGetJSON,
  lsSetJSON,
  getMetaCache,
  setMetaCache,
} from "./localStorage";

// UI components
import { ScoreDonut } from "./Components/UI/ScoreDonut";
import { VotesBar } from "./Components/UI/VotesBar";
import { PickedByBadge } from "./Components/UI/PickedByBadge";
import { Card } from "./Components/UI/Card";
import { VoterChip } from "./Components/UI/VoterChip";
import { Stats } from "./Pages/Stats";
import { formatScore } from "./Utils/Utils";
import { HistoryCardExtended } from "./Components/UI/HistoryCardExtended";
import { Profile } from "./Pages/Profile";
import { Header } from "./Components/UI/Header";
import { Login } from "./Pages/Login";
import VotePage from "./Pages/Vote";
import { EditViewingDialog } from "./Components/EditViewingDialog";


// ---------------------------------

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

async function enrichFromTmdbByTitleOrId(movie: any) {
  return await ensureGenres(movie);
}

function getAverage(r: Record<string, number> | undefined | null) {
  if (!r) return null;
  const vals = Object.values(r).map(Number);
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function roundToQuarter(n: number) {
  return Math.round(n / 0.25) * 0.25;
}

// Theme
type Theme = "light" | "dark";
function getInitialTheme(): Theme {
  const saved = (localStorage.getItem(K_THEME) as Theme | null) || null;
  if (saved === "dark" || saved === "light") return saved;
  return "dark";
}
function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
  localStorage.setItem(K_THEME, theme);
}

// ======================================
// Dialog di ricerca/replace film + delete
// ======================================

function EditMovieDialog({
  open,
  initialTitle = "",
  onClose,
  onSelect,
  onDelete,
}: {
  open: boolean;
  initialTitle?: string;
  onClose: () => void;
  onSelect: (movie: any) => void;
  onDelete: () => void;
}) {
  const [q, setQ] = useState(initialTitle);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setQ(initialTitle);
    setResults([]);
    setErr(null);
  }, [initialTitle]);

  if (!open) return null;

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

  const confirmDelete = () => {
    const title = q?.trim() || initialTitle || "this entry";
    if (confirm(`Eliminare definitivamente "${title}"? L'azione non è reversibile.`)) {
      onDelete();
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-2xl border bg-white p-4 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-lg font-semibold">Edit movie</h3>
          <div className="flex items-center gap-2">
            <button
              className="rounded-xl border border-red-200 px-3 py-1 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/30"
              onClick={confirmDelete}
              title="Delete this entry"
            >
              Delete entry
            </button>
            <button className="rounded-xl border px-3 py-1 text-sm dark:border-zinc-700" onClick={onClose}>
              Close
            </button>
          </div>
        </div>

        <div className="flex items-end gap-2">
          <div className="flex-1">
            <label className="text-xs text-gray-600 dark:text-zinc-400">Search on TMDB</label>
            <input
              className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
              placeholder="e.g. Lucky Number Slevin"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && search()}
              autoFocus
            />
          </div>
          <button
            onClick={search}
            className="rounded-xl bg-black px-4 py-2 text-white disabled:opacity-30 dark:bg-white dark:text-black"
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
              className="flex cursor-pointer gap-3 rounded-xl border border-gray-200 bg-white p-2 hover:bg-gray-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
              onClick={() => onSelect(r)}
              title="Use this movie"
            >
              {r.poster_path && (
                <img src={getPosterUrl(r.poster_path, "w185")} alt={r.title} className="h-24 w-16 rounded-lg object-cover" />
              )}
              <div className="flex-1">
                <div className="font-semibold">
                  {r.title} {r.release_date ? <span className="text-gray-500">({r.release_date?.slice(0, 4)})</span> : null}
                </div>
                <div className="line-clamp-3 text-sm text-gray-700 dark:text-zinc-300">{r.overview}</div>
              </div>
            </div>
          ))}
          {!loading && results.length === 0 && (
            <div className="rounded-xl border p-3 text-sm text-gray-600 dark:border-zinc-700 dark:text-zinc-400">
              No results yet — search something above.
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

// ======================================
// Meta lazy loader per Viewing/Tile
// ======================================

function useLazyMetaForViewing(
  viewing: any | null,
  onMetaResolved?: (viewingId: any, nextMovie: any) => void
) {
  const [meta, setMeta] = React.useState<{ poster_path?: string; overview?: string } | null>(null);

  React.useEffect(() => {
    if (!viewing) return;
    const base = {
      poster_path: viewing?.movie?.poster_path,
      overview: (viewing?.movie?.overview || "").trim(),
    };
    setMeta(base);

    const title = (viewing?.movie?.title || "").trim();
    if (!title) return;
    if (base.poster_path && base.overview) return;

    const cache = getMetaCache();
    const cached = cache[title];
    if (cached && (cached.poster_path || cached.overview)) {
      const merged = {
        poster_path: base.poster_path || cached.poster_path,
        overview: base.overview || cached.overview,
      };
      setMeta(merged);
      if ((!base.poster_path && merged.poster_path) || (!base.overview && merged.overview)) {
        onMetaResolved?.(viewing.id, { ...viewing.movie, ...merged });
      }
      return;
    }

    (async () => {
      const fetched = await fetchMetaForTitle(title);
      if (!fetched) return;
      const merged = {
        poster_path: base.poster_path || fetched.poster_path,
        overview: base.overview || fetched.overview,
      };
      setMeta(merged);
      const c = getMetaCache();
      c[title] = { poster_path: fetched.poster_path, overview: fetched.overview };
      setMetaCache(c);
      if ((!base.poster_path && merged.poster_path) || (!base.overview && merged.overview)) {
        onMetaResolved?.(viewing.id, { ...viewing.movie, ...merged });
      }
    })();
  }, [viewing?.id]);

  return meta;
}

function HistoryPosterTile({
  v,
  onClick,
  onResolve,
}: {
  v: any;
  onClick: () => void;
  onResolve?: (id: any, nextMovie: any) => void;
}) {
  const meta = useLazyMetaForViewing(v, onResolve);
  const poster = meta?.poster_path ? getPosterUrl(meta.poster_path, "w342") : "";

  return (
    <button
      onClick={onClick}
      className="group relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/40 shadow-sm transition hover:shadow-md"
      style={{ aspectRatio: "2/3" }}
      title={v?.movie?.title || ""}
    >
      {poster ? (
        <img src={poster} alt={v?.movie?.title} className="h-full w-full object-cover transition group-hover:scale-[1.02]" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-sm text-zinc-400">No poster</div>
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 rounded-t-xl bg-gradient-to-t from-black/60 to-transparent p-2">
        <div className="line-clamp-1 text-left text-[13px] font-medium text-white drop-shadow">
          {v?.movie?.title}
          {v?.movie?.release_year ? <span className="ml-1 text-zinc-300">({v.movie.release_year})</span> : null}
        </div>
      </div>
    </button>
  );
}

function HistoryPosterGrid({
  items,
  onOpen,
  onResolve,
}: {
  items: any[];
  onOpen: (v: any) => void;
  onResolve?: (id: any, nextMovie: any) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {items.map((v) => (
        <HistoryPosterTile key={v.id} v={v} onClick={() => onOpen(v)} onResolve={onResolve} />
      ))}
    </div>
  );
}

// ======================================
// Modal dettagli viewing
// ======================================

function ViewingModal({
  v,
  onClose,
  onEdit,
  onResolve,
  currentUser,
}: {
  v: any | null;
  onClose: () => void;
  onEdit?: (id: any) => void;
  onResolve?: (id: any, nextMovie: any) => void;
  currentUser?: string;
}) {
  if (!v) return null;

  const meta = useLazyMetaForViewing(v, onResolve);

  const title = v?.movie?.title || "Untitled";
  const year =
    v?.movie?.release_year ||
    (v?.movie?.release_date ? String(v.movie.release_date).slice(0, 4) : null);
  const genreLine = Array.isArray(v?.movie?.genres)
    ? v.movie.genres.map((g: any) => g?.name).filter(Boolean).join(", ")
    : "";
  const runtime = typeof v?.movie?.runtime === "number" && v.movie.runtime > 0 ? v.movie.runtime : null;
  const imdbRating = typeof v?.movie?.imdb_rating === "number" ? v.movie.imdb_rating : null;
  const tmdbAvg = typeof v?.movie?.tmdb_vote_average === "number" ? v.movie.tmdb_vote_average : null;
  const tmdbCount = typeof v?.movie?.tmdb_vote_count === "number" ? v.movie.tmdb_vote_count : null;

  const poster = meta?.poster_path ? getPosterUrl(meta.poster_path, "w342") : "";
  const overview = (meta?.overview || "").trim();

  const ratings = (v?.ratings || {}) as Record<string, number>;
  const entries = Object.entries(ratings) as [string, number][];
  const scores = entries.map(([, n]) => Number(n));
  const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-5xl overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900 shadow-xl">
        <div className="flex items-center gap-2 border-b border-zinc-800 px-4 py-3">
          {v?.picked_by && <PickedByBadge name={v.picked_by} />}
          <div className="mx-2 text-zinc-600">•</div>
          <h3 className="min-w-0 flex-1 truncate text-lg font-semibold text-zinc-100">
            {title} {year ? <span className="text-zinc-400">({year})</span> : null}
          </h3>
          {onEdit && (
            <button className="rounded-md border border-zinc-700 px-3 py-1 text-sm text-zinc-200 hover:bg-zinc-800" onClick={() => onEdit(v.id)}>
              Edit
            </button>
          )}
          <button className="rounded-md border border-zinc-700 px-3 py-1 text-sm text-zinc-200 hover:bg-zinc-800" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="grid gap-5 px-4 py-4 md:grid-cols-[220px,1fr]">
          <div className="flex items-start justify-center">
            {poster ? (
              <img src={poster} alt={title} className="h-[330px] w-[220px] rounded-2xl border border-zinc-700 object-cover" />
            ) : (
              <div className="flex h-[330px] w-[220px] items-center justify-center rounded-2xl border border-dashed border-zinc-700 text-sm text-zinc-400">
                No poster
              </div>
            )}
          </div>

          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
              {year && <span className="rounded-full border border-zinc-700 px-2 py-0.5">📅 {year}</span>}
              {runtime && <span className="rounded-full border border-zinc-700 px-2 py-0.5">⏱ {runtime} min</span>}
              {genreLine && <span className="rounded-full border border-zinc-700 px-2 py-0.5">{genreLine}</span>}
              {(() => {
                const imdbId = v?.movie?.imdb_id as string | undefined;
                const imdbAvg = imdbRating;
                const imdbVotes = typeof v?.movie?.imdb_votes === "number" ? v.movie.imdb_votes : null;

                if (imdbId && (imdbAvg != null || imdbVotes != null)) {
                  return (
                    <a
                      href={`https://www.imdb.com/title/${imdbId}/`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-full border border-zinc-700 px-2 py-0.5 underline-offset-2 hover:underline"
                      title="Open on IMDb"
                    >
                      ★ IMDb{imdbAvg != null ? ` ${formatScore(imdbAvg)}` : ""}{imdbAvg != null && imdbVotes != null ? " • " : ""}
                      {imdbVotes != null ? `${imdbVotes.toLocaleString()} votes` : ""}
                    </a>
                  );
                }

                // Fallback su TMDB se non abbiamo IMDb
                if (tmdbAvg != null) {
                  return (
                    <span className="rounded-full border border-zinc-700 px-2 py-0.5">
                      ★ TMDB {formatScore(tmdbAvg)}{tmdbCount ? ` • ${tmdbCount.toLocaleString()} votes` : ""}
                    </span>
                  );
                }

                return null;
              })()}
            </div>

            {overview && <p className="mb-4 whitespace-pre-wrap text-[15px] leading-relaxed text-zinc-200">{overview}</p>}

            <div className="mb-3 flex items-center gap-4">
              {avg !== null && (
                <div className="flex items-center gap-3">
                  <ScoreDonut value={avg} />
                  <div className="text-xs text-zinc-400">Avg {entries.length ? `(${entries.length} votes)` : ""}</div>
                </div>
              )}
              <div className="flex-1">
                <VotesBar entries={entries} avg={avg} currentUser={currentUser} size="sm" showHeader={false} showScale={false} />
              </div>
            </div>

            {entries.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {entries
                  .sort((a, b) => Number(b[1]) - Number(a[1]) || a[0].localeCompare(b[0]))
                  .map(([name, score]) => <VoterChip key={name} name={name} score={Number(score)} currentUser={currentUser || ""} />)}
              </div>
            )}
          </div>
        </div>
      </div>

      <button className="fixed inset-0 -z-10 cursor-auto" onClick={onClose} aria-label="Close overlay" />
    </div>,
    document.body
  );
}

// ======================================
// Export JSON utility
// ======================================

function exportHistoryJSON(list: any[]) {
  const blob = new Blob([JSON.stringify(list, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  a.download = `circo_history_${stamp}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// ======================================
// App
// ======================================

export default function CinemaNightApp() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme());
  useEffect(() => applyTheme(theme), [theme]);

  const [isBackfillingRuntime, setIsBackfillingRuntime] = useState(false);
  const [isBackfillingRatings, setIsBackfillingRatings] = useState(false);
  const [isBackfilling, setIsBackfilling] = useState(false);

  const [user, setUser] = useState<string>("");
  const [tab, setTab] = useState<"vote" | "history" | "profile" | "stats">("vote");
  const [editingViewing, setEditingViewing] = useState<{ id: any; title: string } | null>(null);
  const [openViewing, setOpenViewing] = useState<any | null>(null);

  const [pickedMovie, setPickedMovie] = useState<any | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [activeVote, setActiveVote] = useState<any | null>(null);
  const [activeRatings, setActiveRatings] = useState<Record<string, number>>({});
  const [historyMode, setHistoryMode] = useState<"extended" | "compact">("extended");

  // Filters / sort
  const [filterPicker, setFilterPicker] = useState<string>("");
  const [filterGenre, setFilterGenre] = useState<string>("");
  const [sortKey, setSortKey] = useState<"date-desc" | "date-asc" | "avg-desc" | "avg-asc" | "votes-desc" | "votes-asc">("date-desc");

  const pickerOptions = useMemo(() => {
    const s = new Set<string>();
    for (const h of history) if (h?.picked_by) s.add(h.picked_by);
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [history]);

  const genreOptions = useMemo(() => {
    const s = new Set<string>();
    for (const h of history) {
      const arr = (h?.movie?.genres || []) as Array<{ id: number; name: string }>;
      arr?.forEach((g) => g?.name && s.add(g.name));
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [history]);

  const knownUsers = useMemo(() => {
    const set = new Set<string>();
    for (const h of history) {
      Object.keys(h?.ratings || {}).forEach((u) => set.add(u));
      if (h?.picked_by) set.add(h.picked_by);
    }
    if (user) set.add(user);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [history, user]);

  // === RANKING ===
  // Classifica globale per media voti (dense ranking: pari merito -> stessa posizione)
  const ranking = useMemo(() => {
    const items = history
      .map((h) => ({ id: h.id, avg: getAverage(h?.ratings) }))
      .filter((x) => x.avg != null) as { id: any; avg: number }[];

    items.sort((a, b) => b.avg - a.avg);

    const map = new Map<any, number>();
    let prev: number | null = null;
    let rank = 0;
    items.forEach((it, idx) => {
      if (prev === null || it.avg !== prev) {
        rank = idx + 1;
        prev = it.avg;
      }
      map.set(it.id, rank);
    });

    return { map, total: items.length };
  }, [history]);

  // ---------- INIT + REALTIME ----------
  useEffect(() => {
    let offLive = () => {};
    let offState = () => {};

    (async () => {
      setUser(lsGetJSON<string>(K_USER, ""));

      if (sb) {
        await ensureLiveFileExists();
        const [live, shared] = await Promise.all([loadHistoryLive(), loadSharedState()]);
        setHistory(Array.isArray(live) ? live : []);
        setActiveVote(shared?.active ?? null);
        setActiveRatings(shared?.ratings ?? {});

        // history live bumps
        offLive = subscribeHistoryLive((next) => setHistory(Array.isArray(next) ? next : []));

        // active/ratings realtime
        offState = subscribeSharedState((row) => {
          setActiveVote(row?.active ?? null);
          setActiveRatings(row?.ratings ?? {});
        });

        return;
      }

      // ------- Fallback offline -------
      const hist = lsGetJSON<any[]>(K_VIEWINGS, []);
      setHistory(hist);
      setActiveVote(lsGetJSON<any | null>(K_ACTIVE_VOTE, null));
      setActiveRatings(lsGetJSON<Record<string, number>>(K_ACTIVE_RATINGS, {}));

      const onStorage = (e: StorageEvent) => {
        if (e.key === K_ACTIVE_VOTE) setActiveVote(lsGetJSON<any | null>(K_ACTIVE_VOTE, null));
        if (e.key === K_ACTIVE_RATINGS) setActiveRatings(lsGetJSON<Record<string, number>>(K_ACTIVE_RATINGS, {}));
        if (e.key === K_VIEWINGS) setHistory(lsGetJSON<any[]>(K_VIEWINGS, []));
        if (e.key === K_THEME) applyTheme(((localStorage.getItem(K_THEME) as Theme) || "dark") as Theme);
      };
      window.addEventListener("storage", onStorage);
      offLive = () => window.removeEventListener("storage", onStorage);
    })();

    return () => {
      offLive?.();
      offState?.();
    };
  }, []);

  // ---------- BACKFILLS ----------
  const backfillHistoryGenres = async () => {
    if (isBackfilling) return;
    setIsBackfilling(true);
    try {
      const list = history.slice();
      let changed = false;

      for (let i = 0; i < list.length; i++) {
        const v = list[i];
        const hasGenres = Array.isArray(v?.movie?.genres) && v.movie.genres.length > 0;
        if (hasGenres) continue;

        const enriched = await enrichFromTmdbByTitleOrId(v.movie);
        if (enriched !== v.movie) {
          list[i] = { ...v, movie: enriched };
          changed = true;
        }
        await sleep(200);
      }

      if (changed) {
        setHistory(list);
        await persistHistoryLive(list);
      }
    } catch (e) {
      console.error("[backfillHistoryGenres] failed:", e);
    } finally {
      setIsBackfilling(false);
    }
  };

  const backfillRatingsMeta = async () => {
    if (isBackfillingRatings) return;
    setIsBackfillingRatings(true);
    try {
      const list = history.slice();
      let changed = false;

      for (let i = 0; i < list.length; i++) {
        const v = list[i];
        let m = { ...(v?.movie || {}) };

        let det: any = null;
        if (m?.id) det = await tmdbDetails(m.id);
        else if (m?.title) {
          const s = await tmdbSearch(m.title);
          const first = s?.[0];
          if (first?.id) det = await tmdbDetails(first.id);
        }
        if (det) m = mergeMovie(m, det);

        if (!m?.release_year && m?.release_date) m.release_year = String(m.release_date).slice(0, 4);

        const needImdb = m?.imdb_id && (m.imdb_rating == null || m.imdb_votes == null);
        if (needImdb) {
          const om = await omdbRatingFromImdbId(m.imdb_id);
          if (om) m = { ...m, ...om };
        }

        if (JSON.stringify(m) !== JSON.stringify(v.movie)) {
          list[i] = { ...v, movie: m };
          changed = true;
        }

        await sleep(220);
      }

      if (changed) {
        setHistory(list);
        await persistHistoryLive(list);
      }
    } catch (e) {
      console.error("[backfillRatingsMeta] failed:", e);
      alert("Errore durante il backfill dei rating (vedi console).");
    } finally {
      setIsBackfillingRatings(false);
    }
  };

  const backfillHistoryRuntime = async () => {
    if (isBackfillingRuntime) return;
    setIsBackfillingRuntime(true);
    try {
      const list = history.slice();
      let changed = false;

      for (let i = 0; i < list.length; i++) {
        const v = list[i];
        const rt = Number((v?.movie as any)?.runtime);
        if (!Number.isNaN(rt) && rt > 0) continue;

        const withRt = await ensureRuntime(v.movie);
        if (withRt !== v.movie) {
          list[i] = { ...v, movie: withRt };
          changed = true;
        }
        await sleep(200);
      }

      if (changed) {
        setHistory(list);
        await persistHistoryLive(list);
      }
    } catch (e) {
      console.error("[backfillHistoryRuntime] failed:", e);
    } finally {
      setIsBackfillingRuntime(false);
    }
  };

  // trigger backfills quando serve
  useEffect(() => {
    if (!history.length || isBackfillingRatings) return;
    const missing = history.some((h) => {
      const m = h?.movie || {};
      return m.imdb_rating == null && m.tmdb_vote_average == null;
    });
    if (missing) backfillRatingsMeta();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history.length, isBackfillingRatings]);

  useEffect(() => {
    const hasAnyGenre = history.some((h) => Array.isArray(h?.movie?.genres) && h.movie.genres.length > 0);
    if (!hasAnyGenre && history.length > 0) backfillHistoryGenres();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history.length]);

  useEffect(() => {
    if (history.length === 0 || isBackfillingRuntime) return;
    const hasAnyRuntime = history.some((h) => {
      const rt = Number((h?.movie as any)?.runtime);
      return !Number.isNaN(rt) && rt > 0;
    });
    const hasMissingRuntime = history.some((h) => {
      const rt = Number((h?.movie as any)?.runtime);
      return Number.isNaN(rt) || rt <= 0;
    });
    if (!hasAnyRuntime && hasMissingRuntime) backfillHistoryRuntime();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history.length, isBackfillingRuntime]);

  // ---------- Mutations ----------
  async function deleteViewing(viewingId: any) {
    try {
      const nextList = history.filter((v) => v.id !== viewingId);
      setHistory(nextList);
      await persistHistoryLive(nextList);
    } catch (e) {
      console.error("[deleteViewing] failed:", e);
      alert("Errore durante l'eliminazione.");
    }
  }

  async function updateViewingMovie(viewingId: any, nextMovie: any) {
    try {
      const nextList = history.map((v) => (v.id === viewingId ? { ...v, movie: nextMovie } : v));
      setHistory(nextList);
      await persistHistoryLive(nextList);
    } catch (e) {
      console.error("[updateViewingMovie] failed:", e);
      alert("Errore durante il salvataggio.");
    }
  }

  // ---------- Auth ----------
  const login = (name: string) => {
    lsSetJSON(K_USER, name.trim());
    setUser(name);
  };
  const logout = () => {
    localStorage.removeItem(K_USER);
    setUser("");
  };

  // ---------- Vote flow ----------
  const onPick = async (res: any) => {
    const details = await tmdbDetails(res.id);
    setPickedMovie(details || res);
  };

  const startVoting = async (movie: any, pickedBy: string) => {
    const movieWithGenres = await ensureGenres(movie);
    const session = {
      id: Date.now(),
      movie: { ...movieWithGenres, genres: Array.isArray(movieWithGenres?.genres) ? movieWithGenres.genres : [] },
      picked_by: pickedBy,
      opened_by: user,
      started_at: new Date().toISOString(),
    };
    setActiveVote(session);
    setActiveRatings({});
    if (sb) {
      await saveSharedState({ active: session, ratings: {} });
    } else {
      lsSetJSON(K_ACTIVE_VOTE, session);
      lsSetJSON(K_ACTIVE_RATINGS, {});
    }
  };

  const sendVote = async (score: number) => {
    if (!user || !activeVote) return;
    const fixed = roundToQuarter(score);
    setActiveRatings((prev) => ({ ...prev, [user]: fixed }));
    if (sb) {
      await setRatingAtomic(user, fixed);
    } else {
      const next = { ...lsGetJSON<Record<string, number>>(K_ACTIVE_RATINGS, {}), [user]: fixed };
      lsSetJSON(K_ACTIVE_RATINGS, next);
    }
  };

  const endVoting = async () => {
    if (!activeVote) return;
    if (activeVote.opened_by && activeVote.opened_by !== user) {
      alert("Only the host can end this voting.");
      return;
    }

    const entry = {
      id: activeVote.id,
      started_at: activeVote.started_at,
      picked_by: activeVote.picked_by,
      movie: activeVote.movie,
      ratings: activeRatings,
    };

    const nextHistory = [entry, ...history];
    setHistory(nextHistory);
    setActiveVote(null);
    setActiveRatings({});

    if (sb) {
      await persistHistoryLive(nextHistory);
      await saveSharedState({ active: null, ratings: {} });
    } else {
      const L = lsGetJSON<any[]>(K_VIEWINGS, []);
      L.unshift(entry);
      lsSetJSON(K_VIEWINGS, L);
      localStorage.removeItem(K_ACTIVE_VOTE);
      localStorage.removeItem(K_ACTIVE_RATINGS);
    }
  };

  const cancelVoting = async () => {
    if (!activeVote) return;
    if (activeVote.opened_by && activeVote.opened_by !== user) {
      alert("Only the host can cancel this voting.");
      return;
    }
    setActiveVote(null);
    setActiveRatings({});
    if (sb) {
      await saveSharedState({ active: null, ratings: {} });
    } else {
      localStorage.removeItem(K_ACTIVE_VOTE);
      localStorage.removeItem(K_ACTIVE_RATINGS);
    }
  };

  // ======================================
  // Render
  // ======================================

  return (
    <div className="min-h-screen bg-gray-50 p-4 text-gray-900 dark:bg-zinc-950 dark:text-zinc-100">
      {!user ? (
        <Login onLogin={login} />
      ) : (
        <div className="mx-auto max-w-6xl">
          <Header user={user} onLogout={logout} tab={tab} setTab={setTab} theme={theme} setTheme={setTheme} />

          {tab === "vote" && (
            <VotePage
              currentUser={user}
              knownUsers={knownUsers}
              activeVote={activeVote}
              activeRatings={activeRatings}
              onStartVoting={startVoting}
              onSendVote={sendVote}
              onEndVoting={endVoting}
              onCancelVoting={cancelVoting}
              historyViewings={history}
            />
          )}

          {tab === "stats" && (
            <div className="mt-2 grid gap-4">
              <Card>
                <h3 className="mb-3 text-lg font-semibold">📊 Stats</h3>
                <Stats history={history} backfillRuntime={backfillHistoryRuntime} isLoading={isBackfillingRuntime} />
              </Card>
            </div>
          )}

          {tab === "history" && (
            <div className="mt-2">
              <Card>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-lg font-semibold">📜 Past nights</h3>
                  <div className="flex items-center gap-2">
                    <button
                      className="rounded-xl border px-3 py-1 text-sm dark:border-zinc-700"
                      onClick={() => setHistoryMode(historyMode === "extended" ? "compact" : "extended")}
                    >
                      Switch to {historyMode === "extended" ? "Compact" : "Extended"} view
                    </button>
                    <button className="rounded-xl border px-3 py-1 text-sm dark:border-zinc-700" onClick={() => exportHistoryJSON(history)}>
                      Export JSON
                    </button>
                  </div>
                </div>

                {editingViewing && (
                  <EditViewingDialog
                    open
                    viewing={history.find((h) => h.id === editingViewing.id)!}
                    knownUsers={knownUsers}
                    onClose={() => setEditingViewing(null)}
                    onSave={async (next) => {
                      const list = history.map((h) => (h.id === next.id ? next : h));
                      setHistory(list);
                      await persistHistoryLive(list);
                      setEditingViewing(null);
                    }}
                    onDelete={async () => {
                      await deleteViewing(editingViewing.id);
                      setEditingViewing(null);
                    }}
                  />
                )}

                {/* Filters */}
                <div className="grid gap-3 md:grid-cols-4">
                  <div className="flex flex-col">
                    <label className="text-xs text-gray-600 dark:text-zinc-400">Picked by</label>
                    <select
                      className="rounded-xl border border-gray-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
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

                  <div className="flex flex-col">
                    <label className="text-xs text-gray-600 dark:text-zinc-400">Genre</label>
                    <select
                      className="rounded-xl border border-gray-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
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

                  <div className="flex flex-col">
                    <label className="text-xs text-gray-600 dark:text-zinc-400">Sort by</label>
                    <select
                      className="rounded-xl border border-gray-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                      value={sortKey}
                      onChange={(e) =>
                        setSortKey(e.target.value as "date-desc" | "date-asc" | "avg-desc" | "avg-asc" | "votes-desc" | "votes-asc")
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

                  <div className="flex items-end">
                    <button
                      className="w-full rounded-xl border px-3 py-2 dark:border-zinc-700"
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

                {/* Results */}
                <div className="mt-4 grid gap-3">
                  {history.length === 0 && (
                    <div className="text-sm text-gray-600 dark:text-zinc-400">No entries yet. Start a vote from the “Vote” tab.</div>
                  )}

                  {(() => {
                    let L = history.slice();
                    if (filterPicker) L = L.filter((h) => h?.picked_by === filterPicker);
                    if (filterGenre) {
                      L = L.filter((h) =>
                        ((h?.movie?.genres as Array<{ name: string }>) || []).some((g) => g?.name === filterGenre)
                      );
                    }

                    const getAvg = (r?: Record<string, number> | null) => {
                      if (!r) return null;
                      const vals = Object.values(r).map(Number);
                      if (!vals.length) return null;
                      return vals.reduce((a, b) => a + b, 0) / vals.length;
                    };

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

                    return historyMode === "compact" ? (
                      <>
                        <HistoryPosterGrid
                          items={L}
                          onOpen={setOpenViewing}
                          onResolve={(id, nextMovie) => updateViewingMovie(id, nextMovie)}
                        />

                        <ViewingModal
                          v={openViewing}
                          onClose={() => setOpenViewing(null)}
                          onEdit={(id) => {
                            setEditingViewing({
                              id,
                              title: L.find((x) => x.id === id)?.movie?.title || "",
                            });
                            setOpenViewing(null);
                          }}
                          onResolve={(id, nextMovie) => updateViewingMovie(id, nextMovie)}
                          currentUser={user}
                        />
                      </>
                    ) : (
                      L.map((v) => (
                        <HistoryCardExtended
                          key={v.id}
                          v={v}
                          onEdit={() => setEditingViewing({ id: v.id, title: v?.movie?.title || "" })}
                          onMetaResolved={(id, nextMovie) => updateViewingMovie(id, nextMovie)}
                          // PASSO LA POSIZIONE IN CLASSIFICA GLOBALE
                          rank={ranking.map.get(v.id)}
                          total={ranking.total}
                        />
                      ))
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
