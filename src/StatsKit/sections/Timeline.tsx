
// sections/Timeline.tsx
import React from "react";
import { PresentationChartLineIcon } from "@heroicons/react/24/outline";
import { Card } from "../../Components/UI/Card";
import { Sparkline } from "../charts/Sparkline";
export function Timeline({ data }:{ data:Array<{t:number; avg:number}> }){
  return (
    <Card>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-lg font-semibold">
          <PresentationChartLineIcon className="h-5 w-5" />
          Average rating over time
        </h3>
        <span className="text-xs text-zinc-500">(by viewing date)</span>
      </div>
      <Sparkline data={data} />
    </Card>
  );
}
