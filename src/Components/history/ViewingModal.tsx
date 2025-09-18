// src/Components/history/ViewingModal.tsx
import React from "react";
import { createPortal } from "react-dom";
import { Calendar, Timer } from "lucide-react";
import { formatScore } from "../../Utils/Utils";
import { PickerBadgePro } from "../UI/PickerPro";
import { ScoreDonut } from "../../Components/UI/ScoreDonut";
import { VotesBar } from "../../Components/UI/VotesBar";
import { VoterChip } from "../../Components/UI/VoterChip";
import { useLazyMetaForViewing } from "../../hooks/useLazyMetaForViewing";
import { Viewing } from "../../types/viewing";
import { getPosterUrl } from "../../TMDBHelper"; // <-- import STATICO

export function ViewingModal({
  v,
  onClose,
  onEdit,
  onResolve,
  currentUser,
}: {
  v: Viewing | null;
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

  // ⬇️ niente await qui
  const poster = meta?.poster_path ? getPosterUrl(meta.poster_path, "w342") : "";
  const overview = (meta?.overview || "").trim();

  const ratings = (v?.ratings || {}) as Record<string, number>;
  const entries = Object.entries(ratings) as [string, number][];
  const scores = entries.map(([, n]) => Number(n));
  const avg = scores.length
    ? scores.reduce((a, b) => a + b, 0) / scores.length
    : null;

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-5xl overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900 shadow-xl">
        <div className="flex items-center gap-2 border-b border-zinc-800 px-4 py-3">
          {v?.picked_by && <PickerBadgePro name={v.picked_by} />}
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

        <div className="grid gap-5 px-4 py-4 md:grid-cols-[220px,1fr]">
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

          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
              {year && (
                <span className="inline-flex items-center gap-1 rounded-full border border-zinc-700 px-2 py-0.5 text-sm">
                  <Calendar className="h-4 w-4 text-blue-400" />
                  {year}
                </span>
              )}
              {runtime && (
                <span className="inline-flex items-center gap-1 rounded-full border border-zinc-700 px-2 py-0.5 text-sm">
                  <Timer className="h-4 w-4 text-pink-400" />
                  {runtime} min
                </span>
              )}
              {genreLine && (
                <span className="rounded-full border border-zinc-700 px-2 py-0.5">
                  {genreLine}
                </span>
              )}
              {(() => {
                const imdbId = v?.movie?.imdb_id as string | undefined;
                const imdbAvg = imdbRating;
                const imdbVotes =
                  typeof v?.movie?.imdb_votes === "number"
                    ? v.movie.imdb_votes
                    : null;

                if (imdbId && (imdbAvg != null || imdbVotes != null)) {
                  return (
                    <a
                      href={`https://www.imdb.com/title/${imdbId}/`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-full border border-zinc-700 px-2 py-0.5 underline-offset-2 hover:underline"
                      title="Open on IMDb"
                    >
                      ★ IMDb
                      {imdbAvg != null ? ` ${formatScore(imdbAvg)}` : ""}
                      {imdbAvg != null && imdbVotes != null ? " • " : ""}
                      {imdbVotes != null
                        ? `${imdbVotes.toLocaleString()} votes`
                        : ""}
                    </a>
                  );
                }

                if (tmdbAvg != null) {
                  return (
                    <span className="rounded-full border border-zinc-700 px-2 py-0.5">
                      ★ TMDB {formatScore(tmdbAvg)}
                      {tmdbCount ? ` • ${tmdbCount.toLocaleString()} votes` : ""}
                    </span>
                  );
                }

                return null;
              })()}
            </div>

            {overview && (
              <p className="mb-4 whitespace-pre-wrap text-[15px] leading-relaxed text-zinc-200">
                {overview}
              </p>
            )}

            <div className="mb-3 flex items-center gap-4">
              {avg !== null && (
                <div className="flex items-center gap-3">
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
                  size="sm"
                  showHeader={false}
                  showScale={false}
                />
              </div>
            </div>

            {entries.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {entries
                  .sort(
                    (a, b) =>
                      Number(b[1]) - Number(a[1]) || a[0].localeCompare(b[0])
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

      <button
        className="fixed inset-0 -z-10 cursor-auto"
        onClick={onClose}
        aria-label="Close overlay"
      />
    </div>,
    document.body
  );
}
