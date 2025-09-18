import React, { useEffect, useMemo, useState } from "react";

export function useNextScreeningTick() {
  const [now, setNow] = useState(() => Date.now());
  const target = useMemo(() => nextThursdayAt21(new Date(now)).getTime(), [now]);

  // calcolo quanto manca
  const msLeft = target - now;
  const useSeconds = msLeft <= 24 * 60 * 60 * 1000; // sotto 1 giorno

  useEffect(() => {
    const dt = useSeconds
      ? 1000 - (now % 1000)          // tick ogni secondo preciso
      : 60000 - (now % 60000);      // tick ogni minuto preciso
    const id = setTimeout(() => setNow(Date.now()), dt);
    return () => clearTimeout(id);
  }, [now, useSeconds]);

  return { now, target };
}

export function nextThursdayAt21(from = new Date()) {
  const d = new Date(from);
  d.setSeconds(0, 0);
  const day = d.getDay();
  const add = (4 - day + 7) % 7;
  const t = new Date(d);
  t.setDate(d.getDate() + add);
  t.setHours(21, 0, 0, 0);
  if (add === 0 && from.getTime() >= t.getTime()) t.setDate(t.getDate() + 7);
  return t;
}

export function fmtCountdown(targetTs: number, nowTs: number) {
  const total = Math.max(0, Math.floor((targetTs - nowTs) / 1000));
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;

  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);

  if (d > 0) {
    return `${d}d ${pad(h)}h ${pad(m)}m`;
  }
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}