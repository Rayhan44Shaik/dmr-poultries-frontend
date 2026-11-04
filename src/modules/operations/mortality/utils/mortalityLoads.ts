import type { MortalityLoad, MortalityRow } from "../services/mortalityAnalysisApi";

/**
 * Multi-load helpers for the Completed Trips table and its expanded panel.
 *
 * Everything here is pure: the backend owns every number (one row per trip
 * with a `loads` breakdown), and these helpers only slice, label and position
 * what the server already computed. No DOM, no React — every branch below is
 * covered by the mortality frontend harness.
 */

export type MortalityLoadMetric =
  | "farm"
  | "farmBirds"
  | "farmWeight"
  | "shops"
  | "deliveredBirds"
  | "deliveredWeight"
  | "mortality"
  | "mortalityWeight"
  | "weightLoss"
  | "lossPct";

/** Loads backing the per-load breakdown, in display order. */
export function tripLoads(record: Pick<MortalityRow, "loads">): MortalityLoad[] {
  return (record.loads ?? []).filter((load) => load && load.load > 0);
}

/**
 * A load-breakdown tooltip exists only for two or more real/effective loads.
 * Single-load and legacy trips render the plain value — never a Load 1 stub.
 */
export function hasLoadBreakdown(record: Pick<MortalityRow, "loads">): boolean {
  return tripLoads(record).length > 1;
}

export interface TooltipLine {
  label: string;
  value: string;
  /** Second segment under the value (Box/Weight-mode split for mortality). */
  sub?: string;
}

export interface LoadTooltip {
  title: string;
  lines: TooltipLine[];
  totalLabel: string;
  total: string;
  helper?: string;
}

export interface TooltipFormatters {
  birds(value: number): string;
  weight(value: number): string;
  percent(value: number): string;
  count(value: number): string;
}

export interface TooltipLabels {
  /** Localised "Load {number}" for one load row. */
  formatLoad: (load: number) => string;
  totalLabel: string;
  boxModeLabel: string;
  weightModeLabel: string;
}

/**
 * One driven tooltip model for all ten multi-load metrics. The table renders
 * `lines` (one per load) plus the `total` row; the component stays a dumb
 * card so every metric shares the Trip List tooltip language.
 */
export function buildLoadTooltip(
  record: MortalityRow,
  metric: MortalityLoadMetric,
  opts: {
    title: string;
    helper?: string;
    labels: TooltipLabels;
    fmt: TooltipFormatters;
  }
): LoadTooltip {
  const { title, helper, labels, fmt } = opts;
  const loads = tripLoads(record);
  const line = (label: string, value: string, sub?: string): TooltipLine =>
    sub === undefined ? { label, value } : { label, value, sub };
  const loadName = (load: MortalityLoad) => labels.formatLoad(load.load);
  const emDash = "—";

  switch (metric) {
    case "farm": {
      const names = loads.map((load) =>
        load.farmName && load.farmName.trim() ? load.farmName : emDash
      );
      const distinct = [...new Set(names.filter((name) => name !== emDash))];
      return {
        title,
        lines: loads.map((load, index) => line(loadName(load), names[index])),
        totalLabel: labels.totalLabel,
        total: distinct.length > 0 ? distinct.join(" · ") : emDash,
        helper,
      };
    }
    case "farmBirds":
      return {
        title,
        lines: loads.map((load) => line(loadName(load), fmt.birds(load.farmBirds))),
        totalLabel: labels.totalLabel,
        total: fmt.birds(record.farmBirds),
        helper,
      };
    case "farmWeight":
      return {
        title,
        lines: loads.map((load) => line(loadName(load), fmt.weight(load.farmWeight))),
        totalLabel: labels.totalLabel,
        total: fmt.weight(record.farmWeight),
        helper,
      };
    case "shops":
      // The trip total is the DISTINCT shop count — never the per-load sum.
      return {
        title,
        lines: loads.map((load) => line(loadName(load), fmt.count(load.deliveryShops))),
        totalLabel: labels.totalLabel,
        total: fmt.count(record.deliveryShops),
        helper,
      };
    case "deliveredBirds":
      return {
        title,
        lines: loads.map((load) => line(loadName(load), fmt.birds(load.deliveredBirds))),
        totalLabel: labels.totalLabel,
        total: fmt.birds(record.deliveredBirds),
        helper,
      };
    case "deliveredWeight":
      return {
        title,
        lines: loads.map((load) => line(loadName(load), fmt.weight(load.deliveredWeight))),
        totalLabel: labels.totalLabel,
        total: fmt.weight(record.deliveredWeight),
        helper,
      };
    case "mortality":
      return {
        title,
        lines: loads.map((load) =>
          line(
            loadName(load),
            fmt.birds(load.mortalityCount),
            `${labels.boxModeLabel} ${fmt.count(load.boxMortalityCount)} · ${labels.weightModeLabel} ${fmt.count(load.weightModeMortalityCount)}`
          )
        ),
        totalLabel: labels.totalLabel,
        total: fmt.birds(record.mortalityCount),
        helper,
      };
    case "mortalityWeight":
      return {
        title,
        lines: loads.map((load) =>
          line(
            loadName(load),
            fmt.weight(load.mortalityWeight),
            `${labels.boxModeLabel} ${fmt.weight(load.boxMortalityWeight)} · ${labels.weightModeLabel} ${fmt.weight(load.weightModeMortalityWeight)}`
          )
        ),
        totalLabel: labels.totalLabel,
        total: fmt.weight(record.mortalityWeight),
        helper,
      };
    case "weightLoss":
      return {
        title,
        lines: loads.map((load) => line(loadName(load), fmt.weight(load.weightLoss))),
        totalLabel: labels.totalLabel,
        total: fmt.weight(record.weightLoss),
        helper,
      };
    case "lossPct":
      // The trip percentage derives from the aggregates — never averaged.
      return {
        title,
        lines: loads.map((load) => line(loadName(load), fmt.percent(load.weightLossPercentage))),
        totalLabel: labels.totalLabel,
        total: fmt.percent(record.weightLossPercentage),
        helper,
      };
  }
}

