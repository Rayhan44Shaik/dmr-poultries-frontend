// src/modules/staff/components/performance/PerformanceSortableHeader.tsx
//
// ============================================================================
// SORTABLE TABLE HEADER — shared click-to-sort column header for both pages
// ============================================================================
// A <th> whose label is a button (keyboard + pointer identical). State cycle
// per column: first click → preferred direction · second click → reversed ·
// third click → cleared (back to the award order). The active column shows a
// directional arrow + aria-sort; idle columns show a subtle up/down glyph.
// Presentation only — sorting reorders the loaded rows, grades never change.
// ============================================================================

import { memo } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { uiTableThClass } from "../../../../shared/ui/uiTokens";

export type SortDirection = "asc" | "desc";

export interface SortState {
  key: string;
  dir: SortDirection;
}

interface SortableHeaderProps {
  /** Already-translated column label. */
  label: string;
  /** Stable key shared with the page's accessor map. */
  sortKey: string;
  /** Current sort state (null = award order, no active column). */
  sort: SortState | null;
  onSortChange: (next: SortState | null) => void;
  align?: "left" | "right" | "center";
  /** Direction used on the FIRST click (numeric columns default to desc). */
  firstDir?: SortDirection;
  className?: string;
}

function SortableHeaderImpl({
  label,
  sortKey,
  sort,
  onSortChange,
  align = "left",
  firstDir = "desc",
  className = "",
}: SortableHeaderProps) {
  const active = sort?.key === sortKey;
  const dir = active ? sort!.dir : null;
  const Icon = !active ? ChevronsUpDown : dir === "asc" ? ArrowUp : ArrowDown;
  // Prominent by request: large, colour-coded sort affordance on every column.
  const iconSize = 14;

  const alignClass =
    align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";
  const justifyClass =
    align === "right"
      ? "justify-end text-right"
      : align === "center"
        ? "justify-center text-center"
        : "text-left";

  const handleClick = () => {
    if (!active) {
      onSortChange({ key: sortKey, dir: firstDir });
    } else if (dir === firstDir) {
      onSortChange({ key: sortKey, dir: firstDir === "asc" ? "desc" : "asc" });
    } else {
      onSortChange(null); // third click → back to the award order
    }
  };

  return (
    <th
      scope="col"
      aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : undefined}
      className={`${uiTableThClass} ${alignClass} ${className}`}
    >
      <button
        type="button"
        onClick={handleClick}
        aria-label={label}
        className={`group inline-flex w-full min-w-0 items-center gap-1.5 font-bold uppercase tracking-wide transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 ${
          active ? "text-emerald-700" : "text-slate-500 hover:text-slate-900"
        } ${justifyClass}`}
      >
        <span className="truncate">{label}</span>
        <Icon
          size={iconSize}
          strokeWidth={active ? 2.6 : 2.2}
          aria-hidden="true"
          className={`shrink-0 ${
            active ? "text-emerald-600" : "text-slate-400 group-hover:text-emerald-500"
          }`}
        />
      </button>
    </th>
  );
}

const SortableHeader = memo(SortableHeaderImpl);
export default SortableHeader;
