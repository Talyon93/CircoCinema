// src/avatars.ts
import { sb } from "./supabaseClient";

const BUCKET = "Avatars";

// cache in‐mem per evitare richieste ripetute
const cache = new Map<string, string | null>();

function slug(s: string) {
  return (s || "")
    .normalize("NFKD")
    .replace(/[^\w\s.-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase();
}

/** Ritorna l'URL pubblico dell'avatar (o null se assente). */
export async function fetchAvatarUrl(name: string): Promise<string | null> {
  if (!name) return null;
  if (cache.has(name)) return cache.get(name)!;

  // 1) prova a leggere il path dalla tabella
  const { data, error } = await sb
    .from("cn_profiles")
    .select("avatar_path")
    .eq("name", name)
    .single();

  if (error || !data?.avatar_path) {
    cache.set(name, null);
    return null;
  }

  // 2) costruisci l'URL pubblico dal bucket
  const { data: pub } = sb.storage.from(BUCKET).getPublicUrl(data.avatar_path);
  const url = pub?.publicUrl || null;

  cache.set(name, url);
  return url;
}

/** Carica un nuovo avatar per l’utente e aggiorna la tabella. */
export async function uploadAvatar(name: string, file: File): Promise<string> {
  const ext = (file.name.split(".").pop() || "png").toLowerCase();
  // path: una cartella per utente + timestamp per bustare cache
  const path = `${slug(name)}/${Date.now()}.${ext}`;

  // upload su bucket
  const up = await sb.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: true,
    contentType: file.type || `image/${ext}`,
  });
  if (up.error) throw up.error;

  // salva/aggiorna il path in tabella
  const upsert = await sb.from("cn_profiles").upsert(
    { name, avatar_path: path, updated_at: new Date().toISOString() },
    { onConflict: "name" }
  );
  if (upsert.error) throw upsert.error;

  // URL pubblico
  const { data: pub } = sb.storage.from(BUCKET).getPublicUrl(path);
  const url = pub?.publicUrl!;
  cache.set(name, url);
  return url;
}

/** Sottoscrizione realtime agli avatar (facoltativa ma comoda) */
export function subscribeAvatars(onChange: (name: string) => void) {
  const ch = sb
    .channel("cn_profiles-avatars")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "cn_profiles" },
      (payload) => {
        const name = (payload.new?.name || payload.old?.name) as string;
        if (name) {
          cache.delete(name); // invalida cache locale
          onChange(name);
        }
      }
    )
    .subscribe();
  return () => sb.removeChannel(ch);
}

export async function removeAvatar(name: string) {
  // Leggi il vecchio path
  const { data, error } = await sb
    .from("cn_profiles")
    .select("avatar_path")
    .eq("name", name)
    .single();
  if (error) throw error;

  const path = data?.avatar_path as string | null;

  // Svuota la colonna (manteniamo l'utente)
  const up = await sb
    .from("cn_profiles")
    .upsert({ name, avatar_path: null, updated_at: new Date().toISOString() }, { onConflict: "name" });
  if (up.error) throw up.error;

  // Opzionale: elimina il file dal bucket se presente
  if (path) {
    await sb.storage.from(BUCKET).remove([path]);
  }
}