const isoToName: Record<string, string> = {
    IT: "Italy", FR: "France", DE: "Germany",
    ES: "Spain", CA: "Canada", JP: "Japan",
    KR: "Korea, Republic of", CN: "China",
    HK: "Hong Kong SAR China", TW: "Taiwan, Province of China",
    IN: "India", AU: "Australia", BR: "Brazil", MX: "Mexico",
};
const aliasMap: Record<string, string> = {
    "United States of America": "United States",
    "Republic of Korea": "Korea, Republic of",
    "South Korea": "Korea, Republic of",
    "S Korea": "Korea, Republic of",
    "Korea South": "Korea, Republic of",
    "Czech Republic": "Czechia",
    Russia: "Russian Federation",
    "Viet Nam": "Vietnam",
    "Soviet Union": "Russia",
    SU: "Russia",
};


export function primaryCountryName(src?: any): string | null {
    if (!src) return null;
    const m = src.movie ?? src;
    let cand: any = m?.primary_country ?? m?.movie?.primary_country ?? null;
    if (!cand) {
        const omdbC = m?.omdb?.Country || m?.Country;
        if (typeof omdbC === "string" && omdbC.trim()) cand = omdbC.split(/[,/|;]/)[0]?.trim();
    }
    if (!cand && Array.isArray(m?.production_countries) && m.production_countries.length) {
        cand = m.production_countries[0]?.name || m.production_countries[0]?.english_name || m.production_countries[0]?.iso_3166_1;
    }
    if (!cand && Array.isArray(m?.origin_country) && m.origin_country.length) cand = m.origin_country[0];
    if (!cand) return null;
    const raw = String(cand).trim();
    const up = raw.toUpperCase();
    if (isoToName[up]) return isoToName[up];
    return aliasMap[raw] || raw;
}


export function safeRuntime(m?: any): number | null {
    const rCand = m?.runtime ?? m?.Runtime ?? m?.duration ?? m?.movie_runtime;
    const r = Number(rCand);
    return Number.isFinite(r) ? r : null;
}
export function safeYear(m?: any): number | null {
    const yCand = m?.year ?? m?.Year ?? m?.release_year ?? (typeof m?.first_air_date === "string" ? m.first_air_date?.slice(0, 4) : undefined) ?? (typeof m?.release_date === "string" ? m.release_date?.slice(0, 4) : undefined);
    const y = Number(yCand);
    return Number.isFinite(y) ? y : null;
}
export function runtimeBuckets(history: any[], user: string) {
    const counts = { short: 0, medium: 0, long: 0 };
    history.filter((h) => (h?.picked_by ?? h?.pickedBy) === user).forEach((h) => {
        const r = safeRuntime(h?.movie);
        if (!r) return;
        if (r < 90) counts.short++;
        else if (r <= 120) counts.medium++;
        else counts.long++;
    });
    return [
        { name: "Short (<90)", count: counts.short },
        { name: "Medium (90–120)", count: counts.medium },
        { name: "Long (>120)", count: counts.long },
    ];
}
export function countryDistribution(history: any[], user: string) {
    const dist: Record<string, number> = {};
    history.filter((h) => (h?.picked_by ?? h?.pickedBy) === user).forEach((h) => {
        const c = primaryCountryName(h);
        if (!c) return;
        dist[c] = (dist[c] || 0) + 1;
    });
    return Object.entries(dist).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
}