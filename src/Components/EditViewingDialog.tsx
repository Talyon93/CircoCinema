import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { Card } from "./UI/Card";
import { VoterChip } from "./UI/VoterChip";
import { VotesBar } from "./UI/VotesBar";
import { ScoreDonut } from "./UI/ScoreDonut";

function clamp(v: number, lo = 1, hi = 10) { return Math.max(lo, Math.min(hi, v)); }
function roundQuarter(v: number) { return Math.round(v / 0.25) * 0.25; }
function toNumberSafe(v: any, fallback = 7) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

// datetime-local helpers (mostra/legge in locale)
function toLocalDatetimeInputValue(iso?: string) {
  const d = iso ? new Date(iso) : new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const YYYY = d.getFullYear();
  const MM = pad(d.getMonth() + 1);
  const DD = pad(d.getDate());
  const hh = pad(d.getHours());
  const mm = pad(d.getMinutes());
  return `${YYYY}-${MM}-${DD}T${hh}:${mm}`;
}
function fromLocalDatetimeInputValue(s: string) {
  const d = new Date(s.replace("T", " ") + ":00");
  return new Date(
    d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), 0, 0
  ).toISOString();
}

export function EditViewingDialog({
  open,
  viewing,
  knownUsers,
  onClose,
  onSave,
  onDelete,
  onRequestChangeMovie, // opzionale: apri qui il tuo dialog TMDB esterno
}: {
  open: boolean;
  viewing: any;
  knownUsers: string[];
  onClose: () => void;
  onSave: (next: any) => void;
  onDelete: () => void;
  onRequestChangeMovie?: () => void;
}) {
  const [movie, setMovie] = useState(viewing?.movie || null);
  const [ratings, setRatings] = useState<Record<string, number>>(viewing?.ratings || {});
  const [date, setDate] = useState<string>(toLocalDatetimeInputValue(viewing?.started_at));

  useEffect(() => {
    setMovie(viewing?.movie || null);
    setRatings(viewing?.ratings || {});
    setDate(toLocalDatetimeInputValue(viewing?.started_at));
  }, [viewing?.id]);

  // Chiudi con ESC
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const values = Object.values(ratings).map(Number);
  const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
  const entries = Object.entries(ratings) as [string, number][];

  const updateRating = (name: string, val: number) => {
    const clean = roundQuarter(clamp(toNumberSafe(val)));
    setRatings((prev) => ({ ...prev, [name]: clean }));
  };
  const addUser = (name: string) => {
    if (!name) return;
    if (!ratings[name]) setRatings((prev) => ({ ...prev, [name]: 7 }));
  };
  const removeUser = (name: string) => {
    const copy = { ...ratings };
    delete copy[name];
    setRatings(copy);
  };

  const save = () => {
    const next = {
      ...viewing,
      movie,
      ratings,
      started_at: fromLocalDatetimeInputValue(date),
    };
    onSave(next);
  };

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4">
      {/* click fuori per chiudere */}
      <button className="fixed inset-0 -z-10 cursor-auto" onClick={onClose} aria-label="Close overlay" />
      <Card
        className="w-full max-w-3xl shadow-xl !bg-white dark:!bg-zinc-900
                   text-zinc-900 dark:text-zinc-100"
      >
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Edit Viewing</h3>
          <div className="flex gap-2">
            <button
              onClick={onDelete}
              className="rounded-xl border border-red-500/50 px-3 py-1 text-sm
                         text-red-600 hover:bg-red-50
                         dark:text-red-400 dark:hover:bg-red-950/30"
            >
              Delete
            </button>
            <button
              onClick={onClose}
              className="rounded-xl border px-3 py-1 text-sm
                         border-zinc-300 dark:border-zinc-700
                         text-zinc-800 dark:text-zinc-100"
            >
              Close
            </button>
          </div>
        </div>

        {/* Hero: Avg + bar */}
        <div className="mb-3 flex items-center gap-4">
          {avg !== null && <ScoreDonut value={avg} size={56} />}
          <div className="flex-1">
            <div className="mb-1 text-xs text-zinc-600 dark:text-zinc-400">
              Avg {entries.length ? `(${entries.length} votes)` : ""}
            </div>
            <VotesBar entries={entries} avg={avg} size="sm" showHeader={false} />
          </div>
        </div>

        {/* Movie */}
        <div className="mb-5">
          <label className="text-xs text-zinc-700 dark:text-zinc-300">Movie</label>
          <div className="mt-1 flex gap-2">
            <span
              className="flex-1 rounded-xl border px-3 py-2
                         border-zinc-300 text-zinc-900 bg-white
                         dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            >
              {movie?.title || "Untitled"}
            </span>
            <button
              onClick={
                onRequestChangeMovie
                  ? onRequestChangeMovie
                  : () => { /* apri qui il tuo dialog di ricerca TMDB e poi fai setMovie(nextMovie) */ }
              }
              className="rounded-xl bg-blue-600 px-3 py-1 text-sm text-white"
            >
              Change
            </button>
          </div>
        </div>

        {/* Date */}
        <div className="mb-5">
          <label className="text-xs text-zinc-700 dark:text-zinc-300">Date</label>
          <input
            type="datetime-local"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1 w-full rounded-xl border px-3 py-2
                       border-zinc-300 text-zinc-900 placeholder-zinc-400 bg-white
                       dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder-zinc-500"
          />
        </div>

        {/* Votes */}
        <div>
          <label className="text-xs text-zinc-700 dark:text-zinc-300">Votes</label>
          <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
            {Object.entries(ratings).map(([name, score]) => (
              <div
                key={name}
                className="flex items-center gap-2 rounded-xl border px-2 py-1
                           border-zinc-300 dark:border-zinc-700"
              >
                {/* Assicurati che VoterChip usi testo bianco in dark mode; se no, aggiungi una prop o una classe */}
                <VoterChip name={name} score={Number(score)} currentUser={""} />
                <input
                  type="number"
                  inputMode="decimal"
                  step={0.25}
                  min={1}
                  max={10}
                  value={Number(score)}
                  onChange={(e) => updateRating(name, parseFloat(e.target.value))}
                  className="w-20 rounded border px-2 py-1 text-sm
                             border-zinc-300 text-zinc-900 bg-white placeholder-zinc-400
                             dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder-zinc-500"
                />
                <button
                  onClick={() => removeUser(name)}
                  className="ml-1 text-xs text-zinc-700 hover:text-zinc-900
                             dark:text-zinc-300 dark:hover:text-white"
                  title="Remove"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          {/* Add user */}
          <div className="mt-3 flex gap-2">
            <select
              className="flex-1 rounded-xl border px-3 py-2
                         border-zinc-300 text-zinc-900 bg-white
                         dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              onChange={(e) => { addUser(e.target.value); e.currentTarget.value = ""; }}
              defaultValue=""
            >
              <option value="">Add user…</option>
              {knownUsers.filter((u) => !ratings[u]).map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={save}
            className="rounded-xl px-4 py-2
                       bg-zinc-900 text-white
                       dark:bg-zinc-800 dark:text-white"
          >
            Save
          </button>
        </div>
      </Card>
    </div>,
    document.body
  );
}
