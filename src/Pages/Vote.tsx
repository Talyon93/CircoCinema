import React, { useEffect, useMemo, useRef, useState } from "react";
import { Card } from "../Components/UI/Card";
import { VotesBar } from "../Components/UI/VotesBar";
import { PickedByBadge } from "../Components/UI/PickedByBadge";
import { VoterChip } from "../Components/UI/VoterChip";
import { formatScore } from "../Utils/Utils";
import { getPosterUrl, tmdbDetails, tmdbSearch } from "../TMDBHelper";
import { AvatarInline } from "../Components/UI/Avatar";

export type ActiveSession = {
  id: any;
  movie: any;
  picked_by?: string;
  opened_by?: string;           // NEW: host della sessione
  started_at: string;
};

type Props = {
  currentUser: string;
  knownUsers: string[];
  activeVote: ActiveSession | null;
  activeRatings: Record<string, number>;
  onStartVoting: (movie: any, pickedBy: string) => void; // (l'owner lo aggiungiamo lato App)
  onSendVote: (score: number) => void;
  onEndVoting: () => void;
  onCancelVoting?: () => void;
};

/* =============== Search =============== */
function SearchMovie({ onPick }: { onPick: (movie: any) => void }) {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const search = async () => {
    const query = q.trim();
    if (!query) return;
    setErr(null);
    setLoading(true);
    try {
      const res = await tmdbSearch(query);
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
          disabled={!q.trim() || loading}
        >
          {loading ? "…" : "Search"}
        </button>
      </div>
      {err && <p className="mt-2 text-sm text-red-600">{err}</p>}

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {results.map((r) => (
          <button
            key={r.id}
            className="flex gap-3 rounded-xl border p-2 text-left transition hover:bg-gray-50 dark:hover:bg-zinc-900 border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
            onClick={async () => {
              const det = await tmdbDetails(r.id);
              onPick(det || r);
              setResults([]);
            }}
            title="Pick this movie"
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
                  <span className="text-gray-500">({String(r.release_date).slice(0, 4)})</span>
                ) : null}
              </div>
              <div className="line-clamp-3 text-sm text-gray-700 dark:text-zinc-300">
                {r.overview}
              </div>
            </div>
          </button>
        ))}
      </div>
    </Card>
  );
}

