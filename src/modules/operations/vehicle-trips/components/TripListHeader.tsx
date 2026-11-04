import React from "react";
import { Eye, History } from "lucide-react";
import { opsViewButtonClass } from "../../../../shared/ui/operationsStyles";

interface TripListHeaderProps {
  title: string;
  viewLabel: string;
  /** Tooltip while no valid visible trip is selected. */
  viewDisabledTitle: string;
  /** Tooltip once a visible trip is selected. */
  viewEnabledTitle: string;
  viewDisabled: boolean;
  onView: () => void;
  viewButtonRef: React.Ref<HTMLButtonElement>;
}

/**
 * Trip List card heading toolbar: title on the left, View on the right. The
 * View button is always rendered (disabled until a visible trip is selected)
 * so the toolbar never shifts, and it sits above the table scroll viewport so
 * it stays fixed while rows scroll. The disabled tooltip lives on a wrapper
 * span because disabled buttons do not fire hover events.
 */
function TripListHeader({
  title,
  viewLabel,
  viewDisabledTitle,
  viewEnabledTitle,
  viewDisabled,
  onView,
  viewButtonRef,
}: TripListHeaderProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-6 py-3 border-b border-slate-100 bg-gradient-to-r from-blue-50/60 via-white to-blue-50/40">
      <div className="flex min-w-0 items-center gap-3">
        <div className="h-9 w-9 rounded-xl bg-blue-50/70 border border-blue-100 flex items-center justify-center text-blue-500 shadow-inner">
          <History className="w-5 h-5" />
        </div>
        <h3 className="text-base font-bold text-slate-800 tracking-tight">{title}</h3>
      </div>
      <div className="ml-auto flex shrink-0 items-center">
        <span className="inline-flex" title={viewDisabled ? viewDisabledTitle : undefined}>
          <button
            ref={viewButtonRef}
            type="button"
            onClick={onView}
            disabled={viewDisabled}
            title={viewDisabled ? undefined : viewEnabledTitle}
            aria-label={viewLabel}
            className={`group relative ${opsViewButtonClass} whitespace-nowrap`}
          >
            <span className={`inline-flex ${viewDisabled ? "" : "motion-safe:group-hover:animate-[var(--animate-action-view)]"}`}>
              <Eye size={15} />
            </span>
            {viewLabel}
          </button>
        </span>
      </div>
    </div>
  );
}

export default React.memo(TripListHeader);
