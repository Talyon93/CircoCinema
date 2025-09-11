import { createClient } from "@supabase/supabase-js";

/**
 * Supabase client + storage bucket constants
 */
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

/** Shared singleton row id for cn_state */
export const SB_ROW_ID = "singleton" as const;

/** Storage bucket + keys */
export const STORAGE_BUCKET = "circo";
/** Seed (read-only) */
export const STORAGE_BASE_HISTORY_KEY = "history.json";
/** Live file we write to */
export const STORAGE_LIVE_HISTORY_KEY = "history_live.json";

/**
 * If env vars are missing, fall back to null client (app uses localStorage-only mode).
 */
export const sb = (SUPABASE_URL && SUPABASE_ANON_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;
