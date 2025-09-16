// Components/UI/Card.tsx
import React from "react";

function cn(...a: Array<string | false | null | undefined>) {
  return a.filter(Boolean).join(" ");
}


/* ------------------------- Card ------------------------- */
export function Card({
  children,
  className = "",
  spaced = true,                       // NEW: margine orizzontale on/off (retro-compat: true)
  gutterX,                             // NEW: override esplicito del margine orizzontale
}: {
  children: React.ReactNode;
  className?: string;
  spaced?: boolean;
  gutterX?: "none" | "sm" | "md" | "lg";
}) {
  // Riconosce se i figli sono già Card.Section
  const onlySections = React.Children.toArray(children).every(
    (child) =>
      React.isValidElement(child) &&
      (child.type as any)?.displayName === "Card.Section"
  );

  // Mappa per i gutter orizzontali
  const gutterMap: Record<NonNullable<typeof gutterX>, string> = {
    none: "mx-0",
    sm: "mx-2",
    md: "mx-4",
    lg: "mx-6",
  };

  // Calcolo della classe di margin-x
  const mxClass = gutterX ? gutterMap[gutterX] : spaced ? "mx-4" : "mx-0";

  return (
    <div
      className={cn(
        "rounded-xl border border-zinc-800 bg-zinc-950 shadow-sm",
        mxClass,
        className
      )}
    >
      {/* Retro-compat: se non usi Card.Section aggiungo padding interno */}
      {onlySections ? children : <div className="px-4 py-3">{children}</div>}
    </div>
  );
}

/* ------------------------- Card.Section ------------------------- */
type SectionProps = {
  children: React.ReactNode;
  className?: string;
};

const Section: React.FC<SectionProps> = ({ children, className }) => {
  return (
    <div
      className={cn(
        "px-4 py-3",
        "border-t border-zinc-800 first:border-0",
        className
      )}
    >
      {children}
    </div>
  );
};
Section.displayName = "Card.Section";
Card.Section = Section;

/* ------------------------- Card.Header ------------------------- */
/* ------------------------- Card.Header ------------------------- */
type HeaderProps = {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;     // resta com'era (testo normale sotto il titolo)
  overline?: string;     // NEW: etichetta piccola con linee ai lati (OUTLIERS / LAST 30 DAYS)
  info?: React.ReactNode;
  align?: "left" | "center";
  tight?: boolean;       // NEW: padding più compatto
};

const Header: React.FC<HeaderProps> = ({
  icon,
  title,
  subtitle,
  overline,              // <- nuovo
  info,
  align = "center",
  tight = false,         // <- nuovo
}) => {
  return (
    <Section
      padding={tight ? "sm" : "md"}
      tone="base"
      className="border-b border-zinc-700"
    >
      <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2">
        {/* Icona (opzionale) */}
        <div className="flex items-center">
          {icon && (
            <div className="grid h-7 w-7 place-items-center rounded-md bg-zinc-900 ring-1 ring-inset ring-zinc-800">
              <span className="text-[15px] leading-none text-zinc-200">{icon}</span>
            </div>
          )}
        </div>

        {/* Titolo + Overline */}
        <div className={align === "center" ? "text-center" : "text-left"}>
          <h4 className="text-sm font-semibold leading-tight text-zinc-100">
            {title}
          </h4>

          {/* overline carina con linee ai lati */}
          {overline && (
            <div className="mt-1 flex items-center gap-2 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
              <span className="h-px flex-1 bg-zinc-800/70" />
              <span className="px-2">{overline}</span>
              <span className="h-px flex-1 bg-zinc-800/70" />
            </div>
          )}

          {/* vecchio subtitle (rimane invariato se lo usi) */}
          {subtitle && !overline && (
            <div className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
              {subtitle}
            </div>
          )}
        </div>

        {/* Info a destra */}
        <div className="justify-self-end text-zinc-400">{info}</div>
      </div>
    </Section>
  );
};
Card.Header = Header;
