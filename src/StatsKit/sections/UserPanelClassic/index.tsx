// ===============================
// filepath: src/StatsKit/sections/UserPanelClassic/index.tsx
// ===============================
import React, { Fragment } from "react";
import { Card } from "../../../Components/UI/Card";
import { AvatarInline } from "../../../Components/UI/Avatar";
import { Donut } from "../../ui/Donut";
import { Listbox, Transition } from "@headlessui/react";
import { CheckIcon, ChevronUpDownIcon } from "@heroicons/react/20/solid";

// Cards
import { OldStyleCompareCard } from "./parts/OldStyleCompareCard";
import { TopReceivedCard } from "./parts/TopReceivedCard";
import { TopLovedCard } from "./parts/TopListCard";
import { RecentActivityCard } from "./parts/RecentActivityCard";
import { MilestonesCard } from "./parts/MilestonesCard";
import { AffinityCard } from "./parts/AffinityCard";
import { InfoBadge } from "./parts/InfoBadge";
import { ControversialPickCard } from "./parts/ControversialPickCard";
import { OutlierList } from "./parts/OutlierList";

import {
  BarChart3,
  Clapperboard,
  LineChart,
  Users2,
  Award,
  Trophy,
  AlertTriangle,
  AlertOctagon,
  History,
  Handshake,
  CalendarRange,
  Timer,
  Globe2,
  FlaskConical,
  Heart,
  Tags,
} from "lucide-react";

// Charts
import { Histogram } from "../../charts/Histogram";
import { Sparkline } from "../../charts/Sparkline";

// Utils
import {
  buildYearDistribution,
  yearsSummary,
  averageRuntime,
  averageImdbForPicks,
  buildTopRated,
  affinityWithOthers,
  userVsCrowdAverages,
  buildVotesGiven,
  buildVotesReceived,
  collectReceivedVotesOnPicks,
} from "../../../Utils/stats";
import { runtimeBuckets, countryDistribution } from "../../../Utils/country";
import { refScoreFor } from "../../../Utils/history";

export type GivenRow = { user: string; avg: number; count: number; scores: number[] };
export type ReceivedRow = { user: string; avg: number; count: number };




type Props = {
  history: any[];
  givenArr: GivenRow[];
  receivedArr: ReceivedRow[];
  userGenreLikes: Map<string, Map<string, { pos: number; tot: number }>>;
  selectedUser: string | null;
  onSelectUser: (u: string | null) => void;
  userOptions: string[];
  below?: React.ReactNode;
  selectorHidden?: boolean;
};

// palette for bar lists
const BAR_COLORS = [
  "bg-emerald-400", "bg-sky-400", "bg-violet-400", "bg-fuchsia-400",
  "bg-amber-400", "bg-rose-400", "bg-cyan-400", "bg-lime-400",
];

function SectionBox({
  title,
  icon,
  className = "",
  children,
}: {
  title: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={[
        "rounded-xl border border-zinc-700/60 bg-zinc-900/40 p-4",
        "space-y-4",
        className,
      ].join(" ")}
    >
      <h2 className="flex items-center gap-2 text-base font-semibold text-zinc-100">
        {icon}
        <span>{title}</span>
      </h2>
      {children}
    </section>
  );
}

