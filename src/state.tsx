import { sb, SB_ROW_ID } from "./supabaseClient";
import { K_VIEWINGS, K_ACTIVE_VOTE, K_ACTIVE_RATINGS, lsGetJSON, lsSetJSON } from "./localStorage";

/**
 * Shared "room state" kept in table `cn_state`.
 * When `sb` is null, we fall back to localStorage-only mode.
 */

export type RatingMap = Record<string, number>;

export type SharedState = {
  id: string;
  history: any[];
  active: any | null;
  ratings: RatingMap;
  updated_at?: string;
};

/** Load current shared state from DB (or localStorage fallback). */
export async function loadSharedState(): Promise<SharedState> {
  if (!sb) {
    return {
      id: SB_ROW_ID,
      history: lsGetJSON<any[]>(K_VIEWINGS, []),
      active: lsGetJSON<any | null>(K_ACTIVE_VOTE, null),
      ratings: lsGetJSON<RatingMap>(K_ACTIVE_RATINGS, {}),
    };
  }
  const { data, error } = await sb
    .from("cn_state")
    .select("*")
    .eq("id", SB_ROW_ID)
    .single();
  if (error || !data) {
    return { id: SB_ROW_ID, history: [], active: null, ratings: {} };
  }
  return data as SharedState;
}

/** Upsert (merge) the shared state; also mirrors to localStorage for resilience. */
export async function saveSharedState(partial: Partial<SharedState>) {
  // helper: mirror su localStorage per tab sync locale
  const writeLocal = (s: Partial<SharedState>) => {
    if (s.history) lsSetJSON(K_VIEWINGS, s.history);
    if ("active" in s) lsSetJSON(K_ACTIVE_VOTE, s.active ?? null);
    if (s.ratings) lsSetJSON(K_ACTIVE_RATINGS, s.ratings);
  };

  if (!sb) {
    writeLocal(partial);
    return { error: null as any };
  }

  const current = await loadSharedState();
  const next: SharedState = {
    id: SB_ROW_ID,
    history: partial.history ?? current.history,
    active: partial.active === undefined ? current.active : partial.active,
    ratings: partial.ratings ?? current.ratings,
    updated_at: new Date().toISOString(),
  };

  const { error } = await sb.from("cn_state").upsert(next, { onConflict: "id" });
  if (error) {
    console.error("[saveSharedState] upsert error:", error);
    return { error };
  }

  // write-through locale per test in locale + resilienza
  writeLocal(next);
  return { error: null as any };
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
