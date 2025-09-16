import React from "react";
import { Avatar } from "./Avatar";
import { loadSharedState, subscribeSharedState, SharedState } from "../../state";

type TabKey = "vote" | "history" | "stats";

/* ---------------- Utilities: next Thursday 21:00 ---------------- */
function nextThursdayAt21(from = new Date()) {
  const d = new Date(from);
  d.setSeconds(0, 0);
  const day = d.getDay(); // 0=Sun ... 4=Thu
  const daysUntilThu = (4 - day + 7) % 7;
  const target = new Date(d);
  target.setDate(d.getDate() + daysUntilThu);
  target.setHours(21, 0, 0, 0);
  if (daysUntilThu === 0 && from.getTime() >= target.getTime()) {
    target.setDate(target.getDate() + 7);
  }
  return target;
}
function fmt2(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}
function diffToDHM(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (d > 0) return `${d}d ${fmt2(h)}h ${fmt2(m)}m`;
  if (h > 0) return `${h}h ${fmt2(m)}m`;
  return `${m}m`;
}
/* ---------------------------------------------------------------- */

/* ---------- Pretty unified bar: countdown + next picker ---------- */
function ViewingInfoBar({
  targetTs,
  nextPicker,
}: {
  targetTs: number;
  nextPicker: string | null;
}) {
  const target = new Date(targetTs);
  const dateStr = target.toLocaleDateString(undefined, {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
  const timeStr = target.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div
      className={[
        "flex items-center gap-4 rounded-2xl",
        "border border-white/10 bg-white/[0.04] px-4 py-2",
        "backdrop-blur shadow-[0_4px_20px_rgba(0,0,0,0.25)]",
        "text-[12px] leading-5 text-zinc-100",
      ].join(" ")}
    >
      {/* Data e orario */}
      <div className="flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
        <span className="font-medium">
          {dateStr},{" "}
          <span className="font-semibold text-white">{timeStr}</span>
        </span>
      </div>

      {/* Divider */}
      {nextPicker && <span className="h-3 w-px bg-white/15" />}

      {/* Next picker */}
      {nextPicker && (
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
          <span className="rounded-md border border-amber-300/25 bg-amber-300/10 px-2 py-[2px] text-amber-100 font-semibold">
            {nextPicker}
          </span>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- */

export function Header({
  user,
  onLogout,
  tab,
  setTab,
}: {
  user: string;
  onLogout: () => void;
  tab: TabKey;
  setTab: (t: TabKey) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [hasActiveVote, setHasActiveVote] = React.useState(false);
  const [nowTitle, setNowTitle] = React.useState<string | null>(null);
  const [nextPicker, setNextPicker] = React.useState<string | null>(null);
  const menuRef = React.useRef<HTMLDivElement | null>(null);

  // Countdown state
  const [targetTs, setTargetTs] = React.useState<number>(() => nextThursdayAt21().getTime());
  const [nowTs, setNowTs] = React.useState<number>(() => Date.now());

  // Imposta Archive come tab iniziale se non salvato
  React.useEffect(() => {
    const saved = localStorage.getItem("CN_TAB") as TabKey | null;
    if (!saved) setTab("history");
  }, [setTab]);

  // Sync stato globale (active/nowTitle + nextPicker)
  React.useEffect(() => {
    const pickNameFrom = (s: any) =>
      s?.nextPicker?.name ?? s?.nextpicker?.name ?? s?.next_picker?.name ?? null;

    let off: (() => void) | void;
    (async () => {
      try {
        const s = (await loadSharedState()) as SharedState | null;
        setHasActiveVote(Boolean(s?.active?.movie));
        setNowTitle(s?.active?.movie?.title ?? null);
        setNextPicker(pickNameFrom(s));
      } catch {
        setHasActiveVote(false);
        setNowTitle(null);
        setNextPicker(null);
      }
      off = subscribeSharedState?.((s: SharedState) => {
        setHasActiveVote(Boolean(s?.active?.movie));
        setNowTitle(s?.active?.movie?.title ?? null);
        setNextPicker(pickNameFrom(s));
      });
    })();
    return () => {
      if (typeof off === "function") off();
    };
  }, []);

  // Gestione apertura/chiusura menu
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onClick = (e: MouseEvent) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, []);

  // Timer per il countdown (tick ogni secondo)
  React.useEffect(() => {
    setTargetTs(nextThursdayAt21().getTime());
    const id = setInterval(() => {
      const now = Date.now();
      setNowTs(now);
      if (now >= targetTs) setTargetTs(nextThursdayAt21(new Date(now)).getTime());
    }, 1000);
    return () => clearInterval(id);
  }, [targetTs]);

  // Tab generica con lineetta bianca full width
  const TabBtn = ({ k, label }: { k: TabKey; label: string }) => {
    const active = tab === k;
    return (
      <button
        onClick={() => {
          setTab(k);
          localStorage.setItem("CN_TAB", k);
        }}
        aria-current={active ? "page" : undefined}
        aria-selected={active}
        className={[
          "relative flex flex-col items-center justify-center px-5 md:px-6 py-2.5 md:py-3",
          "text-base md:text-lg font-semibold tracking-wide transition",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60",
          active ? "text-white" : "text-zinc-400 hover:text-white",
        ].join(" ")}
      >
        {label}
        <span
          aria-hidden
          className={`absolute left-0 bottom-0 h-[2px] w-full rounded ${active ? "bg-white" : "bg-transparent"}`}
        />
      </button>
    );
  };

  const voteLabel = hasActiveVote ? "Vote" : "Start vote";

  const NowShowingBadge = () =>
    !hasActiveVote || !nowTitle ? null : (
      <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-wide text-white/90 backdrop-blur">
        <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-rose-400" />
        <span className="truncate">Now showing: {nowTitle}</span>
      </div>
    );

  return (
    <header
      className={[
        "sticky top-0 z-40",
        "backdrop-blur supports-[backdrop-filter]:bg-white/55 dark:supports-[backdrop-filter]:bg-zinc-950/55",
        "border-b border-zinc-200/70 dark:border-zinc-800",
      ].join(" ")}
    >
      {/* 3 colonne: 1fr / auto / 1fr (tabs sempre centrate) */}
      <div className="mx-auto grid max-w-6xl grid-cols-[1fr,auto,1fr] items-center gap-3 px-3 py-3 md:px-4">
        {/* LEFT: badge / info bar */}
        <div className="justify-self-start flex flex-col gap-2">
          {hasActiveVote ? (
            <NowShowingBadge />
          ) : (
            <ViewingInfoBar
              remainingMs={targetTs - nowTs}
              targetTs={targetTs}
              nextPicker={nextPicker}
            />
          )}
        </div>

        {/* CENTER: tabs */}
        <nav className="flex items-center justify-center gap-3 md:gap-6" aria-label="Primary">
          <TabBtn k="history" label="Archive" />
          <TabBtn k="vote" label={voteLabel} />
          <TabBtn k="stats" label="Stats" />
        </nav>

        {/* RIGHT: user menu */}
        <div className="justify-self-end flex items-center gap-2">
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setOpen((s) => !s)}
              className={[
                "group flex items-center gap-2 rounded-2xl",
                "border border-zinc-200 bg-white px-2.5 py-1.5 shadow-sm",
                "hover:bg-zinc-50 active:scale-[0.99]",
                "dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800/70",
              ].join(" ")}
              aria-haspopup="menu"
              aria-expanded={open}
              aria-label="Open profile menu"
              title={user}
            >
              <Avatar name={user} size={28} />
              <span className="max-w-[140px] truncate text-sm font-medium text-zinc-800 dark:text-zinc-100">
                {user}
              </span>
              <svg className="h-4 w-4 opacity-70 group-hover:opacity-100" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                <path
                  fillRule="evenodd"
                  d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
                  clipRule="evenodd"
                />
              </svg>
            </button>

            {open && (
              <div
                role="menu"
                className="absolute right-0 mt-2 w-56 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
              >
                <div className="px-3 py-2 text-xs text-zinc-500 dark:text-zinc-400">
                  Signed in as{" "}
                  <span className="font-medium text-zinc-800 dark:text-zinc-100">
                    {user}
                  </span>
                </div>
                <div className="my-1 h-px bg-zinc-200 dark:bg-zinc-700" />

                <button
                  role="menuitem"
                  onClick={() => {
                    // opzionale: se hai una tab "profile"
                    // @ts-ignore
                    setTab?.("profile");
                    setOpen(false);
                  }}
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800/70"
                >
                  Profile
                </button>

                <div className="my-1 h-px bg-zinc-200 dark:bg-zinc-700" />

                <button
                  role="menuitem"
                  onClick={() => {
                    setOpen(false);
                    onLogout();
                  }}
                  className="block w-full px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/30"
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile: info bar sotto header */}
      <div className="mx-auto block max-w-6xl px-3 pb-3 md:hidden">
        {!hasActiveVote && (
          <ViewingInfoBar
            remainingMs={targetTs - nowTs}
            targetTs={targetTs}
            nextPicker={nextPicker}
          />
        )}
      </div>
    </header>
  );
}