// bar-list simple
function BarList({
  items,
  labelWidth = 100,
}: {
  items: Array<{ name: string; count: number }>;
  labelWidth?: number;
}) {
  if (!items.length) return <div className="text-sm text-zinc-500">—</div>;
  const max = Math.max(...items.map((x) => x.count), 1);
  return (
    <div className="flex flex-col gap-2">
      {items.map((it, idx) => {
        const pct = Math.max(4, Math.round((it.count / max) * 100));
        return (
          <div key={it.name} className="flex items-center gap-2">
            <div style={{ width: labelWidth }} className="shrink-0 truncate text-xs text-zinc-300">
              {it.name}
            </div>
            <div className="h-1.5 w-full rounded bg-zinc-800">
              <div
                className={`h-1.5 rounded ${BAR_COLORS[idx % BAR_COLORS.length]}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="w-6 text-right text-xs text-zinc-400">{it.count}</div>
          </div>
        );
      })}
    </div>
  );
}

// fallback for IMDb/TMDb ref score
function refFromItem(h: any): number | null {
  try {
    const r1: any = (refScoreFor as any)?.(h);
    if (Number.isFinite(Number(r1))) return Number(r1);
  } catch { }
  try {
    const r2: any = (refScoreFor as any)?.(h?.movie);
    if (Number.isFinite(Number(r2))) return Number(r2);
  } catch { }
  const m = h?.movie ?? h;
  const cand =
    m?.imdb_rating ??
    m?.imdbRating ??
    m?.imdb_score ??
    m?.ratings?.imdb ??
    m?.omdb?.imdbRating ??
    m?.vote_average;
  const n = Number(cand);
  return Number.isFinite(n) ? n : null;
}

export function UserPanelClassic({
  history,
  givenArr,
  receivedArr,
  userGenreLikes,
  selectedUser,
  onSelectUser,
  userOptions,
  below,
  selectorHidden
}: Props) {
  // aggregates
  const selGiven = React.useMemo(
    () => (selectedUser ? givenArr.find((u) => u.user === selectedUser) : undefined),
    [selectedUser, givenArr]
  );
  const selReceived = React.useMemo(
    () => (selectedUser ? receivedArr.find((u) => u.user === selectedUser) : undefined),
    [selectedUser, receivedArr]
  );

  // picks distributions
  const yearDist = React.useMemo(
    () => (selectedUser ? buildYearDistribution(history, selectedUser) : []),
    [history, selectedUser]
  );
  const { avg: avgYear, min: minYear, max: maxYear } = React.useMemo(
    () => (selectedUser ? yearsSummary(history, selectedUser) : { avg: null, min: null, max: null }),
    [history, selectedUser]
  );

  const avgImdbPicks = React.useMemo(
    () => (selectedUser ? averageImdbForPicks(history, selectedUser) : null),
    [history, selectedUser]
  );
  const topRatedPicks = React.useMemo(
    () => (selectedUser ? buildTopRated(history, selectedUser) : []),
    [history, selectedUser]
  );
  const avgRt = React.useMemo(
    () => (selectedUser ? averageRuntime(history, selectedUser) : null),
    [history, selectedUser]
  );

  const runtimeDist = React.useMemo(
    () => (selectedUser ? runtimeBuckets(history, selectedUser) : []),
    [history, selectedUser]
  );
  const countries = React.useMemo(
    () => (selectedUser ? countryDistribution(history, selectedUser) : []),
    [history, selectedUser]
  );

  // affinities and comparisons (watched)
  const affinity = React.useMemo(
    () => (selectedUser ? affinityWithOthers(history, selectedUser) : { most: [], least: [] }),
    [history, selectedUser]
  );
  const { avgUser, avgCrowd } = React.useMemo(
    () => (selectedUser ? userVsCrowdAverages(history, selectedUser) : { avgUser: null, avgCrowd: null }),
    [history, selectedUser]
  );

  // series
  const sparkGiven = React.useMemo(
    () => (selectedUser ? buildVotesGiven(history, selectedUser) : []),
    [history, selectedUser]
  );
  const sparkReceived = React.useMemo(
    () => (selectedUser ? buildVotesReceived(history, selectedUser) : []),
    [history, selectedUser]
  );
  const receivedVotes = React.useMemo(
    () => (selectedUser ? collectReceivedVotesOnPicks(history, selectedUser, false) : []),
    [history, selectedUser]
  );

  // IMDb bias (picks)
  const imdbBiasSpark = React.useMemo(() => {
    if (!selectedUser) return [];
    const picks = history
      .map((h, i) => ({ h, i }))
      .filter(({ h }) => (h?.picked_by ?? h?.pickedBy) === selectedUser);

    const out: Array<{ t: number; val: number; title?: string; label?: string }> = [];
    for (const { h, i } of picks) {
      const vals = Object.values(h?.ratings ?? {}).map(Number).filter(Number.isFinite);
      if (!vals.length) continue;
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
      const ref = refFromItem(h);
      if (ref == null) continue;
      out.push({
        t: i,
        val: Math.round((avg - ref) * 100) / 100,
        title: h?.movie?.title,
        label: `avg ${avg.toFixed(2)} · ref ${ref.toFixed(2)}`,
      });
    }
    return out;
  }, [history, selectedUser]);

  // Pick win-rate (≥8)
  const winRateSpark = React.useMemo(() => {
    if (!selectedUser) return [];
    const picks = history
      .map((h, i) => ({ h, i }))
      .filter(({ h }) => (h?.picked_by ?? h?.pickedBy) === selectedUser);
    const out: Array<{ t: number; val: number }> = [];
    let wins = 0;
    let tot = 0;
    for (const { h, i } of picks) {
      const vals = Object.values(h?.ratings ?? {}).map(Number).filter(Number.isFinite);
      if (!vals.length) continue;
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
      tot += 1;
      if (avg >= 8) wins += 1;
      out.push({ t: i, val: Math.round((wins / tot) * 100) });
    }
    return out;
  }, [history, selectedUser]);

  // WATCHED: favourite genres (scores ≥ 8)
  const favouriteGenres = React.useMemo(() => {
    if (!selectedUser) return [];
    const m = userGenreLikes.get(selectedUser) || new Map<string, { pos: number; tot: number }>();
    return Array.from(m, ([name, v]) => ({ name, count: v.pos }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
      .slice(0, 9);
  }, [selectedUser, userGenreLikes]);

  // WATCHED: top loved by this user (from their own votes)
  const topLoved = React.useMemo(() => {
    if (!selectedUser) return [];
    type Row = { title: string; score: number };
    const out: Row[] = [];
    for (const h of history) {
      const r = Number(h?.ratings?.[selectedUser]);
      if (!Number.isFinite(r)) continue;
      const title = h?.movie?.title || h?.title || "Untitled";
      out.push({ title, score: r });
    }
    return out.sort((a, b) => b.score - a.score).slice(0, 5);
  }, [history, selectedUser]);

  // Brought: film by decade (from yearDist)
  const decadeDist = React.useMemo(() => {
    const acc: Record<string, number> = {};
    for (const y of yearDist) {
      const yy = Number(y.name);
      if (!Number.isFinite(yy)) continue;
      const d = `${Math.floor(yy / 10) * 10}s`;
      acc[d] = (acc[d] || 0) + Number(y.count);
    }
    return Object.entries(acc)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => Number(a.name.slice(0, -1)) - Number(b.name.slice(0, -1)));
  }, [yearDist]);

  // WATCHED: median given (for section header)
  const medianGiven = React.useMemo(() => {
    const arr = (selGiven?.scores || []).slice().sort((a, b) => a - b);
    const n = arr.length;
    if (!n) return null;
    return n % 2 ? arr[(n - 1) / 2] : (arr[n / 2 - 1] + arr[n / 2]) / 2;
  }, [selGiven]);

  // ===== GENERAL EXTRAS =====
  const watchedViews = React.useMemo(() => {
    if (!selectedUser) return [];
    return history.filter((h) => Number.isFinite(Number(h?.ratings?.[selectedUser])));
  }, [history, selectedUser]);

  const picksViews = React.useMemo(() => {
    if (!selectedUser) return [];
    return history.filter((h) => (h?.picked_by ?? h?.pickedBy) === selectedUser);
  }, [history, selectedUser]);

  const watchedCount = watchedViews.length;
  const picksCount = picksViews.length;

  const givenScores = selGiven?.scores || [];
  const avgGiven = givenScores.length ? givenScores.reduce((a, b) => a + b, 0) / givenScores.length : null;
  const stdGiven = React.useMemo(() => {
    if (!givenScores.length) return null;
    const m = avgGiven || 0;
    const v = givenScores.reduce((acc, x) => acc + Math.pow(x - m, 2), 0) / givenScores.length;
    return Math.sqrt(v);
  }, [givenScores, avgGiven]);

  // generosity/harshness (share of >=8 and <=5)
  const generosity = React.useMemo(() => {
    if (!givenScores.length) return null;
    const c = givenScores.filter((x) => x >= 8).length;
    return Math.round((c / givenScores.length) * 100);
  }, [givenScores]);
  const harshness = React.useMemo(() => {
    if (!givenScores.length) return null;
    const c = givenScores.filter((x) => x <= 5).length;
    return Math.round((c / givenScores.length) * 100);
  }, [givenScores]);

  // scope: co-raters per pick avg
  const avgRatersPerPick = React.useMemo(() => {
    if (!picksViews.length) return null;
    const sum = picksViews.reduce((acc, h) => acc + Object.values(h?.ratings ?? {}).filter(Number.isFinite).length, 0);
    return Math.round((sum / picksViews.length) * 10) / 10;
  }, [picksViews]);

  // best/worst vs IMDb among picks
  const pickDeltas = React.useMemo(() => {
    const arr: Array<{ title: string; delta: number }> = [];
    for (const h of picksViews) {
      const vals = Object.values(h?.ratings ?? {}).map(Number).filter(Number.isFinite);
      if (!vals.length) continue;
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
      const ref = refFromItem(h);
      if (ref == null) continue;
      arr.push({ title: h?.movie?.title || h?.title || "Untitled", delta: Math.round((avg - ref) * 100) / 100 });
    }
    const best = [...arr].sort((a, b) => b.delta - a.delta).slice(0, 5);
    const worst = [...arr].sort((a, b) => a.delta - b.delta).slice(0, 5);
    return { best, worst };
  }, [picksViews]);

  // most controversial pick (highest stdev of ratings)
  const controversialPick = React.useMemo(() => {
    let best: {
      title: string; stdev: number; ratings: number[]; votes: { user: string; score: number }[];
      avg: number; ref?: number | null; poster_path?: string; poster_url?: string;
    } | null = null;

    for (const h of picksViews) {
      const entries = Object.entries(h?.ratings ?? {})
        .map(([u, v]) => ({ user: u, score: Number(v) }))
        .filter((x) => Number.isFinite(x.score));

      if (entries.length < 2) continue;

      const vals = entries.map((e) => e.score);
      const m = vals.reduce((a, b) => a + b, 0) / vals.length;
      const st =
        Math.sqrt(vals.reduce((acc, x) => acc + Math.pow(x - m, 2), 0) / vals.length);

      const ref = refFromItem(h);
      const movie = h?.movie ?? {};
      const rawPoster = movie.poster_url || movie.poster || movie.posterPath || movie.poster_path;

      const candidate = {
        title: movie.title || h?.title || "Untitled",
        stdev: Math.round(st * 100) / 100,
        ratings: vals,
        votes: entries,                         // ⬅️ pass voters
        avg: m,
        ref: ref == null ? null : Number(ref),
        poster_url: rawPoster?.startsWith?.("http") ? rawPoster : undefined,
        poster_path: !rawPoster?.startsWith?.("http") ? rawPoster : undefined,
      };

      if (!best || candidate.stdev > best.stdev) best = candidate;
    }
    return best;
  }, [picksViews]);

return (
  <div className="space-y-5 md:space-y-6">
    {/* ===================== 1) General ===================== */}
    <SectionBox
      title="General"
      icon={<BarChart3 className="h-4 w-4" />}
      className="space-y-3 md:space-y-4"
    >
      {/* user selector */}
      {!selectorHidden && userOptions?.length > 1 && (
        <div className="flex w-full justify-center">
          <div className="w-80 md:w-96">
            <Listbox value={selectedUser ?? ""} onChange={(val) => onSelectUser(val || null)}>
              <div className="relative">
                <Listbox.Button className="relative w-full cursor-default rounded-xl border border-zinc-700 bg-zinc-900 py-2.5 pl-4 pr-12 text-left text-base shadow-md focus:outline-none focus-visible:border-sky-500 focus-visible:ring-2 focus-visible:ring-sky-500/40">
                  <span className="flex items-center gap-2">
                    {selectedUser && <AvatarInline name={selectedUser} size={22} />}
                    <span className="truncate">{selectedUser || "Select user"}</span>
                  </span>
                  <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                    <ChevronUpDownIcon className="h-5 w-5 text-zinc-400" aria-hidden="true" />
                  </span>
                </Listbox.Button>

                <Transition as={Fragment} leave="transition ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
                  <Listbox.Options className="absolute z-50 mt-2 max-h-72 w-full overflow-auto rounded-xl border border-zinc-700 bg-zinc-900 p-1 text-sm shadow-2xl ring-1 ring-black/5 focus:outline-none">
                    {userOptions.map((u, idx) => (
                      <Listbox.Option
                        key={idx}
                        value={u}
                        className={({ active }) =>
                          `relative cursor-default select-none rounded-lg px-3 py-2 ${active ? "bg-sky-600 text-white" : "text-zinc-200"}`
                        }
                      >
                        {({ selected, active }) => (
                          <div className="flex items-center gap-2">
                            <AvatarInline name={u} size={20} />
                            <span className={`truncate ${selected ? "font-medium" : ""}`}>{u}</span>
                            {selected && <CheckIcon className={`ml-auto h-4 w-4 ${active ? "text-white" : "text-sky-400"}`} />}
                          </div>
                        )}
                      </Listbox.Option>
                    ))}
                  </Listbox.Options>
                </Transition>
              </div>
            </Listbox>
          </div>
        </div>
      )}

      {!selectedUser && <div className="text-sm text-zinc-500">No user selected.</div>}

      {selectedUser && (
        <div className="grid gap-3 md:gap-4">
          <MilestonesCard
            selectedUser={selectedUser}
            history={history}
            countryDist={countries}
            yearDist={yearDist}
            minYear={minYear}
            maxYear={maxYear}
            userGenreLikes={userGenreLikes}
            avgImdbPicks={avgImdbPicks}
          />

          {/* 2 colonne – azzero i mx dei figli */}
          <div className="grid gap-3 md:gap-4 lg:grid-cols-2 [&>*]:mx-0">
            <OutlierList title="Best picks vs IMDb" items={pickDeltas.best} positive numbers={3} />
            <OutlierList title="Worst picks vs IMDb" items={pickDeltas.worst} positive={false} numbers={3} />
          </div>

          {/* 2 colonne – azzero i mx dei figli */}
          <div className="grid gap-3 md:gap-4 lg:grid-cols-2 [&>*]:mx-0">
            <ControversialPickCard data={controversialPick || undefined} />
            <RecentActivityCard selectedUser={selectedUser} history={history} />
          </div>

          <AffinityCard affinity={affinity} />

          {below}
        </div>
      )}
    </SectionBox>

    {selectedUser && (
      <>
        {/* ============== 2) Films chosen (picks) ============== */}
        <SectionBox
          title="Films chosen (picks)"
          icon={<Clapperboard className="h-4 w-4" />}
          className="space-y-3 md:space-y-4"
        >
          {/* 2 colonne – azzero i mx dei figli */}
          <div className="grid gap-3 md:gap-4 lg:grid-cols-2 [&>*]:mx-0">
            <OldStyleCompareCard
              title="Avg received vs IMDb"
              leftLabel="Received"
              leftValue={selReceived?.avg ?? null}
              rightLabel="IMDb"
              rightValue={avgImdbPicks ?? null}
              hint="Average score received by this user's picks vs IMDb reference."
            />
            <TopReceivedCard
              topRatedPicks={topRatedPicks}
              avgRt={avgRt}
              avgYear={avgYear}
              minYear={minYear}
              maxYear={maxYear}
            />
          </div>

          <Card spaced={false}>
            <Card.Header
              title="Votes received"
              subtitle="Distribution (mean per pick)"
              icon={<BarChart3 className="h-4 w-4" />}
              info={<InfoBadge text="…" />}
            />
            <Card.Section inset tone="muted">
              {receivedVotes.length ? <Histogram values={receivedVotes} embedded /> : <div className="text-sm text-zinc-500">—</div>}
            </Card.Section>
          </Card>

          <Card spaced={false}>
            <Card.Header
              title="Films by decade (picks)"
              subtitle={yearDist.length ? `avg ${avgYear ?? "—"} — oldest ${minYear ?? "—"} — newest ${maxYear ?? "—"}` : "—"}
            />
            <Card.Section>
              {decadeDist.length === 0 ? <div className="text-sm text-zinc-500">—</div> : <BarList items={decadeDist} labelWidth={60} />}
            </Card.Section>
          </Card>

          {/* 2 colonne – azzero i mx dei figli */}
          <div className="grid gap-3 md:gap-4 md:grid-cols-2 [&>*]:mx-0">
            <Card spaced={false}>
              <Card.Header title="Runtime buckets (picks)" info={<InfoBadge text="Breakdown by runtime for this user's picks." />} />
              <Card.Section>
                {runtimeDist.length === 0 ? (
                  <div className="text-sm text-zinc-500">—</div>
                ) : (
                  <BarList items={runtimeDist.map((x: any) => ({ name: String(x.name), count: Number(x.count) || 0 }))} labelWidth={96} />
                )}
              </Card.Section>
            </Card>

            <Card spaced={false}>
              <Card.Header title="Countries (picks)" info={<InfoBadge text="Most frequent countries among their picks." />} />
              <Card.Section>
                {countries.length === 0 ? (
                  <div className="text-sm text-zinc-500">—</div>
                ) : (
                  <BarList
                    items={countries.slice(0, 10).map((x: any) => ({ name: String(x.name), count: Number(x.count) || 0 }))}
                    labelWidth={96}
                  />
                )}
              </Card.Section>
            </Card>
          </div>

          {/* 3 colonne – azzero i mx dei figli */}
          <div className="grid gap-3 md:gap-4 md:grid-cols-3 [&>*]:mx-0">
            <Card spaced={false}>
              <Card.Header title="Votes received — timeline" subtitle="mean per pick" icon={<LineChart className="h-4 w-4" />} />
              <Card.Section>
                <Sparkline data={sparkReceived} mode="avg" height={100} />
              </Card.Section>
            </Card>

            <Card spaced={false}>
              <Card.Header
                title="IMDb bias — timeline"
                info={<InfoBadge text="Difference between internal average and IMDb reference for each pick." />}
              />
              <Card.Section>
                <Sparkline
                  data={imdbBiasSpark}
                  mode="delta"
                  height={100}
                  yDomain={[-1.5, 1.5]}
                  zeroLine
                  bands={[{ from: -1.0, to: 1.0, className: "fill-current text-zinc-600/20" }]}
                />
              </Card.Section>
            </Card>

            <Card spaced={false}>
              <Card.Header title="Pick win-rate — timeline (≥ 8)" />
              <Card.Section>
                <Sparkline data={winRateSpark} mode="percent" height={100} />
              </Card.Section>
            </Card>
          </div>
        </SectionBox>

        {/* ==================== 3) Films voted ==================== */}
        <SectionBox
          title="Films voted"
          icon={<LineChart className="h-4 w-4" />}
          className="space-y-3 md:space-y-4"
        >
          {/* 2 colonne – azzero i mx dei figli */}
          <div className="grid gap-3 md:gap-4 lg:grid-cols-2 [&>*]:mx-0">
            <OldStyleCompareCard
              title="User vs Crowd (co-rated)"
              leftLabel="User avg"
              leftValue={avgUser}
              rightLabel="Crowd avg"
              rightValue={avgCrowd}
              hint="Average of this user's votes vs overall average on the same movies."
            />
            <TopLovedCard items={topLoved} />
          </div>

          <Card spaced={false}>
            <Card.Header
              title="Score distribution"
              icon={<BarChart3 className="h-4 w-4" />}
              info={
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-500">(rounded to 1..10)</span>
                  <InfoBadge text="Distribution of the scores this user gives to movies." />
                </div>
              }
            />
            <Card.Section>
              <Histogram values={selGiven?.scores || []} />
            </Card.Section>
          </Card>

          <Card spaced={false}>
            <Card.Header title="Favourite genres (scores ≥ 8)" info={<InfoBadge text="Genres most often rated ≥ 8 by this user." />} />
            <Card.Section>
              {favouriteGenres.length === 0 ? (
                <div className="text-sm text-zinc-500">—</div>
              ) : (
                <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                  {favouriteGenres.map((g, idx) => (
                    <div key={g.name}>
                      <div className="flex items-center justify-between text-xs text-zinc-300">
                        <span className="truncate">{g.name}</span>
                        <span className="ml-2 text-zinc-500">{g.count}</span>
                      </div>
                      <div className="mt-1 h-1.5 w-full rounded bg-zinc-800">
                        <div className={`h-1.5 rounded ${BAR_COLORS[idx % BAR_COLORS.length]}`} style={{ width: `${Math.min(100, g.count * 14)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card.Section>
          </Card>

          {/* 2 colonne – azzero i mx dei figli */}
          <div className="grid gap-3 md:gap-4 lg:grid-cols-1 [&>*]:mx-0">
            <Card spaced={false}>
              <Card.Header
                title="Votes given — timeline"
                icon={<LineChart className="h-4 w-4" />}
                info={<InfoBadge text="Trend of this user's given scores over time." />}
              />
              <Card.Section>
                <Sparkline data={sparkGiven} mode="avg" height={120} yDomain={[2, 10]} />
              </Card.Section>
            </Card>
            {/* eventuale secondo pannello → stessa grid */}
          </div>
        </SectionBox>
      </>
    )}
  </div>
);


}

export default UserPanelClassic;
