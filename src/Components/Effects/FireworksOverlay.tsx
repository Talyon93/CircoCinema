// ../Components/UI/FireworksCanvas.tsx
import React from "react";

export function FireworksCanvas({ running }: { running: boolean }) {
  const ref = React.useRef<HTMLCanvasElement | null>(null);
  const raf = React.useRef<number | null>(null);

  React.useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // dimensioni
    let w = (canvas.width = canvas.offsetWidth || window.innerWidth);
    let h = (canvas.height = canvas.offsetHeight || window.innerHeight);

    const onResize = () => {
      w = canvas.width = canvas.offsetWidth || window.innerWidth;
      h = canvas.height = canvas.offsetHeight || window.innerHeight;
    };

    const ro = new ResizeObserver(onResize);
    ro.observe(canvas);
    window.addEventListener("resize", onResize);

    type Particle = {
      x: number; y: number; vx: number; vy: number;
      life: number; max: number; size: number; hue: number;
      spark?: boolean;
    };

    const parts: Particle[] = [];
    const rnd = (a: number, b: number) => a + Math.random() * (b - a);
    const spawn = () => {
      const cx = rnd(w * 0.15, w * 0.85);
      const cy = rnd(h * 0.15, h * 0.55);
      const count = 55 + (Math.random() * 35) | 0;
      const baseHue = rnd(30, 55); // oro/arancio caldo
      for (let i = 0; i < count; i++) {
        const ang = (Math.PI * 2 * i) / count;
        const spd = rnd(1.4, 3.0);
        parts.push({
          x: cx, y: cy,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          life: 0,
          max: rnd(45, 80),
          size: rnd(1.2, 2.2),
          hue: baseHue + rnd(-6, 6),
          spark: Math.random() < 0.25,
        });
      }
    };

    // scia morbida + bloom
    ctx.globalCompositeOperation = "lighter";
    let frame = 0;

    const loop = () => {
      if (!running) return; // stop quando la modale è chiusa
      raf.current = requestAnimationFrame(loop);

      // fade trasparente per trail
      ctx.fillStyle = "rgba(0,0,0,0.14)";
      ctx.fillRect(0, 0, w, h);

      // lancia fuochi a ritmo
      if (frame % 22 === 0) spawn();
      frame++;

      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.life++;
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.018; // gravità

        const t = p.life / p.max;
        if (t >= 1) {
          parts.splice(i, 1);
          continue;
        }

        // bagliore
        ctx.save();
        ctx.beginPath();
        const alpha = 1 - t;
        ctx.shadowBlur = 12;
        ctx.shadowColor = `hsla(${p.hue}, 100%, ${60 + (1 - t) * 20}%, ${alpha})`;
        ctx.fillStyle = `hsla(${p.hue}, 100%, ${55 + (1 - t) * 25}%, ${alpha})`;
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();

        // scintille secondarie
        if (p.spark && p.life % 3 === 0) {
          const sx = p.x + rnd(-2.5, 2.5);
          const sy = p.y + rnd(-2.5, 2.5);
          ctx.beginPath();
          ctx.shadowBlur = 6;
          ctx.shadowColor = `hsla(${p.hue + 10},100%,70%,${alpha * 0.8})`;
          ctx.fillStyle = `hsla(${p.hue + 10},100%,70%,${alpha * 0.8})`;
          ctx.arc(sx, sy, p.size * 0.7, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
    };

    if (running) raf.current = requestAnimationFrame(loop);
    return () => {
      if (raf.current != null) cancelAnimationFrame(raf.current);
      ro.disconnect();
      window.removeEventListener("resize", onResize);
    };
  }, [running]);

  return (
    <canvas
      ref={ref}
      className="absolute inset-0 h-full w-full"
      style={{ pointerEvents: "none" }}
    />
  );
}
