
// sections/ScatterRuntimeSection.tsx
import React from "react";
import { Card } from "../../Components/UI/Card";
import { Squares2X2Icon } from "@heroicons/react/24/outline";
import { ScatterRuntime } from "../charts/ScatterRuntime";
export function ScatterRuntimeSection({ points }:{ points:Array<{ x:number; y:number; size:number; title:string }>; }){
  return (
    <Card>
      <h3 className="mb-2 flex items-center gap-2 text-lg font-semibold">
        <Squares2X2Icon className="h-5 w-5" />
        Runtime vs rating (with trend)
      </h3>
      <ScatterRuntime points={points} />
      <p className="mt-2 text-xs text-zinc-500">Linea di regressione OLS non pesata. Diametro punto proporzionale al numero di voti.</p>
    </Card>
  );
}
