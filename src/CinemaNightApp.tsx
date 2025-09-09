import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

/**
 * Circo Cinema – complete app (with Dark Mode toggle)
 * - Dark mode via Tailwind `dark:` + toggle persistente
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
const K_THEME = "cn_theme";                   // 'light' | 'dark'



const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";


const sb = SUPABASE_URL && SUPABASE_ANON_KEY
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null; // fallback automatico a localStorage

const SB_ROW_ID = "singleton" as const; // una sola riga condivisa


// ===== Shared state su Supabase (con fallback locale) =====
// ===== Supabase Storage (JSON history) =====
// ===== Supabase Storage (JSON history) =====
const STORAGE_BUCKET = "circo";
const STORAGE_BASE_HISTORY_KEY = "history.json";       // seed, sola lettura
const STORAGE_LIVE_HISTORY_KEY = "history_live.json";  // file “vivo” dove scriviamo



async function loadHistoryFromStorage(): Promise<any[] | null> {
  if (!sb) return null;
  try {
    const { data, error } = await sb.storage
      .from(STORAGE_BUCKET)
      .download(STORAGE_HISTORY_KEY);
    if (error || !data) return null;
    const text = await data.text();
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function downloadJSONFromStorage(key: string): Promise<any[] | null> {
  if (!sb) return null;
  try {
    const { data, error } = await sb.storage.from(STORAGE_BUCKET).download(key);
    if (error || !data) return null;
    const text = await data.text();
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Carica prima il LIVE, se non esiste torna il BASE */
async function loadHistoryFromStoragePreferLive(): Promise<{ list: any[]; source: "live" | "base" | null }> {
  if (!sb) return { list: [], source: null };
  const live = await downloadJSONFromStorage(STORAGE_LIVE_HISTORY_KEY);
  if (Array.isArray(live)) return { list: live, source: "live" };
  const base = await downloadJSONFromStorage(STORAGE_BASE_HISTORY_KEY);
  if (Array.isArray(base)) return { list: base, source: "base" };
  return { list: [], source: null };
}

/** Scrive SOLO il LIVE (non tocca il BASE) */
async function saveLiveHistoryToStorage(list: any[]): Promise<{ error: any | null }> {
  if (!sb) return { error: null };
  try {
    const blob = new Blob([JSON.stringify(list, null, 2)], { type: "application/json" });
    const { error } = await sb.storage
      .from(STORAGE_BUCKET)
      .upload(STORAGE_LIVE_HISTORY_KEY, blob, { upsert: true, contentType: "application/json" });
    if (error) {
      console.error("[saveLiveHistoryToStorage] upload error:", error);
      return { error };
    }
    return { error: null };
  } catch (e) {
    console.error("[saveLiveHistoryToStorage] exception:", e);
    return { error: e };
  }
}

/** Se non esiste ancora il LIVE, crealo copiando il seed BASE */
async function ensureLiveFileExists(seedList: any[]) {
  if (!sb) return;
  const live = await downloadJSONFromStorage(STORAGE_LIVE_HISTORY_KEY);
  if (!Array.isArray(live)) {
    const { error } = await saveLiveHistoryToStorage(seedList);
    if (!error) {
      // opzionale ma utile per coerenza realtime
      await saveSharedState({ history: seedList });
    }
  }
}

async function saveHistoryToStorage(list: any[]): Promise<{ error: any | null }> {
  if (!sb) return { error: null };
  try {
    const blob = new Blob([JSON.stringify(list, null, 2)], { type: "application/json" });
    const { error } = await sb.storage
      .from(STORAGE_BUCKET)
      .upload(STORAGE_HISTORY_KEY, blob, { upsert: true, contentType: "application/json" });
    if (error) {
      console.error("[saveHistoryToStorage] upload error:", error);
      return { error };
    }
    return { error: null };
  } catch (e) {
    console.error("[saveHistoryToStorage] exception:", e);
    return { error: e };
  }
}

async function persistHistory(list: any[]) {
  // Update ottimistico già fatto a monte (setHistory(list))
  if (!sb) {
    lsSetJSON(K_VIEWINGS, list);
    return;
  }

  // 1) Scrivi SOLO sul LIVE
  const { error: upErr } = await saveLiveHistoryToStorage(list);

  // 2) Aggiorna cn_state per realtime + fallback
  const { error: stErr } = await saveSharedState({});

  if (upErr || stErr) {
    console.error("[persistHistory] errors", { upErr, stErr });
    alert("Non sono riuscito a salvare sul server. Controlla le policy del bucket/tabella (vedi console).");
    return;
  }

  // 3) Round-trip dal LIVE
  const roundTrip = await downloadJSONFromStorage(STORAGE_LIVE_HISTORY_KEY);
  if (!Array.isArray(roundTrip) || roundTrip.length !== list.length) {
    console.warn("[persistHistory] roundTrip mismatch", { roundTripLen: roundTrip?.length, expected: list.length });
  }
}

type SharedState = {
  id: string;
  history: any[];
  active: any | null;
  ratings: Record<string, number>;
  updated_at?: string;
};

async function loadSharedState(): Promise<SharedState> {
  if (!sb) {
    return {
      id: SB_ROW_ID,
      history: lsGetJSON<any[]>(K_VIEWINGS, []),
      active: lsGetJSON<any | null>(K_ACTIVE_VOTE, null),
      ratings: lsGetJSON<Record<string, number>>(K_ACTIVE_RATINGS, {}),
    };
  }
  const { data, error } = await sb
    .from("cn_state")
    .select("*")
    .eq("id", SB_ROW_ID)
    .single();
  if (error || !data) {
    return { id: SB_ROW_ID, history: [], active: null, ratings: {} };
  }
  return data as SharedState;
}

async function saveSharedState(partial: Partial<SharedState>) {
  // helper: mirror su localStorage per tab sync locale
  const writeLocal = (s: Partial<SharedState>) => {
    if (s.history) lsSetJSON(K_VIEWINGS, s.history);
    if ("active" in s) lsSetJSON(K_ACTIVE_VOTE, s.active ?? null);
    if (s.ratings) lsSetJSON(K_ACTIVE_RATINGS, s.ratings);
  };

  if (!sb) {
    writeLocal(partial);
    return { error: null as any };
  }

  const current = await loadSharedState();
  const next: SharedState = {
    id: SB_ROW_ID,
    history: partial.history ?? current.history,
    active: partial.active === undefined ? current.active : partial.active,
    ratings: partial.ratings ?? current.ratings,
    updated_at: new Date().toISOString(),
  };

  const { error } = await sb.from("cn_state").upsert(next, { onConflict: "id" });
  if (error) {
    console.error("[saveSharedState] upsert error:", error);
    return { error };
  }

  // write-through locale per test in locale + resilienza
  writeLocal(next);
  return { error: null as any };
}

