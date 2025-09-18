// supabaseClient.ts
import { createClient } from "@supabase/supabase-js";

/**
 * Supabase client + storage bucket constants
 */
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

/** Shared singleton row id for cn_state */
export const SB_ROW_ID = "main" as const;

/** Storage bucket + keys */
export const STORAGE_BUCKET = "circo";
/** Live file we write to */
export const STORAGE_LIVE_HISTORY_KEY = "history_live.json";

/**
 * If env vars are missing, fall back to null client (app uses localStorage-only mode).
 * In prod, we also pass realtime params to improve throughput.
 */
export const sb = (SUPABASE_URL && SUPABASE_ANON_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      realtime: { params: { eventsPerSecond: 30 } },
    })
  : null;

/* ------------------------------------------------------------------ */
/* Realtime Channel: typed facade + local shim when sb === null       */
/* ------------------------------------------------------------------ */

type BroadcastHandler = (msg: { payload: unknown }) => void;

export interface RealtimeChannelLike {
  on(
    type: "broadcast",
    filter: { event: string },
    cb: BroadcastHandler
  ): RealtimeChannelLike;
  send(msg: { type: "broadcast"; event: string; payload: unknown }): void | Promise<void>;
  subscribe(cb?: (status: string) => void): void;
  unsubscribe(): void;
}

/** Very small in-memory channel used when sb === null (dev/offline). */
class LocalChannel implements RealtimeChannelLike {
  private listeners = new Map<string, Set<BroadcastHandler>>();
  constructor(private key: string) {}
  on(_: "broadcast", filter: { event: string }, cb: BroadcastHandler) {
    const set = this.listeners.get(filter.event) ?? new Set<BroadcastHandler>();
    set.add(cb);
    this.listeners.set(filter.event, set);
    return this;
  }
  send(msg: { type: "broadcast"; event: string; payload: unknown }) {
    const set = this.listeners.get(msg.event);
    if (!set) return;
    const packet = { payload: msg.payload };
    set.forEach((fn) => fn(packet));
  }
  subscribe(cb?: (status: string) => void) {
    cb?.("SUBSCRIBED");
  }
  unsubscribe() {
    this.listeners.clear();
  }
}

/** Cache per stanza per riutilizzare i canali */
const channelCache = new Map<string, RealtimeChannelLike>();

/**
 * Ottieni (o crea) il canale realtime per una stanza.
 * - In produzione: usa Supabase Realtime (broadcast low-latency).
 * - In dev/offline (sb === null): usa LocalChannel in-memory (nessuna persistenza).
 */
export function getRoomChannel(roomId: string): RealtimeChannelLike {
  const key = `room:${roomId}`;
  if (channelCache.has(key)) return channelCache.get(key)!;

  if (!sb) {
    const ch = new LocalChannel(key);
    ch.subscribe(); // no-op, ma uniforma il flusso
    channelCache.set(key, ch);
    return ch;
  }

  // @ts-expect-error: tipizzazione rilassata per compat con Like
  const ch: RealtimeChannelLike = sb.channel(key, {
    config: { broadcast: { ack: false } },
  });

  ch.subscribe?.((status: string) => {
    // opzionale: telemetry/log
    // console.debug("[realtime]", key, status);
  });

  channelCache.set(key, ch);
  return ch;
}

/**
 * Helper comodo per inviare un broadcast.
 * Esempio:
 *   broadcast(roomId, "slot", { kind: "slot.start", ... })
 */
export function broadcast(roomId: string, event: string, payload: unknown) {
  const ch = getRoomChannel(roomId);
  return ch.send({ type: "broadcast", event, payload });
}
