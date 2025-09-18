import React from "react";
import { Avatar } from "./Avatar";


/* Crown outline minimal */
const Crown = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" aria-hidden {...props}>
    <path d="M3.5 9.5l4 3a1 1 0 001.5-.3L11 7l2 5a1 1 0 001.6.4l3.9-2.9L20.5 16h-17l0-6.5z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round"/>
    <path d="M4 18h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
  </svg>
);

/* === PICKER BADGE — glow + conic ring + sparkles === */
export function PickerBadgePro({ name }: { name: string }) {
  return (
    <span
      className={[
        "relative inline-flex items-center gap-2 rounded-full px-2.5 py-1.5",
        "bg-zinc-900/40 ring-1 ring-inset ring-amber-300/35",
        "shadow-[0_10px_28px_-16px_rgba(255,170,0,.45)] select-none overflow-hidden",
      ].join(" ")}
      title={`Next picker: ${name}`}
      aria-label={`Next picker: ${name}`}
    >
      {/* anello conic che gira soft = vibe premium */}
      <span
        aria-hidden
        className="pointer-events-none absolute -inset-px rounded-full opacity-35 blur-[2px] motion-reduce:animate-none"
        style={{
          background:
            "conic-gradient(from 0deg, rgba(255,214,130,.65), rgba(255,170,0,.25), rgba(255,255,255,.12), rgba(255,214,130,.65))",
          animation: "spinSlow 10s linear infinite",
          WebkitMask:
            "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
          mask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
          WebkitMaskComposite: "xor",
          maskComposite: "exclude",
          padding: 1.2,
        }}
      />

      {/* crown */}
      <Crown className="h-[15px] w-[15px] text-amber-200 drop-shadow-[0_1px_0_rgba(0,0,0,.35)]" />

      {/* avatar con alone neon */}
      <span className="relative grid place-items-center">
        <Avatar name={name} size={22} />
        <span className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-amber-300/60" aria-hidden />
        <span
          aria-hidden
          className="pointer-events-none absolute -inset-[6px] rounded-full blur-md"
          style={{ background: "radial-gradient(circle, rgba(255,193,79,.28), transparent 60%)" }}
        />
      </span>

      {/* nome “inked” */}
      <span className="text-[13px] font-extrabold tracking-wide text-amber-50 [text-shadow:0_1px_0_rgba(0,0,0,.35)]">
        {name}
      </span>
      {/* keyframes scoped */}
      <style>{`
        @keyframes spinSlow { from { transform: rotate(0); } to { transform: rotate(360deg); } }
        @keyframes twinkle { 0%,100% { opacity: 0; transform: scale(.5); }
                              50% { opacity: 1; transform: scale(1); } }
        .spark { position:absolute; width:6px; height:6px; border-radius:9999px;
                 background: rgba(255,235,170,.95);
                 filter: drop-shadow(0 0 8px rgba(255,210,100,.9)); }
        .spark1 { top:-3px; left:18px; animation: twinkle 2.6s ease-in-out infinite; }
        .spark2 { bottom:-3px; left:44px; animation: twinkle 3.1s ease-in-out .5s infinite; }
        .spark3 { top:6px; right:10px; animation: twinkle 2.4s ease-in-out 1.1s infinite; }
        @media (prefers-reduced-motion: reduce) {
          .spark { animation: none; }
        }
      `}</style>
    </span>
  );
}
