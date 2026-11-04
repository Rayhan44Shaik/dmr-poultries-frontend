/**
 * Shared row-selection model for Operations tables.
 *
 * One consistent experience everywhere: click selects, the serial position
 * shows a check-circle for the selected row, the row carries a light mint
 * background with a subtle green left indicator, and keyboard navigation
 * (Up/Down/Home/End/Space/Enter/Escape) behaves identically.
 *
 * This module is deliberately DOM-free so the rules are unit-testable. The
 * React binding lives in `useTableRowSelection.ts`; the serial indicator in
 * `RowSelectMark.tsx`.
 */

export type TableRowId = string | number;

export type RowSelectVia = "pointer" | "keyboard";

/** Elements that must never arm a row selection (inline actions, editors). */
const INTERACTIVE_SELECTOR =
  "button, a, input, select, textarea, [role='button'], [role='link'], " +
  "[role='checkbox'], [role='menuitem'], [role='option'], [contenteditable], " +
  "[data-no-row-select]";

const EDITABLE_TAG = new Set(["INPUT", "SELECT", "TEXTAREA"]);

export function isEditableTarget(target: unknown): boolean {
  if (!target || typeof target !== "object") return false;
  const tag = (target as { tagName?: unknown }).tagName;
  if (typeof tag === "string" && EDITABLE_TAG.has(tag)) return true;
  const isContentEditable = (target as { isContentEditable?: unknown }).isContentEditable;
  return isContentEditable === true;
}

/**
 * True when the event target is (or sits inside) an interactive descendant:
 * inline buttons, links, dropdowns, checkboxes, inputs, tooltips or action
 * menus. Clicking those must never select or activate the row.
 */
export function isInteractiveTarget(target: unknown): boolean {
  if (isEditableTarget(target)) return true;
  if (!target || typeof target !== "object") return false;
  const closest = (target as { closest?: unknown }).closest;
  if (typeof closest !== "function") return false;
  try {
    return closest.call(target, INTERACTIVE_SELECTOR) != null;
  } catch {
    return false;
  }
}

/** First selectable index in [0, count), or -1 when none is selectable. */
export function firstSelectableIndex(
  count: number,
  isSelectable: (index: number) => boolean = () => true,
): number {
  for (let index = 0; index < count; index += 1) {
    if (isSelectable(index)) return index;
  }
  return -1;
}

/** Last selectable index in [0, count), or -1 when none is selectable. */
export function lastSelectableIndex(
  count: number,
  isSelectable: (index: number) => boolean = () => true,
): number {
  for (let index = count - 1; index >= 0; index -= 1) {
    if (isSelectable(index)) return index;
  }
  return -1;
}

/**
 * Next selectable index stepping from `from` by `delta` (+1/-1), skipping
 * disabled rows. Returns -1 when no selectable row exists in that direction.
 */
export function stepSelectableIndex(
  from: number,
  delta: 1 | -1,
  count: number,
  isSelectable: (index: number) => boolean = () => true,
): number {
  let next = from + delta;
  while (next >= 0 && next < count) {
    if (isSelectable(next)) return next;
    next += delta;
  }
  return -1;
}

export type ClickSelection = "select" | "deselect" | "keep";

/**
 * Click outcome for one row. Clicking the selected row keeps it selected
 * unless the page opts into toggling (deselect on reselect).
 */
export function resolveClickSelection(args: {
  rowSelected: boolean;
  selectable: boolean;
  toggleOnReselect: boolean;
}): ClickSelection {
  if (!args.selectable) return "keep";
  if (!args.rowSelected) return "select";
  return args.toggleOnReselect ? "deselect" : "keep";
}

/**
 * Stored selection after the data changes. A selected id that no longer
 * exists must never operate on another row — it resolves to null.
 */
export function resolveSelectedId(
  selectedId: TableRowId | null,
  knownIds: ReadonlySet<TableRowId> | readonly TableRowId[],
): TableRowId | null {
  if (selectedId === null) return null;
  const known: Set<TableRowId> = new Set(Array.isArray(knownIds) ? knownIds : [...knownIds]);
  return known.has(selectedId) ? selectedId : null;
}

export type SelectionKeyAction =
  | { kind: "move"; delta: 1 | -1 }
  | { kind: "first" }
  | { kind: "last" }
  | { kind: "primary" }
  | { kind: "select" }
  | { kind: "clear" }
  | { kind: "none" };

/**
 * Pure key → action map shared by every table. Enter invokes the page's
 * primary action only when one exists (otherwise it selects); Escape clears
 * only when the page supports clearing. Anything else is ignored so editable
 * cells and menus keep their native keys.
 */
export function selectionKeyAction(
  key: string,
  options: { hasPrimaryAction: boolean; allowEscapeClear: boolean },
): SelectionKeyAction {
  switch (key) {
    case "ArrowDown":
      return { kind: "move", delta: 1 };
    case "ArrowUp":
      return { kind: "move", delta: -1 };
    case "Home":
      return { kind: "first" };
    case "End":
      return { kind: "last" };
    case "Enter":
      return options.hasPrimaryAction ? { kind: "primary" } : { kind: "select" };
    case " ":
      return { kind: "select" };
    case "Escape":
      return options.allowEscapeClear ? { kind: "clear" } : { kind: "none" };
    default:
      return { kind: "none" };
  }
}

/** Roving tabindex: exactly one selectable row (the active one) is tabbable. */
export function tabIndexFor(args: {
  selectable: boolean;
  active: boolean;
}): number {
  if (!args.selectable) return -1;
  return args.active ? 0 : -1;
}

/* ── Shared selected-row visuals (the Operation Expenses reference) ── */

/**
 * Light mint background + subtle green left indicator. Stronger than hover
 * (`hover:bg-slate-50/...`) without ever going dark or loud.
 */
export const tableSelectedRowClass =
  "bg-emerald-50/80 shadow-[inset_4px_0_0_0_#10b981] hover:bg-emerald-50";

/** Serial cell for a selectable row — tabular numerals, quiet slate. */
export const tableSerialCellClass =
  "px-4 py-5 text-center text-[13px] font-medium tabular-nums text-slate-500";
