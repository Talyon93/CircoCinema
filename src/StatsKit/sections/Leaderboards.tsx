// sections/Leaderboards.tsx
import React from "react";
import { Card } from "../../Components/UI/Card";
import { AvatarInline } from "../../Components/UI/Avatar";
import { StarIcon, FireIcon, HeartIcon } from "@heroicons/react/24/outline";
import { formatScore } from "../../Utils/Utils";
import { ProgressBar } from "../ui/ProgressBar";

export function Leaderboards({
  givenArr,
  isLoading,
}: {
  givenArr: Array<{ user: string; avg: number; count: number }>;
  isLoading?: boolean;
}) {
  const LoadingRow = () => (
    <div className="rounded-xl border px-3 py-2 text-sm text-gray-500 dark:border-zinc-700 dark:text-zinc-400">
      <span className="animate-pulse">Loading…</span>
    </div>
  );

  // Top 5 per categoria
  const mostGiven = givenArr.slice().sort((a, b) => b.count - a.count).slice(0, 5);
  const harshest = givenArr.slice().sort((a, b) => a.avg - b.avg).slice(0, 5);
  const kindest  = givenArr.slice().sort((a, b) => b.avg - a.avg).slice(0, 5);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {/* Most votes given */}
      <Card>
        <h3 className="flex items-center gap-2 text-lg font-semibold">
          <StarIcon className="h-5 w-5" />
          Most votes given
        </h3>
        {isLoading && givenArr.length === 0 ? (
          <LoadingRow />
        ) : mostGiven.length === 0 ? (
          <div className="text-sm text-zinc-500">No votes yet.</div>
        ) : (
          <ul className="grid gap-2">
            {mostGiven.map((u) => (
              <li
                key={u.user}
                className="flex items-center justify-between rounded-xl border bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <AvatarInline name={u.user} size={20} />
                  <span className="truncate">{u.user}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs">
                    <b>{u.count}</b> · avg <b>{formatScore(u.avg)}</b>
                  </span>
                  <ProgressBar value={u.avg} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Harshest */}
      <Card>
        <h3 className="flex items-center gap-2 text-lg font-semibold">
          <FireIcon className="h-5 w-5 text-rose-500" />
          Harshest
        </h3>
        {isLoading && givenArr.length === 0 ? (
          <LoadingRow />
        ) : (
          <ul className="grid gap-2">
            {harshest.map((u) => (
              <li
                key={u.user}
                className="flex items-center justify-between rounded-xl border bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <AvatarInline name={u.user} size={20} />
                  <span className="truncate">{u.user}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs">
                    avg <b>{formatScore(u.avg)}</b> · {u.count}
                  </span>
                  <ProgressBar value={u.avg} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Kindest */}
      <Card>
        <h3 className="flex items-center gap-2 text-lg font-semibold">
          <HeartIcon className="h-5 w-5 text-emerald-500" />
          Kindest
        </h3>
        {isLoading && givenArr.length === 0 ? (
          <LoadingRow />
        ) : (
          <ul className="grid gap-2">
            {kindest.map((u) => (
              <li
                key={u.user}
                className="flex items-center justify-between rounded-xl border bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <AvatarInline name={u.user} size={20} />
                  <span className="truncate">{u.user}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs">
                    avg <b>{formatScore(u.avg)}</b> · {u.count}
                  </span>
                  <ProgressBar value={u.avg} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
