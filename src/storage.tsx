import { saveSharedState, loadSharedState } from "./state";
import { sb, STORAGE_BUCKET, STORAGE_LIVE_HISTORY_KEY } from "./supabaseClient";


async function downloadJsonSafe<T = any>(bucket: string, key: string): Promise<T | null> {
  try {
    if (!sb) return null;
    const { data, error } = await sb.storage.from(bucket).download(key);
    if (error || !data) return null;
    const txt = await data.text();
    return JSON.parse(txt) as T;
  } catch {
    return null;
  }
}


async function sha256(text: string): Promise<string> {
  const enc = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  const arr = Array.from(new Uint8Array(buf));
  return arr.map(b => b.toString(16).padStart(2, "0")).join("");
}

function buildBackupKey(prefix = "backups/history") {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(
    d.getHours()
  )}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
  return `${prefix}/${stamp}.json`;
}

// ============ API richieste ============

/** Crea il file live/history.json se non esiste (inizialmente []) + 1 backup. */
export async function ensureLiveFileExists(): Promise<void> {
  if (!sb) return;
  const current = await downloadJsonSafe<any[]>(STORAGE_BUCKET, STORAGE_LIVE_HISTORY_KEY);
  if (current) return;

  const initial: any[] = [];
  const blob = new Blob([JSON.stringify(initial, null, 2)], { type: "application/json" });

  await sb.storage.from(STORAGE_BUCKET).upload(STORAGE_LIVE_HISTORY_KEY, blob, { upsert: true });

  // backup iniziale
  const backupKey = buildBackupKey();
  await sb.storage.from(STORAGE_BUCKET).upload(backupKey, blob, { upsert: false }).catch(() => {});

  // aggiorna rev (facoltativo)
  const state = await loadSharedState();
  const nextRev = Number((state as any)?.history_live_rev || 0) + 1;
  await saveSharedState({ history: initial, history_live_rev: nextRev }, { allowEmptyHistory: true });
}

/** Carica lo storico live; se fallisce ritorna []. */
export async function loadHistoryLive(): Promise<any[]> {
  const list = await downloadJsonSafe<any[]>(STORAGE_BUCKET, STORAGE_LIVE_HISTORY_KEY);
  return Array.isArray(list) ? list : [];
}

/**
 * Salva lo storico:
 * - Skippa se `viewings.length < minLength` (default 2), a meno che `allowDrasticDrop` sia true.
 * - Skippa se identico all’ultimo (via hash).
 * - Fa un backup con timestamp.
 * - Aggiorna lo sharedState (history_live_rev).
 */
export async function persistHistoryLive(
  viewings: any[],
  opts: {
    minLength?: number;
    allowDrasticDrop?: boolean;
    makeBackup?: boolean;
  } = {}
): Promise<void> {
  const { minLength = 2, allowDrasticDrop = false, makeBackup = true } = opts;

  if (!Array.isArray(viewings)) return;
  if (viewings.length < minLength && !allowDrasticDrop) {
    console.warn("⚠️ persistHistoryLive: array vuoto o troppo piccolo -> skip.");
    return;
  }

  if (!sb) return; // offline: ci pensa il ramo localStorage in CinemaNightApp

  try {
    const prev = await downloadJsonSafe<any[]>(STORAGE_BUCKET, STORAGE_LIVE_HISTORY_KEY);
    const prevHash = prev ? await sha256(JSON.stringify(prev)) : null;
    const nextHash = await sha256(JSON.stringify(viewings));

    if (prevHash && prevHash === nextHash) {
      // identico: aggiorno solo la rev per tenere i client in sync, senza scrivere lo storage
      const state = await loadSharedState();
      const nextRev = Number((state as any)?.history_live_rev || 0) + 1;
      await saveSharedState(
        { history: viewings, active: null, ratings: {}, history_live_rev: nextRev },
        { allowEmptyHistory: allowDrasticDrop }
      );
      return;
    }

    const blob = new Blob([JSON.stringify(viewings, null, 2)], { type: "application/json" });
    const up = await sb.storage.from(STORAGE_BUCKET).upload(STORAGE_LIVE_HISTORY_KEY, blob, { upsert: true });
    if (up.error) {
      console.error("[persistHistoryLive] upload error:", up.error);
      throw up.error;
    }

    if (makeBackup) {
      const backupKey = buildBackupKey();
      await sb.storage.from(STORAGE_BUCKET).upload(backupKey, blob, { upsert: false }).catch(() => {});
    }

    const state = await loadSharedState();
    const nextRev = Number((state as any)?.history_live_rev || 0) + 1;
    await saveSharedState(
      { history: viewings, active: null, ratings: {}, history_live_rev: nextRev },
      { allowEmptyHistory: allowDrasticDrop }
    );
  } catch (err) {
    console.error("[persistHistoryLive] fatal:", err);
  }
}

/**
 * Sottoscrizione “leggera” ai cambi del live history.
 * Supabase Storage non ha Realtime sul file, quindi facciamo polling con ETag/hash.
 * @returns unsubscribe()
 */
export function subscribeHistoryLive(
  cb: (next: any[]) => void,
  opts: { intervalMs?: number } = {}
): () => void {
  const { intervalMs = 5000 } = opts;
  let alive = true;
  let lastHash: string | null = null;

  const tick = async () => {
    if (!alive) return;
    try {
      const list = await loadHistoryLive();
      const hash = await sha256(JSON.stringify(list));
      if (hash !== lastHash) {
        lastHash = hash;
        cb(list);
      }
    } catch {
      // ignore
    } finally {
      if (alive) setTimeout(tick, intervalMs);
    }
  };

  // avvio immediato
  tick();

  // unsubscribe
  return () => {
    alive = false;
  };
}