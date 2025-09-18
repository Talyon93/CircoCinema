import { sb, SB_ROW_ID } from "./supabaseClient";
import { K_VIEWINGS, K_ACTIVE_VOTE, K_ACTIVE_RATINGS, lsGetJSON, lsSetJSON, K_NEXT_PICKER  } from "./localStorage";

/**
 * Shared "room state" kept in table `cn_state`.
 * When `sb` is null, we fall back to localStorage-only mode.
 */

export type RatingMap = Record<string, number>;
export type NextPicker = { name: string; decided_at?: string };

export type SharedState = {
  id: string;
  history: any[];
  active: any | null;
  ratings: RatingMap;
  nextPicker?: NextPicker | null;
  updated_at?: string;
  [k: string]: any;
};

/** Load current shared state from DB (or localStorage fallback). */
export async function loadSharedState(): Promise<SharedState> {
  if (!sb) {
    return {
      id: SB_ROW_ID,
      history: lsGetJSON<any[]>(K_VIEWINGS, []),
      active: lsGetJSON<any | null>(K_ACTIVE_VOTE, null),
      ratings: lsGetJSON<RatingMap>(K_ACTIVE_RATINGS, {}),
      nextPicker: lsGetJSON<NextPicker | null>(K_NEXT_PICKER, null),
    };
  }
  const { data, error } = await sb.from("cn_state").select("*").eq("id", SB_ROW_ID).single();
  if (error || !data) return { id: SB_ROW_ID, history: [], active: null, ratings: {}, nextPicker: null };
  return data as SharedState;
}

/** Upsert (merge) the shared state; also mirrors to localStorage for resilience. */
type SaveSharedStateOptions = {
  /** Se true, consente di salvare una history vuota (wipe intenzionale). Default: false */
  allowEmptyHistory?: boolean;
};

export async function saveSharedState(
  partial: Partial<SharedState>,
  opts: SaveSharedStateOptions = {}
) {
  const { allowEmptyHistory = false } = opts;

  const writeLocal = (s: Partial<SharedState>) => {
    // ⚠️ NON scrivere la history vuota se non consentito
    if (Array.isArray(s.history)) {
      if (s.history.length === 0 && !allowEmptyHistory) {
        // skip write di history vuota
      } else {
        lsSetJSON(K_VIEWINGS, s.history);
      }
    }

    if ("active" in s) lsSetJSON(K_ACTIVE_VOTE, s.active ?? null);
    if (s.ratings) lsSetJSON(K_ACTIVE_RATINGS, s.ratings);
    if ("nextPicker" in s) lsSetJSON(K_NEXT_PICKER, s.nextPicker ?? null);
  };

  // Se non c'è Supabase → solo locale con guardrail
  if (!sb) {
    // Droppa history vuota se non consentito
    const localPayload = { ...partial };
    if (Array.isArray(localPayload.history) && localPayload.history.length === 0 && !allowEmptyHistory) {
      delete (localPayload as any).history;
    }
    writeLocal(localPayload);
    // Se abbiamo droppato la history, ritorna info utile
    if (!allowEmptyHistory && "history" in partial && Array.isArray(partial.history) && partial.history.length === 0) {
      return { error: { code: "refused_empty_history", message: "Skipped empty history (local)." } as any };
    }
    return { error: null as any };
  }

  // ===== Supabase path =====
  const current = await loadSharedState();

  // Prepara il payload "next" unendo allo stato corrente
  const next: SharedState = {
    ...current,
    ...partial,
    id: SB_ROW_ID,
    updated_at: new Date().toISOString(),
  };

  // 1) Guardrail: rifiuta history vuota se non consentito -> togli la chiave dal payload
  let refusedEmptyHistory = false;
  if (Array.isArray(next.history) && next.history.length === 0 && !allowEmptyHistory) {
    delete (next as any).history;
    refusedEmptyHistory = true;
  }

  // 2) Se non c'è alcuna differenza rispetto a current e non stai forzando history vuota, puoi anche evitare la write (opzionale)
  // (lasciamo la upsert per semplicità/trasparenza)

  const { error } = await sb.from("cn_state").upsert(next, { onConflict: "id" });
  if (error) {
    console.error("[saveSharedState] upsert error:", error);
    return { error };
  }

  // 3) Scrivi in locale ciò che è stato effettivamente permesso
  writeLocal(next);

  if (refusedEmptyHistory) {
    return { error: { code: "refused_empty_history", message: "Skipped empty history." } as any };
  }

  return { error: null as any };
}

export async function setNextPicker(name: string | null) {
  const payload = name
    ? { nextPicker: { name, decided_at: new Date().toISOString() } }
    : { nextPicker: null };
  return saveSharedState(payload);
}

export async function clearNextPicker() {
  return saveSharedState({ nextPicker: null });
}


/** Subscribe to realtime changes on cn_state and refetch on notify. */
export function subscribeSharedState(onChange: (s: SharedState) => void) {
  if (!sb) return () => {};

  // canale con nome unico (evita collisioni in hot reload)
  const ch = sb.channel(`cn_state_realtime_${Math.random().toString(36).slice(2)}`);

  const handle = async (payload: any) => {
    const id = payload?.new?.id ?? payload?.old?.id;
    if (id !== SB_ROW_ID) return; // filtra lato client

    // ✅ read-after-notify: ricarica lo stato canonico
    const { data, error } = await sb
      .from("cn_state")
      .select("*")
      .eq("id", SB_ROW_ID)
      .single();

    if (!error && data) {
      onChange(data as SharedState);
    } else {
      console.warn("[RT READBACK] error", error);
    }
  };

  ch.on("postgres_changes", { event: "INSERT", schema: "public", table: "cn_state" }, handle)
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "cn_state" }, handle)
    .on("postgres_changes", { event: "DELETE", schema: "public", table: "cn_state" }, handle)
    .subscribe((status) => {
      console.log("[RT STATUS]", status);
      // 🔁 autoripartenza in caso di problemi
      if (status === "TIMED_OUT" || status === "CHANNEL_ERROR" || status === "CLOSED") {
        setTimeout(() => ch.subscribe(), 500);
      }
    });

  return () => sb.removeChannel(ch);
}

/** Atomic rating set via stored procedure; falls back to upsert merge. */
export async function setRatingAtomic(user: string, score: number) {
  if (!sb) {
    const cur = lsGetJSON<RatingMap>(K_ACTIVE_RATINGS, {});
    cur[user] = score;
    lsSetJSON(K_ACTIVE_RATINGS, cur);
    return;
  }

  const { error } = await sb.rpc("cn_set_rating", {
    _id: SB_ROW_ID,
    _user: user,
    _score: score,
  });

  if (error) {
    console.warn("[setRatingAtomic] RPC failed, fallback to upsert:", error);
    // fallback: leggo lo stato e scrivo il merge via upsert (meno atomico, ma funziona)
    const cur = (await loadSharedState())?.ratings || {};
    cur[user] = score;
    await saveSharedState({ ratings: cur });
  }
}
