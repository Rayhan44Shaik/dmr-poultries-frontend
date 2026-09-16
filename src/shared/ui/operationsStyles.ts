// src/shared/ui/operationsStyles.ts
import type { CSSObjectWithLabel } from "react-select";

/**
 * Minimal state shapes for the react-select style callbacks.
 *
 * react-select's own `ControlProps` / `OptionProps` are generic over the option
 * type, and their `selectOption`/`selectValue` members make them *contravariant*
 * — so a callback annotated with `ControlProps<unknown>` cannot be assigned to a
 * consumer's `StylesConfig<MyOption>`. These callbacks only ever read
 * `isFocused` / `isSelected`, so the narrow structural types below are both
 * precise about what they use and assignable for every option type.
 */
interface ControlState {
  isFocused: boolean;
}
interface OptionState {
  isFocused: boolean;
  isSelected: boolean;
}
// Shared visual shell for all Operations pages.
// Visual consistency only — no business logic lives here.
//
// ─────────────────────────────────────────────────────────────────────────────
// These values now DERIVE FROM the global design system in `./uiTokens`.
// The `ops*` names are kept as stable aliases so the 20+ existing consumers
// keep working untouched while automatically picking up the global standard.
// New code should import from `src/shared/ui/uiTokens` (or use `src/ui/*`).
// ─────────────────────────────────────────────────────────────────────────────

import {
  controlHeight,
  uiBadgeClass,
  uiButton,
  uiCardClass,
  uiDisabled,
  uiEmptySurfaceClass,
  uiFilterLabelClass,
  uiFocusRing,
  uiIconButton,
  uiInputClass,
  uiPageStackClass,
  uiSectionTitleClass,
  uiStatusBadgeClass,
  uiTableHeadClass,
  uiTableTdClass,
  uiTableThClass,
  uiTableRowClass,
  uiTransition,
  statusToneFor,
  type StatusTone,
} from "./uiTokens";

/* ── Page shell ─────────────────────────────────────────────────── */
export const opsPageClass = uiPageStackClass;

/* ── Filter surface ─────────────────────────────────────────────── */
export const opsFilterCardClass = `${uiCardClass} space-y-4 p-4 md:p-5`;

export const opsFilterLabelClass = uiFilterLabelClass;

/** 40px, control radius — identical chrome to the shared DatePicker, so a
 *  filter row containing both aligns on one grid line. */
export const opsInputClass = uiInputClass;

export const opsSelectClass = uiInputClass;

/* ── Buttons ────────────────────────────────────────────────────── */
export const opsPrimaryButtonClass = uiButton("primary", "md");

export const opsSecondaryButtonClass = uiButton("secondary", "md");

/** Toolbar-height primary, for rows that sit beside 40px controls. */
export const opsToolbarPrimaryButtonClass = uiButton("primary", "lg");

export const opsToolbarSecondaryButtonClass = uiButton("secondary", "lg");

/* ── Semantic document actions ──────────────────────────────────── */
// Re-exported from the global tokens so PDF is rose-outline and Excel is
// emerald-outline in EVERY module (they were neutral slate in Masters and
// rose in Operations before this consolidation).
export {
  uiPdfButtonClass as opsPdfButtonClass,
  uiExcelButtonClass as opsExcelButtonClass,
  uiImportButtonClass as opsImportButtonClass,
  uiExportButtonClass as opsExportButtonClass,
  uiResetButtonClass as opsResetButtonClass,
  uiRefreshButtonClass as opsRefreshButtonClass,
  uiViewButtonClass as opsViewButtonClass,
} from "./uiTokens";

/**
 * Icon-only control used for toolbar actions (e.g. Refresh beside the filters).
 * 40px so it aligns with the h-10 inputs and DatePicker in the same row.
 */
export const opsIconButtonClass = [
  "inline-flex items-center justify-center rounded-lg",
  controlHeight.lg,
  "w-10 border border-slate-200 bg-white text-slate-500",
  uiTransition,
  "hover:bg-slate-50 hover:text-slate-800 hover:border-slate-300",
  uiFocusRing,
  uiDisabled,
  "[&_svg]:shrink-0",
].join(" ");

/** Dense icon-only control (table rows, card headers). */
export const opsIconActionClass = uiIconButton("ghost", "sm");

/* ── Sections / titles ──────────────────────────────────────────── */
export const opsSectionTitleClass = uiSectionTitleClass;

/** Page title. 17px/700 — one hierarchy step above section titles, matching
 *  `uiPageTitleClass` so every module's header reads the same. */
export const opsPageTitleClass =
  "text-[17px] font-bold tracking-[-0.011em] text-slate-900";

/* ── Table shell ────────────────────────────────────────────────── */
export const opsTableCardClass = `${uiCardClass} overflow-hidden`;

