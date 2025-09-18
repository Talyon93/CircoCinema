import React from "react";
import { createPortal } from "react-dom";
import { Card } from "./Card";
import { AvatarInline } from "./Avatar";
import { saveSharedState, loadSharedState, subscribeSharedState, SharedState } from "../../state";
import { sb } from "../../supabaseClient";
import WinnerModal from "./WinnerModal";

/* ------------------------------------------------------------------ */
/*  Types & constants                                                  */
/* ------------------------------------------------------------------ */
const DEFAULT_CHIP_W = 112;
const MIN_SPIN_MS = 5000;   // durata minima animazione
const MAX_SPIN_MS = 10000;   // opzionale, per dare variabilità
const MIN_LOOPS = 6;
const MIN_SPEED_PX = 700;   // px al secondo minimi desiderati
const MAX_LOOPS = 30;    // tetto di sicurezza per non esagerare

type SlotShared = {
    runId: string;
    startedBy: string;
    startedAt: number;
    durationMs: number;
    isSpinning: boolean;
    entries: string[];
    targetIndex: number;
    loops: number;
    winner?: string;
};

function useChipWidth(viewportRef: React.RefObject<HTMLDivElement>) {
    const [chipW, setChipW] = React.useState(DEFAULT_CHIP_W);
    React.useLayoutEffect(() => {
        const root = viewportRef.current;
        if (!root) return;
        const probe = root.querySelector('[data-chip]') as HTMLElement | null;
        const measure = () => {
            const w = probe?.getBoundingClientRect().width ?? DEFAULT_CHIP_W - 8; // 104 fallback
            setChipW(Math.round(w + 8)); // + gap 8
        };
        measure();
        const ro = new ResizeObserver(measure);
        ro.observe(root);
        return () => ro.disconnect();
    }, [viewportRef]);
    return chipW;
} const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const norm = (s?: string) => (s || "").trim().toLowerCase();

/* ------------------------------------------------------------------ */
/*  Small UI pieces                                                    */
/* ------------------------------------------------------------------ */

function WinnerBadge({ name }: { name: string }) {
    if (!name) return null;
    return (
        <div className="rounded-full border border-emerald-500/40 bg-emerald-500/15 px-3 py-1 text-sm text-emerald-200">
            Estratto: <b>{name}</b>
        </div>
    );
}

function RosterControls({
    total,
    included,
    disabled,
    onAllOn,
    onAllOff,
}: {
    total: number;
    included: number;
    disabled: boolean;
    onAllOn: () => void;
    onAllOff: () => void;
}) {
    return (
        <div className="mb-3 flex flex-wrap items-center gap-2">
            <button
                className="rounded-full border px-3 py-1 text-sm dark:border-zinc-700 disabled:opacity-40"
                onClick={onAllOn}
                disabled={disabled}
            >
                Seleziona tutti
            </button>
            <button
                className="rounded-full border px-3 py-1 text-sm dark:border-zinc-700 disabled:opacity-40"
                onClick={onAllOff}
                disabled={disabled}
            >
                Deseleziona tutti
            </button>
            <div className="text-sm text-zinc-400">
                {included}/{total} inclusi
            </div>
        </div>
    );
}

function ChipsToggle({
    candidates,
    selected,
    disabled,
    onToggle,
}: {
    candidates: string[];
    selected: string[];
    disabled: boolean;
    onToggle: (n: string) => void;
}) {
    return (
        <div className="mb-4 flex flex-wrap gap-2">
            {candidates.map((n) => {
                const on = selected.includes(n);
                return (
                    <button
                        key={n}
                        onClick={() => onToggle(n)}
                        disabled={disabled}
                        className={[
                            "inline-flex items-center gap-2 rounded-full border px-2.5 py-1.5 text-sm transition disabled:opacity-40",
                            on
                                ? "bg-amber-500/15 border-amber-500/40 text-amber-100"
                                : "bg-white dark:bg-zinc-900 border-gray-300 dark:border-zinc-700 text-zinc-300",
                        ].join(" ")}
                        title={n}
                    >
                        <AvatarInline name={n} size={18} className={on ? "ring-2 ring-amber-400/50" : ""} />
                        <span className="font-medium">{n}</span>
                    </button>
                );
            })}
        </div>
    );
}

