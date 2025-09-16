// filepath: src/.../EditMovieDialog.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { tmdbSearch, getPosterUrl } from "../../TMDBHelper";

type TMDBMovie = {
  id: number;
  title: string;
  overview?: string;
  poster_path?: string | null;
  release_date?: string | null;
};

export function EditMovieDialog({
  open,
  initialTitle = "",
  onClose,
  onSelect,
  onDelete,
}: {
  open: boolean;
  initialTitle?: string;
  onClose: () => void;
  onSelect: (movie: TMDBMovie) => void;
  onDelete: () => void;
}) {
  // -------------------- state --------------------
  const [q, setQ] = useState(initialTitle);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<TMDBMovie[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [activeIdx, setActiveIdx] = useState<number>(-1); // keyboard highlight

  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // -------------------- effects --------------------
  // Reset when title changes / dialog re-opens
  useEffect(() => {
    if (!open) return;
    setQ(initialTitle);
    setResults([]);
    setErr(null);
    setActiveIdx(-1);
  }, [open, initialTitle]);

  // Block body scroll while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Focus input at open
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  // Close on ESC
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Debounced search
  useEffect(() => {
    if (!open) return;
    setErr(null);
    setLoading(true);

    const handle = setTimeout(async () => {
      try {
        if (!q?.trim()) {
          setResults([]);
          return;
        }
        const res = await tmdbSearch(q.trim());
        setResults((res || []).slice(0, 12));
      } catch (e: any) {
        setErr(e?.message || "Search error");
      } finally {
        setLoading(false);
      }
    }, 350);

    return () => clearTimeout(handle);
  }, [q, open]);

  // -------------------- handlers --------------------
  const onBackdropClick = (e: React.MouseEvent) => {
    // close only if clicking the backdrop (not inner panel)
    if (e.target === containerRef.current) onClose();
  };

  const confirmDelete = () => {
    const title = q?.trim() || initialTitle || "this entry";
    if (confirm(`Eliminare definitivamente "${title}"? L'azione non è reversibile.`)) {
      onDelete();
    }
  };

  const selectByIndex = (idx: number) => {
    const item = results[idx];
    if (item) onSelect(item);
  };

  const handleKeyDownList = (e: React.KeyboardEvent) => {
    if (!results.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIdx >= 0) selectByIndex(activeIdx);
    }
  };

  const subtitle = useMemo(
    () =>
      results.length
        ? `${results.length} result${results.length > 1 ? "s" : ""}`
        : q?.trim()
        ? loading
          ? "Searching…"
          : "No results"
        : "Type to search",
    [results.length, q, loading]
  );

  if (!open) return null;

  // -------------------- UI --------------------
  return createPortal(
    <div
      ref={containerRef}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-3 md:p-6"
      onMouseDown={onBackdropClick}
      aria-modal="true"
      role="dialog"
      aria-labelledby="edit-movie-title"
    >
      <div
        className="w-full max-w-3xl rounded-2xl border border-zinc-800/70 bg-zinc-950/95 p-4 shadow-2xl ring-1 ring-black/40 backdrop-blur-sm md:p-6"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 id="edit-movie-title" className="text-lg font-semibold text-zinc-100">
              Edit movie stocazzo
            </h3>
            <p className="mt-0.5 text-xs text-zinc-400">{subtitle}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={confirmDelete}
              className="inline-flex items-center gap-1 rounded-xl border border-red-900/60 bg-red-950/30 px-3 py-1.5 text-sm font-medium text-red-300 hover:bg-red-900/30"
              title="Delete this entry"
            >
              Delete
            </button>
            <button
              onClick={onClose}
              className="rounded-xl border border-zinc-700/70 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-800"
            >
              Close
            </button>
          </div>
        </div>

        {/* Search row */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="text-xs text-zinc-400">Search on TMDB</label>
            <input
              ref={inputRef}
              className="mt-1 w-full rounded-xl border border-zinc-700/70 bg-zinc-900/60 px-3 py-2 text-zinc-100 placeholder-zinc-500 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
              placeholder="e.g. Lucky Number Slevin"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                // allow Enter to select highlighted item if any
                if (e.key === "Enter" && results.length && activeIdx >= 0) {
                  e.preventDefault();
                  selectByIndex(activeIdx);
                }
              }}
            />
          </div>

          <button
            disabled={!q?.trim() || loading}
            onClick={() => setQ((s) => s)} // force run current debounced search instantly
            className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40 sm:self-auto"
            title="Run search"
          >
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                Searching…
              </span>
            ) : (
              "Search"
            )}
          </button>
        </div>

        {/* Error */}
        {err && (
          <div className="mt-3 rounded-xl border border-red-900/60 bg-red-950/30 p-3 text-sm text-red-300">
            {err}
          </div>
        )}

        {/* Results */}
        <div
          className="mt-4 grid gap-3 sm:grid-cols-2"
          onKeyDown={handleKeyDownList}
          tabIndex={0}
          aria-label="Search results"
        >
          {/* Loading skeletons */}
          {loading && !results.length && (
            <>
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={`sk-${i}`}
                  className="flex gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-3"
                >
                  <div className="h-24 w-16 animate-pulse rounded-lg bg-zinc-800" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-3/4 animate-pulse rounded bg-zinc-800" />
                    <div className="h-3 w-full animate-pulse rounded bg-zinc-800" />
                    <div className="h-3 w-[85%] animate-pulse rounded bg-zinc-800" />
                    <div className="h-3 w-2/3 animate-pulse rounded bg-zinc-800" />
                  </div>
                </div>
              ))}
            </>
          )}

          {/* Result items */}
          {results.map((r, i) => {
            const year = r.release_date?.slice(0, 4);
            const active = i === activeIdx;
            return (
              <button
                key={r.id}
                type="button"
                onMouseEnter={() => setActiveIdx(i)}
                onFocus={() => setActiveIdx(i)}
                onClick={() => onSelect(r)}
                className={[
                  "group flex w-full cursor-pointer gap-3 rounded-xl border p-2 text-left",
                  "border-zinc-800 bg-zinc-900/40 hover:border-sky-700/60 hover:bg-zinc-900",
                  active ? "ring-2 ring-sky-500/40" : "ring-0",
                ].join(" ")}
                title="Use this movie"
              >
                {r.poster_path ? (
                  <img
                    src={getPosterUrl(r.poster_path, "w185")}
                    alt={r.title}
                    className="h-24 w-16 shrink-0 rounded-lg object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="h-24 w-16 shrink-0 rounded-lg bg-zinc-800" />
                )}
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-baseline gap-2">
                    <div className="truncate font-semibold text-zinc-100">{r.title}</div>
                    {year && <span className="text-xs text-zinc-400">({year})</span>}
                  </div>
                  {r.overview ? (
                    <p className="mt-1 line-clamp-3 text-sm text-zinc-300">{r.overview}</p>
                  ) : (
                    <p className="mt-1 text-sm italic text-zinc-500">No overview available</p>
                  )}
                  <div className="mt-auto pt-2 text-xs text-zinc-400 opacity-0 transition-opacity group-hover:opacity-100">
                    Press Enter to select
                  </div>
                </div>
              </button>
            );
          })}

          {/* Empty state */}
          {!loading && !results.length && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 text-sm text-zinc-300">
              Nessun risultato. Prova a:
              <ul className="mt-2 list-disc pl-5 text-zinc-400">
                <li>Aggiungere l’anno (es. “Mirror 1975”)</li>
                <li>Usare il titolo inglese o originale</li>
                <li>Controllare gli accenti o la punteggiatura</li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
