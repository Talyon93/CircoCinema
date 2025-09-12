import React from "react";
import { Card } from "../../Components/UI/Card";
import { SparklesIcon } from "@heroicons/react/24/outline";
import DistributionInsight from "../charts/DistributionInsight";

export function DistributionInsightSection({
  values,
}: {
  values: number[];
}) {
  return (
    <Card>
      <h3 className="mb-2 flex items-center gap-2 text-lg font-semibold">
        <SparklesIcon className="h-5 w-5" />
        Distribution of all scores
      </h3>
      <DistributionInsight values={values} />
      <p className="mt-2 text-xs text-zinc-500">
        Istogramma + curva di densità con median/IQR e whisker 10–90. Tooltip con density,
        percentile e conteggio locale.
      </p>
    </Card>
  );
}