function ViewportTrack({
    viewportRef,
    translateX,
    items,
    isSpinning,
    targetIndex,
    loops,
    highlightCenter = false,
    centerOffset,
    chipW,
}: {
    viewportRef: React.RefObject<HTMLDivElement>;
    translateX: number;
    items: string[];
    isSpinning: boolean;
    targetIndex: number;
    loops: number;
    highlightCenter?: boolean;
    centerOffset: number;
    chipW: number;
}) {
    // --- quante card servono per riempire la viewport + buffer ---
    const minRender = React.useMemo(() => {
        const vw = viewportRef.current?.clientWidth ?? 640;
        const onScreen = Math.max(1, Math.ceil(vw / Math.max(1, chipW)));
        return onScreen * 6; // buffer largo: 3x a sx + 3x a dx
    }, [viewportRef, chipW]);

    const base = items.length ? items : ["—"];
    const few = base.length <= 2;

    // garantisci abbastanza elementi anche durante lo spin
    const requested =
        (isSpinning ? loops * base.length + (targetIndex ?? 0) + base.length * 2 : 0) +
        minRender;

    const renderList = React.useMemo(() => {
        const out: string[] = [];
        const total = Math.max(minRender, requested);
        for (let i = 0; i < total; i++) out.push(base[i % base.length]);
        return out;
    }, [base, minRender, requested]);

    // parallax dolce dello sfondo (fra -40 e 40 px circa)
    const bgParallax = Math.max(-40, Math.min(40, translateX * 0.04));

    return (
        <div
            ref={viewportRef}
            className="relative mx-auto w-full max-w-[960px] overflow-hidden rounded-3xl border border-zinc-800/60 bg-zinc-950/60 p-4"
        >
            {/* background parallax + grana leggera */}
            <div
                aria-hidden
                className="pointer-events-none absolute inset-0 -z-10"
                style={{
                    background:
                        "radial-gradient(120% 80% at 50% 0%, rgba(251,191,36,.10) 0%, rgba(0,0,0,0) 55%), radial-gradient(120% 120% at 50% 100%, rgba(34,197,94,.10) 0%, rgba(0,0,0,0) 60%)",
                    transform: `translate3d(${bgParallax}px,0,0)`,
                    transition: "transform 60ms linear",
                }}
            />
            <div
                aria-hidden
                className="pointer-events-none absolute inset-0 -z-10"
                style={{
                    backgroundImage:
                        "radial-gradient(rgba(255,255,255,.04) 1px, transparent 1px)",
                    backgroundSize: "6px 6px",
                    opacity: 0.25,
                    mixBlendMode: "overlay",
                }}
            />

            {/* rails neon */}
            <div className="pointer-events-none absolute inset-x-4 top-1/2 -translate-y-1/2">
                <div className="h-[2px] w-full rounded bg-amber-400/70 blur-[0.2px]" />
                <div className="absolute inset-x-0 -top-1 h-[1px] w-full bg-amber-200/25" />
                <div className="absolute inset-x-0 top-1 h-[1px] w-full bg-amber-200/15" />
                <div className="absolute inset-x-0 top-0 h-[10px] bg-amber-400/5 blur-xl" />
            </div>

            {/* marcatore centro */}
            <div className="pointer-events-none absolute left-1/2 top-0 z-10 h-full -translate-x-1/2">
                <div className="h-full w-[2px] bg-amber-300/80 drop-shadow-[0_0_10px_rgba(251,191,36,.6)]" />
                {highlightCenter && (
                    <div className="absolute -left-3 top-1/2 h-14 w-8 -translate-y-1/2 rounded-full bg-amber-300/15 blur" />
                )}
            </div>

            {/* speed lines sottili */}
            <div
                aria-hidden
                className="pointer-events-none absolute inset-0"
                style={{
                    background:
                        "repeating-linear-gradient(90deg, rgba(255,255,255,.04) 0 1px, transparent 1px 8px)",
                    transform: `translate3d(${translateX * 0.02}px,0,0)`,
                    transition: "transform 60ms linear",
                    maskImage:
                        "linear-gradient(90deg, transparent, black 12%, black 88%, transparent)",
                }}
            />

            {/* nastro */}
            <div
                className="flex items-center"
                style={{
                    transform: `translate3d(${translateX}px,0,0)`,
                    columnGap: "10px",
                    willChange: "transform",
                }}
            >
                {renderList.map((name, idx) => {
                    // posizione x "nominale" del chip
                    const x = idx * chipW + translateX;
                    const dist = Math.abs(centerOffset - x);
                    const t = Math.min(1, dist / (chipW * 3)); // 0 (centro) → 1 (lontano)
                    const near = 1 - t;

                    // Effetti “wow” solo se non siamo nel caso 1–2 nomi
                    const scale = few ? 1 : 1 + near * 0.30;
                    const opacity = few ? 1 : 0.55 + near * 0.45;
                    const elevate = few ? 8 : 6 + near * 18;
                    const glow = near * 0.8;

                    const cardStyle: React.CSSProperties = {
                        transform: `scale(${scale})`,
                        opacity,
                        borderColor: `rgba(63,63,70,${0.5 + glow * 0.25})`,
                        background:
                            "linear-gradient(180deg, rgba(24,24,27,.98), rgba(24,24,27,.78))",
                        boxShadow: `
              0 ${elevate}px ${18 + elevate}px rgba(0,0,0,.45),
              0 0 ${10 + glow * 18}px rgba(251,191,36,${0.10 + glow * 0.18})
            `,
                        willChange: "transform, opacity, box-shadow",
                        // sheen controllato via CSS var
                        // @ts-ignore
                        "--shine": String(Math.max(0, near - 0.1)),
                    } as any;

                    const chipClass =
                        "group relative flex w-[112px] shrink-0 items-center gap-2 rounded-2xl border px-2.5 py-2.5";

                    return (
                        <div key={`${name}-${idx}`} data-chip className={chipClass} style={cardStyle} title={name}>
                            {/* bagliore interno (si illumina vicino al centro) */}
                            <div
                                aria-hidden
                                className="pointer-events-none absolute inset-0 rounded-2xl"
                                style={{
                                    background:
                                        "radial-gradient(60% 80% at 50% 50%, rgba(251,191,36,.06), transparent 70%)",
                                    opacity: 0.6 * (near * near),
                                    mixBlendMode: "screen",
                                }}
                            />
                            {/* sheen diagonale che “passa” sul chip al centro */}
                            <div
                                aria-hidden
                                className="pointer-events-none absolute inset-0 rounded-2xl"
                                style={{
                                    background:
                                        "linear-gradient(75deg, transparent 40%, rgba(255,255,255,.12) 50%, transparent 60%)",
                                    transform: "translateX(-30%)",
                                    opacity: `var(--shine)`,
                                    filter: "blur(0.5px)",
                                }}
                            />
                            {/* scia/motion blur orizzontale dinamico (solo vicino al centro) */}
                            {!few && (
                                <div
                                    aria-hidden
                                    className="pointer-events-none absolute inset-0 rounded-2xl"
                                    style={{
                                        background:
                                            "linear-gradient(90deg, rgba(251,191,36,.15), rgba(251,191,36,0))",
                                        opacity: 0.25 * near,
                                        transform: "translateX(-18%)",
                                        filter: "blur(6px)",
                                        maskImage:
                                            "linear-gradient(90deg, black, black 50%, transparent)",
                                    }}
                                />
                            )}

                            <AvatarInline name={name} size={22} className="ring-2 ring-amber-400/50" />
                            <div className="truncate text-sm font-medium text-zinc-100">{name}</div>
                        </div>
                    );
                })}
            </div>

            {/* vignetta ai bordi per focus */}
            <div
                aria-hidden
                className="pointer-events-none absolute inset-0 rounded-3xl"
                style={{
                    boxShadow: "inset 0 0 40px rgba(0,0,0,.55)",
                }}
            />
        </div>
    );
}