export interface Viewport {
  width: number;
  height: number;
}

export interface AnchorRect {
  left: number;
  top: number;
  bottom: number;
  width: number;
}

/**
 * Fixed-position tooltip placement in the Trip List idiom: centred on the
 * trigger, flipped above it when there is no room below, always fully inside
 * the viewport. Pure so the harness can pin the clamping.
 */
export function placeTooltip(
  rect: AnchorRect,
  rows: number,
  width: number,
  viewport: Viewport
): { left: number; top: number } {
  const estimatedHeight = 54 + rows * 32;
  const top =
    rect.bottom + estimatedHeight + 12 <= viewport.height
      ? rect.bottom + 8
      : rect.top - estimatedHeight - 8;
  return {
    left: Math.max(
      12,
      Math.min(viewport.width - width - 12, rect.left + rect.width / 2 - width / 2)
    ),
    top: Math.max(8, top),
  };
}

export type LoadScope = "all" | number;

export interface LoadScopeFigures {
  scope: LoadScope;
  farmName: string | null;
  farmBirds: number;
  farmWeight: number;
  deliveryShops: number;
  deliveredBirds: number;
  deliveredWeight: number;
  boxMortalityCount: number;
  boxMortalityWeight: number;
  weightModeMortalityCount: number;
  weightModeMortalityWeight: number;
  mortalityCount: number;
  mortalityWeight: number;
  weightLoss: number;
  mortalityPercentage: number;
  weightLossPercentage: number;
  survivalRate: number;
}

/** The aggregate main-row figures, as the "All Loads" tab shows them. */
export function aggregateScope(record: MortalityRow): LoadScopeFigures {
  return {
    scope: "all",
    farmName: record.sourceFarm,
    farmBirds: record.farmBirds,
    farmWeight: record.farmWeight,
    deliveryShops: record.deliveryShops,
    deliveredBirds: record.deliveredBirds,
    deliveredWeight: record.deliveredWeight,
    boxMortalityCount: record.boxMortalityCount,
    boxMortalityWeight: record.boxMortalityWeight,
    weightModeMortalityCount: record.weightModeMortalityCount,
    weightModeMortalityWeight: record.weightModeMortalityWeight,
    mortalityCount: record.mortalityCount,
    mortalityWeight: record.mortalityWeight,
    weightLoss: record.weightLoss,
    mortalityPercentage: record.mortalityPercentage,
    weightLossPercentage: record.weightLossPercentage,
    survivalRate: record.survivalRate,
  };
}

/**
 * Figures for one expanded-panel tab. "All Loads" is the exact aggregate
 * main row; a load tab shows only that load's canonical values. Switching
 * tabs never refetches — everything is already on the record.
 */
export function selectLoadScope(record: MortalityRow, scope: LoadScope): LoadScopeFigures {
  if (scope === "all") return aggregateScope(record);
  const loads = tripLoads(record);
  const load = loads.find((candidate) => candidate.load === scope) ?? loads[scope - 1];
  if (!load) return aggregateScope(record);
  return {
    scope,
    farmName: load.farmName,
    farmBirds: load.farmBirds,
    farmWeight: load.farmWeight,
    deliveryShops: load.deliveryShops,
    deliveredBirds: load.deliveredBirds,
    deliveredWeight: load.deliveredWeight,
    boxMortalityCount: load.boxMortalityCount,
    boxMortalityWeight: load.boxMortalityWeight,
    weightModeMortalityCount: load.weightModeMortalityCount,
    weightModeMortalityWeight: load.weightModeMortalityWeight,
    mortalityCount: load.mortalityCount,
    mortalityWeight: load.mortalityWeight,
    weightLoss: load.weightLoss,
    mortalityPercentage: load.mortalityPercentage,
    weightLossPercentage: load.weightLossPercentage,
    survivalRate: load.survivalRate,
  };
}

