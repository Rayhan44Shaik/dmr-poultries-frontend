// src/modules/operations/mortality/components/analysis/LossWaterfallChart.tsx
// Weight flow: every kilogram loaded at the farm, and where it ends up.
//
//   Farm weight  ▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇  total loaded
//   Mortality    ·············▇▇  deducted (birds lost in transit)
//   Weight loss  ··············▇  deducted (shrinkage / weighbridge variance)
//   Delivered    ▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇  total that reached the shops
//
// A waterfall is the honest way to show this: mortality and shrinkage are ~2.6%
// and ~0.15% of farm weight, so on a plain axis they collapse to invisible
// slivers. Here each deduction starts from where the previous one ended, so the
// small steps stay legible while the totals still read true.

import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useI18n } from "../../../../../i18n";
import { TooltipRow, TooltipShell } from "./chartBits";
import { asTooltipProps, formatKg, formatKgTick, SERIES_COLORS } from "./chartFormat";
import { buildWaterfall, type StepKind, type WaterfallInput, type WaterfallStep } from "./waterfall";

const COLOR_BY_KIND: Record<StepKind, string> = {
  total: SERIES_COLORS.farmWeight,
  deduction: SERIES_COLORS.mortality,
  gain: SERIES_COLORS.deliveredWeight,
};

export default function LossWaterfallChart({ input }: { input: WaterfallInput }) {
  const { t } = useI18n();
  const steps = buildWaterfall(input);
  const max = Math.max(...steps.map((s) => s.base + s.value), input.farmWeight) * 1.12 || 1;

  const renderTooltip = (props: unknown) => {
    const { active, payload } = asTooltipProps(props);
    if (!active || !payload || payload.length === 0) return null;
    const step = payload[0]?.payload as WaterfallStep | undefined;
    if (!step) return null;
    const share = ((step.value / (input.farmWeight || 1)) * 100).toFixed(2);

    return (
      <TooltipShell title={t(step.label)}>
        <TooltipRow label={t("ops.mortality.kpi.farm_weight")} value={formatKg(step.value)} />
        {step.kind === "total" ? (
          <TooltipRow label={t("ops.mortality.analysis.flow.running")} value={formatKg(step.running)} />
        ) : (
          <TooltipRow
            label={t("ops.mortality.analysis.of_farm", { value: share })}
            value={step.delta > 0 ? `+${formatKg(step.value)}` : `-${formatKg(step.value)}`}
          />
        )}
      </TooltipShell>
    );
  };

  return (
    <div className="h-[320px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={steps} margin={{ top: 22, right: 12, bottom: 4, left: 4 }}>
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11 }}
            className="text-slate-400 dark:text-slate-500"
            stroke="currentColor"
            tickFormatter={(value: string) => t(value).replace(" weight", "")}
          />
          <YAxis
            tick={{ fontSize: 11 }}
            className="text-slate-400 dark:text-slate-500"
            stroke="currentColor"
            domain={[0, max]}
            tickFormatter={(value: number) => formatKgTick(value)}
            width={64}
          />
          <Tooltip
            content={(props) => renderTooltip(props)}
            cursor={{ fill: "rgba(148,163,184,0.08)" }}
          />

          {/* Invisible pedestal — positions the visible bar on the waterfall. */}
          <Bar dataKey="base" stackId="flow" fill="transparent" isAnimationActive={false} />
          <Bar dataKey="value" stackId="flow" radius={[4, 4, 0, 0]} maxBarSize={86} isAnimationActive={false}>
            {steps.map((step) => (
              <Cell key={step.key} fill={COLOR_BY_KIND[step.kind]} />
            ))}
            <LabelList
              dataKey="value"
              position="top"
              formatter={(value: unknown) => formatKg(Number(value))}
              style={{ fontSize: 11, fontWeight: 700, fill: "currentColor" }}
              className="text-slate-600 dark:text-slate-300"
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
