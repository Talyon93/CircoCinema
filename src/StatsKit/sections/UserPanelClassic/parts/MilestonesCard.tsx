// StatsKit/sections/UserPanelClassic/parts/MilestonesCard.tsx
import React from "react";
import { InfoBadge } from "./InfoBadge";
import { Film, Trophy, Globe2, CalendarRange, Target } from "lucide-react";
import { Card } from "../../../../Components/UI/Card";

export function MilestonesCard({
  selectedUser,
  history,
  countryDist,
  yearDist,
  minYear,
  maxYear,
  userGenreLikes,
  avgImdbPicks,
}: {
  selectedUser: string;
  history: any[];
  countryDist: { name: string; count: number }[];
  yearDist: { name: string; count: number }[];
  minYear: number | null;
  maxYear: number | null;
  userGenreLikes: Map<string, Map<string, { pos: number; tot: number }>>;
  avgImdbPicks: number | null;
}) {
  const nf = (n: number) => new Intl.NumberFormat("en-US").format(n);

  const ratedCount = React.useMemo(
    () =>
      history.filter((h) =>
        Number.isFinite(Number(h?.ratings?.[selectedUser]))
      ).length,
    [history, selectedUser]
  );

  const picksCount = React.useMemo(
    () => history.filter((h) => (h?.picked_by ?? h?.pickedBy) === selectedUser).length,
    [history, selectedUser]
  );

  const selGenres = React.useMemo(() => {
    const m =
      userGenreLikes.get(selectedUser) ||
      new Map<string, { pos: number; tot: number }>();
    return Array.from(m, ([name, v]) => ({ name, count: v.pos, tot: v.tot }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
      .slice(0, 9);
  }, [selectedUser, userGenreLikes]);

  const topGenre = selGenres[0]?.name ?? "—";
  const genresCount = selGenres?.length ?? 0;
  const countriesCount = countryDist.length || 0;
  const hasYears = yearDist.length > 0 && minYear != null && maxYear != null;

const Kpi = ({
  icon: Icon,
  label,
  value,
}: {
  icon: any;
  label: string;
  value: string | number | React.ReactNode;
}) => (
  <div className="rounded-xl bg-white/[0.02] ring-1 ring-inset ring-zinc-800/60 px-3 py-2">
    <div className="mb-1 flex items-center gap-2 text-[11px] uppercase tracking-wide text-zinc-500">
      <Icon className="h-3.5 w-3.5 text-zinc-400" />
      {label}
    </div>
    <div className="font-semibold tabular-nums">{value}</div>
  </div>
);

  return (
    <Card spaced={false}>
  <Card.Header
    icon={<Target className="h-4 w-4" />}
    title="Milestones & scope"
    subtitle="Overview"
    info={<InfoBadge text="Panoramica sintetica: film votati, picks, paesi e copertura anni." />}
  />

      {/* KPI grid */}
      <Card.Section padding="md" inset tone="base" className="mt-1">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <Kpi icon={Film} label="Movies rated" value={nf(ratedCount)} />
          <Kpi icon={Trophy} label="Picks total" value={nf(picksCount)} />
          <Kpi icon={Globe2} label="Countries" value={nf(countriesCount)} />
          <Kpi
            icon={CalendarRange}
            label="Years span"
            value={
              hasYears ? (
                <span className="font-semibold">
                  <span className="tracking-tight">{minYear}</span>
                  <span className="px-1 text-zinc-500">–</span>
                  <span className="tracking-tight">{maxYear}</span>
                </span>
              ) : (
                "—"
              )
            }
          />
        </div>
      </Card.Section>

      {/* Secondary info chips */}
      <Card.Section padding="md" inset={false} tone="base" className="mt-1">
        <div className="grid grid-cols-1 gap-2 text-[12px] text-zinc-400 sm:grid-cols-3">
          <div className="flex items-center justify-between gap-3 rounded-md bg-white/[0.02] px-3 py-1.5 ring-1 ring-inset ring-zinc-800/60">
            <span className="truncate">Top genre</span>
            <span className="truncate font-medium text-zinc-200">{topGenre}</span>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-md bg-white/[0.02] px-3 py-1.5 ring-1 ring-inset ring-zinc-800/60">
            <span className="truncate">Genres ≥8</span>
            <span className="font-medium text-zinc-200 tabular-nums">{nf(genresCount)}</span>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-md bg-white/[0.02] px-3 py-1.5 ring-1 ring-inset ring-zinc-800/60">
            <span className="truncate">Avg IMDb (picks)</span>
            <span className="font-medium text-zinc-200 tabular-nums">
              {avgImdbPicks != null ? avgImdbPicks.toFixed(2) : "—"}
            </span>
          </div>
        </div>
      </Card.Section>
    </Card>
  );
}
