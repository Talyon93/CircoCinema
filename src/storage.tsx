import { sb, STORAGE_BUCKET, STORAGE_BASE_HISTORY_KEY, STORAGE_LIVE_HISTORY_KEY } from "./supabaseClient";
import { lsSetJSON, K_VIEWINGS } from "./localStorage";
import { saveSharedState } from "./state";

/**
 * Storage helpers for history.json files (seed + live).
 */

async function downloadJSON(key: string): Promise<any[] | null> {
  if (!sb) return null;
  try {
    const { data, error } = await sb.storage.from(STORAGE_BUCKET).download(key);
    if (error || !data) return null;
    const text = await data.text();
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : null;
  } catch (e) {
    console.error(`[downloadJSON] ${key} exception:`, e);
    return null;
  }
}

async function uploadJSON(key: string, list: any[]): Promise<{ error: any | null }> {
  if (!sb) return { error: null };
  try {
    const blob = new Blob([JSON.stringify(list, null, 2)], { type: "application/json" });
    const { error } = await sb.storage
      .from(STORAGE_BUCKET)
      .upload(key, blob, { upsert: true, contentType: "application/json" });
    if (error) {
      console.error(`[uploadJSON] ${key} error:`, error);
      return { error };
    }
    return { error: null };
  } catch (e) {
    console.error(`[uploadJSON] ${key} exception:`, e);
    return { error: e };
  }
}

/** Public: download arbitrary key (array expected). */
export const downloadJSONFromStorage = (key: string) => downloadJSON(key);

/** Carica prima il LIVE, se non esiste torna il BASE */
export async function loadHistoryFromStoragePreferLive(): Promise<{ list: any[]; source: "live" | "base" | null }> {
  if (!sb) return { list: [], source: null };
  const live = await downloadJSON(STORAGE_LIVE_HISTORY_KEY);
  if (Array.isArray(live)) return { list: live, source: "live" };
  const base = await downloadJSON(STORAGE_BASE_HISTORY_KEY);
  if (Array.isArray(base)) return { list: base, source: "base" };
  return { list: [], source: null };
}

/** Scrive SOLO il LIVE (non tocca il BASE) */
export const saveLiveHistoryToStorage = (list: any[]) =>
  uploadJSON(STORAGE_LIVE_HISTORY_KEY, list);

/** Se non esiste ancora il LIVE, crealo copiando il seed BASE */
export async function ensureLiveFileExists(seedList: any[]) {
  if (!sb) return;
  const live = await downloadJSON(STORAGE_LIVE_HISTORY_KEY);
  if (!Array.isArray(live)) {
    const { error } = await saveLiveHistoryToStorage(seedList);
    if (!error) {
      // opzionale ma utile per coerenza realtime
      await saveSharedState({ history: seedList });
    }
  }
}

/** Persist history:
 * - offline: mirror su localStorage
 * - online: upload live + trigger cn_state update + (opzionale) round-trip check
 */
export async function persistHistory(list: any[], opts?: { roundTripCheck?: boolean }) {
  // Update ottimistico già fatto a monte (setHistory(list))
  if (!sb) {
    lsSetJSON(K_VIEWINGS, list);
    return;
  }

  // 1) Scrivi SOLO sul LIVE
  const { error: upErr } = await saveLiveHistoryToStorage(list);

  // 2) Aggiorna cn_state per realtime + fallback
  const { error: stErr } = await saveSharedState({});

  if (upErr || stErr) {
    console.error("[persistHistory] errors", { upErr, stErr });
    alert("Non sono riuscito a salvare sul server. Controlla le policy del bucket/tabella (vedi console).");
    return;
  }

  // 3) (Opzionale) Round-trip dal LIVE
  if (opts?.roundTripCheck) {
    const roundTrip = await downloadJSON(STORAGE_LIVE_HISTORY_KEY);
    if (!Array.isArray(roundTrip) || roundTrip.length !== list.length) {
      console.warn("[persistHistory] roundTrip mismatch", { roundTripLen: roundTrip?.length, expected: list.length });
    }
  }
}
