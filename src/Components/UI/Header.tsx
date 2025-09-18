import React from "react";
import { Avatar } from "./Avatar";
import { loadSharedState, subscribeSharedState, SharedState } from "../../state";
import { useNextScreeningTick, fmtCountdown } from "../../Utils/UseNextScreening";
import { PickerBadgePro } from "../UI/PickerPro";

type TabKey = "vote" | "history" | "stats";

function CompactInfoBar({
  hasActiveVote,
  nowTitle,
  targetTs,
  nowTs,
  nextPicker,
}: {
  hasActiveVote: boolean;
  nowTitle: string | null;
  targetTs: number;
  nowTs: number;
  nextPicker: string | null;
}) {
  const total = Math.max(0, Math.floor((targetTs - nowTs) / 1000));
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);

  const timeStr =
    d > 0
      ? `${pad(d)}d ${pad(h)}h ${pad(m)}m`
      : `${pad(h)}:${pad(m)}:${pad(s)}`;

  return (
    <div
      className={[
        "flex flex-col items-center gap-1.5",
        "rounded-xl border border-white/10 bg-white/5 px-4 py-2 backdrop-blur",
        "shadow-[0_6px_18px_-8px_rgba(0,0,0,.4)]",
        "min-w-[220px]",
      ].join(" ")}
    >
      {/* Titolo sopra solo se NON c’è un now showing */}
      {!hasActiveVote && (
        <div className="text-[9px] font-semibold uppercase tracking-[0.18em] text-white/70">
          Next Screening In
        </div>
      )}

      {/* Riga centrale: Now showing o countdown + picker */}
      <div className="flex w-full items-center justify-between gap-3">
        {hasActiveVote && nowTitle ? (
          <div className="truncate text-xs font-medium text-rose-400">
            Now showing: {nowTitle}
          </div>
        ) : (
          <div
            className="font-bold tabular-nums tracking-tight text-white text-[16px]"
            aria-hidden
          >
            {timeStr}
          </div>
        )}

        {nextPicker && <PickerBadgePro name={nextPicker} />}
      </div>
    </div>
  );
}

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

  // ✅ usa il tuo hook: minuto sopra 24h, secondo sotto 24h
  const { now: nowTs, target: targetTs } = useNextScreeningTick();

  const menuRef = React.useRef<HTMLDivElement | null>(null);

  // prima volta: se non salvato, vai su "Archive"
  React.useEffect(() => {
    const saved = localStorage.getItem("CN_TAB") as TabKey | null;
    if (!saved) setTab("history");
  }, [setTab]);

  // sync dallo shared state (active/nowTitle/nextPicker)
  React.useEffect(() => {
    let off: (() => void) | void;
    (async () => {
      try {
        const s = (await loadSharedState()) as SharedState | null;
        setHasActiveVote(Boolean(s?.active?.movie));
        setNowTitle(s?.active?.movie?.title ?? null);
        setNextPicker((s as any)?.nextPicker?.name ?? null);
      } catch {
        setHasActiveVote(false);
        setNowTitle(null);
      }
      off = subscribeSharedState?.((s: SharedState) => {
        setHasActiveVote(Boolean(s?.active?.movie));
        setNowTitle(s?.active?.movie?.title ?? null);
        setNextPicker((s as any)?.nextPicker?.name ?? null);
      });
    })();
    return () => {
      if (typeof off === "function") off();
    };
  }, []);

  // gestione apertura/chiusura menu
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

React.useEffect(() => {
  const goArchive = () => {
    setTab("history");
    localStorage.setItem("CN_TAB", "history");
  };
  window.addEventListener("cn:go-archive", goArchive as EventListener);
  return () => window.removeEventListener("cn:go-archive", goArchive as EventListener);
}, [setTab]);

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

  return (
    <header
      className={[
        "sticky top-0 z-40",
        "backdrop-blur supports-[backdrop-filter]:bg-white/55 dark:supports-[backdrop-filter]:bg-zinc-950/55",
        "border-b border-zinc-200/70 dark:border-zinc-800",
      ].join(" ")}
    >
      <div className="mx-auto grid max-w-6xl grid-cols-[1fr,auto,1fr] items-center gap-3 px-3 py-3 md:px-4">
        {/* LEFT: barra compatta */}
        <div className="justify-self-start">
          <CompactInfoBar
            hasActiveVote={hasActiveVote}
            nowTitle={nowTitle}
            targetTs={targetTs}
            nowTs={nowTs}
            nextPicker={nextPicker}
          />
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
                  <span className="font-medium text-zinc-800 dark:text-zinc-100">{user}</span>
                </div>
                <div className="my-1 h-px bg-zinc-200 dark:bg-zinc-700" />
                <button
                  role="menuitem"
                  onClick={() => {
                    // @ts-ignore eventuale tab "profile"
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

      {/* Mobile: stessa barra sopra, tabs sotto */}
      <div className="mx-auto block max-w-6xl px-3 pb-3 md:hidden">
        <div className="justify-self-start">
          <CompactInfoBar
            hasActiveVote={hasActiveVote}
            nowTitle={nowTitle}
            targetTs={targetTs}
            nowTs={nowTs}
            nextPicker={nextPicker}
          />
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <TabBtn k="history" label="Archive" />
          <TabBtn k="vote" label={voteLabel} />
          <TabBtn k="stats" label="Stats" />
        </div>
      </div>
    </header>
  );
}
