import React, { useEffect, useMemo, useState } from "react";
import { Card } from "../Components/UI/Card";
import { PickedByBadge } from "../Components/UI/PickedByBadge";
import { loadSharedState, subscribeSharedState } from "../state";
import { fetchMetaForTitle, getPosterUrl } from "../TMDBHelper";
import { sb } from "../supabaseClient";
import { ensureLiveFileExists, loadHistoryLive } from "../storage";
import { useNextScreeningTick } from "../Utils/UseNextScreening";
import { PickerBadgePro } from "../Components/UI/PickerPro";

type Showcase = {
  title?: string;
  release_year?: string | number | null;
  overview?: string;
  poster_path?: string;
  picked_by?: string | null;
};

function NextPanel({
  targetTs,
  nowTs,
  nextPicker,
}: {
  targetTs: number;
  nowTs: number;
  nextPicker: string | null;
}) {
  // countdown adattivo
  const total = Math.max(0, Math.floor((targetTs - nowTs) / 1000));
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);

  const Block = ({ label, value }: { label: string; value: string | number }) => (
    <div className="flex flex-col items-center gap-2">
      <div className="rounded-2xl bg-white/[0.04] px-4 py-3 ring-1 ring-white/10 shadow-[inset_0_-1px_0_rgba(255,255,255,0.06),0_10px_30px_-10px_rgba(0,0,0,0.6)]">
        <div className="tabular-nums text-[34px] leading-none font-extrabold tracking-tight text-white">
          {String(value).padStart(2, "0")}
        </div>
      </div>
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/60">
        {label}
      </div>
    </div>
  );

  const dateStr = new Date(targetTs).toLocaleDateString(undefined, {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
  const timeStr = new Date(targetTs).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <aside
      className={[
        "rounded-2xl p-6",
        "bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] backdrop-blur",
        "ring-1 ring-white/10 shadow-[0_28px_80px_-30px_rgba(0,0,0,0.7)]",
      ].join(" ")}
      aria-label="Next screening"
    >
      <div className="mb-4">
        <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/70">
          Next Screening
        </div>
        <div className="mt-2 h-px w-14 bg-gradient-to-r from-white/40 to-transparent" />
      </div>

      {/* Adattivo: sopra 1 giorno → D/H/M, sotto 1 giorno → H/M/S */}
      <div className="mx-auto grid max-w-lg grid-cols-3 items-end justify-items-center gap-5">
        {d > 0 ? (
          <>
            <Block label="Days" value={d} />
            <Block label="Hours" value={h} />
            <Block label="Mins" value={m} />
          </>
        ) : (
          <>
            <Block label="Hours" value={h} />
            <Block label="Mins" value={m} />
            <Block label="Secs" value={pad(s)} />
          </>
        )}
      </div>

      <div className="mx-auto mt-6 flex max-w-lg items-center justify-center">
        <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[13px] font-semibold text-white/90">
          <span className="text-white">{dateStr}</span>
          <span className="mx-2 opacity-50">•</span>
          <span>{timeStr}</span>
        </span>
      </div>

      <div className="mx-auto my-6 h-px w-full bg-white/10" />

      {nextPicker && (
        <div className="mx-auto grid max-w-lg justify-items-center gap-3">
          <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/70">
            Next Picker
          </div>
          {/* usa il tuo badge “wow” */}
          <PickerBadgePro name={nextPicker} />
        </div>
      )}
    </aside>
  );
}


