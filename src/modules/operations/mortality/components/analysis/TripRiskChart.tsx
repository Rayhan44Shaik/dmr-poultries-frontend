// src/modules/operations/mortality/components/analysis/TripRiskChart.tsx
// Trip risk map — one bubble per trip.
//
//   X = weight loss % (shrinkage between farm and delivered)
//   Y = mortality % (birds lost, as a share of birds loaded)
//   bubble size = farm weight carried
//
// Average lines split the field into four quadrants, so the trips that are both
// high-mortality and high-shrinkage sit in the top-right where the eye lands
// first. Only the worst trips are plotted (see the cap in useMortalitySeries) —
// a quarter's worth of bubbles is unreadable.

import {
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
  Cell,
} from "recharts";
import { useI18n } from "../../../../../i18n";
import { formatDateShort } from "../../../../../utils/format";
import type { TripRiskPoint } from "../../hooks/useMortalitySeries";
import { TooltipRow, TooltipShell } from "./chartBits";
import { asTooltipProps, formatKg, formatPct } from "./chartFormat";

interface TripRiskChartProps {
  points: TripRiskPoint[];
  avgMortalityPct: number;
  avgWeightLossPct: number;
}

/** Colour by combined risk: amber = watch, rose = act. */
function colorFor(point: TripRiskPoint, avgMortality: number, avgLoss: number): string {
  const mortalityBad = point.mortalityPct >= avgMortality;
  const lossBad = point.weightLossPct >= avgLoss;
  if (mortalityBad && lossBad) return "#f43f5e";
  if (mortalityBad || lossBad) return "#f59e0b";
  return "#10b981";
}

export default function TripRiskChart({ points, avgMortalityPct, avgWeightLossPct }: TripRiskChartProps) {
  const { t } = useI18n();

  const renderTooltip = (props: unknown) => {
    const { active, payload } = asTooltipProps(props);
    if (!active || !payload || payload.length === 0) return null;
    const point = payload[0]?.payload as TripRiskPoint | undefined;
    if (!point) return null;

    return (
      <TooltipShell title={`${point.tripNo} · ${formatDateShort(point.tripDate)}`}>
        <TooltipRow label={t("ops.mortality.col.source_farm")} value={point.farm} />
        <TooltipRow label={t("ops.mortality.col.vehicle")} value={point.vehicleNo} />
        <TooltipRow
          label={t("ops.mortality.kpi.farm_weight")}
          value={formatKg(point.farmWeight)}
          hint={`· ${point.farmBirds} birds`}
        />
        <TooltipRow
          label={t("ops.mortality.analysis.risk.axis_y")}
          value={formatPct(point.mortalityPct)}
          hint={`· ${point.mortalityCount} birds`}
        />
        <TooltipRow label={t("ops.mortality.analysis.risk.axis_x")} value={formatPct(point.weightLossPct)} />
        <TooltipRow label={t("ops.mortality.kpi.delivery_weight")} value={formatKg(point.deliveredWeight)} />
      </TooltipShell>
    );
  };

  return (
    <div className="h-[320px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 12, right: 16, bottom: 18, left: 4 }}>
          <CartesianGrid strokeDasharray="3 3" className="text-slate-200 dark:text-slate-700" stroke="currentColor" />
          <XAxis
            type="number"
            dataKey="weightLossPct"
            name={t("ops.mortality.analysis.risk.axis_x")}
            tick={{ fontSize: 11 }}
            className="text-slate-400 dark:text-slate-500"
            stroke="currentColor"
            tickFormatter={(value: number) => `${value.toFixed(1)}%`}
            label={{
              value: t("ops.mortality.analysis.risk.axis_x"),
              position: "insideBottom",
              offset: -10,
              style: { fontSize: 11, fill: "currentColor" },
              className: "text-slate-400 dark:text-slate-500",
            }}
          />
          <YAxis
            type="number"
            dataKey="mortalityPct"
            name={t("ops.mortality.analysis.risk.axis_y")}
            tick={{ fontSize: 11 }}
            className="text-slate-400 dark:text-slate-500"
            stroke="currentColor"
            tickFormatter={(value: number) => `${value.toFixed(1)}%`}
            width={52}
            label={{
              value: t("ops.mortality.analysis.risk.axis_y"),
              angle: -90,
              position: "insideLeft",
              offset: 14,
              style: { fontSize: 11, fill: "currentColor" },
              className: "text-slate-400 dark:text-slate-500",
            }}
          />
          <ZAxis type="number" dataKey="farmWeight" range={[36, 420]} />
          <Tooltip content={(props) => renderTooltip(props)} />

          {/* Quadrant guides — the averages for everything in view. */}
          <ReferenceLine
            y={avgMortalityPct}
            stroke="#f43f5e"
            strokeDasharray="4 4"
            strokeOpacity={0.5}
            label={{
              value: `${t("ops.mortality.analysis.risk.average")} ${avgMortalityPct.toFixed(2)}%`,
              position: "right",
              style: { fontSize: 10, fill: "#f43f5e" },
            }}
          />
          <ReferenceLine
            x={avgWeightLossPct}
            stroke="#f59e0b"
            strokeDasharray="4 4"
            strokeOpacity={0.5}
            label={{
              value: `${t("ops.mortality.analysis.risk.average")} ${avgWeightLossPct.toFixed(2)}%`,
              position: "top",
              style: { fontSize: 10, fill: "#f59e0b" },
            }}
          />

          <Scatter data={points} isAnimationActive={false}>
            {points.map((point) => (
              <Cell
                key={point.tripId}
                fill={colorFor(point, avgMortalityPct, avgWeightLossPct)}
                fillOpacity={0.65}
                stroke={colorFor(point, avgMortalityPct, avgWeightLossPct)}
                strokeOpacity={0.9}
              />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
