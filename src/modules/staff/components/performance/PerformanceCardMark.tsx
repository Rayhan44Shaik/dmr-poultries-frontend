// src/modules/staff/components/performance/PerformanceCardMark.tsx
//
// ============================================================================
// PERFORMANCE CARD MARK — the card's logo, in the Rate Entry / Trip List style
// ============================================================================
// The Driver/Supervisor Performance cards (chart and table) open with their
// respective mark, built exactly like the ones on the Trip List and Rate Entry
// cards:
//
//   ┌────┐
//   │ 🚚 │  Driver Weekly Performance      Reporting weeks: …
//   └────┘
//
// The chip is copied from those pages — 36px `rounded-xl`, tone-50 fill, 1px
// tone-100 ring, `shadow-inner` well, 20px tone-500 glyph — so a driver card
// carries the driver mark (Truck, orange) and a supervisor card the supervisor
// mark (UserCheck, sky), i.e. the same icon and tone those pages show in the
// sidebar. Decorative only: the heading beside it carries the accessible name.
// ============================================================================

import { memo, type ComponentType } from "react";
import { CARD_MARK_TONE, type PerformanceCardTone } from "./performanceCardTone";

interface PerformanceCardMarkProps {
  /** The page's own glyph (Truck for drivers, UserCheck for supervisors). */
  icon: ComponentType<{ className?: string }>;
  /** The page's own tone, matching its sidebar entry. */
  tone: PerformanceCardTone;
}

function PerformanceCardMarkImpl({ icon: Icon, tone }: PerformanceCardMarkProps) {
  return (
    <span
      aria-hidden="true"
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border shadow-inner ${CARD_MARK_TONE[tone]}`}
    >
      <Icon className="h-5 w-5" />
    </span>
  );
}

const PerformanceCardMark = memo(PerformanceCardMarkImpl);
export default PerformanceCardMark;