/* =============== Who picked (enhanced) =============== */
function WhoPicked({
  known,
  value,
  onChange,
  currentUser,
}: {
  known: string[];
  value: string;
  onChange: (v: string) => void;
  currentUser: string;
}) {
  const [q, setQ] = useState(value || currentUser || "");
  useEffect(() => setQ(value), [value]);

  const filtered = useMemo(() => {
    const norm = q.trim().toLowerCase();
    return known
      .filter((n) => n.toLowerCase().includes(norm))
      .slice(0, 12);
  }, [known, q]);

  return (
    <div className="grid gap-2">
      <div className="flex gap-2">
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            onChange(e.target.value);
          }}
          placeholder="Who picked it?"
          className="flex-1 rounded-xl border px-3 py-2 border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
        />
      </div>

      {filtered.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {filtered.map((n) => (
            <button
              type="button"
              key={n}
              onClick={() => {
                setQ(n);
                onChange(n);
              }}
              className={[
                "group inline-flex items-center gap-2 rounded-full",
                "border px-2.5 py-1.5 text-sm transition",
                "bg-white hover:bg-gray-50 dark:bg-zinc-900 dark:hover:bg-zinc-800",
                "border-gray-300 dark:border-zinc-700",
              ].join(" ")}
              title={n}
            >
              <AvatarInline name={n} size={18} className="ring-2 ring-amber-400/40" />
              <span className="font-medium">{n}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* =============== StartVote =============== */
function StartVoteCard({
  movie,
  knownUsers,
  currentUser,
  onStartVoting,
}: {
  movie: any;
  knownUsers: string[];
  currentUser: string;
  onStartVoting: (movie: any, pickedBy: string) => void;
}) {
  const [pickedBy, setPickedBy] = useState("");
  const valid = pickedBy.trim().length > 0;

  return (
    <Card>
      <div className="flex gap-4">
        {movie?.poster_path && (
          <img
            src={getPosterUrl(movie.poster_path, "w342")}
            className="h-48 w-32 rounded-xl object-cover"
            alt={movie.title}
          />
        )}
        <div className="flex-1">
          <h3 className="text-xl font-bold">
            {movie?.title}{" "}
            {movie?.release_date ? (
              <span className="text-gray-500">({String(movie.release_date).slice(0, 4)})</span>
            ) : null}
          </h3>
          {movie?.overview && (
            <p className="mt-1 whitespace-pre-wrap text-gray-700 dark:text-zinc-300">
              {movie.overview}
            </p>
          )}

          <div className="mt-4 grid gap-2">
            <label className="text-sm font-medium text-gray-700 dark:text-zinc-300">Picked by</label>
            <WhoPicked
              known={knownUsers}
              currentUser={currentUser}
              value={pickedBy}
              onChange={setPickedBy}
            />
          </div>

          <div className="mt-4">
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

/* =============== Results overlay (post-chiusura) =============== */
function ResultsOverlay({
  movie,
  pickedBy,
  ratings,
  onClose,
}: {
  movie: any;
  pickedBy?: string;
  ratings: Record<string, number>;
  onClose: () => void;
}) {
  const entries = Object.entries(ratings) as [string, number][];
  const scores = entries.map(([, v]) => Number(v));
  const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-2xl rounded-3xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Session results · {movie?.title}</h3>
          <button className="rounded-xl border border-zinc-700 px-3 py-1.5 text-sm" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="mb-3 flex items-center gap-2">
          {pickedBy && <PickedByBadge name={pickedBy} />}
          {avg != null && (
            <span className="rounded-full border border-zinc-700 px-2 py-0.5 text-sm">
              Avg {formatScore(avg)} · {entries.length} votes
            </span>
          )}
        </div>

        <div className="mb-4">
          <VotesBar entries={entries} avg={avg} currentUser="" size="sm" showHeader={false} showScale={false} />
        </div>

        <div className="flex flex-wrap gap-2">
          {entries
            .sort((a, b) => Number(b[1]) - Number(a[1]) || a[0].localeCompare(b[0]))
            .map(([name, score]) => (
              <VoterChip key={name} name={name} score={Number(score)} currentUser="" />
            ))}
        </div>
      </div>
    </div>
  );
}

/* =============== ActiveVoting =============== */
function ActiveVoting({
  movie,
  pickedBy,
  openedBy,
  currentUser,
  ratings,
  onSendVote,
  onEnd,
  onCancel,
}: {
  movie: any;
  pickedBy?: string;
  openedBy?: string;
  currentUser: string;
  ratings: Record<string, number>;
  onSendVote: (score: number) => void;
  onEnd: () => void;
  onCancel?: () => void;
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
    onSendVote(Math.round(temp / 0.25) * 0.25);
    setOpenVote(false);
    setEditMode(false);
  };

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

  const isOwner = openedBy && currentUser && openedBy === currentUser;

  return (
    <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm ring-1 ring-black/5 dark:border-zinc-800 dark:bg-zinc-900/60">
      <div className="mb-4 grid items-start gap-3 md:grid-cols-[auto,1fr]">
        <div className="flex items-center gap-2">
          {pickedBy && <PickedByBadge name={pickedBy} />}
          {openedBy && (
            <span
              className="inline-flex items-center gap-2 rounded-full border border-sky-400/40 bg-sky-500/15 px-2.5 py-1.5 text-sky-200 ring-1 ring-sky-400/20"
              title={`Host: ${openedBy}`}
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor"><path d="M4 4h16v4H4zm0 6h16v10H4z"/></svg>
              <span className="text-xs font-bold">{openedBy}</span>
            </span>
          )}
        </div>

        <div>
          <div className="text-xl font-bold">
            Voting in progress · {movie?.title}
            {releaseYear && <span className="ml-1 text-zinc-400">({releaseYear})</span>}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-gray-600 dark:text-zinc-400">
            {Number(movie?.runtime) > 0 && (
              <span className="rounded-full border px-2 py-0.5 dark:border-zinc-700">⏱ {movie.runtime} min</span>
            )}
            {genreLine && <span className="rounded-full border px-2 py-0.5 dark:border-zinc-700">{genreLine}</span>}
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

      <div className="grid gap-5 md:grid-cols-[176px,1fr]">
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

        <div className="min-w-0">
          {movie?.overview && (
            <p className="mb-3 whitespace-pre-wrap text-[15px] leading-relaxed text-gray-800 dark:text-zinc-300">
              {movie.overview}
            </p>
          )}

          <div className="mb-3">
            <div className="flex items-center gap-6">
              {avg !== null && (
                <div className="relative h-16 w-16">
                  <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90">
                    <circle cx="32" cy="32" r="26" strokeWidth="8" className="fill-none stroke-zinc-800/60" />
                    <circle
                      cx="32"
                      cy="32"
                      r="26"
                      strokeWidth="8"
                      className="fill-none stroke-lime-400"
                      strokeLinecap="round"
                      strokeDasharray={2 * Math.PI * 26}
                      strokeDashoffset={2 * Math.PI * 26 - ((Math.max(1, Math.min(10, avg)) - 1) / 9) * (2 * Math.PI * 26)}
                    />
                  </svg>
                  <div className="absolute inset-0 grid place-items-center text-sm font-bold">{formatScore(avg)}</div>
                </div>
              )}
              <div className="flex-1">
                <VotesBar entries={entries} avg={avg} currentUser={currentUser} />
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

                  <input
                    type="range"
                    min={1}
                    max={10}
                    step={0.25}
                    value={temp}
                    onInput={(e) => setTemp(parseFloat((e.target as HTMLInputElement).value))}
                    onChange={(e) => setTemp(parseFloat((e.target as HTMLInputElement).value))}
                    className="w-full"
                  />

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
                    <span><b>Vote saved.</b> Please wait for others…</span>
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
                    <div className="text-sm text-zinc-300">Edit your vote <span className="text-zinc-500">(current: {formatScore(you)})</span></div>
                    <div className="rounded-full border border-zinc-700 px-2 py-0.5 text-xs text-zinc-300">{formatScore(temp)}</div>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={10}
                    step={0.25}
                    value={temp}
                    onInput={(e) => setTemp(parseFloat((e.target as HTMLInputElement).value))}
                    onChange={(e) => setTemp(parseFloat((e.target as HTMLInputElement).value))}
                    className="w-full"
                  />
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
                  <VoterChip key={name} name={name} score={Number(score)} currentUser={currentUser} />
                ))}
              </div>
            )}
          </div>

          {/* Owner actions */}
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              className="rounded-xl border px-4 py-2 dark:border-zinc-700 disabled:opacity-40"
              onClick={onEnd}
              disabled={!isOwner}
              title={isOwner ? "Save results and close voting" : "Only the host can end voting"}
            >
              End voting
            </button>
            {onCancel && (
              <button
                className="rounded-xl border px-4 py-2 text-rose-600 dark:border-zinc-700 dark:text-rose-400 disabled:opacity-40"
                onClick={() => {
                  if (!isOwner) return;
                  if (confirm("Cancel this voting? All votes will be discarded.")) onCancel();
                }}
                disabled={!isOwner}
                title={isOwner ? "Cancel without saving results" : "Only the host can cancel"}
              >
                Cancel voting
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* =============== Page =============== */
export default function VotePage({
  currentUser,
  knownUsers,
  activeVote,
  activeRatings,
  onStartVoting,
  onSendVote,
  onEndVoting,
  onCancelVoting,
}: Props) {
  const [pickedMovie, setPickedMovie] = useState<any | null>(null);

  // Cattura ultimo risultato per overlay quando la sessione si chiude (anche da remoto)
  const prevActiveRef = useRef<ActiveSession | null>(null);
  const prevRatingsRef = useRef<Record<string, number>>({});
  const [lastOverlay, setLastOverlay] = useState<{ movie: any; picked_by?: string; ratings: Record<string, number> } | null>(null);
    const canceledRef = React.useRef(false);

  useEffect(() => {
    // quando cambia, salva prev
    prevActiveRef.current = activeVote;
    prevRatingsRef.current = activeRatings;
  }, [activeVote, activeRatings]);

  useEffect(() => {
    if (!activeVote && prevActiveRef.current?.movie) 
        {
            if (canceledRef.current) {
            // CANCEL → niente overlay e torna alla ricerca
            canceledRef.current = false;
            setLastOverlay(null);
            setPickedMovie(null);
            return;
            }
            // END → mostra overlay risultati
            setLastOverlay({
            movie: prevActiveRef.current.movie,
            picked_by: prevActiveRef.current.picked_by,
            ratings: prevRatingsRef.current,
            });
        }
    }, [activeVote]);

  const pickHandler = async (res: any) => {
    setPickedMovie(res || null);
  };

    if (activeVote?.movie) {
    return (
        <ActiveVoting
        movie={activeVote.movie}
        pickedBy={activeVote.picked_by}
        currentUser={currentUser}
        ratings={activeRatings}
        onSendVote={onSendVote}
        onEnd={onEndVoting}
        onCancel={() => {
            canceledRef.current = true;
            setPickedMovie(null);
            onCancelVoting?.();
        }}
        />
    );
    }

  return (
    <div className="grid gap-4">
      {!pickedMovie ? (
        <SearchMovie onPick={pickHandler} />
      ) : (
        <StartVoteCard
          movie={pickedMovie}
          knownUsers={knownUsers}
          currentUser={currentUser}
          onStartVoting={onStartVoting}
        />
      )}
      {lastOverlay && (
        <ResultsOverlay
          movie={lastOverlay.movie}
          pickedBy={lastOverlay.picked_by}
          ratings={lastOverlay.ratings}
          onClose={() => setLastOverlay(null)}
        />
      )}
    </div>
  );
}