function subscribeSharedState(onChange: (s: SharedState) => void) {
  if (!sb) return () => {};

  // canale con nome unico (evita collisioni in hot reload)
  const ch = sb.channel(`cn_state_realtime_${Math.random().toString(36).slice(2)}`);

  const handle = async (payload: any) => {
    const id = payload?.new?.id ?? payload?.old?.id;
    if (id !== SB_ROW_ID) return; // filtra lato client

    // ✅ read-after-notify: ricarica lo stato canonico
    const { data, error } = await sb
      .from("cn_state")
      .select("*")
      .eq("id", SB_ROW_ID)
      .single();

    if (!error && data) {
      onChange(data as SharedState);
    } else {
      console.warn("[RT READBACK] error", error);
    }
  };

  ch.on("postgres_changes", { event: "INSERT", schema: "public", table: "cn_state" }, handle)
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "cn_state" }, handle)
    .on("postgres_changes", { event: "DELETE", schema: "public", table: "cn_state" }, handle)
    .subscribe((status) => {
      console.log("[RT STATUS]", status);
      // 🔁 autoripartenza in caso di problemi
      if (status === "TIMED_OUT" || status === "CHANNEL_ERROR" || status === "CLOSED") {
        setTimeout(() => ch.subscribe(), 500);
      }
    });

  return () => sb.removeChannel(ch);
}


// ============================
// Helpers
// ============================

async function setRatingAtomic(user: string, score: number) {
  if (!sb) {
    const cur = lsGetJSON<Record<string, number>>(K_ACTIVE_RATINGS, {});
    cur[user] = score;
    lsSetJSON(K_ACTIVE_RATINGS, cur);
    return;
  }

  const { error } = await sb.rpc("cn_set_rating", {
    _id: SB_ROW_ID,
    _user: user,
    _score: score,
  });

  if (error) {
    console.warn("[setRatingAtomic] RPC failed, fallback to upsert:", error);
    // fallback: leggo lo stato e scrivo il merge via upsert (meno atomico, ma funziona)
    const cur = (await loadSharedState())?.ratings || {};
    cur[user] = score;
    await saveSharedState({ ratings: cur });
  }
}


/** Ritorna movie con `runtime` valorizzato (se lo trova su TMDB). */
async function ensureRuntime(movie: any): Promise<any> {
    try {
      const rt = Number((movie as any)?.runtime);
      if (!Number.isNaN(rt) && rt > 0) return movie;
  
      if (movie?.id) {
        const det = await tmdbDetails(movie.id);
        if (det?.runtime) {
          return {
            ...movie,
            runtime: det.runtime,
            genres: Array.isArray(movie?.genres) && movie.genres.length ? movie.genres : (det.genres || []),
            poster_path: movie.poster_path ?? det.poster_path,
            overview: movie.overview ?? det.overview,
          };
        }
      }
  
      const title = movie?.title || "";
      if (!title) return movie;
  
      const res = await tmdbSearch(title);
      const first = res?.[0];
      if (!first?.id) return movie;
  
      const det = await tmdbDetails(first.id);
      if (det?.runtime) {
        return {
          ...movie,
          id: movie.id ?? first.id,
          runtime: det.runtime,
          genres: Array.isArray(movie?.genres) && movie.genres.length ? movie.genres : (det.genres || []),
          poster_path: movie.poster_path ?? det.poster_path ?? first.poster_path,
          overview: movie.overview ?? det.overview ?? first.overview ?? "",
        };
      }
      return movie;
    } catch {
      return movie;
    }
  }
  
  

// piccola pausa per non bombardare TMDB (opzionale)
const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