export const opsTableHeaderBarClass =
  "flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 " +
  "bg-slate-50/60 px-4 py-3 sm:px-5";

export const opsTableHeadRowClass = uiTableHeadClass;

export const opsTableThClass = uiTableThClass;

export const opsTableTdClass = uiTableTdClass;

export const opsTableRowClass = uiTableRowClass;

export const opsTableDivideClass = "divide-y divide-slate-100";

/* ── Status badge ───────────────────────────────────────────────── */
/**
 * One global status → tone map. `Completed` can no longer be emerald here and
 * sky somewhere else: every module resolves through `statusToneFor`.
 */
export function opsStatusBadgeClass(status?: string | null): string {
  return uiStatusBadgeClass(status);
}

export function opsStatusTone(status?: string | null): StatusTone {
  return statusToneFor(status);
}

export { uiBadgeClass as opsBadgeClass, statusToneFor };

/* ── React-select (shared) ──────────────────────────────────────── */
/**
 * react-select ships its own chrome, so it is themed here once. Values match
 * the design tokens: 40px control height and the 8px control radius, so a
 * react-select sits flush with `uiInputClass` and the shared DatePicker.
 */
export function opsReactSelectStyles(accent = "#059669") {
  return {
    control: (base: CSSObjectWithLabel, state: ControlState) => ({
      ...base,
      borderRadius: "0.5rem", // --ds-radius-control
      minHeight: "2.5rem", // --ds-control-h-lg
      fontSize: "0.8125rem",
      fontWeight: 500,
      borderColor: state.isFocused ? accent : "#cbd5e1", // slate-300
      boxShadow: state.isFocused ? `0 0 0 2px ${accent}33` : "0 1px 2px 0 rgb(15 23 42 / 0.04)",
      backgroundColor: "#ffffff",
      transition: "border-color 150ms, box-shadow 150ms",
      "&:hover": { borderColor: state.isFocused ? accent : "#94a3b8" }, // slate-400
    }),
    option: (base: CSSObjectWithLabel, { isFocused, isSelected }: OptionState) => ({
      ...base,
      backgroundColor: isSelected ? accent : isFocused ? "#f1f5f9" : "transparent", // slate-100
      color: isSelected ? "#ffffff" : "#334155", // slate-700
      fontSize: "0.8125rem",
      fontWeight: isSelected ? 600 : 500,
      padding: "0.5rem 0.75rem",
      cursor: "pointer",
    }),
    menu: (base: CSSObjectWithLabel) => ({
      ...base,
      borderRadius: "0.625rem", // --ds-radius-surface
      // --ds-shadow-popover
      boxShadow:
        "0 4px 10px -2px rgb(15 23 42 / 0.08), 0 14px 34px -10px rgb(15 23 42 / 0.16)",
      border: "1px solid #e2e8f0", // slate-200
      overflow: "hidden",
      zIndex: 50, // --ds-z-popover
    }),
    menuList: (base: CSSObjectWithLabel) => ({ ...base, paddingTop: 4, paddingBottom: 4 }),
    indicatorSeparator: () => ({ display: "none" }),
    dropdownIndicator: (base: CSSObjectWithLabel) => ({
      ...base,
      color: "#94a3b8", // slate-400
      "&:hover": { color: "#64748b" }, // slate-500
    }),
    clearIndicator: (base: CSSObjectWithLabel) => ({
      ...base,
      color: "#94a3b8",
      "&:hover": { color: "#475569" },
    }),
    singleValue: (base: CSSObjectWithLabel) => ({ ...base, color: "#1e293b", fontWeight: 500 }), // slate-800
    placeholder: (base: CSSObjectWithLabel) => ({ ...base, color: "#94a3b8", fontWeight: 400 }), // slate-400
    input: (base: CSSObjectWithLabel) => ({ ...base, fontSize: "0.8125rem" }),
    multiValue: (base: CSSObjectWithLabel) => ({
      ...base,
      backgroundColor: "#d1fae5", // emerald-100
      borderRadius: "0.25rem",
    }),
    multiValueLabel: (base: CSSObjectWithLabel) => ({
      ...base,
      color: "#065f46", // emerald-800
      fontSize: "0.75rem",
      fontWeight: 600,
    }),
    multiValueRemove: (base: CSSObjectWithLabel) => ({
      ...base,
      color: "#065f46",
      // Destructive affordance uses the canonical danger colour (rose).
      ":hover": { backgroundColor: "#a7f3d0", color: "#e11d48" }, // rose-600
    }),
  };
}

/* ── Empty state ────────────────────────────────────────────────── */
export const opsEmptyStateClass = [
  uiEmptySurfaceClass,
  "px-4 py-10 text-center text-[13px] font-medium text-slate-500",
].join(" ");
