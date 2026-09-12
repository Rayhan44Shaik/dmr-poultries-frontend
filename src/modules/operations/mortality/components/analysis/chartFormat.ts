// src/modules/operations/mortality/components/analysis/chartFormat.ts
// Formatting + tooltip typing helpers for the Trip Analysis charts.
//
// Kept free of JSX and component exports so the chart files stay compatible
// with Vite's fast-refresh rule (components only, per file).

import { formatNumber, formatWeight } from "../../../../../utils/format";

/** One series entry inside a recharts tooltip payload. */
export interface TooltipEntry {
  name?: string;
  value?: number | string;
  color?: string;
  dataKey?: string | number;
  payload?: Record<string, unknown>;
}

export interface ChartTooltipProps {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string | number;
}

/** Recharts types tooltip content loosely; narrow it once, here. */
export function asTooltipProps(props: unknown): ChartTooltipProps {
  if (!props || typeof props !== "object") return {};
  const value = props as Record<string, unknown>;
  return {
    active: typeof value.active === "boolean" ? value.active : undefined,
    label:
      typeof value.label === "string" || typeof value.label === "number" ? value.label : undefined,
    payload: Array.isArray(value.payload) ? (value.payload as TooltipEntry[]) : undefined,
  };
}

/* ------------------------------------------------------------------ */
/*  Formatting                                                         */
/* ------------------------------------------------------------------ */

/**
 * Weight in kilograms — one unit everywhere (kg), two decimals while the
 * number is small enough to care and whole kilograms once it is not:
 * 766.66 kg · 13,475 kg · 5,20,281 kg.
 */
export function formatKg(kg: number): string {
  const value = Number.isFinite(kg) ? kg : 0;
  if (value === 0) return "0 kg";
  if (Math.abs(value) >= 1000) return `${formatNumber(Math.round(value))} kg`;
  return formatWeight(Math.round(value * 100) / 100);
}

/** Axis ticks: the same number without the unit. */
export function formatKgTick(kg: number): string {
  return formatKg(kg).replace(" kg", "");
}

export function formatPct(value: number): string {
  const n = Number.isFinite(value) ? value : 0;
  return `${n.toFixed(2)}%`;
}

/** Series colours — shared by every chart so a colour always means one thing. */
export const SERIES_COLORS = {
  trips: "#6366f1",
  farmWeight: "#0ea5e9",
  deliveredWeight: "#10b981",
  mortality: "#f43f5e",
  weightLoss: "#f59e0b",
} as const;
