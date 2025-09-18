// charts/NiceBarChart.tsx
import React from "react";
import {
  ResponsiveContainer,
  BarChart as RBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";

type Item = { label: string; value: number };

export default function NiceBarChart({
  data,
  maxCount,
  yAxisWidth = 30,
  rotateTicks = -45,
  color = {
    from: "#22d3ee", // cyan-400
    to: "#34d399",   // emerald-400
    fillFrom: "rgba(34,211,238,.85)",
    fillTo: "rgba(52,211,153,.85)",
  },
}: {
  data: Item[];
  maxCount?: number;
  yAxisWidth?: number;
  rotateTicks?: number;
  color?: { from: string; to: string; fillFrom?: string; fillTo?: string };
}) {
  const id = (React as any).useId ? (React as any).useId() : "nbc";
  const localMax = maxCount ?? Math.max(3, ...data.map((d) => d.value));
  const [activeIndex, setActiveIndex] = React.useState<number | null>(null);

  return (
    // IMPORTANTISSIMO: altezza al 100% per far funzionare ResponsiveContainer
    <div style={{ width: "100%", height: "100%" }}>
      <ResponsiveContainer>
        <RBarChart
          data={data}
          margin={{ top: 8, right: 8, bottom: 18, left: 8 }}
          onMouseMove={(state: any) => {
            const i = state?.activeTooltipIndex;
            if (typeof i === "number") setActiveIndex(i);
          }}
          onMouseLeave={() => setActiveIndex(null)}
        >
          <defs>
            <linearGradient id={`barFill-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color.from} />
              <stop offset="100%" stopColor={color.to} />
            </linearGradient>
            <filter id={`barGlow-${id}`} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="2.2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />

          <XAxis
            dataKey="label"
            tick={{ fill: "#d4d4d8", fontSize: 11 }}
            interval={0}
            angle={rotateTicks}
            textAnchor={rotateTicks ? "end" : "middle"}
            height={rotateTicks ? 40 : 20}
            tickLine={false}
            axisLine={{ stroke: "rgba(255,255,255,0.12)" }}
          />

          <YAxis
            allowDecimals={false}
            tick={{ fill: "#a1a1aa", fontSize: 11 }}
            width={yAxisWidth}
            domain={[0, localMax]}
            tickLine={false}
            axisLine={{ stroke: "rgba(255,255,255,0.12)" }}
          />

          <ReferenceLine y={0} stroke="rgba(255,255,255,0.12)" ifOverflow="extendDomain" />

          <Tooltip
            cursor={{ fill: "rgba(255,255,255,0.05)" }}
            contentStyle={{
              background: "#0b0b0c",
              border: "1px solid #3f3f46",
              borderRadius: 10,
              padding: "6px 8px",
            }}
            labelStyle={{ color: "#fafafa", fontWeight: 600 }}
            formatter={(v: any) => [v, "Count"]}
          />

          <Bar
            dataKey="value"
            radius={[8, 8, 0, 0]}
            fill={`url(#barFill-${id})`}
            filter={`url(#barGlow-${id})`}
            shape={(props: any) => {
              const { x, y, width, height, index } = props;
              const isActive = activeIndex === index || activeIndex === null;
              return (
                <g opacity={isActive ? 1 : 0.45}>
                  <rect x={x} y={y} width={width} height={height} rx={8} ry={8} fill={`url(#barFill-${id})`} />
                </g>
              );
            }}
          />
        </RBarChart>
      </ResponsiveContainer>
    </div>
  );
}
