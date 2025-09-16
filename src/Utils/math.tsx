
// utils/math.ts
export function clamp(n: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, n)); }
export function linspace(a: number, b: number, n: number) {
  return Array.from({ length: n }, (_, i) => a + (i * (b - a)) / (n - 1));
}
export function mean(xs: number[]) { return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0; }
export function variance(xs: number[]) { const m = mean(xs); return xs.length ? xs.reduce((s, x) => s + (x - m) * (x - m), 0) / xs.length : 0; }
export function stdev(xs: number[]) { return Math.sqrt(variance(xs)); }
export function pearson(x: number[], y: number[]) {
  const mx = mean(x), my = mean(y);
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < x.length; i++) { const a = x[i] - mx, b = y[i] - my; num += a * b; dx += a * a; dy += b * b; }
  const den = Math.sqrt(dx * dy);
  return den === 0 ? 0 : num / den;
}
export function djb2(str: string) { let h = 5381; for (let i = 0; i < str.length; i++) h = ((h << 5) + h) + str.charCodeAt(i); return h >>> 0; }
export function seededJitter(key: string, spread = 1) {
  const r = (djb2(key) % 1000) / 1000;
  return (r - 0.5) * 2 * spread; // -spread..spread
}

// Average of a ratings record
export function avgOf(r?: Record<string, number> | null) {
  if (!r) return null;
  const vals = Object.values(r).map(Number).filter((x) => Number.isFinite(x));
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

export function median(arr: number[]) {
  if (!arr.length) return null;
  const a = [...arr].sort((x, y) => x - y);
  const mid = Math.floor(a.length / 2);
  return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
}
export function stddev(arr: number[]) {
  if (arr.length < 2) return null;
  const m = arr.reduce((s, x) => s + x, 0) / arr.length;
  const v = arr.reduce((s, x) => s + (x - m) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(v);
}
export function corr(a: number[], b: number[]) {
  const n = Math.min(a.length, b.length);
  if (n < 2) return null;
  const ax = a.slice(0, n), bx = b.slice(0, n);
  const ma = ax.reduce((s, x) => s + x, 0) / n;
  const mb = bx.reduce((s, x) => s + x, 0) / n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) {
    const xa = ax[i] - ma, xb = bx[i] - mb;
    num += xa * xb; da += xa * xa; db += xb * xb;
  }
  const den = Math.sqrt(da * db);
  return den ? Math.round((num / den) * 100) / 100 : null;
}

export function getAverage(r: Record<string, number> | undefined | null) {
  if (!r) return null;
  const vals = Object.values(r).map(Number);
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

export function roundToQuarter(n: number) {
  return Math.round(n / 0.25) * 0.25;
}