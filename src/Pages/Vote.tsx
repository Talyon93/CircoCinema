import React, { useEffect, useMemo, useRef, useState } from "react";
import { Card } from "../Components/UI/Card";
import { VotesBar } from "../Components/UI/VotesBar";
import { PickedByBadge } from "../Components/UI/PickedByBadge";
import { VoterChip } from "../Components/UI/VoterChip";
import { formatScore } from "../Utils/Utils";
import { getPosterUrl, tmdbDetails, tmdbSearch } from "../TMDBHelper";
import { AvatarInline } from "../Components/UI/Avatar";
import { sb } from "../supabaseClient";
import { ensureLiveFileExists, loadHistoryLive, subscribeHistoryLive } from "../storage";
import { K_VIEWINGS, lsGetJSON } from "../localStorage";
import { loadSharedState, saveSharedState, subscribeSharedState, SharedState } from "../state";
import ScoreSlider from "../Components/UI/ScoreSlider";
import { setNextPicker } from "../state";

/* ===================== Wheel shared payload ===================== */
type WheelShared = {
  runId: string;
  startedBy: string;
  startedAt: number;
  durationMs: number;
  targetDeg: number;      // angolo cumulativo
  isSpinning: boolean;
  entries: string[];      // lista CONGELATA per lo spin (uguale per tutti)
  winner?: string;
};

/* ===================== Types ===================== */
export type ActiveSession = {
  id: any;
  movie: any;
  picked_by?: string;
  opened_by?: string;
  started_at: string;
};

type HistoryViewing = {
  id: any;
  movie: any;
  ratings?: Record<string, number>;
  avg?: number;
};

type Props = {
  currentUser: string;
  knownUsers: string[];
  activeVote: ActiveSession | null;
  activeRatings: Record<string, number>;
  onStartVoting: (movie: any, pickedBy: string) => void;
  onSendVote: (score: number) => void;
  onEndVoting: () => void;
  onCancelVoting?: () => void;
  historyViewings?: HistoryViewing[];
};

/* ===================== Helpers ===================== */
function computeAvg(ratings?: Record<string, number> | null): number | null {
  if (!ratings) return null;
  const vals = Object.values(ratings).map(Number).filter((n) => !Number.isNaN(n));
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}
const uniq = <T,>(arr: T[]) => Array.from(new Set(arr));

/* ===================== Search ===================== */
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

/* ===================== Who picked ===================== */
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
    return known.filter((n) => n.toLowerCase().includes(norm)).slice(0, 12);
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

/* ===================== StartVote ===================== */
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

