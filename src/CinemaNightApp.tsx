import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { createPortal } from "react-dom";

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
const OMDB_API_KEY = "c71ea1b7";

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

function formatCompact(n: number) {
  if (n < 1000) return String(n);
  const units = ["k","M","B","T"];
  let i = -1;
  let v = n;
  do { v /= 1000; i++; } while (v >= 1000 && i < units.length - 1);
  return `${Math.round(v * 10) / 10}${units[i]}`;
}


// TMDB: prime recensioni
async function tmdbReviews(tmdbId: number) {
  try {
    const url = `https://api.themoviedb.org/3/movie/${tmdbId}/reviews?api_key=${TMDB_API_KEY}&language=en-US&page=1`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    const results = Array.isArray(data?.results) ? data.results : [];
    return results.slice(0, 3).map((r: any) => ({
      id: r.id,
      author: r?.author || r?.author_details?.username || "Unknown",
      rating: typeof r?.author_details?.rating === "number" ? r.author_details.rating : null,
      content: r?.content || "",
      url: r?.url || "",
      created_at: r?.created_at || null,
    }));
  } catch {
    return [];
  }
}


async function omdbRatingFromImdbId(imdbId: string) {
  try {
    if (!OMDB_API_KEY || !imdbId) return null;
    const res = await fetch(`https://www.omdbapi.com/?apikey=${OMDB_API_KEY}&i=${imdbId}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.Response !== "True") return null;
    return {
      imdb_rating: data.imdbRating !== "N/A" ? parseFloat(data.imdbRating) : null,
      imdb_votes:
        data.imdbVotes && data.imdbVotes !== "N/A"
          ? parseInt(String(data.imdbVotes).replace(/,/g, ""), 10)
          : null,
    };
  } catch {
    return null;
  }
}


async function loadHistoryFromStorage(): Promise<any[] | null> {
  if (!sb) return null;
  try {
    const { data, error } = await sb.storage
      .from(STORAGE_BUCKET)
      .download(STORAGE_LIVE_HISTORY_KEY);
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
      .upload(STORAGE_LIVE_HISTORY_KEY, blob, { upsert: true, contentType: "application/json" });
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


function mergeMovie(base: any, det: any) {
  const release_year =
    (det?.release_date || base?.release_date || "").slice(0, 4) ||
    base?.release_year ||
    null;

  return {
    ...base,
    id: base?.id ?? det?.id,
    poster_path: base?.poster_path ?? det?.poster_path,
    overview: base?.overview ?? det?.overview ?? "",
    genres: Array.isArray(det?.genres) ? det.genres : (base?.genres || []),
    runtime: det?.runtime ?? base?.runtime,
    release_year,
    tmdb_vote_average:
      typeof det?.vote_average === "number"
        ? det.vote_average
        : base?.tmdb_vote_average,
    tmdb_vote_count:
      typeof det?.vote_count === "number"
        ? det.vote_count
        : base?.tmdb_vote_count,
    imdb_id: det?.external_ids?.imdb_id ?? base?.imdb_id,
  };
}

// Assicura che il movie abbia almeno genres (e, già che ci siamo, completiamo poster/overview se mancano)
async function ensureGenres(movie: any): Promise<any> {
  try {
    let out = { ...movie };
    let det: any = null;

    if (movie?.id) {
      det = await tmdbDetails(movie.id);
      if (det) out = mergeMovie(out, det);
    }

    if (!out?.id && movie?.title) {
      const search = await tmdbSearch(movie.title);
      const first = search?.[0];
      if (first?.id) {
        det = await tmdbDetails(first.id);
        out = det
          ? mergeMovie(out, det)
          : {
              ...out,
              id: first.id,
              poster_path: out.poster_path ?? first.poster_path,
              overview: out.overview ?? first.overview ?? "",
            };
      }
    }

    // IMDb rating (se possibile), altrimenti useremo tmdb_vote_average in UI
    if (!out.imdb_rating && out.imdb_id) {
      const omdb = await omdbRatingFromImdbId(out.imdb_id);
      if (omdb) out = { ...out, ...omdb };
    }

    return out;
  } catch {
    return movie;
  }
}

async function ensureRuntime(movie: any): Promise<any> {
  try {
    return await ensureGenres(movie);
  } catch {
    return movie;
  }
}
  
  const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

async function enrichFromTmdbByTitleOrId(movie: any) {
  return await ensureGenres(movie);
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
    const url = `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${TMDB_API_KEY}&language=en-US&append_to_response=external_ids`;
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
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
            onClick={() => {
              onPick(r);
              setResults([]);          // 🔹 nasconde i suggerimenti
              setQ(r.title || "");     // (opzionale) mostra il titolo scelto nell'input
            }}
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


/* ===========================
 *  ACTIVE VOTING (con lazy meta fetch)
 * =========================== */
// ============== Mini componenti interni ==============
const ClapperIcon: React.FC<{ className?: string }> = ({ className = "" }) => (
  <svg viewBox="0 0 24 24" className={`h-4 w-4 ${className}`} fill="currentColor" aria-hidden="true">
    <path d="M3 8h18v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8Zm18-2v2H3V6a2 2 0 0 1 2-2h2l2 2h3l-2-2h3l2 2h3l-2-2h3a2 2 0 0 1 2 2Z"/>
  </svg>
);

export function PickedByBadge({ name }: { name?: string }) {
  if (!name) return null;
  const avatar = loadAvatarFor(name);
  const initial = name?.[0]?.toUpperCase() || "?";

  return (
    <span
      className="inline-flex items-center gap-2 rounded-full border border-amber-400/40
                 bg-amber-500/15 px-2.5 py-1.5 text-amber-200 shadow-sm backdrop-blur
                 ring-1 ring-amber-400/20"
      title={`Picked by: ${name}`}
    >
      <ClapperIcon className="text-amber-300" />
      {avatar ? (
        <img
          src={avatar}
          alt={name}
          className="h-5 w-5 rounded-full object-cover ring-2 ring-amber-400/50"
        />
      ) : (
        <span className="grid h-5 w-5 place-items-center rounded-full bg-amber-500/20
                         text-[10px] font-bold text-amber-100 ring-2 ring-amber-400/50">
          {initial}
        </span>
      )}
      <span className="text-xs font-bold">{name}</span>
    </span>
  );
}


function AvatarInline({ name }: { name: string }) {
  const avatar = loadAvatarFor(name);
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");
  if (avatar) return <img src={avatar} className="h-8 w-8 rounded-full object-cover" alt={name} />;
  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-xs font-semibold dark:bg-zinc-800">
      {initials || "?"}
    </div>
  );
}

function ScoreSlider({
  value,
  onChange,
  min = 1,
  max = 10,
  step = 0.25,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  const toPct = (n: number) => ((clamp(n) - min) / (max - min)) * 100;
  const pct = toPct(value);
  const mid = min + (max - min) / 2;

  const fmt = (n: number) => {
    try {
      // usa il tuo formatter se presente
      // @ts-ignore
      return typeof formatScore === "function"
        ? // @ts-ignore
          formatScore(n)
        : (Math.round(n * 100) / 100)
            .toFixed(2)
            .replace(/\.00$/, "")
            .replace(/(\.\d)0$/, "$1");
    } catch {
      return String(n);
    }
  };

  const Pill = ({ children }: { children: React.ReactNode }) => (
    <span
      className="
        rounded-md px-1.5 py-[2px] text-[12px] font-semibold
        bg-white/90 text-gray-900 ring-1 ring-gray-300 shadow-sm
        dark:bg-zinc-900/85 dark:text-zinc-50 dark:ring-zinc-700
      "
    >
      {children}
    </span>
  );

  return (
    <div className="relative">
      {/* Track */}
      <div className="relative h-3 w-full rounded-full bg-zinc-800/80">
        {/* Fill */}
        <div
          className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-lime-500 to-lime-400"
          style={{ width: `${pct}%` }}
        />
        {/* tacche intere */}
        {Array.from({ length: Math.floor(max - min) + 1 }, (_, i) => i + min).map(
          (n) => (
            <div
              key={n}
              className="absolute top-1/2 h-3 w-[2px] -translate-y-1/2 bg-white/35"
              style={{ left: `calc(${toPct(n)}% - 1px)` }}
            />
          )
        )}
      </div>

      {/* Bubble + thumb (solo visuali; non catturano il puntatore) */}
      <div
        className="pointer-events-none absolute -top-12 select-none"
        style={{ left: `calc(${pct}% - 24px)` }}
      >
        <div className="rounded-xl border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm font-bold text-white shadow-lg">
          {fmt(value)}
        </div>
      </div>
      <div
        className="pointer-events-none absolute -top-[10px] grid h-8 w-8 place-items-center rounded-full bg-white text-[10px] font-bold text-zinc-900 shadow-lg"
        style={{ left: `calc(${pct}% - 16px)` }}
      >
        ●
      </div>

      {/* Range reale: gestisce drag/touch/keyboard */}
      <input
        aria-label="Vote slider"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onInput={(e) =>
          onChange(
            // @ts-ignore
            roundToQuarter(parseFloat((e.target as HTMLInputElement).value))
          )
        }
        onChange={(e) =>
          onChange(
            // @ts-ignore
            roundToQuarter(parseFloat((e.target as HTMLInputElement).value))
          )
        }
        className="absolute inset-0 h-8 w-full cursor-pointer appearance-none bg-transparent opacity-0"
      />

      {/* Label pill più visibili */}
      <div className="mt-1.5 flex justify-between">
        <Pill>{fmt(min)}</Pill>
        <Pill>{fmt(mid)}</Pill>
        <Pill>{fmt(max)}</Pill>
      </div>
    </div>
  );
}


/** Barra voti con avatar sopra le tacche (riutilizzabile ovunque)
 *  - entries: [ [nome, voto], ... ]
 *  - avg: media (1..10) o null
 *  - currentUser: evidenzia il tuo avatar con ring bianco
 *  - size: 'md' | 'sm' (compact)
 *  - showScale: mostra 1/5/10 sotto
 */
function VotesBarWithAvatars({
  entries,
  avg,
  currentUser,
  size = "md",
  showScale = true,
}: {
  entries: [string, number][];
  avg: number | null;
  currentUser?: string;
  size?: "sm" | "md";
  showScale?: boolean;
}) {
  const toPct = (n: number) => ((Number(n) - 1) / 9) * 100;
  const BADGE_SHIFT = 0.5;
  // dimensioni
  const trackH    = size === "sm" ? 8  : 16;
  const tickH     = size === "sm" ? 14 : 24;
  const avatarSz  = size === "sm" ? 18 : 22;
  const countSz   = size === "sm" ? 14 : 16;

  const ringByScore = (s: number) =>
    s >= 8 ? "ring-emerald-500/70" : s >= 6 ? "ring-amber-400/70" : "ring-rose-500/70";

  // misura track per soglia in px -> %
  const ref = React.useRef<HTMLDivElement>(null);
  const [w, setW] = React.useState(0);
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    setW(el.clientWidth);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // punti ordinati
  const points = React.useMemo(
    () =>
      entries
        .map(([name, score]) => ({
          name,
          score: Number(score),
          pct: toPct(Number(score)),
          avatar: loadAvatarFor(name),
        }))
        .sort((a, b) => a.pct - b.pct),
    [entries]
  );

  // cluster per vicinanza orizzontale
  const minPct = React.useMemo(() => {
    if (!w) return 1.4; // fallback
    const minPx = Math.max(avatarSz * 0.9, 16); // distanza minima tra cluster
    return (minPx / w) * 100;
  }, [w, avatarSz]);

  type Cluster = { pct: number; people: typeof points };
  const clusters: Cluster[] = React.useMemo(() => {
    const out: Cluster[] = [];
    let cur: typeof points = [];
    for (const p of points) {
      if (!cur.length || Math.abs(p.pct - cur[cur.length - 1].pct) < minPct) {
        cur.push(p);
      } else {
        const pct = cur.reduce((a, b) => a + b.pct, 0) / cur.length;
        out.push({ pct, people: cur });
        cur = [p];
      }
    }
    if (cur.length) {
      const pct = cur.reduce((a, b) => a + b.pct, 0) / cur.length;
      out.push({ pct, people: cur });
    }
    return out;
  }, [points, minPct]);

  // util: rappresentante del cluster (preferisci l'utente corrente, altrimenti il più alto, tie -> alfabetico)
  function pickRep(c: Cluster) {
    const meIdx = currentUser ? c.people.findIndex(p => p.name === currentUser) : -1;
    if (meIdx >= 0) return c.people[meIdx];
    return c.people
      .slice()
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))[0];
  }

  return (
    <div className="w-full">
      <div className="mb-1 flex items-center justify-between text-xs text-zinc-400">
        <span>Avg {entries.length ? `(${entries.length} votes)` : ""}</span>
        <span>10</span>
      </div>

      <div
        ref={ref}
        className="relative w-full overflow-visible rounded-full bg-zinc-800"
        style={{ height: trackH }}
      >
        {/* riempimento fino alla media */}
        {avg !== null && (
          <div
            className="absolute left-0 top-0 h-full bg-gradient-to-r from-lime-500 to-lime-400"
            style={{ width: `${toPct(avg)}%` }}
          />
        )}

        {/* cluster */}
        {clusters.map((c, i) => {
          const rep = pickRep(c);
          const others = c.people.length - 1;
          const left = `calc(${c.pct}% - 1px)`;
          const ring =
            rep.name === currentUser ? "ring-white" : ringByScore(rep.score);
          const tooltip = c.people
            .map(p => `${p.name} ${formatScore(p.score)}`)
            .join(", ");

          return (
            <div key={i} className="absolute pointer-events-none" style={{ left }}>
              {/* tick del cluster */}
              <div
                className="absolute top-0 w-[2px] -translate-x-1/2 rounded-full bg-white/90 shadow-[0_0_0_2px_rgba(0,0,0,0.5)]"
                style={{ height: tickH }}
              />
              {/* avatar rappresentante + badge count */}
              <div
                className="absolute -translate-x-1/2"
                style={{ top: -(avatarSz + 6) }}
                title={tooltip}
              >
                {rep.avatar ? (
                  <img
                    src={rep.avatar}
                    alt={rep.name}
                    className={`rounded-full object-cover ring-2 ${ring}`}
                    style={{ width: avatarSz, height: avatarSz }}
                  />
                ) : (
                  <div
                    className={`grid place-items-center rounded-full bg-zinc-900 text-[10px] font-bold text-white ring-2 ${ring}`}
                    style={{ width: avatarSz, height: avatarSz }}
                  >
                    {(rep.name?.[0] || "?").toUpperCase()}
                  </div>
                )}

                {others > 0 && (
                  <div
                    className="absolute grid place-items-center rounded-full border border-zinc-900 bg-white text-[10px] font-bold text-zinc-900 shadow dark:bg-zinc-200"
                    style={{
                      width: countSz,
                      height: countSz,
                      right: -countSz * BADGE_SHIFT,
                      bottom: -countSz * 0.2,
                    }}
                  >
                    +{others}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {showScale && (
        <div className="mt-1 flex justify-between text-[11px] text-zinc-500">
          <span>1</span><span>5</span><span>10</span>
        </div>
      )}
    </div>
  );
}

// Pill dei numeri scala (1 / 5 / 10) — light/dark friendly
function ScaleLabels({ className = "" }: { className?: string }) {
  const pill =
    "rounded-md px-1.5 py-[2px] text-[12px] font-semibold " +
    "bg-white/90 text-gray-900 ring-1 ring-gray-300 shadow-sm " +
    "dark:bg-zinc-900/85 dark:text-zinc-50 dark:ring-zinc-700";
  return (
    <div className={`mt-1.5 flex justify-between ${className}`}>
      <span className={pill}>1</span>
      <span className={pill}>5</span>
      <span className={pill}>10</span>
    </div>
  );
}


// ============== ActiveVoting ==============
function ActiveVoting({
  movie,
  pickedBy,
  currentUser,
  ratings,
  onSendVote,
  onEnd,
  onMetaResolved, // NEW (opzionale)
}: {
  movie: any;
  pickedBy?: string;
  currentUser: string;
  ratings: Record<string, number>;
  onSendVote: (score: number) => void;
  onEnd: () => void;
  onMetaResolved?: (nextMovie: any) => void; // NEW
}) {
  // Stato voto utente
  const you = ratings[currentUser];
  const hasVoted = typeof you === "number";
  const [openVote, setOpenVote] = React.useState(false);
  const [editMode, setEditMode] = React.useState(false);
  const [temp, setTemp] = React.useState<number>(you ?? 7);
  React.useEffect(() => {
    if (typeof you === "number") setTemp(you);
  }, [you]);
  const submit = () => {
    const fixed = roundToQuarter(temp);
    onSendVote(fixed);
    setOpenVote(false);
    setEditMode(false);
  };

  // Derivati
  const entries = Object.entries(ratings) as [string, number][];
  const scores = entries.map(([, n]) => Number(n));
  const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;

  const sorted = entries
    .slice()
    .sort((a, b) => Number(b[1]) - Number(a[1]) || a[0].localeCompare(b[0]));

  const releaseYear =
    movie?.release_year ||
    (movie?.release_date ? String(movie.release_date).slice(0, 4) : null);

  const genreLine = Array.isArray(movie?.genres)
    ? movie.genres.map((g: any) => g?.name).filter(Boolean).join(", ")
    : "";

  const poster = movie?.poster_path ? posterUrl(movie.poster_path, "w342") : "";

  /* ---------- Sub-components ---------- */

  // Pill “Picked by” unificata
  
  function PickedByPill({ name }: { name: string }) {
    const avatar = loadAvatarFor(name);
    const initial = name?.[0]?.toUpperCase() || "?";
    return (
      <div
        className="
          inline-flex items-center gap-3 rounded-full
          px-3 py-2
          bg-[#201607] ring-1 ring-[#d8b24a]/30
          text-[#f6e7b0] shadow-[inset_0_1px_0_rgba(255,255,255,.04)]
        "
        title={`Picked by: ${name}`}
      >
        <div className="grid h-5 w-5 place-items-center rounded-md bg-[#d8b24a] text-black">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M3 6.5 15.5 4l1 3L4 9.5l-1-3zM4 11h16a1 1 0 0 1 1 1v7H3v-7a1 1 0 0 1 1-1z" />
          </svg>
        </div>
        {avatar ? (
          <img
            src={avatar}
            alt={name}
            className="h-6 w-6 rounded-full object-cover ring-2 ring-[#d8b24a]/50"
          />
        ) : (
          <div className="grid h-6 w-6 place-items-center rounded-full bg-[#2e2a1f] text-[#f6e7b0] ring-2 ring-[#d8b24a]/40 text-[10px] font-bold">
            {initial}
          </div>
        )}
        <div className="leading-4 text-[11px] text-[#f6e7b0]/90">
          <div className="-mb-0.5">Picked by</div>
        </div>
        <div className="ml-1 text-sm font-semibold">{name}</div>
      </div>
    );
  }

  // Avatar iniziale colorato per chip votanti
  function InitialCircle({ name, score }: { name: string; score: number }) {
    const ring =
      score >= 8 ? "ring-emerald-500/60" :
      score >= 6 ? "ring-amber-400/60"  :
                   "ring-rose-500/60";

    return (
      <div
        className={`grid h-6 w-6 place-items-center rounded-full text-[11px] font-bold ring-2 ${ring}`}
        title={name}
      >
        {(name?.[0] || "?").toUpperCase()}
      </div>
    );
  }
  function VoterChip({ name, score }: { name: string; score: number }) {
    return (
      <div className="inline-flex items-center gap-2 rounded-2xl border border-zinc-700/80 bg-zinc-900/70 px-2.5 py-1 text-sm text-zinc-100">
        <InitialCircle name={name} score={score} />
        <span className="truncate max-w-[8.5rem]">{name}</span>
        <span className="mx-1 text-zinc-500">•</span>
        <span className="font-semibold">{formatScore(score)}</span>
        {name === currentUser && (
          <span className="ml-1 rounded bg-zinc-200 px-1.5 py-0.5 text-[10px] font-bold text-zinc-900">You</span>
        )}
      </div>
    );
  }

  // Recap stile History: anello + barra con lineette
  const AvgRing = ({ value }: { value: number }) => {
    const r = 26, c = 2 * Math.PI * r, pct = Math.max(0, Math.min(100, ((value - 1) / 9) * 100));
    return (
      <div className="relative h-16 w-16">
        <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90">
          <circle cx="32" cy="32" r={r} strokeWidth="8" className="fill-none stroke-zinc-800/60" />
          <circle cx="32" cy="32" r={r} strokeWidth="8" className="fill-none stroke-lime-400"
            strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - (pct / 100) * c}/>
        </svg>
        <div className="absolute inset-0 grid place-items-center text-sm font-bold">
          {formatScore(value)}
        </div>
      </div>
    );
  };

  /* ---------- Render ---------- */
  return (
    <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm ring-1 ring-black/5 dark:border-zinc-800 dark:bg-zinc-900/60">
      {/* Header: pill a sinistra, titolo a destra */}
      <div className="mb-4 grid items-start gap-3 md:grid-cols-[auto,1fr]">
        <div>{pickedBy && <PickedByPill name={pickedBy} />}</div>
        <div>
          <div className="text-xl font-bold">
            Voting in progress · {movie?.title}
            {releaseYear && <span className="ml-1 text-zinc-400">({releaseYear})</span>}
          </div>

          {/* Meta badges */}
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-gray-600 dark:text-zinc-400">
            {Number(movie?.runtime) > 0 && (
              <span className="rounded-full border px-2 py-0.5 dark:border-zinc-700">⏱ {movie.runtime} min</span>
            )}
            {genreLine && (
              <span className="rounded-full border px-2 py-0.5 dark:border-zinc-700">{genreLine}</span>
            )}
            {typeof movie?.imdb_rating === "number" ? (
              <span className="rounded-full border px-2 py-0.5 dark:border-zinc-700">★ IMDb {formatScore(movie.imdb_rating)}</span>
            ) : typeof movie?.tmdb_vote_average === "number" ? (
              <span className="rounded-full border px-2 py-0.5 dark:border-zinc-700">★ TMDB {formatScore(movie.tmdb_vote_average)}</span>
            ) : null}
            {typeof movie?.tmdb_vote_count === "number" && movie.tmdb_vote_count > 0 && (
              <span className="rounded-full border px-2 py-0.5 dark:border-zinc-700">
                {movie.tmdb_vote_count.toLocaleString()} votes
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Layout principale */}
      <div className="grid gap-5 md:grid-cols-[176px,1fr]">
        {/* Poster */}
        <div className="flex items-start justify-center">
          {poster ? (
            <img
              src={poster}
              className="h-[264px] w-[176px] rounded-2xl border border-gray-200 object-cover shadow-sm dark:border-zinc-700"
              alt={movie?.title}
            />
          ) : (
            <div className="flex h-[264px] w-[176px] items-center justify-center rounded-2xl border border-dashed text-xs text-gray-500 dark:border-zinc-700 dark:text-zinc-400">
              No poster
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="min-w-0">
          {movie?.overview && (
            <p className="mb-3 whitespace-pre-wrap text-[15px] leading-relaxed text-gray-800 dark:text-zinc-300">
              {movie.overview}
            </p>
          )}

          {/* Recap voti – stile history */}
          <div className="mb-3">
            <div className="flex items-center gap-6">
              {avg !== null && <AvgRing value={avg} />}
              <div className="flex-1">
                <VotesBarWithAvatars
                  entries={entries}       // <-- Object.entries(ratings)
                  avg={avg}
                  currentUser={currentUser}
                />
              </div>
            </div>
          </div>

          {/* VOTE / EDIT */}
          {!hasVoted ? (
            <div className="mt-2">
              {!openVote ? (
                <button
                  className="rounded-xl bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600"
                  onClick={() => setOpenVote(true)}
                >
                  Vote
                </button>
              ) : (
                <div className="mt-2 rounded-2xl border border-zinc-800/80 bg-zinc-900/50 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="text-sm text-zinc-300">Choose your score</div>
                    <div className="rounded-full border border-zinc-700 px-2 py-0.5 text-xs text-zinc-300">
                      {formatScore(temp)}
                    </div>
                  </div>

                  <ScoreSlider value={temp} onChange={setTemp} />

                  <div className="mt-3 flex items-center gap-2">
                    <button
                      className="rounded-xl bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600"
                      onClick={submit}
                    >
                      Submit vote
                    </button>
                    <button
                      className="rounded-xl border border-zinc-700 px-3 py-2 text-zinc-200"
                      onClick={() => {
                        setOpenVote(false);
                        setTemp(you ?? 7);
                      }}
                    >
                      Cancel
                    </button>
                    <span className="ml-auto text-sm font-semibold text-zinc-200">{formatScore(temp)}</span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              {!editMode ? (
                <div className="mt-2 flex items-center justify-between gap-3 rounded-2xl border border-zinc-800/80 bg-zinc-900/50 p-3">
                  <div className="flex items-center gap-2 text-sm text-zinc-300">
                    <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                    <span>
                      <b>Vote saved.</b> Please wait for others…
                    </span>
                  </div>
                  <button
                    className="rounded-xl border border-zinc-700 px-3 py-2 text-zinc-200"
                    onClick={() => {
                      setTemp(you ?? 7);
                      setEditMode(true);
                    }}
                  >
                    Edit vote
                  </button>
                </div>
              ) : (
                <div className="mt-2 rounded-2xl border border-zinc-800/80 bg-zinc-900/50 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="text-sm text-zinc-300">
                      Edit your vote{" "}
                      <span className="text-zinc-500">(current: {formatScore(you)})</span>
                    </div>
                    <div className="rounded-full border border-zinc-700 px-2 py-0.5 text-xs text-zinc-300">
                      {formatScore(temp)}
                    </div>
                  </div>

                  <ScoreSlider value={temp} onChange={setTemp} />

                  <div className="mt-3 flex items-center gap-2">
                    <button
                      className="rounded-xl bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600"
                      onClick={submit}
                    >
                      Save
                    </button>
                    <button
                      className="rounded-xl border border-zinc-700 px-3 py-2 text-zinc-200"
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

          {/* Live votes list */}
          <div className="mt-5">
            <div className="mb-2 text-sm font-semibold">Live votes</div>
            {sorted.length === 0 ? (
              <div className="rounded-2xl border bg-white p-3 text-sm text-gray-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                No votes yet — be the first!
              </div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {sorted.map(([name, score]) => (
                  <VoterChip key={name} name={name} score={Number(score)} />
                ))}
              </div>
            )}
          </div>

          {/* End voting */}
          <div className="mt-5">
            <button className="rounded-xl border px-4 py-2 dark:border-zinc-700" onClick={onEnd}>
              End voting
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}



// ─────────────────────────────────────────────────────────────────────────────
// Pretty HistoryCardExtended
// ─────────────────────────────────────────────────────────────────────────────


function ChipAvatar({ name, score }: { name: string; score: number }) {
  const avatar = loadAvatarFor(name);
  const ring =
    score >= 8 ? "ring-emerald-500/60" :
    score >= 6 ? "ring-amber-400/60"  :
                 "ring-rose-500/60";

  if (avatar) {
    return (
      <img
        src={avatar}
        alt={name}
        className={`h-5 w-5 rounded-full object-cover ring-2 ${ring}`}
      />
    );
  }
  const initial = name?.[0]?.toUpperCase() || "?";
  return (
    <div className={`grid h-5 w-5 place-items-center rounded-full bg-zinc-800 text-[10px] font-bold text-zinc-100 ring-2 ${ring}`}>
      {initial}
    </div>
  );
}

// ---- Il chip: avatar + nome + • + stella + punteggio
function VoterChip({ name, score }: { name: string; score: number }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white/70 px-2.5 py-1 text-xs text-gray-900 shadow-sm
                 backdrop-blur dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-200"
      title={`${name}: ${score}`}
    >
      <ChipAvatar name={name} score={Number(score)} />
      <span className="max-w-[9rem] truncate font-medium">{name}</span>
      <span className="mx-0.5 h-1 w-1 rounded-full bg-gray-400/70 dark:bg-zinc-500/70" />
      <span className="inline-flex items-center gap-0.5 font-semibold">
        {formatScore(Number(score))}
      </span>
    </span>
  );
}


// ===== Helpers per enfasi voti (solo per questi componenti) =====
const clamp10 = (n: number) => Math.max(1, Math.min(10, Number(n) || 0));
const scoreHue = (n: number) => ((clamp10(n) - 3) / 8) * 120;
const scoreBg = (n: number) => `hsl(${scoreHue(n)} 75% 50%)`;
const scoreGrad = (n: number) =>
  `linear-gradient(90deg, hsl(${scoreHue(n)} 70% 45%) 0%, hsl(${scoreHue(n)} 70% 55%) 100%)`;
const scorePct = (n: number) => `${((clamp10(n) - 1) / 9) * 100}%`;

export function ScoreDonut({ value, size = 64 }: { value: number; size?: number }) {
  // style identico al tuo AvgRing (r=26, stroke=8 su viewBox 64)
  const r = 26;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, ((value - 1) / 9) * 100));

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg viewBox="0 0 64 64" className="h-full w-full -rotate-90">
        <circle cx="32" cy="32" r={r} strokeWidth="8" className="fill-none stroke-zinc-800/60" />
        <circle
          cx="32"
          cy="32"
          r={r}
          strokeWidth="8"
          className="fill-none stroke-lime-400"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (pct / 100) * c}
        />
      </svg>
      {/* numero centrale — bianco in dark mode */}
      <div className="absolute inset-0 grid place-items-center text-sm font-bold text-zinc-900 dark:text-white">
        {formatScore(value)}
      </div>
    </div>
  );
}

function ScoreRail({
  scores,
  avg,
  markers,
}: {
  scores: number[];
  avg: number | null;
  markers: Array<{ label: string; value: number }>;
}) {
  return (
    <div className="relative mt-1 h-3 w-full rounded-full bg-gray-200 dark:bg-zinc-800">
      {avg !== null && (
        <div
          className="absolute left-0 top-0 h-3 rounded-full"
          style={{ width: scorePct(avg), background: scoreGrad(avg) }}
        />
      )}
      {markers.map((m) => (
        <div
          key={m.label}
          className="absolute top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-full"
          style={{ left: scorePct(m.value), background: scoreBg(m.value) }}
          title={`${m.label}: ${formatScore(m.value)}`}
        />
      ))}
      {avg !== null && (
        <div
          className="absolute top-1/2 -mt-[9px] h-5 w-[2px] -translate-y-1/2 rounded-full bg-black dark:bg-white"
          style={{ left: scorePct(avg) }}
          title={`Average: ${formatScore(avg)}`}
        />
      )}
    </div>
  );
}

function VoteChip({ name, score }: { name: string; score: number }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs shadow-sm
                 border-gray-200 bg-white dark:border-zinc-700 dark:bg-zinc-900"
      title={`${name}: ${formatScore(score)}`}
    >
      <span className="inline-block h-2 w-2 rounded-full" style={{ background: scoreBg(score) }} />
      <span className="truncate max-w-[8rem]">{name}</span>
      <b className="tabular-nums">{formatScore(score)}</b>
    </span>
  );
}

function MetaPill({ children, title }: { children: React.ReactNode; title?: string }) {
  return (
    <span
      title={title}
      className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs
                 border-gray-200 text-gray-700 dark:border-zinc-700 dark:text-zinc-300"
    >
      {children}
    </span>
  );
}

/* ===========================
 *  HISTORY CARD – EXTENDED
 * =========================== */
function HistoryCardExtended({
  v,
  onEdit,
  onMetaResolved,
}: {
  v: any;
  onEdit?: (id: any) => void;
  onMetaResolved?: (viewingId: any, nextMovie: any) => void;
}) {
  const ratings = (v.ratings || {}) as Record<string, number>;
  const entries = Object.entries(ratings) as [string, number][];
  const scores = entries.map(([, n]) => Number(n));
  const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;

  const releaseYear =
    v?.movie?.release_year ||
    (v?.movie?.release_date ? String(v.movie.release_date).slice(0, 4) : null);

  const genreLine = Array.isArray(v?.movie?.genres)
    ? v.movie.genres.map((g: any) => g?.name).filter(Boolean).join(", ")
    : "";

  // ----- lazy meta (poster/overview) + cache -----
  const [meta, setMeta] = React.useState<{ poster_path?: string; overview?: string }>({
    poster_path: v?.movie?.poster_path,
    overview: v?.movie?.overview,
  });
  React.useEffect(() => {
    setMeta({
      poster_path: v?.movie?.poster_path,
      overview: v?.movie?.overview,
    });
  }, [v?.id, v?.movie?.id, v?.movie?.poster_path, v?.movie?.overview]);

  const persistOnceRef = React.useRef(false);
  const tryPersist = (cand: { poster_path?: string; overview?: string }) => {
    if (persistOnceRef.current) return;
    const needPoster = !v?.movie?.poster_path && cand.poster_path;
    const needOverview = !v?.movie?.overview && (cand.overview && cand.overview.trim());
    if (needPoster || needOverview) {
      persistOnceRef.current = true;
      const nextMovie = { ...v.movie, ...cand };
      onMetaResolved?.(v.id, nextMovie);
    }
  };

  const inFlightTitleRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    const title = (v?.movie?.title || "").trim();
    if (!title) return;

    const needPoster = !meta?.poster_path;
    const needOverview = !meta?.overview || meta.overview.trim().length === 0;
    if (!needPoster && !needOverview) return;
    if (inFlightTitleRef.current === title) return;
    inFlightTitleRef.current = title;

    // 1) cache
    const cache = getMetaCache();
    const cached = cache[title];
    if (cached && (cached.poster_path || cached.overview)) {
      setMeta((m) => {
        const merged = {
          poster_path: m.poster_path || cached.poster_path,
          overview: m.overview || cached.overview,
        };
        tryPersist(merged);
        return merged;
      });
      inFlightTitleRef.current = null;
      return;
    }

    // 2) fetch
    (async () => {
      try {
        const fetched = await fetchMetaForTitle(title);
        if (fetched) {
          setMeta((m) => {
            const merged = {
              poster_path: m.poster_path || fetched.poster_path,
              overview: m.overview || fetched.overview,
            };
            tryPersist(merged);
            return merged;
          });
          const c = getMetaCache();
          c[title] = { poster_path: fetched.poster_path, overview: fetched.overview };
          setMetaCache(c);
        }
      } finally {
        inFlightTitleRef.current = null;
      }
    })();
  }, [v?.movie?.title, meta?.poster_path, meta?.overview]);
  // -----------------------------------------------

  const poster = meta?.poster_path ? posterUrl(meta.poster_path, "w342") : "";
  const overview = (meta?.overview || "").trim();

  // --- UI helpers (ring & bar) ---
  const AvgRing = ({ value }: { value: number }) => {
    const r = 26, c = 2 * Math.PI * r, pct = Math.max(0, Math.min(100, ((value - 1) / 9) * 100));
    return (
      <div className="relative h-16 w-16">
        <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90">
          <circle cx="32" cy="32" r={r} strokeWidth="8" className="fill-none stroke-zinc-800/60" />
          <circle cx="32" cy="32" r={r} strokeWidth="8" className="fill-none stroke-lime-400"
                  strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - (pct / 100) * c}/>
        </svg>
        <div className="absolute inset-0 grid place-items-center text-sm font-bold">
          {formatScore(value)}
        </div>
      </div>
    );
  };
  const VotesBar = ({ scores, avg }: { scores: number[]; avg: number | null }) => {
    const toPct = (n: number) => ((n - 1) / 9) * 100;
    return (
      <div className="w-full">
        <div className="mb-1 flex items-center justify-between text-xs text-zinc-400">
          <span>Avg {scores.length ? `(${scores.length} votes)` : ""}</span>
          <span>10</span>
        </div>
        <div className="relative h-4 w-full overflow-hidden rounded-full bg-zinc-800">
          {avg !== null && (
            <div className="absolute left-0 top-0 h-full bg-gradient-to-r from-lime-500 to-lime-400"
                 style={{ width: `${toPct(avg)}%` }} />
          )}
          {scores.map((s, i) => (
            <div key={i}
                 className="pointer-events-none absolute top-1/2 h-6 w-[2px] -translate-y-1/2 rounded-full bg-white shadow-[0_0_0_2px_rgba(0,0,0,0.6)]"
                 style={{ left: `calc(${toPct(s)}% - 1px)` }}
                 title={formatScore(s)} />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm ring-1 ring-black/5 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900/60">
      {/* Header */}
      <div className="mb-3 flex items-center gap-3">
        {v.picked_by && (
          <>
            <PickedByBadge name={v.picked_by} />
            <div className="mx-1 text-gray-300">•</div>
          </>
        )}

        <h3 className="min-w-0 text-lg font-semibold leading-tight">
          <span className="break-words">{v.movie?.title || "Untitled"}</span>
          {releaseYear && <span className="ml-2 text-gray-500">({releaseYear})</span>}
        </h3>

        {onEdit && (
          <button
            className="ml-2 rounded-full border px-2.5 py-1 text-xs dark:border-zinc-700"
            onClick={() => onEdit(v.id)}
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

      {/* Layout: poster grande + info a destra */}
      <div className="grid gap-5 md:grid-cols-[176px,1fr]">
        <div className="flex items-start justify-center">
          {poster ? (
            <img
              src={poster}
              alt={v.movie?.title}
              className="h-[264px] w-[176px] rounded-2xl border border-gray-200 object-cover shadow-sm dark:border-zinc-700"
            />
          ) : (
            <div className="flex h-[264px] w-[176px] items-center justify-center rounded-2xl border border-dashed text-xs text-gray-500 dark:border-zinc-700 dark:text-zinc-400">
              No poster
            </div>
          )}
        </div>

        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-gray-600 dark:text-zinc-400">
            {releaseYear && <span className="rounded-full border px-2 py-0.5 dark:border-zinc-700">📅 {releaseYear}</span>}
            {Number(v?.movie?.runtime) > 0 && <span className="rounded-full border px-2 py-0.5 dark:border-zinc-700">⏱ {v.movie.runtime} min</span>}
            {genreLine && <span className="rounded-full border px-2 py-0.5 dark:border-zinc-700">{genreLine}</span>}
            {typeof v?.movie?.imdb_rating === "number" ? (
              <span className="rounded-full border px-2 py-0.5 dark:border-zinc-700">★ IMDb {formatScore(v.movie.imdb_rating)}</span>
            ) : typeof v?.movie?.tmdb_vote_average === "number" ? (
              <span className="rounded-full border px-2 py-0.5 dark:border-zinc-700">★ TMDB {formatScore(v.movie.tmdb_vote_average)}</span>
            ) : null}
            {typeof v?.movie?.tmdb_vote_count === "number" && v.movie.tmdb_vote_count > 0 && (
              <span className="rounded-full border px-2 py-0.5 dark:border-zinc-700">
                {v.movie.tmdb_vote_count.toLocaleString()} votes
              </span>
            )}
          </div>

          <p className="mb-4 whitespace-pre-wrap text-[15px] leading-relaxed text-gray-800 dark:text-zinc-300">
            {overview || "No description available."}
          </p>

          <div className="flex items-center gap-4">
            {avg !== null && <ScoreDonut value={avg} />}
            <div className="flex-1">
              <VotesBarWithAvatars entries={entries} avg={avg} />
            </div>
          </div>
          {entries.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {Object.entries(ratings)
                .sort((a, b) => Number(b[1]) - Number(a[1]) || a[0].localeCompare(b[0]))
                .map(([name, score]) => (
                  <VoterChip key={name} name={name} score={Number(score)} />
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Singola cella poster con lazy meta (cache → details → search) */
function PosterCell({
  v,
  onClick,
  onResolved,
}: {
  v: any;
  onClick: () => void;
  onResolved: (nextMovie: any) => void;
}) {
  const [posterPath, setPosterPath] = React.useState<string | undefined>(v?.movie?.poster_path);

  // evita doppie chiamate per lo stesso titolo
  const inflightRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    let abort = false;

    async function run() {
      // se già presente, niente da fare
      if (posterPath) return;

      const title = (v?.movie?.title || "").trim();
      if (!title) return;

      if (inflightRef.current === title) return;
      inflightRef.current = title;

      // 1) cache
      const cache = getMetaCache();
      const cached = cache[title];
      if (!abort && cached?.poster_path) {
        setPosterPath(cached.poster_path);
        onResolved?.({ ...v.movie, poster_path: cached.poster_path });
        inflightRef.current = null;
        return;
      }

      // 2) TMDB details diretti se ho id
      let det: any = null;
      if (v?.movie?.id) {
        det = await tmdbDetails(v.movie.id);
      }

      // 3) Search+details per titolo se ancora niente
      if (!det) {
        const s = await tmdbSearch(title);
        const first = s?.[0];
        if (first?.id) det = await tmdbDetails(first.id);
      }

      if (!abort && det?.poster_path) {
        const merged = mergeMovie(v.movie, det);
        setPosterPath(merged.poster_path);

        // salva in cache leggera per riuso
        const c = getMetaCache();
        c[title] = { ...(c[title] || {}), poster_path: merged.poster_path };
        setMetaCache(c);

        // persisti in history
        onResolved?.(merged);
      }

      inflightRef.current = null;
    }

    run();
    return () => {
      abort = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v?.id, v?.movie?.id, v?.movie?.title, posterPath]);

  const poster = posterPath ? posterUrl(posterPath, "w342") : "";
  const year =
    v?.movie?.release_year ||
    (v?.movie?.release_date ? String(v.movie.release_date).slice(0, 4) : null);

  return (
    <button
      className="group relative aspect-[2/3] overflow-hidden rounded-xl border bg-white text-left shadow-sm transition
                 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
      onClick={onClick}
      title={v?.movie?.title || "Open details"}
    >
      {poster ? (
        <img
          src={poster}
          alt={v?.movie?.title}
          className="h-full w-full object-cover transition group-hover:scale-[1.02]"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center p-3 text-center text-xs text-gray-500 dark:text-zinc-400">
          {v?.movie?.title || "Untitled"}
          {year ? <span className="ml-1 opacity-70">({year})</span> : null}
        </div>
      )}

      {/* gradient + titolo in basso */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2">
        <div className="line-clamp-2 text-[11px] font-medium text-white/95">
          {v?.movie?.title}
          {year ? <span className="opacity-80"> ({year})</span> : null}
        </div>
      </div>
    </button>
  );
}


/** Modal dettagli: poster + overview + meta + recap voti */

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

  // ---- META ----
  const meta = useLazyMetaForViewing(v, onResolve);

  // ---- DATI FILM ----
  const title = v?.movie?.title || "Untitled";
  const year =
    v?.movie?.release_year ||
    (v?.movie?.release_date ? String(v.movie.release_date).slice(0, 4) : null);

  const genreLine = Array.isArray(v?.movie?.genres)
    ? v.movie.genres.map((g: any) => g?.name).filter(Boolean).join(", ")
    : "";

  const runtime =
    typeof v?.movie?.runtime === "number" && v.movie.runtime > 0
      ? v.movie.runtime
      : null;

  const imdbRating =
    typeof v?.movie?.imdb_rating === "number" ? v.movie.imdb_rating : null;

  const tmdbAvg =
    typeof v?.movie?.tmdb_vote_average === "number"
      ? v.movie.tmdb_vote_average
      : null;

  const tmdbCount =
    typeof v?.movie?.tmdb_vote_count === "number"
      ? v.movie.tmdb_vote_count
      : null;

  const poster = meta?.poster_path ? posterUrl(meta.poster_path, "w342") : "";
  const overview = (meta?.overview || "").trim();

  // ---- VOTI ----
  const ratings = (v?.ratings || {}) as Record<string, number>;
  const entries = Object.entries(ratings) as [string, number][];
  const scores = entries.map(([, n]) => Number(n));
  const avg =
    scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;

// ---- Solo ESC per chiudere ----
React.useEffect(() => {
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  };
  window.addEventListener("keydown", onKey);
  return () => window.removeEventListener("keydown", onKey);
}, [onClose]);

  // ---- RENDER ----
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-5xl overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900 shadow-xl">
        {/* Header */}
        <div className="flex items-center gap-2 border-b border-zinc-800 px-4 py-3">
          {v?.picked_by && <PickedByBadge name={v.picked_by} />}
          <div className="mx-2 text-zinc-600">•</div>
          <h3 className="min-w-0 flex-1 truncate text-lg font-semibold text-zinc-100">
            {title} {year ? <span className="text-zinc-400">({year})</span> : null}
          </h3>
          {onEdit && (
            <button
              className="rounded-md border border-zinc-700 px-3 py-1 text-sm text-zinc-200 hover:bg-zinc-800"
              onClick={() => onEdit(v.id)}
            >
              Edit
            </button>
          )}
          <button
            className="rounded-md border border-zinc-700 px-3 py-1 text-sm text-zinc-200 hover:bg-zinc-800"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        {/* Body */}
        <div className="grid gap-5 px-4 py-4 md:grid-cols-[220px,1fr]">
          {/* Poster */}
          <div className="flex items-start justify-center">
            {poster ? (
              <img
                src={poster}
                alt={title}
                className="h-[330px] w-[220px] rounded-2xl border border-zinc-700 object-cover"
              />
            ) : (
              <div className="flex h-[330px] w-[220px] items-center justify-center rounded-2xl border border-dashed border-zinc-700 text-sm text-zinc-400">
                No poster
              </div>
            )}
          </div>

          {/* Testo + meta + voti */}
          <div className="min-w-0">
            {/* META CHIPS (uguali alla extended) */}
            <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
              {year && (
                <span className="rounded-full border border-zinc-700 px-2 py-0.5">📅 {year}</span>
              )}
              {runtime && (
                <span className="rounded-full border border-zinc-700 px-2 py-0.5">
                  ⏱ {runtime} min
                </span>
              )}
              {genreLine && (
                <span className="rounded-full border border-zinc-700 px-2 py-0.5">
                  {genreLine}
                </span>
              )}
              {imdbRating != null ? (
                <span className="rounded-full border border-zinc-700 px-2 py-0.5">
                  ★ IMDb {formatScore(imdbRating)}
                </span>
              ) : tmdbAvg != null ? (
                <span className="rounded-full border border-zinc-700 px-2 py-0.5">
                  ★ TMDB {formatScore(tmdbAvg)}
                </span>
              ) : null}
              {tmdbCount ? (
                <span className="rounded-full border border-zinc-700 px-2 py-0.5">
                  {tmdbCount.toLocaleString()} votes
                </span>
              ) : null}
            </div>

            {/* Overview */}
            {overview && (
              <p className="mb-4 whitespace-pre-wrap text-[15px] leading-relaxed text-zinc-200">
                {overview}
              </p>
            )}

            {/* Donut + Avg + Barra con avatar */}
            <div className="mb-3 flex items-center gap-4">
              {avg !== null && (
                <div className="flex items-center gap-3">
                  {/* ScoreDonut con testo bianco in dark mode */}
                  <ScoreDonut value={avg} />
                  <div className="text-xs text-zinc-400">
                    Avg {entries.length ? `(${entries.length} votes)` : ""}
                  </div>
                </div>
              )}
              <div className="flex-1">
                <VotesBarWithAvatars
                  entries={entries}
                  avg={avg}
                  currentUser={currentUser}
                  showScale
                />
              </div>
            </div>

            {/* Chips votanti */}
            {entries.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {entries
                  .sort(
                    (a, b) => Number(b[1]) - Number(a[1]) || a[0].localeCompare(b[0])
                  )
                  .map(([name, score]) => (
                    <VoterChip key={name} name={name} score={Number(score)} />
                  ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* overlay click per chiudere */}
      <button
        className="fixed inset-0 -z-10 cursor-auto"
        onClick={onClose}
        aria-label="Close overlay"
      />
    </div>,
    document.body
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
                  accept="image/*"
                  className="hidden"
                  onChange={onFile}
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
  const poster = meta?.poster_path ? posterUrl(meta.poster_path, "w342") : "";

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



// ============================
// App
// ============================

export default function CinemaNightApp() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme());
  useEffect(() => applyTheme(theme), [theme]);
  const [isBackfillingRuntime, setIsBackfillingRuntime] = useState(false);
  const [isBackfillingRatings, setIsBackfillingRatings] = useState(false);

  const [user, setUser] = useState<string>("");
  const [tab, setTab] = useState<"vote" | "history" | "profile" | "stats">("vote");
  const [editingViewing, setEditingViewing] = useState<{ id: any; title: string } | null>(null);
  const [openViewing, setOpenViewing] = useState<any | null>(null);

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

  const backfillRatingsMeta = async () => {
  if (isBackfillingRatings) return;
  setIsBackfillingRatings(true);
  try {
    const list = history.slice();
    let changed = false;

    for (let i = 0; i < list.length; i++) {
      const v = list[i];
      let m = { ...(v?.movie || {}) };

      // --- TMDB details (by id; else search by title) ---
      let det: any = null;
      if (m?.id) {
        det = await tmdbDetails(m.id);
      } else if (m?.title) {
        const s = await tmdbSearch(m.title);
        const first = s?.[0];
        if (first?.id) det = await tmdbDetails(first.id);
      }
      if (det) {
        // unisci campi TMDB (vote_average/vote_count, genres, runtime, poster, overview, imdb_id, release_year…)
        m = mergeMovie(m, det);
      }

      // fallback release_year da release_date se ancora mancante
      if (!m?.release_year && m?.release_date) {
        m.release_year = String(m.release_date).slice(0, 4);
      }

      // --- OMDb (IMDb rating/votes) se abbiamo imdb_id e mancano valori ---
      const needImdb =
        m?.imdb_id && (m.imdb_rating == null || m.imdb_votes == null);
      if (needImdb) {
        const om = await omdbRatingFromImdbId(m.imdb_id);
        if (om) m = { ...m, ...om };
      }

      // cambia se davvero è diverso
      if (JSON.stringify(m) !== JSON.stringify(v.movie)) {
        list[i] = { ...v, movie: m };
        changed = true;
      }

      await sleep(220); // gentile con le API
    }

    if (changed) {
      setHistory(list);        // UI
      await persistHistory(list); // Storage + cn_state
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
    setUser(lsGetJSON<string>(K_USER, ""));

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
  if (!history.length || isBackfillingRatings) return;
  const missing = history.some(h => {
    const m = h?.movie || {};
    return (m.imdb_rating == null && m.tmdb_vote_average == null);
  });
  if (missing) backfillRatingsMeta();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [history.length, isBackfillingRatings]);

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
    lsSetJSON(K_USER, name.trim());
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
                  onMetaResolved={async (nextMovie) => {
                    // UI
                    const nextActive = { ...activeVote, movie: nextMovie };
                    setActiveVote(nextActive);
                    // server (Supabase) o locale
                    if (sb) await saveSharedState({ active: nextActive });
                    else lsSetJSON(K_ACTIVE_VOTE, nextActive);
                  }}
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

    return historyMode === "compact" ? (
  <>
    <HistoryPosterGrid
  items={L}
  onOpen={setOpenViewing} // passa l'oggetto viewing, non l'id
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
/>

  </>
) : (
  L.map((v) => (
    <HistoryCardExtended
      key={v.id}
      v={v}
      onEdit={() => setEditingViewing({ id: v.id, title: v?.movie?.title || "" })}
      onMetaResolved={(id, nextMovie) => updateViewingMovie(id, nextMovie)}
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
