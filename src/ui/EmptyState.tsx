/**
 * =============================================================================
 * GLOBAL EMPTY STATE
 * =============================================================================
 * Four genuinely different situations that previously all rendered the same
 * "No data found" text — which tells a user who just mistyped a search that the
 * database is empty:
 *
 *   no-data          nothing exists yet            → invite the first action
 *   no-search        a search matched nothing      → offer to clear the search
 *   no-filters       filters matched nothing       → offer to reset filters
 *   error            the data could not be loaded  → offer to retry
 *
 * One visual treatment for all four (icon chip, title, description, optional
 * action) so an empty table never looks broken.
 *
 * The icon conveys the difference at a glance, and the copy states it plainly —
 * so the meaning never depends on colour alone.
 * =============================================================================
 */

import type { ReactNode } from "react";
import { AlertTriangle, FilterX, Inbox, SearchX } from "lucide-react";
import { cn } from "../utils/cn";
import {
  uiEmptyStateActionClass,
  uiEmptyStateClass,
  uiEmptyStateDescriptionClass,
  uiEmptyStateIconClass,
  uiEmptyStateIconErrorClass,
  uiEmptyStateTitleClass,
} from "../shared/ui/uiTokens";

export type EmptyVariant = "no-data" | "no-search" | "no-filters" | "error";

export interface EmptyStateProps {
  variant?: EmptyVariant;
  /** Overrides the variant's default title. */
  title?: ReactNode;
  /** Overrides the variant's default description. */
  description?: ReactNode;
  icon?: ReactNode;
  /** Optional call to action (e.g. "Clear search", "Retry", "Add shop"). */
  action?: ReactNode;
  /** Dashed surface treatment, for a whole panel rather than a table body. */
  bordered?: boolean;
  className?: string;
}

const DEFAULTS: Record<
  EmptyVariant,
  { title: string; description: string; icon: ReactNode; isError?: boolean }
> = {
  "no-data": {
    title: "No records yet",
    description: "Nothing has been added here. New records will appear in this list.",
    icon: <Inbox aria-hidden="true" />,
  },
  "no-search": {
    title: "No matching results",
    description: "No records match your search. Check the spelling or try a broader term.",
    icon: <SearchX aria-hidden="true" />,
  },
  "no-filters": {
    title: "Nothing matches these filters",
    description: "No records match the selected filters. Reset them to see everything.",
    icon: <FilterX aria-hidden="true" />,
  },
  error: {
    title: "Couldn't load this data",
    description: "Something went wrong while fetching. Your data is unchanged — try again.",
    icon: <AlertTriangle aria-hidden="true" />,
    isError: true,
  },
};

export function EmptyState({
  variant = "no-data",
  title,
  description,
  icon,
  action,
  bordered = false,
  className,
}: EmptyStateProps) {
  const preset = DEFAULTS[variant];

  return (
    <div
      className={cn(
        uiEmptyStateClass,
        bordered && "rounded-xl border border-dashed border-slate-200 bg-white/60",
        className,
      )}
      // A table body that is empty is still a live region the user should be
      // told about; `polite` avoids interrupting whatever they were doing.
      role={preset.isError ? "alert" : "status"}
      aria-live="polite"
    >
      <span className={preset.isError ? uiEmptyStateIconErrorClass : uiEmptyStateIconClass}>
        {icon ?? preset.icon}
      </span>

      <p className={uiEmptyStateTitleClass}>{title ?? preset.title}</p>

      {(description ?? preset.description) ? (
        <p className={uiEmptyStateDescriptionClass}>
          {description ?? preset.description}
        </p>
      ) : null}

      {action ? <div className={uiEmptyStateActionClass}>{action}</div> : null}
    </div>
  );
}

export default EmptyState;