/* ------------------------------------------------------------------ */
/*  Custom hooks                                                       */
/* ------------------------------------------------------------------ */

function tryExtractVoteOwner(s?: SharedState): string | undefined {
    // supporta più shape possibili del tuo stato condiviso
    // es.: { vote: { startedBy } }  oppure { voting: { owner } }  oppure { poll: { createdBy } }
    const anyS = s as any;
    return (
        anyS?.vote?.startedBy ||
        anyS?.vote?.owner ||
        anyS?.voting?.startedBy ||
        anyS?.voting?.owner ||
        anyS?.poll?.createdBy ||
        undefined
    );
}

/** Restituisce l'utente che ha avviato la votazione (se presente nello shared state).
 *  Puoi anche forzarlo passando una prop a LuckyCarousel (vedi sotto). */
function useVoteOwner(forcedOwner?: string) {
    const [owner, setOwner] = React.useState<string | undefined>(forcedOwner);

    React.useEffect(() => {
        let off: (() => void) | null = null;
        (async () => {
            // prima lettura
            const s = await loadSharedState();
            const first = forcedOwner ?? tryExtractVoteOwner(s);
            if (first) setOwner(first);

            // subscribe ai cambiamenti
            off = subscribeSharedState((next: SharedState) => {
                if (forcedOwner) return; // se forzato da prop, non sovrascrivere
                const o = tryExtractVoteOwner(next);
                if (o) setOwner(o);
            });
        })();
        return () => off?.();
    }, [forcedOwner]);

    return owner;
}

