// src/modules/operations/mortality/components/analysis/waterfall.ts
// Weight-flow model — turns the four totals into waterfall steps.
//
// Pure data, no JSX: the chart component stays fast-refresh friendly.

export interface WaterfallInput {
  farmWeight: number;
  mortalityWeight: number;
  weightLoss: number;
  deliveredWeight: number;
}

export type StepKind = "total" | "deduction" | "gain";

export interface WaterfallStep {
  key: string;
  /** i18n key — the chart resolves it at render time. */
  label: string;
  /** Invisible pedestal the visible bar sits on. */
  base: number;
  value: number;
  kind: StepKind;
  /** Signed change this step represents (totals show the running total). */
  delta: number;
  running: number;
}

/**
 * `farm = delivered + mortality + loss` holds for every trip, so it also holds
 * for the sums — the two deduction steps land exactly on the delivered total.
 * A trip that gained weight (negative loss) is drawn as a gain step.
 */
export function buildWaterfall(input: WaterfallInput): WaterfallStep[] {
  const { farmWeight, mortalityWeight, weightLoss, deliveredWeight } = input;
  const lossIsGain = weightLoss < 0;
  return [
    {
      key: "farm",
      label: "ops.mortality.analysis.flow.farm",
      base: 0,
      value: farmWeight,
      kind: "total",
      delta: farmWeight,
      running: farmWeight,
    },
    {
      key: "mortality",
      label: "ops.mortality.analysis.flow.mortality",
      base: farmWeight - mortalityWeight,
      value: mortalityWeight,
      kind: "deduction",
      delta: -mortalityWeight,
      running: farmWeight - mortalityWeight,
    },
    {
      key: "loss",
      label: lossIsGain ? "ops.mortality.analysis.flow.gain" : "ops.mortality.analysis.flow.loss",
      base: deliveredWeight,
      value: Math.abs(weightLoss),
      kind: lossIsGain ? "gain" : "deduction",
      delta: lossIsGain ? Math.abs(weightLoss) : -Math.abs(weightLoss),
      running: deliveredWeight,
    },
    {
      key: "delivered",
      label: "ops.mortality.analysis.flow.delivered",
      base: 0,
      value: deliveredWeight,
      kind: "total",
      delta: deliveredWeight,
      running: deliveredWeight,
    },
  ];
}
