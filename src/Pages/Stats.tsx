import React, { useEffect, useMemo, useState } from "react";
import {
  Card,
} from "../Components/UI/Card";

import { formatScore } from "..//Utils/Utils";

export function Stats({
    history,
    backfillRuntime,   // optional: () => void
    isLoading = false, // optional
  }: {
    history: any[];
    backfillRuntime?: () => void;
    isLoading?: boolean;
  }) {
    // Automatic backfill start if provided
    React.useEffect(() => {
      if (!backfillRuntime) return;
      const hasRt = history.some((h) => Number((h?.movie as any)?.runtime) > 0);
      if (!hasRt && !isLoading && history.length > 0) {
        backfillRuntime();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [history, isLoading, backfillRuntime]);
  
    // Helper: average of a ratings record
    const avgOf = (r?: Record<string, number> | null) => {
      if (!r) return null;
      const vals = Object.values(r).map(Number);
      if (!vals.length) return null;
      return vals.reduce((a, b) => a + b, 0) / vals.length;
    };
  
    // ---- Aggregations
    const givenMap = new Map<string, { sum: number; n: number }>();     // votes given
    const receivedMap = new Map<string, { sum: number; n: number }>();  // average received as picker
    const genreCount = new Map<string, number>();                       // genre counts
    let totalMinutes = 0;
    let totalMinutesKnown = 0;
    const movieStats: Array<{ id: any; title: string; avg: number; votes: number; date: number }> = [];
  
    for (const v of history) {
      const ratings = (v?.ratings || {}) as Record<string, number>;
      const entries = Object.entries(ratings);
  
      // votes given per user
      for (const [user, score] of entries) {
        const m = givenMap.get(user) || { sum: 0, n: 0 };
        m.sum += Number(score);
        m.n += 1;
        givenMap.set(user, m);
      }
  
      // average received by the picker
      const avg = avgOf(ratings);
      if (avg != null && v?.picked_by) {
        const r = receivedMap.get(v.picked_by) || { sum: 0, n: 0 };
        r.sum += avg;
        r.n += 1;
        receivedMap.set(v.picked_by, r);
      }
  
      // genres
      const arr = (v?.movie?.genres || []) as Array<{ name: string }>;
      arr.forEach((g) => {
        const name = g?.name?.trim();
        if (name) genreCount.set(name, (genreCount.get(name) || 0) + 1);
      });
  
      // runtime
      const rt = Number((v?.movie as any)?.runtime);
      if (!Number.isNaN(rt) && rt > 0) {
        totalMinutes += rt;
        totalMinutesKnown += 1;
      }
  
      // for top/flop
      if (avg != null) {
        movieStats.push({
          id: v.id,
          title: v?.movie?.title || "Untitled",
          avg,
          votes: entries.length,
          date: v?.started_at ? new Date(v.started_at).getTime() : 0,
        });
      }
    }
  
    // ---- Derived, sorted
    const givenArr = Array.from(givenMap, ([user, { sum, n }]) => ({
      user, avg: sum / Math.max(1, n), count: n,
    })).sort((a, b) => b.count - a.count || a.user.localeCompare(b.user));
  
    const receivedArr = Array.from(receivedMap, ([user, { sum, n }]) => ({
      user, avg: sum / Math.max(1, n), count: n,
    })).sort((a, b) => b.avg - a.avg || b.count - a.count);
  
    const genresArr = Array.from(genreCount, ([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  
    const bestMovies = movieStats.slice().sort((a, b) => b.avg - a.avg || b.votes - a.votes).slice(0, 5);
    const worstMovies = movieStats.slice().sort((a, b) => a.avg - b.avg || b.votes - a.votes).slice(0, 5);
  
    const harshest = givenArr.slice().sort((a, b) => a.avg - b.avg).slice(0, 3);
    const kindest  = givenArr.slice().sort((a, b) => b.avg - a.avg).slice(0, 3);
  
    // Minutes label (with loading state)
    const minutesLabel =
      totalMinutesKnown > 0
        ? `${totalMinutes} min (across ${totalMinutesKnown} movies with known runtime)`
        : isLoading
          ? "Fetching runtimes…"
          : "—";
  
    const LoadingRow = () => (
      <div className="rounded-xl border px-3 py-2 text-sm text-gray-500 dark:border-zinc-700 etdark:text-zinc-400">
        <span className="animate-pulse">Loading…</span>
      </div>
    );
  
    return (
      <div className="grid gap-4">
        {/* KPI row */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <div className="text-xs uppercase text-gray-500 dark:text-zinc-400">Total movies</div>
            <div className="text-2xl font-bold">{history.length}</div>
          </Card>
  
          <Card>
            <div className="text-xs uppercase text-gray-500 dark:text-zinc-400">Minutes watched</div>
            <div className="flex items-center">
              <div className="text-2xl font-bold">{minutesLabel}</div>
              {isLoading && <span className="ml-2 animate-pulse text-lg">⏳</span>}
            </div>
            {(!isLoading && totalMinutesKnown === 0) && (
              <p className="mt-1 text-xs text-gray-500 dark:text-zinc-400">
                No runtime available yet
                {backfillRuntime ? " — will be fetched automatically." : "."}
              </p>
            )}
          </Card>
  
          <Card>
            <div className="text-xs uppercase text-gray-500 dark:text-zinc-400">Distinct genres</div>
            <div className="text-2xl font-bold">{genresArr.length}</div>
          </Card>
  
          <Card>
            <div className="text-xs uppercase text-gray-500 dark:text-zinc-400">Total votes</div>
            <div className="text-2xl font-bold">
              {history.reduce((acc, v) => acc + Object.keys(v?.ratings || {}).length, 0)}
            </div>
          </Card>
        </div>
  
        {/* Most watched genres */}
        <Card>
          <h3 className="mb-3 text-lg font-semibold">🎭 Most watched genres</h3>
          {isLoading && genresArr.length === 0 ? (
            <LoadingRow />
          ) : genresArr.length === 0 ? (
            <div className="text-sm text-gray-600 dark:text-zinc-400">
              No genre data (make sure movies have TMDB genres).
            </div>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {genresArr.slice(0, 12).map((g) => (
                <li
                  key={g.name}
                  className="flex items-center justify-between rounded-xl border bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                >
                  <span>{g.name}</span>
                  <span className="rounded-full border px-2 py-0.5 text-xs dark:border-zinc-700">{g.count}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
  
        {/* Users: most votes / harshest / kindest */}
        <div className="grid gap-3 lg:grid-cols-3">
          <Card>
            <h3 className="mb-3 text-lg font-semibold">🗳️ Most votes given</h3>
            {isLoading && givenArr.length === 0 ? (
              <LoadingRow />
            ) : givenArr.length === 0 ? (
              <div className="text-sm text-gray-600 dark:text-zinc-400">No votes yet.</div>
            ) : (
              <ul className="grid gap-2">
                {givenArr.slice(0, 8).map((u) => (
                  <li
                    key={u.user}
                    className="flex items-center justify-between rounded-xl border bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  >
                    <span className="truncate">{u.user}</span>
                    <span className="text-xs">
                      <b>{u.count}</b> votes · avg <b>{formatScore(u.avg)}</b>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
  
          <Card>
            <h3 className="mb-3 text-lg font-semibold">🥶 Harshest (lowest avg)</h3>
            {isLoading && harshest.length === 0 ? (
              <LoadingRow />
            ) : harshest.length === 0 ? (
              <div className="text-sm text-gray-600 dark:text-zinc-400">N/A</div>
            ) : (
              <ul className="grid gap-2">
                {harshest.map((u) => (
                  <li
                    key={u.user}
                    className="flex items-center justify-between rounded-xl border bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  >
                    <span className="truncate">{u.user}</span>
                    <span className="text-xs">avg <b>{formatScore(u.avg)}</b> · {u.count} votes</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
  
          <Card>
            <h3 className="mb-3 text-lg font-semibold">💖 Kindest (highest avg)</h3>
            {isLoading && kindest.length === 0 ? (
              <LoadingRow />
            ) : kindest.length === 0 ? (
              <div className="text-sm text-gray-600 dark:text-zinc-400">N/A</div>
            ) : (
              <ul className="grid gap-2">
                {kindest.map((u) => (
                  <li
                    key={u.user}
                    className="flex items-center justify-between rounded-xl border bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  >
                    <span className="truncate">{u.user}</span>
                    <span className="text-xs">avg <b>{formatScore(u.avg)}</b> · {u.count} votes</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
  
        {/* Picker: average received on movies they picked */}
        <Card>
          <h3 className="mb-3 text-lg font-semibold">🎬 Avg score received by pickers</h3>
          {isLoading && receivedArr.length === 0 ? (
            <LoadingRow />
          ) : receivedArr.length === 0 ? (
            <div className="text-sm text-gray-600 dark:text-zinc-400">No movies with votes yet.</div>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {receivedArr.map((p) => (
                <li
                  key={p.user}
                  className="flex items-center justify-between rounded-xl border bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                >
                  <span className="truncate">{p.user}</span>
                  <span className="text-xs">
                    avg <b>{formatScore(p.avg)}</b> · {p.count} movies
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
  
        {/* Best / Worst movies */}
        <div className="grid gap-3 lg:grid-cols-2">
          <Card>
            <h3 className="mb-3 text-lg font-semibold">🏆 Top 5 movies</h3>
            {isLoading && bestMovies.length === 0 ? (
              <LoadingRow />
            ) : bestMovies.length === 0 ? (
              <div className="text-sm text-gray-600 dark:text-zinc-400">N/A</div>
            ) : (
              <ol className="grid gap-2">
                {bestMovies.map((m, i) => (
                  <li
                    key={m.id}
                    className="flex items-center justify-between rounded-xl border bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  >
                    <span className="truncate">{i + 1}. {m.title}</span>
                    <span className="text-xs">avg <b>{formatScore(m.avg)}</b> · {m.votes} votes</span>
                  </li>
                ))}
              </ol>
            )}
          </Card>
  
          <Card>
            <h3 className="mb-3 text-lg font-semibold">💔 Flop 5 movies</h3>
            {isLoading && worstMovies.length === 0 ? (
              <LoadingRow />
            ) : worstMovies.length === 0 ? (
              <div className="text-sm text-gray-600 dark:text-zinc-400">N/A</div>
            ) : (
              <ol className="grid gap-2">
                {worstMovies.map((m, i) => (
                  <li
                    key={m.id}
                    className="flex items-center justify-between rounded-xl border bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  >
                    <span className="truncate">{i + 1}. {m.title}</span>
                    <span className="text-xs">avg <b>{formatScore(m.avg)}</b> · {m.votes} votes</span>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>
  
        {/* Runtime note */}
        <p className="text-xs text-gray-500 dark:text-zinc-400">
          * Total minutes only consider movies with <code>runtime</code> known from TMDB.
        </p>
      </div>
    );
}
  