/* ===================== ActiveVoting ===================== */
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

  const normalize = (s?: string) => (s || "").trim().toLowerCase();
  const isOwner = normalize(openedBy) === normalize(currentUser);

  return (
    <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm ring-1 ring-black/5 dark:border-zinc-800 dark:bg-zinc-900/60">
      <div className="mb-4 grid items-start gap-3 md:grid-cols-[auto,1fr]">
        <div className="flex items-center gap-2">
          {pickedBy && <PickedByBadge name={pickedBy} />}
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
                <VotesBar entries={Object.entries(ratings) as [string, number][]} avg={avg} currentUser={currentUser} />
              </div>
            </div>
          </div>

          {/* Stato post voto */}
          {hasVoted ? (
            <>
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
              {editMode && (
                <div className="mt-2 rounded-2xl border border-zinc-800/80 bg-zinc-900/50 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="text-sm text-zinc-300">
                      Edit your vote <span className="text-zinc-500">(current: {formatScore(you)})</span>
                    </div>
                    <div className="rounded-full border border-zinc-700 px-2 py-0.5 text-xs text-zinc-300">
                      {formatScore(temp)}
                    </div>
                  </div>
                  <ScoreSlider value={temp} onChange={setTemp} min={1} max={10} step={0.25} />
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      className="rounded-xl bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600"
                      onClick={() => {
                        onSendVote(Math.round(temp / 0.25) * 0.25);
                        setEditMode(false);
                      }}
                    >
                      Save
                    </button>
                    <button
                      className="rounded-xl border border-zinc-700 px-3 py-2 text-zinc-200"
                      onClick={() => setEditMode(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
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
                  <ScoreSlider value={temp} onChange={setTemp} min={1} max={10} step={0.25} />
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

/** -------------------- WHEEL OF NAMES (sync + precise winner) --------------------
 * - Puntatore a destra; vincitore = spicchio sotto il puntatore quando finisce l’animazione
 * - Calcolo dal DOM, nessun “rimbalzo”: angolo cumulativo
 * - Sincronizzata via shared state + Supabase Realtime
 * - Congelamento lista (entries) per coerenza su tutti i client
 * - Dopo l’estrazione mostra il pannello “Prossimo a scegliere”
 * ------------------------------------------------------------------------------- */

const POINTER_DEG = 0;
const norm = (d: number) => ((d % 360) + 360) % 360;

const getDomRotationDeg = (el: HTMLElement | null) => {
  if (!el) return 0;
  const tr = getComputedStyle(el).transform;
  if (!tr || tr === "none") return 0;

  const m2 = tr.match(/matrix\(([^)]+)\)/);
  if (m2) {
    const [a, b] = m2[1].split(",").map((v) => parseFloat(v.trim()));
    return norm((Math.atan2(b, a) * 180) / Math.PI);
  }
  const m3 = tr.match(/matrix3d\(([^)]+)\)/);
  if (m3) {
    const vals = m3[1].split(",").map((v) => parseFloat(v.trim()));
    const a = vals[0];
    const b = vals[1];
    return norm((Math.atan2(b, a) * 180) / Math.PI);
  }
  return 0;
};

const indexAtPointer = (rotDeg: number, anglePer: number, count: number) => {
  const rot = norm(rotDeg);
  const theta = norm(POINTER_DEG - rot);
  return Math.floor((theta + anglePer / 2) / anglePer) % count;
};

export function WheelOfNames({
  candidates,
  onWinner,
  currentUser,
  roomId = "global",
}: {
  candidates: string[];
  onWinner?: (name: string) => void;
  currentUser?: string;
  roomId?: string;
}) {
  // selezione locale (sincronizzata tra i client quando non si gira)
  const [selected, setSelected] = React.useState<string[]>(() => candidates.slice());

  // rotazione cumulativa, stato spin e winner locale
  const [rotation, setRotation] = React.useState(0);
  const [spinning, setSpinning] = React.useState(false);
  const [winner, setWinner] = React.useState<string | null>(null);

  // lista “congelata” per lo spin in corso (se presente, sostituisce selected)
  const [lockedEntries, setLockedEntries] = React.useState<string[] | null>(null);

  // stato remoto condiviso + canale realtime
  const [remote, setRemote] = React.useState<WheelShared | null>(null);
  const [runId, setRunId] = React.useState<string | null>(null);
  const chanRef = React.useRef<any>(null);

  // ref al DOM della ruota
  const wheelRef = React.useRef<HTMLDivElement>(null);

  // lista effettiva in uso (locked se c’è uno spin)
  const inUse = lockedEntries ?? selected;
  const N = Math.max(1, inUse.length);
  const anglePer = 360 / N;

  /* ---------- SINCRONIZZAZIONE ROSTER (selezione) ---------- */

  // pubblica la selezione corrente a tutti
  const publishRoster = (list: string[]) => {
    const payload = { list, updatedAt: Date.now() };
    try { saveSharedState({ wheelRoster: payload } as any); } catch {}
    try { chanRef.current?.send({ type: "broadcast", event: "roster", payload }); } catch {}
  };

  // allineati a shared state (winner/spin + roster)
  React.useEffect(() => {
    let off: (() => void) | null = null;
    (async () => {
      const s = await loadSharedState();
      setRemote((s?.wheel as WheelShared) || null);

      // roster iniziale (se c'è) – applica solo se non stai girando
      const roster = (s as any)?.wheelRoster?.list as string[] | undefined;
      if (Array.isArray(roster) && !lockedEntries) {
        setSelected(roster.filter(Boolean));
      }

      off = subscribeSharedState((next: SharedState) => {
        setRemote((next?.wheel as WheelShared) || null);
        const r = (next as any)?.wheelRoster;
        if (r?.list && !lockedEntries) {
          setSelected(r.list.slice());
        }
      });
    })();
    return () => off?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // canale Supabase (spin/stop/roster in realtime)
  React.useEffect(() => {
    if (!sb) return;
    const ch = sb.channel(`wheel:${roomId}`, { config: { broadcast: { ack: false } } });

    ch.on("broadcast", { event: "spin" }, (msg) => {
      const payload = msg.payload as WheelShared;
      if (!payload?.runId) return;
      setRemote(payload);
      setLockedEntries(payload.entries); // blocca la lista
      setSpinning(true);
      setWinner(null);
      requestAnimationFrame(() => setRotation(payload.targetDeg));
    });

    ch.on("broadcast", { event: "stop" }, (msg) => {
      const payload = msg.payload as WheelShared;
      setRemote(payload);
      setLockedEntries(null);          // sblocca
    });

    ch.on("broadcast", { event: "roster" }, (msg) => {
      const { list } = (msg.payload || {}) as { list?: string[] };
      if (Array.isArray(list) && !lockedEntries) {
        setSelected(list.slice());
      }
    });

    ch.subscribe();
    chanRef.current = ch;
    return () => {
      try { ch.unsubscribe(); } catch {}
      chanRef.current = null;
    };
  }, [roomId, lockedEntries]);

  // mantieni la selezione in sync con i nuovi candidati (se non stai girando)
  React.useEffect(() => {
    if (lockedEntries) return;
    setSelected((prev) => {
      const next = prev.filter((n) => candidates.includes(n));
      return next.length ? next : candidates.slice();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidates]);

  // toggle + selezioni globali (pubblicano roster)
  const toggle = (n: string) => {
    setSelected((prev) => {
      const next = prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n];
      publishRoster(next);
      return next;
    });
  };
  const allOn = () => {
    const next = candidates.slice();
    setSelected(next);
    publishRoster(next);
  };
  const allOff = () => {
    const next: string[] = [];
    setSelected(next);
    publishRoster(next);
  };

  /* ---------- AVVIO SPIN (sincronizzato) ---------- */
  const handleSpin = async () => {
    if (spinning || N === 0 || remote?.isSpinning) return;

    const entries = inUse.slice(); // congela la lista in uso
    const id = (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`).toString();
    const durationMs = 3600;
    const extraTurns = 4 + Math.floor(Math.random() * 2);
    const rand = Math.random() * 360;
    const targetDeg = rotation + extraTurns * 360 + rand;

    const payload: WheelShared = {
      runId: id,
      startedBy: currentUser || "unknown",
      startedAt: Date.now(),
      durationMs,
      targetDeg,
      isSpinning: true,
      entries,
      winner: undefined,
    };

    try { await saveSharedState({ wheel: payload } as any); } catch {}
    try { chanRef.current?.send({ type: "broadcast", event: "spin", payload }); } catch {}

    setRunId(id);
    setWinner(null);
    setLockedEntries(entries);
    setSpinning(true);
    requestAnimationFrame(() => setRotation(targetDeg));
  };

  // fallback: seguire spin anche solo da shared state
  React.useEffect(() => {
    if (!remote) return;
    if (remote.isSpinning && remote.runId && remote.runId !== runId) {
      setLockedEntries(remote.entries);
      setSpinning(true);
      setWinner(null);
      requestAnimationFrame(() => setRotation(remote.targetDeg));
    }
  }, [remote, runId]);

  /* ---------- FINE ANIMAZIONE: calcolo winner dal DOM ---------- */
  React.useEffect(() => {
    const el = wheelRef.current;
    if (!el) return;

    const onEnd = async () => {
      setSpinning(false);

      const domDeg = getDomRotationDeg(el);
      setRotation(domDeg);

      // calcolo sull’elenco in uso (locked se presente)
      const idx = indexAtPointer(domDeg, anglePer, Math.max(1, inUse.length));
      const name = inUse[idx];
      setWinner(name);

      try {
        await setNextPicker(name);
      } catch {}

      if (remote?.isSpinning && remote.runId && !remote.winner) {
        const stopped: WheelShared = { ...remote, isSpinning: false, winner: name };
        try { await saveSharedState({ wheel: stopped } as any); } catch {}
        try { chanRef.current?.send({ type: "broadcast", event: "stop", payload: stopped }); } catch {}
      }

      setLockedEntries(null);
      onWinner?.(name);
    };

    el.addEventListener("transitionend", onEnd);
    return () => el.removeEventListener("transitionend", onEnd);
  }, [anglePer, inUse, remote, onWinner]);

  /* ---------- UI ---------- */
  const deg2rad = (d: number) => (d * Math.PI) / 180;
  const finalWinner = remote?.winner ?? winner;
  const globallySpinning = Boolean(remote?.isSpinning);
  const hideButton = globallySpinning || Boolean(finalWinner);
  const togglesDisabled = Boolean(lockedEntries) || globallySpinning || Boolean(remote?.winner);

  return (
    <Card>
      <div className="mb-2 flex items-center justify-between">
        <div className="text-lg font-bold">Ruota dei nomi</div>
        {finalWinner && (
          <div className="rounded-full border border-emerald-500/40 bg-emerald-500/15 px-3 py-1 text-sm text-emerald-200">
            Estratto: <b>{finalWinner}</b>
          </div>
        )}
      </div>

      {/* controlli */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button
          className="rounded-full border px-3 py-1 text-sm dark:border-zinc-700 disabled:opacity-40"
          onClick={allOn}
          disabled={togglesDisabled}
        >
          Seleziona tutti
        </button>
        <button
          className="rounded-full border px-3 py-1 text-sm dark:border-zinc-700 disabled:opacity-40"
          onClick={allOff}
          disabled={togglesDisabled}
        >
          Deseleziona tutti
        </button>
        <div className="text-sm text-zinc-400">
          {inUse.length}/{candidates.length} inclusi
        </div>
      </div>

      {/* chips */}
      <div className="mb-4 flex flex-wrap gap-2">
        {candidates.map((n) => {
          const on = selected.includes(n);
          return (
            <button
              key={n}
              onClick={() => toggle(n)}
              disabled={togglesDisabled}
              className={[
                "inline-flex items-center gap-2 rounded-full border px-2.5 py-1.5 text-sm transition disabled:opacity-40",
                on
                  ? "bg-amber-500/15 border-amber-500/40 text-amber-100"
                  : "bg-white dark:bg-zinc-900 border-gray-300 dark:border-zinc-700 text-zinc-300",
              ].join(" ")}
              title={n}
            >
              <AvatarInline name={n} size={18} className={on ? "ring-2 ring-amber-400/50" : ""} />
              <span className="font-medium">{n}</span>
            </button>
          );
        })}
      </div>

      {/* ruota */}
      <div className="flex flex-col items-center">
        <div className="relative">
          {/* puntatore a destra (triangolo verso sinistra) */}
          <div className="absolute right-0 top-1/2 z-10 -translate-y-1/2 -translate-x-[5px]">
            <div
              className="h-0 w-0
                         border-t-[10px] border-b-[10px] border-r-[18px]
                         border-t-transparent border-b-transparent border-r-amber-400 drop-shadow"
            />
          </div>

          <div
            ref={wheelRef}
            className="mx-auto aspect-square w-[360px] select-none rounded-full border border-zinc-700 bg-zinc-900 shadow-inner"
            style={{
              transition: "transform 3.6s cubic-bezier(.2,.7,0,1)",
              transform: `rotate(${rotation}deg)`,
              willChange: "transform",
              minWidth: 300,
            }}
          >
            <svg viewBox="0 0 100 100" className="h-full w-full rounded-full" preserveAspectRatio="xMidYMid meet">
              <defs>
                <clipPath id="clip">
                  <circle cx="50" cy="50" r="49" />
                </clipPath>
              </defs>

              <g clipPath="url(#clip)">
                <circle cx="50" cy="50" r="49" fill="rgba(24,24,27,.85)" />

                {N === 0 ? (
                  <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" fontSize="7" fill="#e4e4e7">
                    Nessun nome selezionato
                  </text>
                ) : (
                  inUse.map((name, i) => {
                    const a0 = deg2rad(i * anglePer);
                    const a1 = deg2rad((i + 1) * anglePer);
                    const x0 = 50 + 48 * Math.cos(a0);
                    const y0 = 50 + 48 * Math.sin(a0);
                    const x1 = 50 + 48 * Math.cos(a1);
                    const y1 = 50 + 48 * Math.sin(a1);
                    const largeArc = anglePer > 180 ? 1 : 0;
                    const hue = Math.round((i / N) * 360);

                    const rText = 41;
                    const tx0 = 50 + rText * Math.cos(a0);
                    const ty0 = 50 + rText * Math.sin(a0);
                    const tx1 = 50 + rText * Math.cos(a1);
                    const ty1 = 50 + rText * Math.sin(a1);
                    const id = `arc-${i}`;

                    const txt = name.length > 16 ? name.slice(0, 14) + "…" : name;
                    const fz = +(Math.max(3.2, Math.min(6.2, anglePer * 0.18)) * Math.min(1, 9 / Math.max(1, txt.length))).toFixed(2);

                    return (
                      <g key={`${name}-${i}`}>
                        <path
                          d={`M50,50 L${x0},${y0} A48,48 0 ${largeArc} 1 ${x1},${y1} Z`}
                          fill={`hsl(${hue} 70% 52%)`}
                          opacity="0.95"
                          stroke="rgba(0,0,0,.40)"
                          strokeWidth="0.6"
                        />
                        <defs>
                          <path id={id} d={`M${tx0},${ty0} A${rText},${rText} 0 ${largeArc} 1 ${tx1},${ty1}`} />
                        </defs>
                        <text
                          fontSize={fz}
                          fill="#fff"
                          style={{
                            fontWeight: 900,
                            paintOrder: "stroke",
                            stroke: "rgba(0,0,0,.6)",
                            strokeWidth: 1.1,
                            letterSpacing: 0.2,
                          }}
                        >
                          <textPath href={`#${id}`} startOffset="50%" textAnchor="middle">
                            {txt}
                          </textPath>
                        </text>
                      </g>
                    );
                  })
                )}
              </g>

              {/* mozzo */}
              <circle cx="50" cy="50" r="6.5" fill="rgba(0,0,0,.55)" stroke="rgba(255,255,255,.25)" />
            </svg>
          </div>
        </div>

        {/* Bottone: nascosto durante spin o dopo estrazione */}
        <div className="mt-4">
          <button
            className={`rounded-xl bg-amber-500 px-4 py-2 font-semibold text-black hover:bg-amber-400 ${
              hideButton ? "invisible" : ""
            }`}
            onClick={handleSpin}
            disabled={hideButton || spinning || N === 0}
          >
            {spinning ? "Gira…" : "Gira la ruota"}
          </button>
        </div>

        {/* Pannello fase 2 */}
        {finalWinner && (
          <div className="mt-4 w-full max-w-[520px] rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-100">
            <div className="text-sm opacity-90">Prossimo a scegliere il film</div>
            <div className="mt-1 text-2xl font-extrabold tracking-wide">{finalWinner}</div>
            <div className="mt-2 text-xs opacity-70">Mostrato a tutti i partecipanti.</div>
          </div>
        )}
      </div>
    </Card>
  );
}
/* ===================== Closed recap (nuovo menu) ===================== */
function ClosedRecapCard({
  movie,
  pickedBy,
  ratings,
  history,
  onClose,
}: {
  movie: any;
  pickedBy?: string;
  ratings: Record<string, number>;
  history?: { id: any; movie: any; ratings?: Record<string, number>; avg?: number }[];
  onClose: () => void;
}) {
  const entries = Object.entries(ratings) as [string, number][];
  const scores = entries.map(([, v]) => Number(v));
  const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
  const [nextPicker, setNextPicker] = React.useState<string | null>(null);

  React.useEffect(() => {
    let off: (() => void) | null = null;
    (async () => {
      try {
        const s = await loadSharedState();
        setNextPicker(((s as any)?.nextPicker?.name) ?? ((s as any)?.wheel?.winner) ?? null);
        off = subscribeSharedState((n: SharedState) => {
          setNextPicker(((n as any)?.nextPicker?.name) ?? ((n as any)?.wheel?.winner) ?? null);
        });
      } catch {}
    })();
    return () => off?.();
  }, []);

  const poster = movie?.poster_path ? getPosterUrl(movie.poster_path, "w342") : "";
  const releaseYear =
    movie?.release_year || (movie?.release_date ? String(movie.release_date).slice(0, 4) : null);
  const genreLine = Array.isArray(movie?.genres)
    ? movie.genres.map((g: any) => g?.name).filter(Boolean).join(", ")
    : "";

  // elenco completo dei votanti "storici" + quelli dell'ultima sessione
  const allHistoricalVoters = useMemo(() => {
    const fromHistory = (history || []).flatMap((v) => Object.keys(v.ratings || {}));
    const fromThis = Object.keys(ratings || {});
    return uniq([...fromHistory, ...fromThis]).sort((a, b) => a.localeCompare(b));
  }, [history, ratings]);

  const ranking = React.useMemo(() => {
    if (!history || avg == null) return null;
    const items = history
      .map((v) => {
        const a = typeof v.avg === "number" ? v.avg : computeAvg(v.ratings || null);
        const title = v?.movie?.title || "Untitled";
        const year =
          v?.movie?.release_year ||
          (v?.movie?.release_date ? String(v.movie.release_date).slice(0, 4) : null);
        return a != null ? { id: v.id, title, year, avg: a } : null;
      })
      .filter(Boolean) as { id: any; title: string; year?: string | null; avg: number }[];

    const thisKey = `${(movie?.title || "").trim()}|${releaseYear || ""}`.toLowerCase();
    if (!items.some((it) => `${it.title}|${it.year ?? ""}`.toLowerCase() === thisKey)) {
      items.push({ id: "__current__", title: movie?.title || "Untitled", year: releaseYear, avg: avg! });
    }
    items.sort((a, b) => b.avg - a.avg || a.title.localeCompare(b.title));
    const idx = items.findIndex((it) => `${it.title}|${it.year ?? ""}`.toLowerCase() === thisKey);
    const rank = idx >= 0 ? idx + 1 : null;
    const total = items.length;
    return {
      rank,
      total,
      prev: idx > 0 ? items[idx - 1] : null,
      next: idx < total - 1 ? items[idx + 1] : null,
    };
  }, [history, avg, movie, releaseYear]);

  return (
    <Card>
      <div className="mb-2 text-lg font-bold">La votazione è chiusa.</div>
      {nextPicker && (
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/15 px-3 py-1 text-sm text-amber-200">
          Prossimo a scegliere: <b className="text-amber-100">{nextPicker}</b>
        </div>
      )}
      <div className="grid gap-5 md:grid-cols-[176px,1fr]">
        <div className="flex items-start justify-center">
          {poster ? (
            <img
              src={poster}
              alt={movie?.title}
              className="h-[264px] w-[176px] rounded-2xl border border-zinc-700 object-cover"
            />
          ) : (
            <div className="flex h-[264px] w-[176px] items-center justify-center rounded-2xl border border-dashed text-xs text-zinc-400">
              No poster
            </div>
          )}
        </div>

        <div className="min-w-0">
          <div className="text-xl font-bold">
            {movie?.title} {releaseYear && <span className="ml-1 text-zinc-400">({releaseYear})</span>}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-zinc-400">
            {Number(movie?.runtime) > 0 && (
              <span className="rounded-full border px-2 py-0.5 dark:border-zinc-700">⏱ {movie.runtime} min</span>
            )}
            {genreLine && <span className="rounded-full border px-2 py-0.5 dark:border-zinc-700">{genreLine}</span>}
            {typeof movie?.imdb_rating === "number" && (
              <span className="rounded-full border px-2 py-0.5 dark:border-zinc-700">★ IMDb {formatScore(movie.imdb_rating)}</span>
            )}
            {typeof movie?.tmdb_vote_count === "number" && movie.tmdb_vote_count > 0 && (
              <span className="rounded-full border px-2 py-0.5 dark:border-zinc-700">
                {movie.tmdb_vote_count.toLocaleString()} votes
              </span>
            )}
            {pickedBy && <PickedByBadge name={pickedBy} />}
          </div>

          {movie?.overview && (
            <p className="mt-3 whitespace-pre-wrap text-[15px] leading-relaxed text-zinc-300">{movie.overview}</p>
          )}

          <div className="mt-5 flex items-center gap-4">
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
                  strokeDashoffset={
                    2 * Math.PI * 26 - ((Math.max(1, Math.min(10, avg ?? 1)) - 1) / 9) * (2 * Math.PI * 26)
                  }
                />
              </svg>
              <div className="absolute inset-0 grid place-items-center text-sm font-bold">
                {avg != null ? formatScore(avg) : "—"}
              </div>
            </div>

            <div className="text-sm">
              {ranking?.rank != null ? (
                <div className="rounded-full border border-amber-500/40 bg-amber-500/15 px-3 py-1 text-amber-200">
                  Posizione #{ranking.rank} su {ranking.total}
                </div>
              ) : (
                <div className="text-zinc-400">Nessuna classifica disponibile</div>
              )}
            </div>
          </div>

          <div className="mt-6">
            <button onClick={onClose} className="rounded-xl border px-4 py-2 dark:border-zinc-700">
              Chiudi
            </button>
          </div>
        </div>
      </div>

      {/* ===== Ruota sotto il recap ===== */}
      <div className="mt-6">
        <WheelOfNames
          candidates={allHistoricalVoters}
          roomId="global"
          onWinner={async (name) => {
            try { await setNextPicker(name); } catch {}
          }}
        />
      </div>
    </Card>
  );
}

/* ===================== Page ===================== */
export default function VotePage({
  currentUser,
  knownUsers,
  activeVote,
  activeRatings,
  onStartVoting,
  onSendVote,
  onEndVoting,
  onCancelVoting,
  historyViewings,
}: Props) {
  const [pickedMovie, setPickedMovie] = useState<any | null>(null);

  const prevActiveRef = useRef<ActiveSession | null>(null);
  const lastNonEmptyRatingsRef = useRef<Record<string, number>>({});
  const canceledRef = React.useRef(false);
  const [selfHistory, setSelfHistory] = useState<HistoryViewing[] | null>(null);
  const [closedRecap, setClosedRecap] =
    useState<{ movie: any; picked_by?: string; ratings: Record<string, number> } | null>(null);

  useEffect(() => {
    if (historyViewings && Array.isArray(historyViewings)) {
      setSelfHistory(historyViewings);
      return;
    }

    let offLive: (() => void) | null = null;

    (async () => {
      try {
        if (sb) {
          await ensureLiveFileExists();
          const live = await loadHistoryLive();
          setSelfHistory(Array.isArray(live) ? live : []);
          offLive = subscribeHistoryLive((next) =>
            setSelfHistory(Array.isArray(next) ? next : [])
          );
        } else {
          // Fallback offline: localStorage + listener
          const hist = lsGetJSON<HistoryViewing[]>(K_VIEWINGS, []);
          setSelfHistory(Array.isArray(hist) ? hist : []);

          const onStorage = (e: StorageEvent) => {
            if (e.key === K_VIEWINGS) {
              const curr = lsGetJSON<HistoryViewing[]>(K_VIEWINGS, []);
              setSelfHistory(Array.isArray(curr) ? curr : []);
            }
          };
          window.addEventListener("storage", onStorage);
          offLive = () => window.removeEventListener("storage", onStorage);
        }
      } catch {
        setSelfHistory([]);
      }
    })();

    return () => {
      if (offLive) offLive();
    };
  }, [historyViewings]);

  useEffect(() => {
    if (activeVote?.movie) {
      prevActiveRef.current = activeVote;
    }
  }, [activeVote]);

  useEffect(() => {
    if (activeRatings && Object.keys(activeRatings).length > 0) {
      lastNonEmptyRatingsRef.current = activeRatings;
    }
  }, [activeRatings]);

  useEffect(() => {
    if (activeVote !== null) return;
    if (!prevActiveRef.current?.movie) return;

    if (canceledRef.current) {
      canceledRef.current = false;
      setClosedRecap(null);
      setPickedMovie(null);
      return;
    }

    const snapshot = lastNonEmptyRatingsRef.current;

    setClosedRecap({
      movie: prevActiveRef.current.movie,
      picked_by: prevActiveRef.current.picked_by,
      ratings: snapshot,
    });
    setPickedMovie(null);
  }, [activeVote]);

  const pickHandler = async (res: any) => {
    setPickedMovie(res || null);
  };

  if (activeVote?.movie) {
    return (
      <ActiveVoting
        movie={activeVote.movie}
        pickedBy={activeVote.picked_by}
        openedBy={activeVote.opened_by ?? (activeVote as any).openedBy}
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

  if (closedRecap) {
    return (
      <ClosedRecapCard
        movie={closedRecap.movie}
        pickedBy={closedRecap.picked_by}
        ratings={closedRecap.ratings}
        history={historyViewings ?? selfHistory ?? []}
        onClose={() => setClosedRecap(null)}
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
    </div>
  );
}
