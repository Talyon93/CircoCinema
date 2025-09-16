/**
 * LocalStorage helpers + app keys + lightweight caches
 */

// ===== LocalStorage keys (scoped for this app) =====
export const K_USER = "cn_user";
export const K_VIEWINGS = "cn_viewings";
export const K_ACTIVE_VOTE = "cn_active_vote";       // { id, movie, picked_by, started_at }
export const K_ACTIVE_RATINGS = "cn_active_ratings"; // { [user]: number }
export const K_PROFILE_PREFIX = "cn_profile_";       // `${K_PROFILE_PREFIX}${username}` -> { avatar?: string }
export const K_TMDB_CACHE = "cn_tmdb_cache";         // cache poster/overview per titolo
export const K_THEME = "cn_theme";                   // 'light' | 'dark'
export const K_NEXT_PICKER = "cn_next_picker"; // { name: string; decidedAt?: number } | null

export function lsGetJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function lsSetJSON(key: string, value: any) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

type MetaCache = Record<string, { poster_path?: string; overview?: string }>;
export function getMetaCache(): MetaCache {
  return lsGetJSON<MetaCache>(K_TMDB_CACHE, {});
}

export function setMetaCache(cache: MetaCache) {
  lsSetJSON(K_TMDB_CACHE, cache);
}

export function loadAvatarFor(name: string): string | null {
  try {
    const raw = localStorage.getItem(`${K_PROFILE_PREFIX}${name}`);
    if (!raw) return null;
    const obj = JSON.parse(raw || "{}");
    return obj?.avatar || null;
  } catch {
    return null;
  }
}
