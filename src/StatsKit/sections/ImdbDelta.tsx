
// sections/ImdbDelta.tsx
import React from "react";
import { Card } from "../../Components/UI/Card";
import { BeakerIcon } from "@heroicons/react/24/outline";
import { SparklineDelta } from "../charts/SparklineDelta";
export function ImdbDelta({ data }:{ data:Array<{t:number; val:number; title?:string; label?:string}> }){
  return (
    <Card>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-lg font-semibold">
          <BeakerIcon className="h-5 w-5" />
          IMDb delta over time
        </h3>
        <span className="text-xs text-zinc-500">(our avg − IMDb)</span>
      </div>
      <SparklineDelta
        data={data}
        bands={[
          { from: 1, to: +Infinity, className: "fill-emerald-500/10" },
          { from: -Infinity, to: -1, className: "fill-rose-500/10" },
        ]}
        zeroLine
      />
    </Card>
  );
}