function LastPanel({ show }: { show: Showcase }) {
  return (
    <section
      className={[
        "rounded-2xl p-5",
        "bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] backdrop-blur",
        "ring-1 ring-white/10 shadow-[0_28px_80px_-30px_rgba(0,0,0,0.7)]",
      ].join(" ")}
      aria-label="Last screening"
    >
      <div className="mb-4">
        <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/70">Last Screening</div>
        <div className="mt-2 h-px w-14 bg-gradient-to-r from-white/40 to-transparent" />
      </div>

      <div className="grid grid-cols-[160px,1fr] gap-5">
        <div className="flex items-start justify-center">
          {show.poster_path ? (
            <img
              src={getPosterUrl(show.poster_path, "w342")}
              className="h-[240px] w-[160px] rounded-xl border border-white/10 object-cover shadow-[0_12px_30px_rgba(0,0,0,0.35)]"
              alt={show.title || "Poster"}
            />
          ) : (
            <div className="flex h-[240px] w-[160px] items-center justify-center rounded-xl border border-dashed border-white/10 text-xs text-zinc-400">
              No poster
            </div>
          )}
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-xl font-semibold">
              {show.title}{" "}
              {show.release_year ? <span className="ml-1 text-zinc-400">({show.release_year})</span> : null}
            </h3>
            {show.picked_by ? <PickerBadgePro name={show.picked_by} /> : null}
          </div>

          {show.overview ? (
            <p className="mt-3 whitespace-pre-wrap text-[15px] leading-7 text-zinc-300">{show.overview}</p>
          ) : (
            <p className="mt-3 text-sm text-zinc-400">No summary available.</p>
          )}
        </div>
      </div>
    </section>
  );
}

