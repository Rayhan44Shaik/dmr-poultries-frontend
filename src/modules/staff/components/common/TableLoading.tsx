// src/modules/staff/components/common/TableLoading.tsx
//
// ============================================================================
// STAFF TABLE LOADING — the "Loading …" row inside the table
// ============================================================================
// The Shop Sales table's loading treatment, shared by every staff table: a
// small spinner beside one line of text, centred *inside* the table card.
// The card, its header and the filter bar above it stay exactly where they
// are, so the page never blanks out, never jumps, and the user can see which
// list is being fetched ("Loading leave records…", "Loading duty planner…").
//
//   <TableLoading label={t("staff.table.loading.leave")} />
//
// ACCESSIBILITY
//   `role="status"` with `aria-live="polite"` announces the wait once; the
//   spinner itself is decorative. Sizing/padding match the table's own
//   cell rhythm so swapping it in does not shift the layout.
// ============================================================================

interface TableLoadingProps {
  /** Already-translated sentence, e.g. "Loading leave records…". */
  label: string;
  /** Extra classes for the wrapper (rarely needed). */
  className?: string;
}

export default function TableLoading({ label, className = "" }: TableLoadingProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex items-center justify-center bg-white px-4 py-10 ${className}`}
    >
      <span className="inline-flex items-center gap-2.5 text-sm font-medium text-slate-400">
        <span
          aria-hidden="true"
          className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-slate-200 border-t-brand-600"
        />
        {label}
      </span>
    </div>
  );
}
