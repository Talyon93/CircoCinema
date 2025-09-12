
// utils/math.ts
export function clamp(n: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, n)); }
export function linspace(a: number, b: number, n: number) {
  return Array.from({length:n}, (_,i)=> a + (i*(b-a))/(n-1));
}
export function mean(xs: number[]) { return xs.length ? xs.reduce((a,b)=>a+b,0)/xs.length : 0; }
export function variance(xs: number[]) { const m = mean(xs); return xs.length ? xs.reduce((s,x)=>s+(x-m)*(x-m),0)/xs.length : 0; }
export function stdev(xs: number[]) { return Math.sqrt(variance(xs)); }
export function pearson(x: number[], y: number[]) {
  const mx = mean(x), my = mean(y);
  let num = 0, dx = 0, dy = 0;
  for (let i=0;i<x.length;i++){ const a=x[i]-mx, b=y[i]-my; num+=a*b; dx+=a*a; dy+=b*b; }
  const den = Math.sqrt(dx*dy);
  return den===0 ? 0 : num/den;
}
// jitter helpers (deterministic)
export function djb2(str: string) { let h=5381; for (let i=0;i<str.length;i++) h=((h<<5)+h)+str.charCodeAt(i); return h>>>0; }
export function seededJitter(key: string, spread=1) {
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
