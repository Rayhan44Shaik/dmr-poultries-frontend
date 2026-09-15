// src/modules/staff/components/performance/PerformanceCardMark.tsx
//
// ============================================================================
// PERFORMANCE CARD MARK — the brand logo that opens a performance card header
// ============================================================================
// The Driver/Supervisor Performance cards (chart and table) lead with the DMR
// hen logo so the two cards read as a branded pair:
//
//   [ hen ] Driver Weekly Performance          Reporting weeks: …
//   [ hen ] Driver Performance — 29 drivers, 158 trips
//
// The chip is the exact chip the KPI cards use (36px, rounded-xl, emerald-50
// with a 1px emerald-100 inset ring), holding the 22px hen cut-out — so the
// logo lands in the same visual language rather than as a stray image.
// Decorative only: the heading beside it carries the accessible name.
// ============================================================================

import { memo } from "react";
import HenIcon from "../../../../ui/icons/HenIcon";

export type PerformanceCardMarkSize = "sm" | "md";

interface PerformanceCardMarkProps {
  /** "md" (default) beside a card title, "sm" for denser headers. */
  size?: PerformanceCardMarkSize;
}

const CHIP: Record<PerformanceCardMarkSize, string> = {
  sm: "h-8 w-8 rounded-lg",
  md: "h-9 w-9 rounded-xl",
};

const HEN: Record<PerformanceCardMarkSize, number> = {
  sm: 18,
  md: 22,
};

function PerformanceCardMarkImpl({ size = "md" }: PerformanceCardMarkProps) {
  return (
    <span
      aria-hidden="true"
      className={`flex ${CHIP[size]} shrink-0 items-center justify-center bg-emerald-50 text-emerald-600 shadow-xs ring-1 ring-inset ring-emerald-100`}
    >
      <HenIcon size={HEN[size]} />
    </span>
  );
}

const PerformanceCardMark = memo(PerformanceCardMarkImpl);
export default PerformanceCardMark;
