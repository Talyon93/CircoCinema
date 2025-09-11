import React, { useEffect, useMemo, useState } from "react";
import { Card } from "../Components/UI/Card";
import { PickedByBadge } from "../Components/UI/PickedByBadge";
import { loadSharedState } from "../state";
import { fetchMetaForTitle, getPosterUrl } from "../TMDBHelper";
import { sb, STORAGE_LIVE_HISTORY_KEY } from "../supabaseClient";
// stesse helper usate dall’app
import { ensureLiveFileExists, loadHistoryLive } from "../storage";

type Showcase = {
  title?: string;
  release_year?: string | number | null;
  overview?: string;
  poster_path?: string;
  picked_by?: string | null;
};

export function Login({ onLogin }: { onLogin: (name: string) => void }) {
  const [name, setName] = useState("");
  const [show, setShow] = useState<Showcase | null>(null);
  const [isActive, setIsActive] = useState(false);

  // ripristina eventuale nome
  useEffect(() => {
    try {
      const last = localStorage.getItem("cn_user");
      if (last) setName(last);
    } catch {}
  }, []);

  // carica “now showing” oppure “last screening” con le stesse fonti dell’app
  useEffect(() => {
    let mounted = true;

    (async () => {
      const shared = await loadSharedState(); // active + ratings sempre da cn_state :contentReference[oaicite:3]{index=3}

      // 1) priorità: votazione attiva
      if (shared?.active?.movie) {
        setIsActive(true);
        const a = shared.active;
        let base: Showcase = {
          title: a.movie.title,
          release_year:
            a.movie.release_year ||
            (a.movie.release_date ? String(a.movie.release_date).slice(0, 4) : null),
          overview: a.movie.overview || "",
          poster_path: a.movie.poster_path || "",
          picked_by: a.picked_by || null,
        };
        if ((!base.poster_path || !base.overview) && base.title) {
          const meta = await fetchMetaForTitle(base.title);
          if (mounted && meta) base = { ...base, poster_path: base.poster_path || meta.poster_path, overview: base.overview || meta.overview };
        }
        if (mounted) setShow(base);
        return;
      }

      // 2) altrimenti: ultima proiezione
      setIsActive(false);

      // stessa fonte dell’app: Storage LIVE (history_live.json), fallback a shared.history se vuoto :contentReference[oaicite:4]{index=4}
      let list: any[] = [];
      try {
        if (sb) {
            await ensureLiveFileExists();
            const live = await loadHistoryLive();
          if (Array.isArray(live)) list = live;
        }
      } catch {}

      if ((!list || list.length === 0) && Array.isArray(shared?.history)) {
        list = shared.history; // fallback
      }

      if (!list || list.length === 0) {
        if (mounted) setShow(null);
        return;
      }

      // prendi l’ultima (started_at più recente)
      const latest = list
        .slice()
        .sort((a, b) => {
          const ta = a?.started_at ? new Date(a.started_at).getTime() : 0;
          const tb = b?.started_at ? new Date(b.started_at).getTime() : 0;
          return tb - ta;
        })[0];

      if (!latest?.movie) {
        if (mounted) setShow(null);
        return;
      }

      let base: Showcase = {
        title: latest.movie.title,
        release_year:
          latest.movie.release_year ||
          (latest.movie.release_date ? String(latest.movie.release_date).slice(0, 4) : null),
        overview: latest.movie.overview || "",
        poster_path: latest.movie.poster_path || "",
        picked_by: latest.picked_by || null,
      };

      if ((!base.poster_path || !base.overview) && base.title) {
        const meta = await fetchMetaForTitle(base.title);
        if (mounted && meta) base = { ...base, poster_path: base.poster_path || meta.poster_path, overview: base.overview || meta.overview };
      }

      if (mounted) setShow(base);
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const canProceed = useMemo(() => name.trim().length > 0, [name]);
  const handleSubmit = () => {
    if (!canProceed) return;
    onLogin(name.trim());
  };

  return (
    <div className="relative mx-auto mt-20 max-w-2xl px-4">
      {/* Header “ticket” */}
      <Card>
        <div className="relative -mx-4 -mt-4 mb-6 overflow-hidden rounded-t-2xl bg-gradient-to-r from-zinc-900 via-black to-zinc-900 px-4 py-5 text-center shadow-inner">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-wide text-white/90 backdrop-blur">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-rose-400"></span>
            {isActive ? "Now Showing" : "Last Screening"}
          </div>
          <h1 className="mt-3 flex items-center justify-center gap-2 text-2xl font-extrabold text-white">
            🎬 Welcome to the Screening Room
          </h1>
          <p className="mt-1 text-sm text-zinc-300/90">
            Grab your seat — the movie is about to start.
          </p>
          <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
        </div>

        {/* Showcase */}
        {show && (
          <div className="mb-6 grid gap-4 md:grid-cols-[128px,1fr]">
            <div className="flex items-start justify-center">
              {show.poster_path ? (
                <img
                  src={getPosterUrl(show.poster_path, "w185")}
                  className="h-[192px] w-[128px] rounded-xl border border-gray-200 object-cover shadow-sm dark:border-zinc-700"
                  alt={show.title || "Poster"}
                />
              ) : (
                <div className="flex h-[192px] w-[128px] items-center justify-center rounded-xl border border-dashed text-xs text-gray-500 dark:border-zinc-700 dark:text-zinc-400">
                  No poster
                </div>
              )}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="text-lg font-bold">
                  {show.title} {show.release_year ? <span className="ml-1 text-zinc-400">({show.release_year})</span> : null}
                </h3>
                {show.picked_by ? <PickedByBadge name={show.picked_by} /> : null}
              </div>
              {show.overview ? (
                <p className="mt-2 whitespace-pre-wrap text-[15px] leading-relaxed text-zinc-300">{show.overview}</p>
              ) : (
                <p className="mt-2 text-sm text-zinc-400">No summary available.</p>
              )}
            </div>
          </div>
        )}

        {/* Login */}
        <div className="space-y-3">
          <label htmlFor="login-name" className="sr-only">
            Your stage name
          </label>
          <div className="group relative flex items-center gap-2 rounded-xl border border-zinc-300 bg-white px-3 py-2 shadow-sm transition focus-within:border-zinc-400 focus-within:shadow dark:border-zinc-700 dark:bg-zinc-900 dark:focus-within:border-zinc-500">
            <input
              id="login-name"
              autoFocus
              className="peer w-full bg-transparent text-zinc-900 placeholder-zinc-400 outline-none dark:text-zinc-100 dark:placeholder-zinc-500"
              placeholder="Your stage name…"
              value={name}
              onChange={(e) => setName(e.target.value.replace(/^\s+/, ""))}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSubmit();
              }}
            />
          </div>

          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            If you’ve used this name before, your profile image and picks will be restored.
          </p>

          <div className="mt-3 flex items-center justify-between gap-2">
            <button
              type="button"
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 transition hover:shadow-sm active:translate-y-px disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              onClick={() => setName("")}
              disabled={!name}
              title="Clear"
            >
              Reset
            </button>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canProceed}
              className="relative inline-flex flex-[2] items-center justify-center gap-2 rounded-xl bg-zinc-900 px-5 py-2 text-sm font-semibold text-white shadow-lg transition hover:scale-[1.01] hover:shadow-xl active:translate-y-px disabled:opacity-40 dark:bg-white dark:text-black"
            >
              <span className="relative z-10">Roll the Film</span>
              <span aria-hidden className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-white/15" />
              <span
                aria-hidden
                className="pointer-events-none absolute -inset-1 -z-10 rounded-2xl blur-lg"
                style={{
                  background:
                    "conic-gradient(from 180deg at 50% 50%, rgba(255,255,255,0.35), rgba(255,0,122,0.25), rgba(0,160,255,0.25), rgba(255,255,255,0.35))",
                  opacity: 0.5,
                }}
              />
            </button>
          </div>

          <div className="mt-4 flex items-center justify-center gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
            <span className="h-px w-6 bg-zinc-200 dark:bg-zinc-800" />
            Press <kbd className="rounded bg-zinc-200 px-1.5 py-0.5 text-[10px] dark:bg-zinc-800">Enter</kbd> to start
            <span className="h-px w-6 bg-zinc-200 dark:bg-zinc-800" />
          </div>
        </div>
      </Card>
    </div>
  );
}