export function Login({ onLogin }: { onLogin: (name: string) => void }) {
  const [name, setName] = useState("");
  const [show, setShow] = useState<Showcase | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [nextPicker, setNextPicker] = useState<string | null>(null);

  // countdown centralizzato (tick “on-minute”)
  const { now: nowTs, target: targetTs } = useNextScreeningTick("minute");

  // ripristina eventuale nome
  useEffect(() => {
    try {
      const last = localStorage.getItem("cn_user");
      if (last) setName(last);
    } catch {}
  }, []);

  // nextPicker live
  useEffect(() => {
    let off: (() => void) | void;
    (async () => {
      try {
        const s = await loadSharedState();
        setNextPicker((s as any)?.nextPicker?.name ?? null);
      } catch {}
      off = subscribeSharedState?.((n: any) => {
        setNextPicker(n?.nextPicker?.name ?? null);
      });
    })();
    return () => {
      if (typeof off === "function") off();
    };
  }, []);

  // carica now showing o last screening (fonti originali)
  useEffect(() => {
    let mounted = true;

    (async () => {
      const shared = await loadSharedState();

      if (shared?.active?.movie) {
        setIsActive(true);
        const a = shared.active;
        let base: Showcase = {
          title: a.movie.title,
          release_year:
            a.movie.release_year ||
            (a.movie.release_date ? String(a.movie.release_date).slice(0, 4) : null),
          overview: a.movie.overview || "",
          poster_path: a.movie.poster_path || "",
          picked_by: a.picked_by || null,
        };
        if ((!base.poster_path || !base.overview) && base.title) {
          const meta = await fetchMetaForTitle(base.title);
          if (mounted && meta) base = { ...base, poster_path: base.poster_path || meta.poster_path, overview: base.overview || meta.overview };
        }
        if (mounted) setShow(base);
        return;
      }

      setIsActive(false);

      let list: any[] = [];
      try {
        if (sb) {
          await ensureLiveFileExists();
          const live = await loadHistoryLive();
          if (Array.isArray(live)) list = live;
        }
      } catch {}

      if ((!list || list.length === 0) && Array.isArray((shared as any)?.history)) {
        list = (shared as any).history;
      }

      if (!list || list.length === 0) {
        if (mounted) setShow(null);
        return;
      }

      const latest = list
        .slice()
        .sort((a, b) => {
          const ta = a?.started_at ? new Date(a.started_at).getTime() : 0;
          const tb = b?.started_at ? new Date(b.started_at).getTime() : 0;
          return tb - ta;
        })[0];

      if (!latest?.movie) {
        if (mounted) setShow(null);
        return;
      }

      let base: Showcase = {
        title: latest.movie.title,
        release_year:
          latest.movie.release_year ||
          (latest.movie.release_date ? String(latest.movie.release_date).slice(0, 4) : null),
        overview: latest.movie.overview || "",
        poster_path: latest.movie.poster_path || "",
        picked_by: latest.picked_by || null,
      };

      if ((!base.poster_path || !base.overview) && base.title) {
        const meta = await fetchMetaForTitle(base.title);
        if (mounted && meta) base = { ...base, poster_path: base.poster_path || meta.poster_path, overview: base.overview || meta.overview };
      }

      if (mounted) setShow(base);
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const canProceed = useMemo(() => name.trim().length > 0, [name]);
  const handleSubmit = () => {
    if (!canProceed) return;
    onLogin(name.trim());
  };

  return (
    <div className="relative mx-auto mt-16 w-full max-w-6xl px-4">
      <Card>
        <div className="relative -mx-4 -mt-4 mb-6 overflow-hidden rounded-t-2xl bg-gradient-to-r from-zinc-900 via-black to-zinc-900 px-4 py-6 text-center shadow-inner">
          <h1 className="mt-3 flex items-center justify-center gap-2 text-3xl font-extrabold text-white">
            Welcome to the Circo Cinema
          </h1>
          <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
        </div>

        {/* Last screening + Next screening come 2 pannelli coerenti */}
        {show && (
          <div className={["mb-8 grid gap-8", isActive ? "md:grid-cols-1" : "md:grid-cols-[minmax(0,1fr),380px]"].join(" ")}>
            <LastPanel show={show} />
            {!isActive && <NextPanel targetTs={targetTs} nowTs={nowTs} nextPicker={nextPicker} />}
          </div>
        )}

        {/* Login */}
        <div className="space-y-3">
          <label htmlFor="login-name" className="sr-only">Enter your name</label>
          <div className="group relative flex items-center gap-2 rounded-xl border border-zinc-300 bg-white px-3 py-2 shadow-sm transition focus-within:border-zinc-400 focus-within:shadow dark:border-zinc-700 dark:bg-zinc-900 dark:focus-within:border-zinc-500">
            <input
              id="login-name"
              autoFocus
              className="peer w-full bg-transparent text-zinc-900 placeholder-zinc-400 outline-none dark:text-zinc-100 dark:placeholder-zinc-500"
              placeholder="Your stage name…"
              value={name}
              onChange={(e) => setName(e.target.value.replace(/^\s+/, ""))}
              onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
            />
          </div>

          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            If you’ve used this name before, your profile image and picks will be restored.
          </p>

          <div className="mt-3 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canProceed}
              className="relative inline-flex flex-[2] items-center justify-center gap-2 rounded-xl bg-zinc-900 px-5 py-2 text-sm font-semibold text-white shadow-lg transition hover:scale-[1.01] hover:shadow-xl active:translate-y-px disabled:opacity-40 dark:bg-white dark:text-black"
            >
              <span className="relative z-10">Enter the Circus</span>
              <span aria-hidden className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-white/15" />
              <span
                aria-hidden
                className="pointer-events-none absolute -inset-1 -z-10 rounded-2xl blur-lg"
                style={{ background: "conic-gradient(from 180deg at 50% 50%, rgba(255,255,255,0.35), rgba(255,0,122,0.25), rgba(0,160,255,0.25), rgba(255,255,255,0.35))", opacity: 0.5 }}
              />
            </button>
          </div>

          <div className="mt-4 flex items-center justify-center gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
            <span className="h-px w-6 bg-zinc-200 dark:bg-zinc-800" />
            Press <kbd className="rounded bg-zinc-200 px-1.5 py-0.5 text-[10px] dark:bg-zinc-800">Enter</kbd> to start
            <span className="h-px w-6 bg-zinc-200 dark:bg-zinc-800" />
          </div>
        </div>
      </Card>
    </div>
  );
}
