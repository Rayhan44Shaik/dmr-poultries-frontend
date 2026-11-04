import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  firstSelectableIndex,
  isInteractiveTarget,
  lastSelectableIndex,
  resolveClickSelection,
  resolveSelectedId,
  selectionKeyAction,
  stepSelectableIndex,
  tabIndexFor,
  type RowSelectVia,
  type TableRowId,
} from "./tableRowSelection";

export interface TableRowSelectionOptions<T> {
  rows: readonly T[];
  getId: (row: T, index: number) => TableRowId;
  /** Disabled, group-header, summary and other non-actionable rows. */
  isRowSelectable?: (row: T, index: number) => boolean;
  selectedId: TableRowId | null;
  /** Select this row (click, arrows, Home/End, Space, or Enter fallback). */
  onSelect: (row: T, index: number, via: RowSelectVia) => void;
  /** Clear the selection (toggle-off, Escape, or stale id). */
  onDeselect: () => void;
  /** Clicking the selected row deselects it. Defaults to false (keep). */
  toggleOnReselect?: boolean;
  /** Enter invokes this for the focused row. Omit when the page has none. */
  onPrimaryAction?: (row: T, index: number) => void;
  /** Escape clears the selection. Enable only where the page can clear. */
  allowEscapeClear?: boolean;
  /** Accessible record label, e.g. `Trip TRP-001`. */
  getRowLabel?: (row: T, index: number) => string;
}

export interface TableRowProps {
  tabIndex: number;
  "aria-selected": boolean | undefined;
  "aria-label": string | undefined;
  onClick: (event: React.MouseEvent<HTMLTableRowElement>) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLTableRowElement>) => void;
  ref: (element: HTMLTableRowElement | null) => void;
}

/**
 * One consistent row-selection behaviour for Operations tables.
 *
 * - Single selection by stable database id; stale ids resolve to null and
 *   can never act on another row.
 * - Clicks on inline actions/editors never select (closest() guard).
 * - Roving tabindex: the active row alone is tabbable; arrows/Home/End move
 *   the selection, Space selects without scrolling, Enter runs the page's
 *   primary action, Escape clears where allowed.
 * - Keyboard handling is scoped to the focused row itself — no document
 *   listeners, focus inside inputs keeps its native keys, and Tab/Shift+Tab
 *   never get trapped. Newly focused rows scroll with `block: "nearest"`.
 */
