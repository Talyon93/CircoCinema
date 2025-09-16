import * as React from "react";
import { getMetaCache, setMetaCache } from "../localStorage";
import { fetchMetaForTitle, getPosterUrl } from "../TMDBHelper";
import { Viewing, Movie } from "../types/viewing";

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
