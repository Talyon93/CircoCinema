// Components/UI/VotesBar.tsx
import React from "react";
import { formatScore } from "../../Utils/Utils";
import { AvatarInline } from "./Avatar";
import { useRoomRealtime } from "../../hooks/UseRoomRealtime";
import type { VoteEventPayload } from "../../RealtimeTypes";
import { sb } from "../../supabaseClient";

function avgColor(score: number) {
  const s = Math.max(1, Math.min(10, score));
  if (s <= 4) return `hsl(0 85% 50%)`; // rosso fisso fino a 4
  const hue = ((s - 4) / 4) * 120;      // 5→0°, 10→120°
  return `hsl(${hue} 85% 50%)`;
}

function debounce<T extends (...args: any[]) => void>(fn: T, wait = 600) {
  let t: any;
  return (...args: Parameters<T>) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

type Entry = [string, number];

export function VotesBar({
  /** Rendering data (fallback iniziale / SSR): [username, voto] */
  entries,
  /** Media (se disponibile) */
  avg,
  /** Utente corrente per ring evidenziato */
  currentUser,
  /** Realtime opzionale: se presenti, abilita voto istantaneo */
  roomId,
  targetId,
  /** Comportamento/UX */
  size = "md",
  showScale = true,
  showHeader = true,
  interactive = true,    // permette click sulla barra per votare
  showButtons = false,   // mostra bottoni 1–10; default off per rimanere “pulito”
  scale = [1,2,3,4,5,6,7,8,9,10],
  onLocalChange,
}: {
  entries: Entry[];
  avg: number | null;
  currentUser?: string;
  /** se definiti -> realtime + persistenza */
  roomId?: string;
  targetId?: string;
  /** UI */
  size?: "sm" | "md";
  showScale?: boolean;
  showHeader?: boolean;
  interactive?: boolean;
  showButtons?: boolean;
  scale?: number[];
  onLocalChange?: (value: number) => void;
}) {
  const toPct = (n: number) => ((Number(n) - 1) / 9) * 100;
  const BADGE_SHIFT = 0.5;

  const trackH   = size === "sm" ? 8  : 16;
  const tickH    = size === "sm" ? 14 : 24;
  const avatarSz = size === "sm" ? 18 : 22;
  const countSz  = size === "sm" ? 14 : 16;

  const ringByScore = (s: number) =>
    s >= 8 ? "ring-emerald-500/70" : s >= 6 ? "ring-amber-400/70" : "ring-rose-500/70";

  const ref = React.useRef<HTMLDivElement>(null);
  const [w, setW] = React.useState(0);

  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    setW(el.clientWidth);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /** ---- Stato locale dei voti (nome -> valore) ------------------ */
  const [votes, setVotes] = React.useState<Record<string, number>>(() => {
    const base: Record<string, number> = {};
    for (const [name, score] of entries) base[name] = Number(score);
    return base;
  });

  // Se cambia "entries" dall’alto, riallineo lo stato (senza perdere voti arrivati via realtime con stessi nomi)
  React.useEffect(() => {
    setVotes(prev => {
      const next = { ...prev };
      for (const [name, score] of entries) next[name] = Number(score);
      return next;
    });
  }, [JSON.stringify(entries)]); // dipendenza “stabile” rispetto al contenuto

  /** ---- Realtime (opzionale) ----------------------------------- */
  const pendingBatch = React.useRef<{ voter: string; value: number; targetId: string; ts: number }[]>([]);
  const { send } = useRoomRealtime(roomId || "local", {
    onVote: (p: VoteEventPayload) => {
      if (!targetId || p.targetId !== targetId) return;
      // aggiorno UI all’istante
      setVotes(prev => ({ ...prev, [p.voter]: p.value }));
    },
  });

  const flush = React.useMemo(
    () => debounce(async () => {
      const rows = pendingBatch.current.splice(0);
      if (!rows.length) return;
      if (!sb) return; // offline/dev: salta persistenza
      await sb.from("votes").upsert(
        rows.map(r => ({
          target_id: r.targetId,
          voter: r.voter,
          value: r.value,
          ts: new Date(r.ts).toISOString(),
        })),
        { onConflict: "target_id,voter" }
      );
    }, 700),
    []
  );

  function cast(value: number) {
    if (!currentUser) return;
    // UI ottimistica
    setVotes(prev => ({ ...prev, [currentUser]: value }));
    onLocalChange?.(value);

    // Realtime se ho i dati della stanza
    if (roomId && targetId) {
      const payload: VoteEventPayload = {
        kind: "vote.cast",
        roomId,
        voter: currentUser,
        value,
        targetId,
        ts: Date.now(),
      };
      send("vote", payload);
      // Accodo per persistenza
      pendingBatch.current.push({ voter: currentUser, value, targetId, ts: payload.ts });
      flush();
    }
  }

  /** ---- Derivazioni per il rendering (cluster identico al tuo) -- */
  const list: { name: string; score: number; pct: number }[] = React.useMemo(
    () =>
      Object.entries(votes)
        .map(([name, score]) => ({ name, score: Number(score), pct: toPct(Number(score)) }))
        .sort((a, b) => a.pct - b.pct),
    [votes]
  );

  const minPct = React.useMemo(() => {
    if (!w) return 1.4;
    const minPx = Math.max(avatarSz * 0.9, 16);
    return (minPx / w) * 100;
  }, [w, avatarSz]);

  type P = typeof list[number];
  type Cluster = { pct: number; people: P[] };

  const clusters: Cluster[] = React.useMemo(() => {
    const out: Cluster[] = [];
    let cur: P[] = [];
    for (const p of list) {
      if (!cur.length || Math.abs(p.pct - cur[cur.length - 1].pct) < minPct) {
        cur.push(p);
      } else {
        const pct = cur.reduce((a, b) => a + b.pct, 0) / cur.length;
        out.push({ pct, people: cur });
        cur = [p];
      }
    }
    if (cur.length) {
      const pct = cur.reduce((a, b) => a + b.pct, 0) / cur.length;
      out.push({ pct, people: cur });
    }
    return out;
  }, [list, minPct]);

  function pickRep(c: Cluster) {
    const meIdx = currentUser ? c.people.findIndex((p) => p.name === currentUser) : -1;
    if (meIdx >= 0) return c.people[meIdx];
    return c.people.slice().sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))[0];
  }

  /** ---- Click sulla barra per votare (se interactive) ----------- */
  function onTrackClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!interactive) return;
    if (!currentUser) return;
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left; // 0..width
    const pct = Math.max(0, Math.min(1, x / rect.width));
    // pct(0) -> voto 1 | pct(1) -> voto 10
    const value = Math.round(1 + pct * 9);
    cast(value);
  }

  const myVote = currentUser ? votes[currentUser] ?? null : null;

  return (
    <div className="relative w-full">
      {showHeader && (
        <div className="mb-1 flex items-center justify-between text-xs text-zinc-400">
          <span>
            Avg {Object.keys(votes).length ? `(${Object.keys(votes).length} votes)` : ""}
          </span>
          <span>10</span>
        </div>
      )}

      {/* TRACK: barra con fill e tacche bianche (click per votare se interactive) */}
      <div
        ref={ref}
        className={
          "relative w-full overflow-visible rounded-full bg-zinc-800 " +
          (interactive ? "cursor-pointer" : "")
        }
        style={{ height: trackH }}
        onClick={onTrackClick}
        title={interactive ? "Click per votare (1–10)" : undefined}
      >
        {avg !== null && (
          <div
            className="absolute left-0 top-0 z-0 h-full"
            style={{ width: `${toPct(avg)}%`, background: avgColor(avg ?? 0) }}
          />
        )}

        {clusters.map((c, i) => (
          <div key={`tick-${i}`} className="absolute" style={{ left: `${c.pct}%` }}>
            <div
              className="absolute top-0 z-10 w-[2px] -translate-x-1/2 rounded-full bg-white/90 shadow-[0_0_0_2px_rgba(0,0,0,0.5)]"
              style={{ height: tickH }}
            />
          </div>
        ))}
      </div>

      {/* AVATAR OVERLAY: sopra la barra, no clipping; size del wrapper esplicita */}
      <div className="pointer-events-none absolute left-0 right-0 z-30" style={{ top: -(avatarSz - 16) }}>
        {clusters.map((c, i) => {
          const rep = pickRep(c);
          const others = c.people.length - 1;
          const ring =
            currentUser && rep.name === currentUser ? "ring-white" : ringByScore(rep.score);
          const tooltip = c.people.map((p) => `${p.name} ${formatScore(p.score)}`).join(", ");

          return (
            <div
              key={`av-${i}`}
              className="absolute -translate-x-1/2"
              style={{ left: `${c.pct}%` }}
              title={tooltip}
            >
              <div className="relative grid place-items-center" style={{ width: avatarSz, height: avatarSz }}>
                <AvatarInline
                  name={rep.name}
                  size={avatarSz}
                  className="block"
                  ringClassName={`ring-2 ${ring}`}
                />
                {others > 0 && (
                  <div
                    className="absolute grid place-items-center rounded-full border border-zinc-900 bg-white text-[10px] font-bold text-zinc-900 shadow dark:bg-zinc-200"
                    style={{
                      width: countSz,
                      height: countSz,
                      right: -countSz * BADGE_SHIFT,
                      bottom: -countSz * 0.2,
                    }}
                  >
                    +{others}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {showScale && (
        <div className="mt-1 flex justify-between text-[11px] text-zinc-500">
          <span>1</span>
          <span>5</span>
          <span>10</span>
        </div>
      )}

      {showButtons && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {scale.map((n) => (
            <button
              key={n}
              onClick={() => cast(n)}
              className={
                "min-w-8 rounded-lg border px-2 py-1 text-xs " +
                (myVote === n
                  ? "border-emerald-500 bg-emerald-600/20 text-emerald-200"
                  : "border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800")
              }
              title={`Vota ${n}`}
            >
              {n}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
