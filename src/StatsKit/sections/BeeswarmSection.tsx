
// sections/BeeswarmSection.tsx
import React from "react";
import { Card } from "../../Components/UI/Card";
import { SparklesIcon } from "@heroicons/react/24/outline";
import { Beeswarm } from "../charts/Beeswarm";
export function BeeswarmSection({ values }:{ values:Array<{score:number; key:string}> }){
  return (
    <Card>
      <h3 className="mb-2 flex items-center gap-2 text-lg font-semibold">
        <SparklesIcon className="h-5 w-5" />
        Beeswarm of all scores
      </h3>
      <Beeswarm values={values} />
      <p className="mt-2 text-xs text-zinc-500">Jitter deterministico per evitare sovrapposizioni. Mostra densità e dispersione.</p>
    </Card>
  );
}
