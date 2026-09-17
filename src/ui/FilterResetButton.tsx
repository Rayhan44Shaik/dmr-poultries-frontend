/**
 * =============================================================================
 * FILTER RESET BUTTON — the canonical "clear this page's filters" control
 * =============================================================================
 * ONE reset treatment for every filter card in the application:
 *
 *   • Neutral secondary pill with the RotateCcw glyph (spins on hover).
 *   • An emerald COUNT BADGE that appears (pop-in) only while at least one
 *     filter differs from its default — including a date range that was moved
 *     off the page's default week/day, a typed search, a sort, or a status.
 *     Zero active filters → no badge, exactly like the Order Assignment page.
 *   • The label follows the active language (`common.reset`), the accessible
 *     name always announces the count ("Reset — 2 filters").
 *
 * USAGE (identical everywhere — do not hand-roll a reset button again):
 *
 *   <FilterResetButton count={activeFilterCount} onClick={resetFilters} />
 *
 * `count` is the number of facets that currently narrow the view. Pages
 * compute it from their own state (each facet counts once when it is not at
 * its default). Pass `disabled` only when the whole card is locked; a reset
 * with nothing to clear is still clickable (it is a harmless no-op) so the
 * toolbar never shifts.
 * =============================================================================
 */

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { RotateCcw } from "lucide-react";
import { useI18n } from "../i18n";
import { opsSecondaryButtonClass } from "../shared/ui/operationsStyles";
import { uiActionIconMotionClass } from "../shared/ui/uiTokens";
import { cn } from "../utils/cn";

export interface FilterResetButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children" | "type"
> {
  /** Number of filters currently differing from their defaults. Badge shows when > 0. */
  count?: number;
  /** Visible text. Defaults to the translated "Reset". */
  children?: ReactNode;
  /** Hide the text and show the glyph (and badge) only, for dense toolbars. */
  compact?: boolean;
}

export function FilterResetButton({
  count = 0,
  children,
  compact = false,
  className,
  "aria-label": ariaLabel,
  ...rest
}: FilterResetButtonProps) {
  const { t } = useI18n();
  const label = children === undefined ? t("common.reset") : children;
  const active = count > 0;
  const name =
    ariaLabel ??
    (active ? `${t("common.reset")} — ${count}` : t("common.reset"));

  return (
    <button
      {...rest}
      type="button"
      aria-label={name}
      title={compact ? name : rest.title}
      className={cn("group relative", opsSecondaryButtonClass, className)}
      data-active-filters={active ? count : undefined}
    >
      <span className={cn("inline-flex", uiActionIconMotionClass.reset)}>
        <RotateCcw size={14} aria-hidden="true" />
      </span>
      {!compact && label}
      {active && (
        <span
          className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-600 px-1.5 text-[10px] font-bold tabular-nums text-white motion-safe:animate-[var(--animate-pop-in)]"
          aria-hidden="true"
        >
          {count}
        </span>
      )}
    </button>
  );
}
