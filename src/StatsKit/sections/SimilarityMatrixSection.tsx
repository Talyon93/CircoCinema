
// sections/SimilarityMatrixSection.tsx
import React from "react";
import { Card } from "../../Components/UI/Card";
import { ChartBarIcon } from "@heroicons/react/24/outline";
import { SimilarityMatrix } from "../charts/SimilarityMatrix";
export function SimilarityMatrixSection({ users, cells }:{ users:string[]; cells:Array<{i:number;j:number;corr:number;n:number}>; }){
  return (
    <Card>
      <h3 className="mb-2 flex items-center gap-2 text-lg font-semibold">
        <ChartBarIcon className="h-5 w-5" />
        User similarity (Pearson corr.)
      </h3>
      {users.length ? (
        <SimilarityMatrix users={users} cells={cells} />
      ) : (
        <div className="text-sm text-zinc-500">Dati insufficienti.</div>
      )}
      <p className="mt-2 text-xs text-zinc-500">Tooltip: film in comune e correlazione. Ordinato per mettere in evidenza i gruppi.</p>
    </Card>
  );
}