function useCenterOffset(viewportRef: React.RefObject<HTMLDivElement>, chipW: number) {
    const [centerOffset, setCenterOffset] = React.useState(0);

    React.useLayoutEffect(() => {
        const el = viewportRef.current;
        if (!el) return;
        const update = () => setCenterOffset(el.clientWidth / 2 - chipW / 2);
        update();
        const ro = new ResizeObserver(update);
        ro.observe(el);
        return () => ro.disconnect();
    }, [viewportRef, chipW]);

    return centerOffset;
}

function useSharedRosterSync({
    lockedEntries,
    setSelected,
    setRemote,
}: {
    lockedEntries: string[] | null;
    setSelected: React.Dispatch<React.SetStateAction<string[]>>;
    setRemote: React.Dispatch<React.SetStateAction<SlotShared | null>>;
}) {
    React.useEffect(() => {
        let off: (() => void) | null = null;
        (async () => {
            const s = await loadSharedState();
            setRemote((s?.slot as SlotShared) || null);

            const roster = (s as any)?.slotRoster?.list as string[] | undefined;
            if (Array.isArray(roster) && !lockedEntries) setSelected(roster.filter(Boolean));

            off = subscribeSharedState((next: SharedState) => {
                setRemote((next?.slot as SlotShared) || null);
                const r = (next as any)?.slotRoster;
                if (r?.list && !lockedEntries) setSelected(r.list.slice());
            });
        })();
        return () => off?.();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [lockedEntries]);
}

function useSlotChannel({
    roomId,
    lockedEntries,
    onSpin,
    onStop,
    onRoster,
}: {
    roomId: string;
    lockedEntries: string[] | null;
    onSpin: (p: SlotShared) => void;
    onStop: (p: SlotShared) => void;
    onRoster: (list: string[]) => void;
}) {
    const chanRef = React.useRef<any>(null);

    React.useEffect(() => {
        if (!sb) return;
        const ch = sb.channel(`slot:${roomId}`, { config: { broadcast: { ack: false } } });

        ch.on("broadcast", { event: "spin" }, (msg) => {
            const payload = msg.payload as SlotShared;
            if (!payload?.runId) return;
            onSpin(payload);
        });

        ch.on("broadcast", { event: "stop" }, (msg) => {
            const payload = msg.payload as SlotShared;
            onStop(payload);
        });

        ch.on("broadcast", { event: "roster" }, (msg) => {
            const { list } = (msg.payload || {}) as { list?: string[] };
            if (Array.isArray(list) && !lockedEntries) onRoster(list.slice());
        });

        ch.subscribe();
        chanRef.current = ch;
        return () => {
            try {
                ch.unsubscribe();
            } catch { }
            chanRef.current = null;
        };
    }, [roomId, lockedEntries, onSpin, onStop, onRoster]);

    const publish = React.useCallback((event: "spin" | "stop" | "roster", payload: any) => {
        try {
            chanRef.current?.send({ type: "broadcast", event, payload });
        } catch { }
    }, []);

    return { publish };
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export function LuckyCarousel({
    candidates,
    onWinner,
    currentUser,
    roomId = "global",
    hostUser,     // DEPRECATO: lasciato per compat, ma preferiamo voteOwner
    voteOwner,    // <-- NEW: chi ha avviato la votazione
}: {
    candidates: string[];
    onWinner?: (name: string) => void;
    currentUser?: string;
    roomId?: string;
    hostUser?: string;   // compat: verrà usato solo se non c’è voteOwner
    voteOwner?: string;  // NEW
}) {
    const ownerFromState = useVoteOwner(voteOwner ?? hostUser); // preferisci voteOwner, fallback hostUser
    const canStart = norm(currentUser) === norm(ownerFromState);
    // selezione locale (sincronizzata quando non gira)
    const [selected, setSelected] = React.useState<string[]>(() => candidates.slice());
    const [localSpin, setLocalSpin] = React.useState<SlotShared | null>(null);
    const [finalPose, setFinalPose] = React.useState<{
        entries: string[];
        targetIndex: number;
        loops: number;
    } | null>(null);
    // lista “congelata” per lo spin in corso
    const [lockedEntries, setLockedEntries] = React.useState<string[] | null>(null);

    // stato remoto condiviso
    const [remote, setRemote] = React.useState<SlotShared | null>(null);
    const [runId, setRunId] = React.useState<string | null>(null);
    const [winnerOpen, setWinnerOpen] = React.useState(false);

    const [showFireworks, setShowFireworks] = React.useState(false);
    const prevWinnerRef = React.useRef<string | null>(null);
    // animazione
    const viewportRef = React.useRef<HTMLDivElement>(null);
    const rafRef = React.useRef<number | null>(null);
    const [progress, setProgress] = React.useState(0); // 0..1 easing
    const chipW = useChipWidth(viewportRef);
    const centerOffset = useCenterOffset(viewportRef, chipW);


    const inUse = lockedEntries ?? selected;
    const N = Math.max(1, inUse.length);

    // Sync shared roster/state
    useSharedRosterSync({ lockedEntries, setSelected, setRemote });

    // Pubblica roster a tutti
    const publishRoster = React.useCallback((list: string[]) => {
        const payload = { list, updatedAt: Date.now() };
        try {
            saveSharedState({ slotRoster: payload } as any);
        } catch { }
        publish("roster", payload);
    }, []); // publish injected later after hook is created
    const [hasStarted, setHasStarted] = React.useState(false);

    // Channel hookup (spin/stop/roster)
    const onSpin = React.useCallback((payload: SlotShared) => {
        setHasStarted(true);
        setRemote(payload);
        setLockedEntries(payload.entries);
        setLocalSpin(payload);
        setFinalPose(null);
        startAnim(payload);
    }, []);
    const onStop = React.useCallback((payload: SlotShared) => {
        setRemote(payload);
        setLockedEntries(null);
        setLocalSpin(null);
        setFinalPose({
            entries: payload.entries,
            targetIndex: payload.targetIndex,
            loops: payload.loops,
        });
    }, []);
    const onRoster = React.useCallback(
        (list: string[]) => {
            if (!lockedEntries) setSelected(list);
        },
        [lockedEntries]
    );
    const { publish } = useSlotChannel({ roomId, lockedEntries, onSpin, onStop, onRoster });

    // fix publishRoster closure with publish
    const publishRosterRef = React.useRef<(l: string[]) => void>(() => { });
    React.useEffect(() => {
        publishRosterRef.current = (list: string[]) => {
            const payload = { list, updatedAt: Date.now() };
            try { saveSharedState({ slotRoster: payload } as any); } catch { }
            publish("roster", payload);
        };
    }, [publish]);
    const publishRosterSafe = (list: string[]) => publishRosterRef.current(list);

    // Mantieni selezione in sync con nuovi candidati (se non stai girando)
    React.useEffect(() => {
        if (lockedEntries) return;
        setSelected((prev) => {
            const next = prev.filter((n) => candidates.includes(n));
            return next.length ? next : candidates.slice();
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [candidates]);

    // Toggle helpers
    const toggle = (n: string) => {
        setSelected((prev) => {
            const next = prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n];
            publishRosterSafe(next);
            return next;
        });
    };
    const allOn = () => {
        const next = candidates.slice();
        setSelected(next);
        publishRosterSafe(next);
    };
    const allOff = () => {
        const next: string[] = [];
        setSelected(next);
        publishRosterSafe(next);
    };

    /* --------------------------- Spin lifecycle --------------------------- */

    const cancelAnim = React.useCallback(() => {
        if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
    }, []);

    const finish = React.useCallback(
        async (payload: SlotShared) => {
            cancelAnim();
            setProgress(1);

            const name = payload.entries[payload.targetIndex];
            setFinalPose({
                entries: payload.entries,
                targetIndex: payload.targetIndex,
                loops: payload.loops,
            });
            try {
                const stopped: SlotShared = { ...payload, isSpinning: false, winner: name };
                await saveSharedState({ slot: stopped } as any);
                publish("stop", stopped);
            } catch { }

            setLockedEntries(null);
            setLocalSpin(null);
            onWinner?.(name);
        },
        [cancelAnim, onWinner, publish]
    );

    const startAnim = React.useCallback(
        (payload: SlotShared) => {
            cancelAnim();
            const dur = Math.max(MIN_SPIN_MS, payload.durationMs); // clamp di sicurezza

            const tick = () => {
                const elapsed = Date.now() - payload.startedAt;
                const t = Math.min(1, Math.max(0, elapsed / dur));
                setProgress(t);
                if (t < 1) {
                    rafRef.current = requestAnimationFrame(tick);
                } else {
                    finish(payload);
                }
            };
            rafRef.current = requestAnimationFrame(tick);
        },
        [cancelAnim, finish]
    );

    React.useEffect(() => () => cancelAnim(), [cancelAnim]);

    const handleSpin = async () => {
        if (!canStart) return;
        if (remote?.isSpinning) return;
        if (N === 0) return;
        setHasStarted(true);

        // congela lista
        const entries = inUse.slice();

        // target deterministico per tutti
        const targetIndex = Math.floor(Math.random() * entries.length);

        // durata random ma clampata fra min e max
        const baseMs = 2600 + Math.floor(Math.random() * 600); // 2600–3200
        const durationMs = Math.max(MIN_SPIN_MS, Math.min(MAX_SPIN_MS, baseMs));

        // loops di base (random) ma non sotto il minimo
        let loops = Math.max(MIN_LOOPS, 3 + Math.floor(Math.random() * 2));

        // --- Garantisci velocità minima (px/s) indipendente dal numero di entry ---
        // distanza richiesta = velocità_min * durata
        const minDistancePx = MIN_SPEED_PX * (durationMs / 1000);
        const chipW = DEFAULT_CHIP_W; // o il tuo chipW misurato se lo vuoi usare qui
        const stepsPerLoop = entries.length; // 1 loop = scorrere tutti i chip una volta
        const currentDistancePx = (loops * stepsPerLoop + (targetIndex ?? 0)) * chipW;

        if (currentDistancePx < minDistancePx) {
            const stepsMissing = Math.max(0, Math.ceil(minDistancePx / chipW) - (loops * stepsPerLoop + (targetIndex ?? 0)));
            const extraLoops = Math.ceil(stepsMissing / stepsPerLoop);
            loops = Math.min(MAX_LOOPS, loops + extraLoops);
        }
        // -------------------------------------------------------------------------

        const id = (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`).toString();
        const SYNC_PAD_MS = 300;

        const payload: SlotShared = {
            runId: id,
            startedBy: currentUser || "unknown",
            startedAt: Date.now() + SYNC_PAD_MS,
            durationMs,
            isSpinning: true,
            entries,
            targetIndex,
            loops,
            winner: undefined,
        };

        try { await saveSharedState({ slot: payload } as any); } catch { }
        publish("spin", payload);

        setRunId(id);
        setLockedEntries(entries);
        setLocalSpin(payload);
        startAnim(payload);
    };


    React.useEffect(() => {
        if (!remote) return;

        const isNewRun = remote.isSpinning && remote.runId && remote.runId !== runId;
        if (!isNewRun) return;

        // congela lista localmente e allinea lo stato di animazione
        setLockedEntries(remote.entries);
        setLocalSpin(remote);
        setFinalPose(null);
        startAnim(remote);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [remote?.runId, remote?.isSpinning]);

    React.useEffect(() => {
        if (remote?.winner) {
            setFinalPose({
                entries: remote.entries || [],
                targetIndex: remote.targetIndex ?? 0,
                loops: remote.loops ?? 0,
            });
        }
    }, [remote?.winner]);


    const finalWinner =
        remote?.winner ??
        (finalPose?.entries?.length
            ? finalPose.entries[finalPose.targetIndex ?? 0]
            : null);

    React.useEffect(() => {
        if (finalWinner) setWinnerOpen(true);
    }, [finalWinner]);
    /* --------------------------- Derived UI state ------------------------- */

    // preferisci il payload remoto se sta girando, altrimenti quello locale
    const activeSpin = (remote?.isSpinning ? remote : localSpin?.isSpinning ? localSpin : null) as SlotShared | null;

    // steps da usare (spin attivo -> payload; altrimenti posa finale; altrimenti 0)
    const targetSteps =
        activeSpin
            ? activeSpin.loops * activeSpin.entries.length + (activeSpin.targetIndex ?? 0)
            : finalPose
                ? finalPose.loops * finalPose.entries.length + (finalPose.targetIndex ?? 0)
                : 0;

    const eased = easeOutCubic(progress);
    const rawTranslateX = centerOffset - targetSteps * chipW * eased;
    const translateX = Number.isFinite(rawTranslateX) ? rawTranslateX : 0;

    const globallySpinning = Boolean(activeSpin?.isSpinning);

    const showStartCta = canStart && !globallySpinning && !finalWinner && !hasStarted;
    const togglesDisabled = Boolean(lockedEntries) || Boolean(remote?.isSpinning) || Boolean(remote?.winner) || hasStarted;


    return (
        <Card>
            <div className="mb-2 flex items-center justify-between">
                <div className="text-lg font-bold">Lucky Carousel</div>
                {finalWinner && <WinnerBadge name={finalWinner} />}
            </div>

            <RosterControls
                total={candidates.length}
                included={(lockedEntries ?? selected).length}
                disabled={togglesDisabled}
                onAllOn={allOn}
                onAllOff={allOff}
            />

            <ChipsToggle candidates={candidates} selected={selected} disabled={togglesDisabled} onToggle={toggle} />

            <ViewportTrack
                viewportRef={viewportRef}
                translateX={translateX}
                items={
                    activeSpin?.entries?.length
                        ? activeSpin.entries
                        : finalPose?.entries?.length
                            ? finalPose.entries
                            : inUse.length
                                ? inUse
                                : ["—"]
                }
                isSpinning={Boolean(activeSpin?.isSpinning || finalPose)}
                targetIndex={activeSpin?.targetIndex ?? finalPose?.targetIndex ?? 0}
                loops={activeSpin?.loops ?? finalPose?.loops ?? 0}
                highlightCenter={Boolean(finalPose && !globallySpinning)}
                centerOffset={centerOffset}
                chipW={chipW}
            />

            {/* CTA: solo host vede/clicca */}
            {showStartCta && (
                <div className="mt-4">
                    <button
                        className="group relative rounded-2xl bg-gradient-to-b from-amber-400 to-amber-500 px-5 py-2.5 font-semibold text-black shadow-[0_10px_30px_-10px_rgba(251,191,36,.7)] hover:from-amber-300 hover:to-amber-400 active:scale-[.98] transition"
                        onClick={handleSpin}
                        disabled={N === 0}
                        title="Start the draw"
                    >
                        <span className="relative z-10">{remote?.isSpinning ? "Scrolling…" : "Start the reel"}</span>
                        <span className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-black/10" />
                        <span className="pointer-events-none absolute inset-0 rounded-2xl bg-[linear-gradient(0deg,rgba(255,255,255,.25),transparent_40%)]" />
                    </button>
                </div>
            )}

            {finalWinner && (
                <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-emerald-200">
                    Estratto: <b className="text-emerald-100">{finalWinner}</b>
                </div>
            )}

            <WinnerModal
                isOpen={Boolean(winnerOpen && finalWinner)}
                winnerName={finalWinner || ""}
                // winnerAvatarUrl={...}  // opzionale, se ce l’hai
                onClose={() => {
                    setWinnerOpen(false);
                    window.dispatchEvent(new Event("cn:go-archive"));
                }}
                onArchive={() => {
                    setWinnerOpen(false);
                    window.dispatchEvent(new Event("cn:go-archive"));
                }}
            />
        </Card>
    );
}
