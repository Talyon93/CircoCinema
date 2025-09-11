import { sb, STORAGE_BUCKET, STORAGE_LIVE_HISTORY_KEY } from "./supabaseClient";
import { loadSharedState, saveSharedState, subscribeSharedState } from "./state";

type Viewings = any[];

/** Crea il file live se non esiste (idempotente) */
export async function ensureLiveFileExists(): Promise<void> {
  const { data, error } = await sb.storage.from(STORAGE_BUCKET).list("", {
    search: STORAGE_LIVE_HISTORY_KEY,
  });
  if (!error && data?.some(f => f.name === STORAGE_LIVE_HISTORY_KEY)) return;

  await sb.storage.from(STORAGE_BUCKET).upload(
    STORAGE_LIVE_HISTORY_KEY,
    new Blob([JSON.stringify([])], { type: "application/json" }),
    { upsert: true }
  );
}

/** Carica SEMPRE da history_live (no fallback a history/localStorage) */
export async function loadHistoryLive(): Promise<Viewings> {
  await ensureLiveFileExists();

  const { data, error } = await sb.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(STORAGE_LIVE_HISTORY_KEY, 60);

  if (error || !data?.signedUrl) return [];

  const res = await fetch(data.signedUrl, { cache: "no-store" });
  if (!res.ok) return [];
  const json = await res.json();
  return Array.isArray(json) ? json : (json?.viewings || []);
}

export async function persistHistoryLive(viewings: any[]): Promise<void> {
  const blob = new Blob([JSON.stringify(viewings, null, 2)], { type: "application/json" });
  await sb.storage.from(STORAGE_BUCKET).upload(STORAGE_LIVE_HISTORY_KEY, blob, { upsert: true });

  const state = await loadSharedState();
  const nextRev = Number((state as any)?.history_live_rev || 0) + 1;
  await saveSharedState({ ...state, history_live_rev: nextRev });
}

export function subscribeHistoryLive(onChange: (v: any[]) => void): () => void {
  // ✅ passa solo la callback (l'API accetta 1 argomento)
  return subscribeSharedState(async (next) => {
    if (typeof (next as any)?.history_live_rev !== "undefined") {
      const v = await loadHistoryLive();
      onChange(Array.isArray(v) ? v : []);
    }
  });
}