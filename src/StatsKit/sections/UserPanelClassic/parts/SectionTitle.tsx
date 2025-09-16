// Components/UI/SectionTitle.tsx
import React from "react";

function cn(...a: Array<string | false | null | undefined>) {
  return a.filter(Boolean).join(" ");
}

type Props = {
  children: React.ReactNode;        // titolo
  hint?: string;                    // testo secondario
  icon?: React.ReactNode;           // icona a sinistra
  actions?: React.ReactNode;        // bottoni/switch a destra
  className?: string;
  align?: "left" | "center";        // default: left
  compact?: boolean;                // padding più contenuto
  divider?: boolean;                // riga sottile sotto al titolo
  muted?: boolean;                  // tono più soft per sfondo
};

export function SectionTitle({
  children,
  hint,
  icon,
  actions,
  className,
  align = "left",
  compact = false,
  divider = false,
  muted = false,
}: Props) {
  return (
    <div
      className={cn(
        "rounded-xl",
        muted && "bg-zinc-900/40",
        divider && "border-b border-zinc-800",
        compact ? "px-2 py-2" : "px-3 py-3",
        className
      )}
    >
      <div
        className={cn(
          "flex items-center",
          align === "center" ? "justify-center text-center" : "justify-between"
        )}
      >
        {/* Blocco titolo + hint (sinistra o centrato) */}
        <div
          className={cn(
            "flex min-w-0 items-center gap-2",
            align === "center" && "justify-center"
          )}
        >
          {icon && (
            <div className="grid h-7 w-7 place-items-center rounded-lg bg-zinc-900 ring-1 ring-inset ring-zinc-800">
              <span className="text-[15px] leading-none text-zinc-200">{icon}</span>
            </div>
          )}

          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold text-zinc-100">
              {children}
            </h2>
            {hint && (
              <div className="mt-0.5 text-xs font-medium text-zinc-500">
                {hint}
              </div>
            )}
          </div>
        </div>

        {/* Azioni (solo quando align = left) */}
        {align === "left" && actions && (
          <div className="ml-3 shrink-0">{actions}</div>
        )}
      </div>
    </div>
  );
}