export function useTableRowSelection<T>(options: TableRowSelectionOptions<T>) {
  const {
    rows,
    getId,
    isRowSelectable,
    selectedId,
    onSelect,
    onDeselect,
    toggleOnReselect = false,
    onPrimaryAction,
    allowEscapeClear = false,
    getRowLabel,
  } = options;

  const rowRefs = useRef(new Map<TableRowId, HTMLTableRowElement>());

  const selectableAt = useCallback(
    (index: number) => {
      const row = rows[index];
      if (!row) return false;
      return isRowSelectable ? isRowSelectable(row, index) : true;
    },
    [rows, isRowSelectable],
  );

  const idAt = useCallback((index: number) => {
    const row = rows[index];
    return row ? getId(row, index) : null;
  }, [rows, getId]);

  const ids = useMemo(() => rows.map((row, index) => getId(row, index)), [rows, getId]);
  const idSet = useMemo(() => new Set<TableRowId>(ids), [ids]);

  // A selection that no longer exists must go away, never leak onto another row.
  const resolvedSelectedId = resolveSelectedId(selectedId, idSet);
  useEffect(() => {
    if (selectedId !== null && resolvedSelectedId === null) onDeselect();
  }, [selectedId, resolvedSelectedId, onDeselect]);

  // Roving tabstop, derived during render (no sync effect): the live
  // selection wins; otherwise the last focused row stays tabbable while it
  // still exists, else the first selectable row is tabbable.
  const [manualActiveId, setManualActiveId] = useState<TableRowId | null>(null);
  let activeId: TableRowId | null = resolvedSelectedId;
  if (activeId === null) {
    if (manualActiveId !== null && idSet.has(manualActiveId)) {
      activeId = manualActiveId;
    } else {
      const first = firstSelectableIndex(rows.length, selectableAt);
      activeId = first === -1 ? null : ids[first];
    }
  }

  const focusRow = useCallback((id: TableRowId) => {
    setManualActiveId(id);
    requestAnimationFrame(() => {
      const element = rowRefs.current.get(id);
      if (!element) return;
      element.focus({ preventScroll: true });
      element.scrollIntoView({ block: "nearest", inline: "nearest" });
    });
  }, []);

  const selectIndex = useCallback((index: number, via: RowSelectVia) => {
    const row = rows[index];
    if (!row || !selectableAt(index)) return;
    onSelect(row, index, via);
    focusRow(idAt(index) as TableRowId);
  }, [rows, selectableAt, onSelect, focusRow, idAt]);

  const handleRowClick = useCallback((event: React.MouseEvent<HTMLTableRowElement>, index: number) => {
    if (isInteractiveTarget(event.target)) return;
    const row = rows[index];
    if (!row || !selectableAt(index)) return;
    const id = idAt(index) as TableRowId;
    const outcome = resolveClickSelection({
      rowSelected: resolvedSelectedId === id,
      selectable: true,
      toggleOnReselect,
    });
    if (outcome === "select") {
      onSelect(row, index, "pointer");
      setManualActiveId(id);
    } else if (outcome === "deselect") {
      onDeselect();
    }
    // "keep" intentionally leaves a selected row selected.
  }, [rows, selectableAt, idAt, resolvedSelectedId, toggleOnReselect, onSelect, onDeselect]);

  const handleRowKeyDown = useCallback((event: React.KeyboardEvent<HTMLTableRowElement>, index: number) => {
    // Focus inside an inline control or editor keeps its native keyboard.
    if (event.target !== event.currentTarget) return;
    const action = selectionKeyAction(event.key, {
      hasPrimaryAction: onPrimaryAction !== undefined,
      allowEscapeClear,
    });
    if (action.kind === "none") return;
    const row = rows[index];
    if (!row) return;
    switch (action.kind) {
      case "move": {
        event.preventDefault();
        const next = stepSelectableIndex(index, action.delta, rows.length, selectableAt);
        if (next !== -1) selectIndex(next, "keyboard");
        break;
      }
      case "first": {
        event.preventDefault();
        const first = firstSelectableIndex(rows.length, selectableAt);
        if (first !== -1) selectIndex(first, "keyboard");
        break;
      }
      case "last": {
        event.preventDefault();
        const last = lastSelectableIndex(rows.length, selectableAt);
        if (last !== -1) selectIndex(last, "keyboard");
        break;
      }
      case "primary": {
        event.preventDefault();
        if (selectableAt(index)) onPrimaryAction?.(row, index);
        break;
      }
      case "select": {
        // Space (or Enter without a primary action) selects without scrolling.
        event.preventDefault();
        if (selectableAt(index)) {
          onSelect(row, index, "keyboard");
          setManualActiveId(idAt(index) as TableRowId);
        }
        break;
      }
      case "clear": {
        onDeselect();
        break;
      }
    }
  }, [rows, selectableAt, onPrimaryAction, allowEscapeClear, selectIndex, onSelect, onDeselect, idAt]);

  const getRowProps = useCallback((row: T, index: number): TableRowProps => {
    const id = getId(row, index);
    const selectable = isRowSelectable ? isRowSelectable(row, index) : true;
    const selected = resolvedSelectedId === id;
    const label = getRowLabel?.(row, index);
    return {
      tabIndex: tabIndexFor({ selectable, active: id === activeId }),
      "aria-selected": selectable ? selected : undefined,
      "aria-label": label,
      onClick: (event) => handleRowClick(event, index),
      onKeyDown: (event) => handleRowKeyDown(event, index),
      ref: (element) => {
        if (element) rowRefs.current.set(id, element);
        else rowRefs.current.delete(id);
      },
    };
  }, [getId, isRowSelectable, resolvedSelectedId, activeId, getRowLabel, handleRowClick, handleRowKeyDown]);

  return {
    /** Selection resolved against the current rows (null when stale). */
    selectedId: resolvedSelectedId,
    /** The single tabbable row id (selection, else first selectable). */
    activeId,
    /** Spread onto each body `<tr>` (loading/empty/summary rows excluded). */
    getRowProps,
    /** Move keyboard focus to a row with least-disruptive scrolling. */
    focusRow,
  };
}
