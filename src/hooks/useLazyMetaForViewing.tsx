import * as React from "react";
import { getMetaCache, setMetaCache } from "../localStorage";
import { fetchMetaForTitle, getPosterUrl } from "../TMDBHelper";
import { Viewing, Movie } from "../types/viewing";

// --- in alto (accanto agli altri helper) ---
const TMDB_BASE = "https://image.tmdb.org/t/p";

/** Normalizza qualsiasi poster (URL pieno / path TMDb / campo OMDb) */
export function normalizePosterUrl(raw?: string | null, size: "w185" | "w342" = "w185") {
  if (!raw) return "";
  const s = String(raw).trim();
  if (!s) return "";
  if (s.startsWith("http")) return s;
  if (s.startsWith("/")) return `${TMDB_BASE}/${size}${s}`;
  return "";
}

/** Poster da titolo (usa fetchMetaForTitle che già cache-a) */
export async function fetchPosterForTitle(title: string, size: "w185" | "w342" = "w185"): Promise<string> {
  if (!title) return "";
  const meta = await fetchMetaForTitle(title); // <-- esistente nel tuo file
  return normalizePosterUrl(meta?.poster_path, size);
}

/** Poster da "viewing" grezzo: inline -> TMDb via meta */
export async function fetchPosterForViewing(viewing: any, size: "w185" | "w342" = "w185"): Promise<string> {
  // 1) se il poster è già nel viewing, usalo
  const inline =
    viewing?.movie?.poster ??
    viewing?.poster ??
    viewing?.omdb?.Poster ??
    null;

  const fromInline = normalizePosterUrl(inline, size);
  if (fromInline) return fromInline;

  // 2) fallback tramite titolo (usa meta + cache)
  const title = viewing?.movie?.title ?? viewing?.title ?? "";
  if (!title) return "";
  return fetchPosterForTitle(title, size);
}

/** Hook semplice per batch titles -> poster URL (con merge dei risultati) */
export function usePosterUrls(titles: string[], size: "w185" | "w342" = "w185") {
  const key = React.useMemo(() => titles.filter(Boolean).join("|"), [titles]);
  const uniq = React.useMemo(() => Array.from(new Set(titles.filter(Boolean))), [key]);
  const [urls, setUrls] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    if (!uniq.length) return;
    let cancelled = false;
    (async () => {
      for (const t of uniq) {
        try {
          const u = await fetchPosterForTitle(t, size);
          if (!cancelled && u && !urls[t]) {
            setUrls(prev => ({ ...prev, [t]: u }));
          }
        } catch {
          /* no-op */
        }
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, size]); // dipende solo da lista e size

  return urls;
}


export function useLazyMetaForViewing(
  viewing: Viewing | null,
  onMetaResolved?: (viewingId: any, nextMovie: Movie) => void
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

export function posterUrlOrEmpty(poster_path?: string) {
  return poster_path ? getPosterUrl(poster_path, "w342") : "";
}
