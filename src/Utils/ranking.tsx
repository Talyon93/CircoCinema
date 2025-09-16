import { Viewing } from "../types/viewing";
import { getAverage } from "./math";

export function buildDenseRanking(history: Viewing[]) {
  const items = history
    .map((h) => ({ id: h.id, avg: getAverage(h?.ratings) }))
    .filter((x) => x.avg != null) as { id: any; avg: number }[];

  items.sort((a, b) => b.avg - a.avg);

  const map = new Map<any, number>();
  let prev: number | null = null;
  let rank = 0;
  items.forEach((it, idx) => {
    if (prev === null || it.avg !== prev) {
      rank = idx + 1;
      prev = it.avg;
    }
    map.set(it.id, rank);
  });

  return { map, total: items.length };
}
