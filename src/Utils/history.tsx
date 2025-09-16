export const avgOf = (r?: Record<string, number> | null) => {
    if (!r) return null;
    const vals = Object.values(r).map(Number).filter(Number.isFinite);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
};
export function refScoreFor(v: any): number | null {
    const m = v?.movie || {};
    const cand = m.imdb_rating ?? m.imdbRating ?? m.imdb_score ?? m?.ratings?.imdb ?? m?.omdb?.imdbRating ?? m.vote_average;
    const n = Number(cand);
    return Number.isFinite(n) ? n : null;
}
export function normUser(u?: string | null) { return (u ?? "").trim().toLowerCase(); }
export function getPicker(h: any): string {
    return h?.picked_by ?? h?.pickedBy ?? h?.picker ?? h?.movie?.picked_by ?? h?.movie?.pickedBy ?? h?.movie?.picker ?? "";
}
export function isPickedBy(h: any, user: string) { return normUser(getPicker(h)) === normUser(user); }
export function toOrderKey(view: any, fallbackIndex: number) {
    const ts = Date.parse(view?.started_at || view?.date || view?.created_at || "");
    return Number.isFinite(ts) && ts > 0 ? ts : fallbackIndex;
}