/** Tabs for the expanded Weights section — empty for single-load trips. */
export function loadScopes(record: Pick<MortalityRow, "loads">): LoadScope[] {
  const loads = tripLoads(record);
  if (loads.length <= 1) return [];
  return ["all", ...loads.map((load) => load.load as LoadScope)];
}

/**
 * Expanded load-tab keyboard: Left/Right walks the tabs (wrapping), Home and
 * End jump to the first/last tab. Enter/Space activation belongs to the tab
 * button itself.
 */
export function loadTabNav(current: number, count: number, key: string): number {
  if (count <= 0) return 0;
  if (key === "ArrowRight") return (current + 1) % count;
  if (key === "ArrowLeft") return (current - 1 + count) % count;
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  return current;
}

export type GridNavAction =
  | { kind: "toggle"; tripId: number }
  | { kind: "close" }
  | { kind: "move"; tripId: number }
  | { kind: "none" };

/**
 * The grid's keyboard contract as a pure step: Up/Down moves one trip,
 * Enter/Space toggles the panel, Escape closes it. The component keeps the
 * focus/target ownership checks; this only decides the action.
 */
export function gridNavStep(
  records: Array<{ tripId: number }>,
  index: number,
  key: string,
  openTripId: number | null
): GridNavAction {
  const row = records[index];
  if (!row) return { kind: "none" };
  if (key === "Enter" || key === " ") return { kind: "toggle", tripId: row.tripId };
  if (key === "Escape") {
    return openTripId === row.tripId ? { kind: "close" } : { kind: "none" };
  }
  if (key !== "ArrowDown" && key !== "ArrowUp") return { kind: "none" };
  const next = records[index + (key === "ArrowDown" ? 1 : -1)];
  if (!next) return { kind: "none" };
  return { kind: "move", tripId: next.tripId };
}

/**
 * Interactive descendants must never arm a table drag: buttons, inputs,
 * links, tooltip triggers and the expanded panel (which keeps its text
 * selection) all opt out through one selector.
 */
export const DRAG_GUARD_SELECTOR =
  "button, a, input, select, textarea, [role='button'], [role='link'], [contenteditable], [data-no-dragscroll]";

export function isDragGuardTarget(target: unknown): boolean {
  if (!target || typeof target !== "object") return false;
  const closest = (target as { closest?: unknown }).closest;
  if (typeof closest !== "function") return false;
  try {
    return closest.call(target, DRAG_GUARD_SELECTOR) != null;
  } catch {
    return false;
  }
}

/** Pointer travel below which the gesture still counts as a click. */
export const DRAG_THRESHOLD_PX = 6;

/**
 * Pointer-drag state machine for the table scroller. The hook feeds pointer
 * events in and applies the returned delta; the machine itself is DOM-free so
 * the click-vs-drag contract is unit-testable.
 */
export class DragScrollTracker {
  private phase: "idle" | "armed" | "dragging" = "idle";
  private startX = 0;
  private startY = 0;
  private lastX = 0;

  get active(): boolean {
    return this.phase !== "idle";
  }

  get dragging(): boolean {
    return this.phase === "dragging";
  }

  /** Arm a possible drag. Returns false when the gesture must stay a click. */
  down(x: number, y: number, target: unknown): boolean {
    if (isDragGuardTarget(target)) return false;
    this.phase = "armed";
    this.startX = x;
    this.startY = y;
    this.lastX = x;
    return true;
  }

  /**
   * Horizontal scroll delta for this move (positive scrolls left). Zero while
   * idle or below the click threshold, so a plain click never scrolls.
   */
  move(x: number, y: number): number {
    if (this.phase === "idle") return 0;
    if (
      this.phase === "armed" &&
      Math.hypot(x - this.startX, y - this.startY) < DRAG_THRESHOLD_PX
    ) {
      this.lastX = x;
      return 0;
    }
    this.phase = "dragging";
    const delta = this.lastX - x;
    this.lastX = x;
    return delta;
  }

  /** End the gesture. Returns true when it was a real drag (click suppressed). */
  up(): boolean {
    const wasDrag = this.phase === "dragging";
    this.phase = "idle";
    return wasDrag;
  }

  cancel(): void {
    this.phase = "idle";
  }
}

/** Applies one drag delta — the unit under the hook's scrollLeft update. */
export function applyDragDelta(scroller: { scrollLeft: number }, dx: number): void {
  scroller.scrollLeft -= dx;
}
