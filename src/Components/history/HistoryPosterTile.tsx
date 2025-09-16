import React from "react";
import { getPosterUrl } from "../../TMDBHelper";
import { Viewing } from "../../types/viewing";
import { useLazyMetaForViewing } from "../../hooks/useLazyMetaForViewing";

export function HistoryPosterTile({
  v,
  onClick,
  onResolve,
}: {
  v: Viewing;
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
