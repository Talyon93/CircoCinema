import React from "react";
import { InfoBadge } from "./InfoBadge";
import { formatScore } from "../../../../Utils/Utils";
import { Card } from "../../../../Components/UI/Card";
import { Activity } from "lucide-react";

/* Utility: risolve l’URL poster da campi comuni (tmdb/omdb/local) */
function resolvePoster(h: any): string | null {
  const m = h?.movie ?? h;
  const candidates = [
    m?.poster_url,
    m?.poster,
    m?.posterUrl,
    m?.imdb?.poster,
    m?.meta?.poster,
    m?.tmdb?.poster_path,
    m?.poster_path,
  ].filter(Boolean);

  if (!candidates.length) return null;
  const raw = String(candidates[0]);

  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("/")) return `https://image.tmdb.org/t/p/w154${raw}`;

  return raw;
}

export function RecentActivityCard({
  selectedUser,
  history,
}: {
  selectedUser: string;
  history: any[];
}) {
  const norm = (s?: string) => (s ?? "").trim().toLowerCase();
  const isPickedBy = (h: any) =>
    norm(
      h?.picked_by ??
        h?.pickedBy ??
        h?.picker ??
        h?.movie?.picked_by ??
        h?.movie?.pickedBy ??
        ""
    ) === norm(selectedUser);

  const orderKey = (h: any, i: number) => {
    const ts = Date.parse(h?.started_at || h?.date || h?.created_at || "");
    return Number.isFinite(ts) && ts > 0 ? ts : i;
  };

  const sorted = React.useMemo(
    () => history.slice().sort((a, b) => orderKey(b, 0) - orderKey(a, 0)),
    [history]
  );

  const lastVote = React.useMemo(
    () => sorted.find((h) => Number.isFinite(Number(h?.ratings?.[selectedUser]))),
    [sorted, selectedUser]
  );
  const lastPick = React.useMemo(() => sorted.find(isPickedBy), [sorted]);

  const now = Date.now();
  const d30 = 30 * 24 * 60 * 60 * 1000;
  const votes30 = sorted.filter((h) => {
    const t = Date.parse(h?.started_at || h?.date || h?.created_at || "");
    const v = Number(h?.ratings?.[selectedUser]);
    return Number.isFinite(t) && now - t <= d30 && Number.isFinite(v);
  }).length;

  const myPicks = history.filter(isPickedBy);
  const pickWins = myPicks.filter((h) => {
    const vals = Object.values(h?.ratings ?? {})
      .map(Number)
      .filter(Number.isFinite);
    if (!vals.length) return false;
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    return avg >= 8;
  }).length;

  const ScorePill = ({ val }: { val: number }) => (
    <span
      className={`rounded-md px-2 py-0.5 text-xs font-semibold leading-none shadow-sm
      ${
        val >= 8
          ? "bg-green-600/25 text-green-300 ring-1 ring-inset ring-green-500/30"
          : val < 6
          ? "bg-red-600/25 text-red-300 ring-1 ring-inset ring-red-500/30"
          : "bg-zinc-700/60 text-zinc-200 ring-1 ring-inset ring-zinc-600/60"
      }`}
    >
      {formatScore(val)}
    </span>
  );

  const PosterThumb = ({ h }: { h: any }) => {
    const url = resolvePoster(h);
    return (
      <div className="relative h-14 w-10 overflow-hidden rounded-md bg-zinc-800 ring-1 ring-zinc-700/60">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="h-full w-full animate-pulse bg-zinc-700/50" />
        )}
      </div>
    );
  };

  const Line = ({
    label,
    item,
    value,
  }: {
    label: string;
    item: any | null | undefined;
    value: number | null;
  }) => (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <PosterThumb h={item} />
        <div className="min-w-0">
          <div className="truncate text-[13px] font-medium text-zinc-200">
            {item?.movie?.title || "—"}
          </div>
          <div className="text-xs text-zinc-400">{label}</div>
        </div>
      </div>
      <div className="shrink-0">{value != null ? <ScorePill val={value} /> : "—"}</div>
    </div>
  );

  const lastVoteVal =
    lastVote && Number.isFinite(Number(lastVote?.ratings?.[selectedUser]))
      ? Number(lastVote.ratings[selectedUser])
      : null;

  const lastPickAvg = (() => {
    if (!lastPick) return null;
    const vals = Object.values(lastPick?.ratings ?? {})
      .map(Number)
      .filter(Number.isFinite);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  })();

  return (
     <Card spaced={false}>
      <Card.Header
        icon={<Activity className="h-4 w-4" />}
        title="Recent Activity"
        subtitle="Last 30 days"
        info={<InfoBadge text="Ultimo voto, ultima pick e attività degli ultimi 30 giorni." />}
      />

      {/* Body: container scuro; nessun fondo chiaro qui */}
      <Card.Section padding="md" inset tone="base" className="mt-1">
        <div className="grid gap-3">
          <Line label="Last vote" item={lastVote} value={lastVoteVal} />
          <Line label="Last pick" item={lastPick} value={lastPickAvg} />
        </div>
      </Card.Section>

      {/* Footer KPI: solo i box interni hanno il fondo chiaro */}
      <Card.Section padding="md" inset tone="base" divider="top" className="mt-1">
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div className="rounded-lg bg-white/[0.02] p-3 text-center ring-1 ring-inset ring-zinc-700/50">
            <div className="text-xs text-zinc-400">Votes (30d)</div>
            <div className="mt-1 text-lg font-bold text-zinc-100">{votes30}</div>
          </div>
          <div className="rounded-lg bg-white/[0.02] p-3 text-center ring-1 ring-inset ring-zinc-700/50">
            <div className="text-xs text-zinc-400">Total picks</div>
            <div className="mt-1 text-lg font-bold text-zinc-100">{myPicks.length}</div>
          </div>
          <div className="rounded-lg bg-white/[0.02] p-3 text-center ring-1 ring-inset ring-zinc-700/50">
            <div className="text-xs text-zinc-400">Pick wins ≥8</div>
            <div className="mt-1 text-lg font-bold text-zinc-100">{pickWins}</div>
          </div>
        </div>
      </Card.Section>
    </Card>
  );
}
