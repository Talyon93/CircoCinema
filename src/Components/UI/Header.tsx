import React from "react";
import { Avatar } from "./Avatar";
import { loadSharedState, subscribeSharedState, SharedState } from "../../state";

type TabKey = "vote" | "history" | "stats";

export function Header({
  user,
  onLogout,
  tab,
  setTab,
  theme,
  setTheme,
}: {
  user: string;
  onLogout: () => void;
  tab: TabKey;
  setTab: (t: TabKey) => void;
  theme: "light" | "dark";
  setTheme: (t: "light" | "dark") => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [hasActiveVote, setHasActiveVote] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement | null>(null);

  // derive "Now Showing" from shared state
  React.useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const s = await loadSharedState();
        if (!mounted) return;
        setHasActiveVote(Boolean(s?.active?.movie));
      } catch {}
    })();

    const unsub = subscribeSharedState?.((s: SharedState) => {
      setHasActiveVote(Boolean(s?.active?.movie));
    });

    return () => {
      mounted = false;
      if (typeof unsub === "function") unsub();
    };
  }, []);

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

  const TabBtn = ({ k, label }: { k: TabKey; label: string }) => {
    const active = tab === k;
    return (
      <button
        onClick={() => setTab(k)}
        aria-current={active ? "page" : undefined}
        className={[
          "relative rounded-full px-5 md:px-6 py-2.5 md:py-3",
          "text-base md:text-lg font-semibold tracking-wide transition",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60",
          active
            ? "bg-black text-white dark:bg-white dark:text-black shadow-sm ring-1 ring-black/10 dark:ring-white/10"
            : "text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/70 ring-1 ring-transparent hover:ring-zinc-300/50 dark:hover:ring-zinc-600/60",
        ].join(" ")}
      >
        {label}
        {active && (
          <span
            aria-hidden
            className="absolute -bottom-2 left-1/2 h-1 w-8 -translate-x-1/2 rounded-full bg-current/80"
          />
        )}
      </button>
    );
  };

  const NowShowingBadge = () =>
    !hasActiveVote ? null : (
      <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-wide text-white/90 backdrop-blur">
        <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-rose-400" />
        Now Showing
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
      <div className="mx-auto grid max-w-6xl grid-cols-[auto,1fr,auto] items-center gap-3 px-3 py-3 md:px-4">
        {/* LEFT: badge (only if active) */}
        <div className="flex items-center">
          <NowShowingBadge />
        </div>

        {/* CENTER: big tabs */}
        <nav
          className="flex items-center justify-center gap-3 md:gap-4"
          aria-label="Primary"
        >
          <TabBtn k="vote" label="Vote" />
          <TabBtn k="history" label="History" />
          <TabBtn k="stats" label="Stats" />
        </nav>

        {/* RIGHT: theme + avatar menu */}
        <div className="ml-auto flex items-center gap-2">
          <button
            aria-label="Toggle theme"
            title={theme === "dark" ? "Switch to Light" : "Switch to Dark"}
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="rounded-2xl border border-zinc-300/60 bg-white/60 px-3 py-2 text-base transition hover:bg-white dark:border-zinc-700 dark:bg-zinc-900/70 dark:hover:bg-zinc-900"
          >
            {theme === "dark" ? "🌙" : "☀️"}
          </button>

          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setOpen((s) => !s)}
              className="flex items-center justify-center"
              aria-haspopup="menu"
              aria-expanded={open}
              aria-label="Open profile menu"
              title={user}
            >
              <Avatar name={user} size={36} />
            </button>

            {open && (
              <div
                role="menu"
                className="absolute right-0 mt-2 w-52 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
              >
                <div className="px-3 py-2 text-xs text-zinc-500 dark:text-zinc-400">
                  Signed in as{" "}
                  <span className="font-medium text-zinc-800 dark:text-zinc-100">
                    {user}
                  </span>
                </div>
                <button
                  role="menuitem"
                  onClick={() => {
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

      {/* Mobile: badge left, tabs under */}
      <div className="mx-auto block max-w-6xl px-3 pb-3 md:hidden">
        <div className="mb-2 flex">{/* left aligned on mobile too */}
          <NowShowingBadge />
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <TabBtn k="vote" label="Vote" />
          <TabBtn k="history" label="History" />
          <TabBtn k="stats" label="Stats" />
        </div>
      </div>
    </header>
  );
}