/** Completa poster/overview/genres per un film dato, usando TMDB. */
async function enrichFromTmdbByTitleOrId(movie: any) {
    try {
      // se ha già generi E runtime, non fare nulla
      const hasGenres = Array.isArray(movie?.genres) && movie.genres.length > 0;
      const rt = Number((movie as any)?.runtime);
      const hasRuntime = !Number.isNaN(rt) && rt > 0;
      if (hasGenres && hasRuntime) return movie;
  
      // prova con id diretto
      if (movie?.id) {
        const det = await tmdbDetails(movie.id);
        if (det) {
          return {
            ...movie,
            poster_path: movie.poster_path ?? det.poster_path,
            overview: movie.overview ?? det.overview,
            genres: Array.isArray(det.genres) ? det.genres : (movie.genres || []),
            runtime: det.runtime ?? movie.runtime,
          };
        }
      }
  
      // altrimenti cerca per titolo
      const title = movie?.title || "";
      if (!title) return movie;
  
      const search = await tmdbSearch(title);
      const first = search?.[0];
      if (!first?.id) {
        // almeno riempi poster/overview se ci sono nel "first"
        return {
          ...movie,
          poster_path: movie.poster_path ?? first?.poster_path,
          overview: movie.overview ?? first?.overview ?? movie.overview,
        };
      }
  
      const det = await tmdbDetails(first.id);
      if (!det) {
        return {
          ...movie,
          id: movie.id ?? first.id,
          poster_path: movie.poster_path ?? first.poster_path,
          overview: movie.overview ?? first.overview ?? "",
        };
      }
  
      return {
        ...movie,
        id: movie.id ?? first.id,
        poster_path: movie.poster_path ?? det.poster_path ?? first.poster_path,
        overview: movie.overview ?? det.overview ?? first.overview ?? "",
        genres: Array.isArray(det.genres) ? det.genres : (movie.genres || []),
        runtime: det.runtime ?? movie.runtime,
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
      const hasGenres = Array.isArray(movie?.genres) && movie.genres.length > 0;
      if (hasGenres && Number(movie?.runtime) > 0) return movie;
  
      if (movie?.id) {
        const det = await tmdbDetails(movie.id);
        if (det) {
          return {
            ...movie,
            poster_path: movie.poster_path ?? det.poster_path,
            overview: movie.overview ?? det.overview,
            genres: Array.isArray(det.genres) ? det.genres : (movie.genres || []),
            runtime: det.runtime ?? movie.runtime,
          };
        }
      }
      // fallback: se non ha id, prova via enrich generale (che cerca per titolo)
      return await enrichFromTmdbByTitleOrId(movie);
    } catch {
      return movie;
    }
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
// Theme (Dark/Light)
// ============================
type Theme = "light" | "dark";
function getInitialTheme(): Theme {
  const saved = (localStorage.getItem(K_THEME) as Theme | null) || null;
  if (saved === "dark" || saved === "light") return saved;
  return "dark"; // default
}
function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
  localStorage.setItem(K_THEME, theme);
}

// ============================
// UI primitives
// ============================
function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl border border-gray-200 bg-white p-4 shadow-sm 
                  dark:border-zinc-800 dark:bg-zinc-900/60 ${className}`}
    >
      {children}
    </div>
  );
}

function ThemeToggle({ theme, setTheme }: { theme: Theme; setTheme: (t: Theme) => void }) {
  return (
    <button
      aria-label="Toggle dark mode"
      className="rounded-xl border px-3 py-2 text-sm hover:bg-gray-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      title={theme === "dark" ? "Switch to Light" : "Switch to Dark"}
    >
      {theme === "dark" ? "🌙 Dark" : "☀️ Light"}
    </button>
  );
}

function Header({
    user,
    onLogout,
    tab,
    setTab,
    theme,
    setTheme,
  }: {
    user: string;
    onLogout: () => void;
    tab: "vote" | "history" | "profile" | "stats";
    setTab: (t: "vote" | "history" | "profile" | "stats") => void;
    theme: "light" | "dark";
    setTheme: (t: "light" | "dark") => void;
  }) {
    const tabBtn = (key: "vote" | "history" | "profile" | "stats", label: string) => (
      <button
        onClick={() => setTab(key)}
        className={`rounded-xl border px-3 py-2 
          ${tab === key ? "bg-black text-white dark:bg-white dark:text-black" : "bg-white dark:bg-zinc-900 dark:text-zinc-100"} 
          border-gray-200 dark:border-zinc-700`}
      >
        {label}
      </button>
    );
  
    return (
      <div className="flex flex-col gap-2 py-4 md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl font-bold">🎞️ Circo Cinema</h1>
  
        <div className="flex items-center gap-3">
          <nav className="flex items-center gap-2">
            {tabBtn("vote", "Vote")}
            {tabBtn("history", "History")}
            {tabBtn("profile", "Profile")}
            {tabBtn("stats", "Stats")}
          </nav>
  
          <span className="text-sm text-gray-700 dark:text-zinc-300">
            Hi, <b>{user}</b>
          </span>
  
          <button
            onClick={onLogout}
            className="rounded-xl border px-3 py-1 border-gray-200 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-900"
          >
            Sign out
          </button>
  
          <button
            aria-label="Toggle dark mode"
            className="rounded-xl border px-3 py-2 text-sm hover:bg-gray-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            title={theme === "dark" ? "Switch to Light" : "Switch to Dark"}
          >
            {theme === "dark" ? "🌙 Dark" : "☀️ Light"}
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
        <p className="mb-4 text-sm text-gray-600 dark:text-zinc-400">
          If you used this name before, your profile image and picks will be restored.
        </p>
        <div className="flex gap-2">
          <input
            className="flex-1 rounded-xl border px-3 py-2 border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
            placeholder="e.g. Talyon"
            value={name}
            onChange={(e) => setName(e.target.value.trimStart())}
          />
          <button
            className="rounded-xl bg-black px-4 py-2 text-white disabled:opacity-30 dark:bg-white dark:text-black"
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
          <label className="text-sm text-gray-600 dark:text-zinc-400">Search a movie</label>
          <input
            className="w-full rounded-xl border px-3 py-2 border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
            placeholder="e.g. The Matrix"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search()}
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
            className="flex cursor-pointer gap-3 rounded-xl border p-2 hover:bg-gray-50 dark:hover:bg-zinc-900 border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
            onClick={() => onPick(r)}
          >
            {r.poster_path && <img src={posterUrl(r.poster_path, "w185")} alt={r.title} className="h-24 w-16 rounded-lg object-cover" />}
            <div className="flex-1">
              <div className="font-semibold">
                {r.title} {r.release_date ? <span className="text-gray-500">({r.release_date?.slice(0, 4)})</span> : null}
              </div>
              <div className="line-clamp-3 text-sm text-gray-700 dark:text-zinc-300">{r.overview}</div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

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
  onDelete: () => void; // 👈 nuovo
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-2xl border bg-white p-4 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-lg font-semibold">Edit movie</h3>
          <div className="flex items-center gap-2">
            {/* Delete entry */}
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
              className="w-full rounded-xl border px-3 py-2 border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
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
              className="flex cursor-pointer gap-3 rounded-xl border p-2 hover:bg-gray-50 dark:hover:bg-zinc-800 border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
              onClick={() => onSelect(r)}
              title="Use this movie"
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
                <div className="line-clamp-3 text-sm text-gray-700 dark:text-zinc-300">
                  {r.overview}
                </div>
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
    </div>
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
          <p className="mt-1 whitespace-pre-wrap text-gray-700 dark:text-zinc-300">{movie.overview}</p>

          <div className="mt-4 grid gap-2">
            <label className="text-sm font-medium text-gray-700 dark:text-zinc-300">Picked by</label>
            <input
              list="known-users"
              className="max-w-sm rounded-xl border px-3 py-2 border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
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
            <button
              className="rounded-xl bg-black px-4 py-2 text-white disabled:opacity-30 dark:bg-white dark:text-black"
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
                  <span className="rounded-full bg-black px-2 py-1 text-white dark:bg-white dark:text-black">
                    Picked by: <b>{pickedBy}</b>
                  </span>
                </div>
              )}
            </div>
          </div>

          <p className="mt-2 text-gray-700 dark:text-zinc-300">{movie.overview}</p>

          <div className="mt-3 flex w-full items-stretch gap-3">
            <div className="flex-1 rounded-2xl border bg-gray-50 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900">
              <div className="text-xs uppercase text-gray-500 dark:text-zinc-400">Votes</div>
              <div className="text-2xl font-bold leading-6">{scores.length}</div>
            </div>
            <div className="flex-1 rounded-2xl border bg-gray-50 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900">
              <div className="text-xs uppercase text-gray-500 dark:text-zinc-400">Live avg</div>
              <div className="text-2xl font-bold leading-6">{avg !== null ? formatScore(avg) : "—"}</div>
            </div>
          </div>

          {!hasVoted ? (
            <div className="mt-4">
              {!openVote ? (
                <button className="rounded-xl bg-black px-4 py-2 text-white dark:bg-white dark:text-black" onClick={() => setOpenVote(true)}>
                  Vote
                </button>
              ) : (
                <div className="mt-2 rounded-2xl border p-3 dark:border-zinc-700">
                  <div className="mb-2 text-sm">Choose your score</div>
                  <RatingBar value={temp} onChange={(v) => setTemp(roundToQuarter(v))} />
                  <div className="mt-2 flex gap-2">
                    <button className="rounded-xl bg-black px-4 py-2 text-white dark:bg-white dark:text-black" onClick={submit}>
                      Submit vote
                    </button>
                    <button
                      className="rounded-xl border px-3 py-2 dark:border-zinc-700"
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
                  <div className="flex items-center gap-2 rounded-2xl border bg-gray-50 p-3 text-sm dark:border-zinc-700 dark:bg-zinc-900">
                    <span className="inline-block h-2 w-2 rounded-full bg-green-600" />
                    <span>
                      <b>Vote saved.</b> Please wait for others…
                    </span>
                  </div>
                  <button
                    className="rounded-xl border px-3 py-2 dark:border-zinc-700"
                    onClick={() => {
                      setTemp(you ?? 7);
                      setEditMode(true);
                    }}
                  >
                    Edit vote
                  </button>
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border p-3 dark:border-zinc-700">
                  <div className="mb-2 text-sm">
                    Edit your vote <span className="text-gray-500">(current: {formatScore(you)})</span>
                  </div>
                  <RatingBar value={temp} onChange={(v) => setTemp(roundToQuarter(v))} />
                  <div className="mt-2 flex gap-2">
                    <button className="rounded-xl bg-black px-4 py-2 text-white dark:bg-white dark:text-black" onClick={submit}>
                      Save
                    </button>
                    <button
                      className="rounded-xl border px-3 py-2 dark:border-zinc-700"
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
              <div className="rounded-xl border bg-white p-3 text-sm text-gray-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                No votes yet — be the first!
              </div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {sorted.map(([name, score]) => {
                  const isYou = name === currentUser;
                  return (
                    <div
                      key={name}
                      className={`flex items-center gap-3 rounded-2xl border bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900 ${
                        isYou ? "ring-2 ring-black dark:ring-white" : ""
                      }`}
                    >
                      <Avatar name={name} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">
                          {name} {isYou && <span className="ml-1 rounded bg-black px-1.5 py-0.5 text-xs font-semibold text-white dark:bg-white dark:text-black">You</span>}
                        </div>
                      </div>
                      <div className="rounded-full border px-2 py-0.5 text-sm font-semibold dark:border-zinc-700">{formatScore(score)}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-5">
            <button className="rounded-xl border px-4 py-2 dark:border-zinc-700" onClick={onEnd}>
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
function HistoryCardExtended({ v, onEdit }: { v: any; onEdit?: (id: any) => void }) {
  const ratings = (v.ratings || {}) as Record<string, number>;
  const scores = Object.values(ratings).map(Number);
  const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;

  const avgHue = (() => {
    if (avg == null) return 0;
    const t = Math.max(1, Math.min(10, avg));
    return ((t - 3) / 8) * 120; // 0..120
  })();

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


  // --- META STATE (poster/overview) sincronizzato con v.movie ---
  const [meta, setMeta] = React.useState<{ poster_path?: string; overview?: string }>({
    poster_path: v?.movie?.poster_path,
    overview: v?.movie?.overview,
  });

// 1) Sync immediato con i cambi del film (anche se il titolo resta uguale)
React.useEffect(() => {
  setMeta({
    poster_path: v?.movie?.poster_path,
    overview: v?.movie?.overview,
  });
}, [v?.id, v?.movie?.id, v?.movie?.poster_path, v?.movie?.overview]);

// 2) Se manca poster/overview, prova cache → TMDB (chiave: titolo)
const inFlightTitleRef = React.useRef<string | null>(null);

React.useEffect(() => {
  const title = (v?.movie?.title || "").trim();
  if (!title) return;

  const needPoster = !meta?.poster_path;
  const needOverview = !meta?.overview;
  if (!needPoster && !needOverview) return;

  // Evita fetch duplicati per lo stesso titolo
  if (inFlightTitleRef.current === title) return;
  inFlightTitleRef.current = title;

  // Cache locale
  const cache = getMetaCache();
  const cached = cache[title];
  if (cached && (cached.poster_path || cached.overview)) {
    setMeta((m) => ({
      poster_path: m.poster_path || cached.poster_path,
      overview: m.overview || cached.overview,
    }));
    inFlightTitleRef.current = null;
    return;
  }

  // Fallback: fetch da TMDB
  (async () => {
    try {
      const fetched = await fetchMetaForTitle(title);
      if (fetched) {
        setMeta((m) => ({
          poster_path: m.poster_path || fetched.poster_path,
          overview: m.overview || fetched.overview,
        }));
        const c = getMetaCache();
        c[title] = { poster_path: fetched.poster_path, overview: fetched.overview };
        setMetaCache(c);
      }
    } finally {
      inFlightTitleRef.current = null;
    }
  })();
}, [v?.movie?.title, meta?.poster_path, meta?.overview]);

const poster = meta?.poster_path || v?.movie?.poster_path || "";
const overview = (meta?.overview ?? v?.movie?.overview ?? "").trim();

  return (
    <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm ring-1 ring-black/5 transition hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900/60">
        {/* HEADER */}
            <div className="mb-3 flex flex-wrap items-center gap-3">
            {v.picked_by && (
                <div className="flex items-center gap-2 rounded-full bg-gray-50 px-2 py-1 dark:bg-zinc-900 dark:border dark:border-zinc-800">
                <PickerAvatar name={v.picked_by} />
                <span className="text-sm font-medium">{v.picked_by}</span>
                </div>
            )}
            <div className="mx-1 text-gray-300">•</div>

            {/* Titolo */}
            <h3 className="min-w-0 text-lg font-semibold leading-tight">
                <span className="break-words">{v.movie?.title || "Untitled"}</span>
            </h3>

            {/* ⬅️ Bottone Edit AGGIUNTO QUI, subito dopo il titolo */}
            {onEdit && (
                <button
                className="ml-2 rounded-full border px-2.5 py-1 text-xs dark:border-zinc-700"
                onClick={() => onEdit(v.id)}
                title="Edit movie"
                >
                Edit
                </button>
            )}

            {v.started_at && (
                <span className="ml-auto rounded-full bg-gray-50 px-2.5 py-1 text-xs text-gray-600 dark:bg-zinc-900 dark:text-zinc-400 dark:border dark:border-zinc-800">
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
                className="h-44 w-28 rounded-2xl border border-gray-200 object-cover shadow-sm dark:border-zinc-700"
              />
            ) : (
              <div className="flex h-44 w-28 items-center justify-center rounded-2xl border border-dashed text-xs text-gray-500 dark:border-zinc-700 dark:text-zinc-400">
                No poster
              </div>
            )}
          </div>

          <p className="min-w-0 whitespace-pre-wrap text-[15px] leading-relaxed text-gray-800 dark:text-zinc-300">
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
                className="rounded-2xl border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs text-gray-800 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
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

function HistoryCardCompact({ v, onEdit }: { v: any; onEdit?: (id: any) => void }) {
    const ratings = (v.ratings || {}) as Record<string, number>;
  const scores = Object.values(ratings).map(Number);
  const avg =
    scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;

  const avgHue = (() => {
    if (avg == null) return 0;
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
    <div className="rounded-2xl border border-gray-200 bg-white/80 p-3 shadow-sm transition hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900/60">
      <div className="flex flex-wrap items-center gap-2">
        {v.picked_by && (
            <div className="flex items-center gap-2 rounded-full bg-gray-50 px-2 py-1 dark:bg-zinc-900 dark:border dark:border-zinc-800">
            <PickerAvatar name={v.picked_by} />
            <span className="text-sm font-medium">{v.picked_by}</span>
            </div>
        )}
        <div className="mx-1 text-gray-300">•</div>

  {/* Titolo */}
  <div className="min-w-0 text-[15px] font-semibold leading-tight">
    <span className="break-words">{v.movie?.title || "Untitled"}</span>
  </div>

  {/* ⬅️ Bottone Edit AGGIUNTO QUI */}
  {onEdit && (
    <button
      className="ml-2 rounded-full border px-2 py-0.5 text-xs dark:border-zinc-700"
      onClick={() => onEdit(v.id)}
      title="Edit movie"
    >
      Edit
    </button>
  )}
</div>
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
              className="rounded-2xl border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs text-gray-800 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
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
        <div className="flex flex-col">
          <label className="text-xs text-gray-600 dark:text-zinc-400">Picked by</label>
          <select
            className="rounded-xl border px-3 py-2 border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
            value={picker}
            onChange={(e) => setPicker(e.target.value)}
          >
            <option value="">All</option>
            {pickers.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col">
          <label className="text-xs text-gray-600 dark:text-zinc-400">Genre</label>
          <select
            className="rounded-xl border px-3 py-2 border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
            value={genre}
            onChange={(e) => setGenre(e.target.value)}
          >
            <option value="">All</option>
            {genres.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col">
          <label className="text-xs text-gray-600 dark:text-zinc-400">Sort by</label>
          <select
            className="rounded-xl border px-3 py-2 border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
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
        <button className="rounded-xl border px-3 py-2 dark:border-zinc-700" onClick={onReset}>
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
            <div className="text-sm text-gray-700 dark:text-zinc-300">
              Logged in as <b>{user}</b>
            </div>
            <div className="mt-2 flex gap-2">
              <label className="cursor-pointer rounded-xl border px-3 py-2 text-sm dark:border-zinc-700">
                Change image
                <input
                  type="file"
                  accept="application/json"
                  className="hidden"
                  onChange={(e) => {
                    const inputEl = e.currentTarget;
                    const f = inputEl.files?.[0];
                    if (!f) return;

                    importHistoryFromFile(f, async (list) => {
                      try {
                        if (sb) {
                          // 1) scrivi SOLO il LIVE
                          const { error: upErr } = await saveLiveHistoryToStorage(list);
                          // 2) aggiorna anche cn_state (realtime)
                          const { error: stErr } = await saveSharedState({});

                          // 3) update ottimistico UI
                          setHistory(list);

                          if (upErr || stErr) {
                            alert("Import completato con avvisi (vedi console).");
                          } else {
                            alert(`Import OK: ${list.length} voci salvate su history_live.json + cn_state`);
                          }
                        } else {
                          lsSetJSON(K_VIEWINGS, list);
                          setHistory(list);
                          alert(`Import OK: ${list.length} voci caricate in locale`);
                        }
                      } finally {
                        inputEl.value = "";
                      }
                    });
                  }}
                />

              </label>
              {avatar && (
                <button className="rounded-xl border px-3 py-2 text-sm dark:border-zinc-700" onClick={clearAvatar}>
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
            <div className="text-sm text-gray-600 dark:text-zinc-400">No movies yet. Start one from the “Vote” tab.</div>
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

function Stats({
    history,
    backfillRuntime,   // optional: () => void
    isLoading = false, // optional
  }: {
    history: any[];
    backfillRuntime?: () => void;
    isLoading?: boolean;
  }) {
    // Automatic backfill start if provided
    React.useEffect(() => {
      if (!backfillRuntime) return;
      const hasRt = history.some((h) => Number((h?.movie as any)?.runtime) > 0);
      if (!hasRt && !isLoading && history.length > 0) {
        backfillRuntime();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [history, isLoading, backfillRuntime]);
  
    // Helper: average of a ratings record
    const avgOf = (r?: Record<string, number> | null) => {
      if (!r) return null;
      const vals = Object.values(r).map(Number);
      if (!vals.length) return null;
      return vals.reduce((a, b) => a + b, 0) / vals.length;
    };
  
    // ---- Aggregations
    const givenMap = new Map<string, { sum: number; n: number }>();     // votes given
    const receivedMap = new Map<string, { sum: number; n: number }>();  // average received as picker
    const genreCount = new Map<string, number>();                       // genre counts
    let totalMinutes = 0;
    let totalMinutesKnown = 0;
    const movieStats: Array<{ id: any; title: string; avg: number; votes: number; date: number }> = [];
  
    for (const v of history) {
      const ratings = (v?.ratings || {}) as Record<string, number>;
      const entries = Object.entries(ratings);
  
      // votes given per user
      for (const [user, score] of entries) {
        const m = givenMap.get(user) || { sum: 0, n: 0 };
        m.sum += Number(score);
        m.n += 1;
        givenMap.set(user, m);
      }
  
      // average received by the picker
      const avg = avgOf(ratings);
      if (avg != null && v?.picked_by) {
        const r = receivedMap.get(v.picked_by) || { sum: 0, n: 0 };
        r.sum += avg;
        r.n += 1;
        receivedMap.set(v.picked_by, r);
      }
  
      // genres
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
  
      // for top/flop
      if (avg != null) {
        movieStats.push({
          id: v.id,
          title: v?.movie?.title || "Untitled",
          avg,
          votes: entries.length,
          date: v?.started_at ? new Date(v.started_at).getTime() : 0,
        });
      }
    }
  
    // ---- Derived, sorted
    const givenArr = Array.from(givenMap, ([user, { sum, n }]) => ({
      user, avg: sum / Math.max(1, n), count: n,
    })).sort((a, b) => b.count - a.count || a.user.localeCompare(b.user));
  
    const receivedArr = Array.from(receivedMap, ([user, { sum, n }]) => ({
      user, avg: sum / Math.max(1, n), count: n,
    })).sort((a, b) => b.avg - a.avg || b.count - a.count);
  
    const genresArr = Array.from(genreCount, ([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  
    const bestMovies = movieStats.slice().sort((a, b) => b.avg - a.avg || b.votes - a.votes).slice(0, 5);
    const worstMovies = movieStats.slice().sort((a, b) => a.avg - b.avg || b.votes - a.votes).slice(0, 5);
  
    const harshest = givenArr.slice().sort((a, b) => a.avg - b.avg).slice(0, 3);
    const kindest  = givenArr.slice().sort((a, b) => b.avg - a.avg).slice(0, 3);
  
    // Minutes label (with loading state)
    const minutesLabel =
      totalMinutesKnown > 0
        ? `${totalMinutes} min (across ${totalMinutesKnown} movies with known runtime)`
        : isLoading
          ? "Fetching runtimes…"
          : "—";
  
    const LoadingRow = () => (
      <div className="rounded-xl border px-3 py-2 text-sm text-gray-500 dark:border-zinc-700 etdark:text-zinc-400">
        <span className="animate-pulse">Loading…</span>
      </div>
    );
  
    return (
      <div className="grid gap-4">
        {/* KPI row */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <div className="text-xs uppercase text-gray-500 dark:text-zinc-400">Total movies</div>
            <div className="text-2xl font-bold">{history.length}</div>
          </Card>
  
          <Card>
            <div className="text-xs uppercase text-gray-500 dark:text-zinc-400">Minutes watched</div>
            <div className="flex items-center">
              <div className="text-2xl font-bold">{minutesLabel}</div>
              {isLoading && <span className="ml-2 animate-pulse text-lg">⏳</span>}
            </div>
            {(!isLoading && totalMinutesKnown === 0) && (
              <p className="mt-1 text-xs text-gray-500 dark:text-zinc-400">
                No runtime available yet
                {backfillRuntime ? " — will be fetched automatically." : "."}
              </p>
            )}
          </Card>
  
          <Card>
            <div className="text-xs uppercase text-gray-500 dark:text-zinc-400">Distinct genres</div>
            <div className="text-2xl font-bold">{genresArr.length}</div>
          </Card>
  
          <Card>
            <div className="text-xs uppercase text-gray-500 dark:text-zinc-400">Total votes</div>
            <div className="text-2xl font-bold">
              {history.reduce((acc, v) => acc + Object.keys(v?.ratings || {}).length, 0)}
            </div>
          </Card>
        </div>
  
        {/* Most watched genres */}
        <Card>
          <h3 className="mb-3 text-lg font-semibold">🎭 Most watched genres</h3>
          {isLoading && genresArr.length === 0 ? (
            <LoadingRow />
          ) : genresArr.length === 0 ? (
            <div className="text-sm text-gray-600 dark:text-zinc-400">
              No genre data (make sure movies have TMDB genres).
            </div>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {genresArr.slice(0, 12).map((g) => (
                <li
                  key={g.name}
                  className="flex items-center justify-between rounded-xl border bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                >
                  <span>{g.name}</span>
                  <span className="rounded-full border px-2 py-0.5 text-xs dark:border-zinc-700">{g.count}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
  
        {/* Users: most votes / harshest / kindest */}
        <div className="grid gap-3 lg:grid-cols-3">
          <Card>
            <h3 className="mb-3 text-lg font-semibold">🗳️ Most votes given</h3>
            {isLoading && givenArr.length === 0 ? (
              <LoadingRow />
            ) : givenArr.length === 0 ? (
              <div className="text-sm text-gray-600 dark:text-zinc-400">No votes yet.</div>
            ) : (
              <ul className="grid gap-2">
                {givenArr.slice(0, 8).map((u) => (
                  <li
                    key={u.user}
                    className="flex items-center justify-between rounded-xl border bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  >
                    <span className="truncate">{u.user}</span>
                    <span className="text-xs">
                      <b>{u.count}</b> votes · avg <b>{formatScore(u.avg)}</b>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
  
          <Card>
            <h3 className="mb-3 text-lg font-semibold">🥶 Harshest (lowest avg)</h3>
            {isLoading && harshest.length === 0 ? (
              <LoadingRow />
            ) : harshest.length === 0 ? (
              <div className="text-sm text-gray-600 dark:text-zinc-400">N/A</div>
            ) : (
              <ul className="grid gap-2">
                {harshest.map((u) => (
                  <li
                    key={u.user}
                    className="flex items-center justify-between rounded-xl border bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  >
                    <span className="truncate">{u.user}</span>
                    <span className="text-xs">avg <b>{formatScore(u.avg)}</b> · {u.count} votes</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
  
          <Card>
            <h3 className="mb-3 text-lg font-semibold">💖 Kindest (highest avg)</h3>
            {isLoading && kindest.length === 0 ? (
              <LoadingRow />
            ) : kindest.length === 0 ? (
              <div className="text-sm text-gray-600 dark:text-zinc-400">N/A</div>
            ) : (
              <ul className="grid gap-2">
                {kindest.map((u) => (
                  <li
                    key={u.user}
                    className="flex items-center justify-between rounded-xl border bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  >
                    <span className="truncate">{u.user}</span>
                    <span className="text-xs">avg <b>{formatScore(u.avg)}</b> · {u.count} votes</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
  
        {/* Picker: average received on movies they picked */}
        <Card>
          <h3 className="mb-3 text-lg font-semibold">🎬 Avg score received by pickers</h3>
          {isLoading && receivedArr.length === 0 ? (
            <LoadingRow />
          ) : receivedArr.length === 0 ? (
            <div className="text-sm text-gray-600 dark:text-zinc-400">No movies with votes yet.</div>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {receivedArr.map((p) => (
                <li
                  key={p.user}
                  className="flex items-center justify-between rounded-xl border bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                >
                  <span className="truncate">{p.user}</span>
                  <span className="text-xs">
                    avg <b>{formatScore(p.avg)}</b> · {p.count} movies
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
  
        {/* Best / Worst movies */}
        <div className="grid gap-3 lg:grid-cols-2">
          <Card>
            <h3 className="mb-3 text-lg font-semibold">🏆 Top 5 movies</h3>
            {isLoading && bestMovies.length === 0 ? (
              <LoadingRow />
            ) : bestMovies.length === 0 ? (
              <div className="text-sm text-gray-600 dark:text-zinc-400">N/A</div>
            ) : (
              <ol className="grid gap-2">
                {bestMovies.map((m, i) => (
                  <li
                    key={m.id}
                    className="flex items-center justify-between rounded-xl border bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  >
                    <span className="truncate">{i + 1}. {m.title}</span>
                    <span className="text-xs">avg <b>{formatScore(m.avg)}</b> · {m.votes} votes</span>
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
              <div className="text-sm text-gray-600 dark:text-zinc-400">N/A</div>
            ) : (
              <ol className="grid gap-2">
                {worstMovies.map((m, i) => (
                  <li
                    key={m.id}
                    className="flex items-center justify-between rounded-xl border bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  >
                    <span className="truncate">{i + 1}. {m.title}</span>
                    <span className="text-xs">avg <b>{formatScore(m.avg)}</b> · {m.votes} votes</span>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>
  
        {/* Runtime note */}
        <p className="text-xs text-gray-500 dark:text-zinc-400">
          * Total minutes only consider movies with <code>runtime</code> known from TMDB.
        </p>
      </div>
    );
  }
  
  
  
// ==== Import/Export history (cn_viewings) ====
// Salva un file JSON con la history corrente
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

// Legge un file JSON e lo mette in cn_viewings
function importHistoryFromFile(
  file: File,
  onDone: (list: any[]) => void
) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result || "[]"));
      if (!Array.isArray(parsed)) throw new Error("File non valido: atteso un array");
      onDone(parsed);
    } catch (e: any) {
      alert(e?.message || "Errore nel file");
    }
  };
  reader.readAsText(file);
}

  

// ============================
// App
// ============================

export default function CinemaNightApp() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme());
  useEffect(() => applyTheme(theme), [theme]);
  const [isBackfillingRuntime, setIsBackfillingRuntime] = useState(false);

  const [user, setUser] = useState<string>("");
  const [tab, setTab] = useState<"vote" | "history" | "profile" | "stats">("vote");
const [editingViewing, setEditingViewing] = useState<{ id: any; title: string } | null>(null);

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
    // Usa la sorgente attuale dello stato (coerente con l'UI)
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
      // Aggiorna subito l'UI
      setHistory(list);
      // Persisti su Storage + cn_state (o locale)
      await persistHistory(list);
    }
  } catch (e) {
    console.error("[backfillHistoryGenres] failed:", e);
  } finally {
    setIsBackfilling(false);
  }
  };


  const backfillHistoryRuntime = async () => {
  if (isBackfillingRuntime) return;
  setIsBackfillingRuntime(true);
  try {
    // Parti dalla lista mostrata (così rispetti filtri/ordine corrente)
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
      await sleep(200); // gentile con TMDB
    }

    if (changed) {
      // Aggiorna UI
      setHistory(list);
      // Persisti anche lato Supabase (Storage + cn_state) o locale in fallback
      await persistHistory(list);
    }
  } catch (e) {
    console.error("[backfillHistoryRuntime] failed:", e);
  } finally {
    setIsBackfillingRuntime(false);
  }
  };


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

  const filteredSortedHistory = useMemo(() => {
    let L = history.slice();

    if (filterPicker) L = L.filter(h => (h?.picked_by || "") === filterPicker);

    if (filterGenre) {
      L = L.filter(h => {
        const arr = (h?.movie?.genres || []) as Array<{ id: number; name: string }>;
        return arr?.some(g => g?.name === filterGenre);
      });
    }

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

  const knownUsers = useMemo(() => {
    const set = new Set<string>();
    for (const h of history) {
      Object.keys(h?.ratings || {}).forEach((u) => set.add(u));
      if (h?.picked_by) set.add(h.picked_by);
    }
    if (user) set.add(user);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [history, user]);

// Init + realtime (Supabase) + seed fallback
useEffect(() => {
  let off = () => {};

  (async () => {
    // ripristina utente
    setUser(lsGetJSON<string | null>(K_USER, "") || "");

    if (sb) {
      const [{ list: storageList, source }, shared] = await Promise.all([
        loadHistoryFromStoragePreferLive(),
        loadSharedState(),
      ]);

      // 1) scegli la fonte iniziale
      let initial: any[] = Array.isArray(storageList) ? storageList : [];
      let used: "live" | "base" | "cn_state" | null = source ?? null;

      // fallback a cn_state se Storage è vuoto
      if (initial.length === 0 && Array.isArray(shared?.history) && shared.history.length > 0) {
        initial = shared.history;
        used = "cn_state";
        try {
          await ensureLiveFileExists(initial);     // crea history_live.json se manca
          await saveLiveHistoryToStorage(initial); // mantieni in sync il LIVE
        } catch (e) {
          console.warn("[init] ensure/sync live failed:", e);
        }
      }

      // 2) applica stato iniziale
      setHistory(initial);
      setActiveVote(shared?.active ?? null);
      setActiveRatings(shared?.ratings ?? {});

      console.log("[init] history source:", used, "len:", initial.length);

      // 3) realtime cn_state
      off = subscribeSharedState(async (row) => {
      try {
        const live = await downloadJSONFromStorage(STORAGE_LIVE_HISTORY_KEY);
        if (Array.isArray(live)) setHistory(live);
      } catch (e) {
        console.warn("[realtime] reload live history failed:", e);
      }
      setActiveVote(row?.active ?? null);
      setActiveRatings(row?.ratings ?? {});
    });

      return; // niente fallback locale se c'è Supabase
    }

    // ------- Fallback locale -------
    let hist = lsGetJSON<any[]>(K_VIEWINGS, []);
    if (hist.length === 0) {
      try {
        // @ts-ignore
        const mod = await import("./seed");
        if (Array.isArray(mod?.CIRCO_SEED) && mod.CIRCO_SEED.length) {
          hist = mod.CIRCO_SEED as any[];
        }
      } catch {}
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
      if (e.key === K_THEME) applyTheme(((localStorage.getItem(K_THEME) as Theme) || "dark") as Theme);
    };
    window.addEventListener("storage", onStorage);
    off = () => window.removeEventListener("storage", onStorage);
  })();

  return () => off();
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


    // Avvia il backfill dei runtime quando mancano (senza attendere la tab Stats)
    useEffect(() => {
        if (history.length === 0) return;
        if (isBackfillingRuntime) return; // evita doppi trigger mentre sta lavorando
    
        // c'è almeno un runtime valido?
        const hasAnyRuntime = history.some(h => {
        const rt = Number((h?.movie as any)?.runtime);
        return !Number.isNaN(rt) && rt > 0;
        });
    
        // ci sono runtime mancanti o non validi?
        const hasMissingRuntime = history.some(h => {
        const rt = Number((h?.movie as any)?.runtime);
        return Number.isNaN(rt) || rt <= 0;
        });
    
        // se non abbiamo ancora nessun runtime ma ce ne sono di mancanti, avvia il backfill
        if (!hasAnyRuntime && hasMissingRuntime) {
        backfillHistoryRuntime();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [history.length, isBackfillingRuntime]);
    
    async function deleteViewing(viewingId: any) {
      try {
        const nextList = history.filter((v) => v.id !== viewingId);
        setHistory(nextList);           // UI subito
        await persistHistory(nextList); // salva su Storage + cn_state (o locale)
      } catch (e) {
        console.error("[deleteViewing] failed:", e);
        alert("Errore durante l'eliminazione.");
      }
    }

    async function updateViewingMovie(viewingId: any, nextMovie: any) {
    try {
      const nextList = history.map(v => v.id === viewingId ? { ...v, movie: nextMovie } : v);
      setHistory(nextList);                 // UI subito
      await persistHistory(nextList);       // ⬅️ server write
    } catch (e) {
      console.error("[updateViewingMovie] failed:", e);
      alert("Errore durante il salvataggio.");
    }
  }




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

  // UI ottimistica
  setActiveRatings((prev) => ({ ...prev, [user]: fixed }));

  if (sb) {
    await setRatingAtomic(user, fixed); // 👈 merge atomico lato DB
  } else {
    const next = { ...lsGetJSON<Record<string, number>>(K_ACTIVE_RATINGS, {}), [user]: fixed };
    lsSetJSON(K_ACTIVE_RATINGS, next);
  }
};

  const endVoting = async () => {
  if (!activeVote) return;

  const entry = {
    id: activeVote.id,
    started_at: activeVote.started_at,
    picked_by: activeVote.picked_by,
    movie: activeVote.movie,
    ratings: activeRatings,
  };

  const nextHistory = [entry, ...history];

  // UI subito
  setHistory(nextHistory);
  setActiveVote(null);
  setActiveRatings({});

  if (sb) {
    // Scrivi la history su Storage + cn_state (così anche chi entra dopo la vede)
    await persistHistory(nextHistory);
    // Azzera lo stato attivo per tutti
    await saveSharedState({ active: null, ratings: {} });
  } else {
    // fallback locale
    const L = lsGetJSON<any[]>(K_VIEWINGS, []);
    L.unshift(entry);
    lsSetJSON(K_VIEWINGS, L);
    localStorage.removeItem(K_ACTIVE_VOTE);
    localStorage.removeItem(K_ACTIVE_RATINGS);
  }
};


  
  return (
    <div className="min-h-screen bg-gray-50 p-4 text-gray-900 dark:bg-zinc-950 dark:text-zinc-100">
      {!user ? (
        <Login onLogin={login} />
      ) : (
        <div className="mx-auto max-w-6xl">
          <Header user={user} onLogout={logout} tab={tab} setTab={setTab} theme={theme} setTheme={setTheme} />

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

            {tab === "stats" && (
            <div className="mt-2 grid gap-4">
                <Card>
                <h3 className="mb-3 text-lg font-semibold">📊 Stats</h3>
                <Stats
                    history={history}
                    backfillRuntime={backfillHistoryRuntime}
                    isLoading={isBackfillingRuntime}
                />
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
      onClick={() =>
        setHistoryMode(historyMode === "extended" ? "compact" : "extended")
      }
    >
      Switch to {historyMode === "extended" ? "Compact" : "Extended"} view
    </button>

    {/* Export */}
    <button
      className="rounded-xl border px-3 py-1 text-sm dark:border-zinc-700"
      onClick={() => exportHistoryJSON(history)}
      title="Scarica file JSON con la history"
    >
      Export JSON
    </button>
  </div>
</div>



           {editingViewing && (
              <EditMovieDialog
                open
                initialTitle={editingViewing.title}
                onClose={() => setEditingViewing(null)}
                onSelect={async (tmdbMovie) => {
                  const det = await tmdbDetails(tmdbMovie.id);
                  const enriched = await ensureGenres(det || tmdbMovie);
                  await updateViewingMovie(editingViewing.id, enriched);
                  setEditingViewing(null);
                }}
                onDelete={async () => {
                  await deleteViewing(editingViewing.id);
                  setEditingViewing(null);
                }}
              />
            )}
                {/* ── Filters + Sort ───────────────────────────────────────────── */}
                {(() => {
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
                      <div className="flex flex-col">
                        <label className="text-xs text-gray-600 dark:text-zinc-400">Picked by</label>
                        <select
                          className="rounded-xl border px-3 py-2 border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
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
                          className="rounded-xl border px-3 py-2 border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
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
                          className="rounded-xl border px-3 py-2 border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
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
                  );
                })()}

                {/* ── Results ─────────────────────────────────────────────────── */}
                <div className="mt-4 grid gap-3">
                  {history.length === 0 && (
                    <div className="text-sm text-gray-600 dark:text-zinc-400">
                      No entries yet. Start a vote from the “Vote” tab.
                    </div>
                  )}

                  {(() => {
                    let L = history.slice();
                    if (filterPicker) L = L.filter((h) => h?.picked_by === filterPicker);
                    if (filterGenre) {
                      L = L.filter((h) =>
                        ((h?.movie?.genres as Array<{ name: string }>) || []).some(
                          (g) => g?.name === filterGenre
                        )
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

                    return L.map((v) =>
                        historyMode === "extended" ? (
                          <HistoryCardExtended
                            key={v.id}
                            v={v}
                            onEdit={() => setEditingViewing({ id: v.id, title: v?.movie?.title || "" })}
                          />
                        ) : (
                          <HistoryCardCompact
                            key={v.id}
                            v={v}
                            onEdit={() => setEditingViewing({ id: v.id, title: v?.movie?.title || "" })}
                          />
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
