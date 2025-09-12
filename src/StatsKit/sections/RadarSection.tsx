// sections/RadarSection.tsx
import React from "react";
import { Card } from "../../Components/UI/Card";
import { UserCircleIcon } from "@heroicons/react/24/outline";
import { Radar } from "../charts/Radar";

export function RadarSection({
  selectedUser,
  userOptions,
  axesByUser,
  onChange,
  hideSelect = false,
  title = "Genre affinity (≥ 8)",
  embedded = false,            // NEW: se true non crea la Card esterna
}: {
  selectedUser: string | null;
  userOptions: string[];
  axesByUser: Record<string, Array<{ label: string; value: number }>>;
  onChange: (u: string) => void;
  hideSelect?: boolean;
  title?: string;
  embedded?: boolean;          // NEW
}) {
  const Header = (
    <div className="mb-3 flex items-center justify-between">
      <h3 className="flex items-center gap-2 text-lg font-semibold">
        <UserCircleIcon className="h-5 w-5" />
        {title}
      </h3>
      {!hideSelect && (
        <select
          className="rounded-lg border bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          value={selectedUser || ""}
          onChange={(e) => onChange(e.target.value)}
        >
          {userOptions.map((u) => (
            <option key={u} value={u}>{u}</option>
          ))}
        </select>
      )}
    </div>
  );

  const Body = !selectedUser ? (
    <div className="text-sm text-zinc-500">Seleziona un utente.</div>
  ) : axesByUser[selectedUser] && axesByUser[selectedUser].length ? (
    <Radar axes={axesByUser[selectedUser]} />
  ) : (
    <div className="text-sm text-zinc-500">
      Dati insufficienti per il radar di {selectedUser}.
    </div>
  );

  if (embedded) {
    return (
      <div>
        {Header}
        {Body}
      </div>
    );
  }

  return (
    <Card>
      {Header}
      {Body}
    </Card>
  );
}
