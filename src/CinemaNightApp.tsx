import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { createPortal } from "react-dom";
import { tmdbDetails, tmdbSearch, omdbRatingFromImdbId, mergeMovie, fetchMetaForTitle, ensureRuntime, ensureGenres, getPosterUrl } from "./TMDBHelper";
// Supabase client + bucket keys
import { sb, SB_ROW_ID, STORAGE_BUCKET, STORAGE_LIVE_HISTORY_KEY } from "./supabaseClient";

// Stato condiviso (tabella cn_state)
import {
  loadSharedState,
  saveSharedState,
  subscribeSharedState,
  setRatingAtomic,
  SharedState,
} from "./state";

// Gestione history.json (seed + live)
import {
  persistHistory,
  loadHistoryFromStoragePreferLive,
  ensureLiveFileExists,
  saveLiveHistoryToStorage,
  downloadJSONFromStorage,
} from "./storage";

// LocalStorage helpers + costanti chiave
import {
  K_USER,
  K_VIEWINGS,
  K_ACTIVE_VOTE,
  K_ACTIVE_RATINGS,
  K_PROFILE_PREFIX,
  K_TMDB_CACHE,
  K_THEME,
  lsGetJSON,
  lsSetJSON,
  getMetaCache,
  setMetaCache,
  loadAvatarFor,
} from "./localStorage";

import { ScoreDonut } from "./Components/UI/ScoreDonut";
import { VotesBar } from "./Components/UI/VotesBar";
import { PickedByBadge } from "./Components/UI/PickedByBadge";
import { Card } from "./Components/UI/Card";
import { VoterChip } from "./Components/UI/VoterChip";
import { Stats } from "./Pages/Stats";
import { formatScore } from "./Utils/Utils";
import { HistoryCardExtended } from "./Components/UI/HistoryCardExtended"; 
import { Profile } from "./Pages/Profile";

function formatCompact(n: number) {
  if (n < 1000) return String(n);
  const units = ["k","M","B","T"];
  let i = -1;
  let v = n;
  do { v /= 1000; i++; } while (v >= 1000 && i < units.length - 1);
  return `${Math.round(v * 10) / 10}${units[i]}`;
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

function roundToQuarter(n: number) {
  return Math.round(n / 0.25) * 0.25;
}

// Theme (Dark/Light)
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

// Search + pickers
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
            {r.poster_path && <img src={getPosterUrl(r.poster_path, "w185")} alt={r.title} className="h-24 w-16 rounded-lg object-cover" />}
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
                  src={getPosterUrl(r.poster_path, "w185")}
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
        {movie.poster_path && <img src={getPosterUrl(movie.poster_path, "w342")} className="h-48 w-32 rounded-xl object-cover" alt={movie.title} />}
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

// Voting (with Edit vote)
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

  const poster = movie?.poster_path ? getPosterUrl(movie.poster_path, "w342") : "";

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
                <VotesBar
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
                  <VoterChip
                    key={name}
                    name={name}
                    score={Number(score)}
                    currentUser={currentUser}
                  />
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


// ===== Helpers per enfasi voti (solo per questi componenti) =====
const clamp10 = (n: number) => Math.max(1, Math.min(10, Number(n) || 0));
const scoreHue = (n: number) => ((clamp10(n) - 3) / 8) * 120;
const scoreBg = (n: number) => `hsl(${scoreHue(n)} 75% 50%)`;
const scoreGrad = (n: number) =>
  `linear-gradient(90deg, hsl(${scoreHue(n)} 70% 45%) 0%, hsl(${scoreHue(n)} 70% 55%) 100%)`;
const scorePct = (n: number) => `${((clamp10(n) - 1) / 9) * 100}%`;

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

  const poster = posterPath ? getPosterUrl(posterPath, "w342") : "";
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

  const poster = meta?.poster_path ? getPosterUrl(meta.poster_path, "w342") : "";
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
                <VotesBar
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
                    <VoterChip
                      key={name}
                      name={name}
                      score={Number(score)}
                      currentUser={currentUser || ""}
                    />
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

// ==== Import/Export history (cn_viewings) ====
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

// App
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
