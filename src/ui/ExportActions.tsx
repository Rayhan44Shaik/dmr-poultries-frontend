/**
 * =============================================================================
 * GLOBAL SEMANTIC ACTIONS — PDF · Excel · Import · Export · Reset · Refresh
 * =============================================================================
 * The same semantic action now has exactly ONE visual language project-wide:
 * one icon, one icon size, one colour, one button treatment, one hover/focus
 * behaviour and one accessible label.
 *
 * BEFORE
 *   "PDF" was rose-outline in Operations, neutral slate in Masters, blue in
 *   Reports and red-600 elsewhere. "Excel" alternated between FileSpreadsheet
 *   and Download. Refresh alternated between RefreshCw and RotateCw. Four
 *   colours for one meaning.
 *
 * AFTER (canonical icon + tone, defined once in `shared/ui/uiTokens`)
 *   PDF      FileText          rose outline     (document convention; a quiet
 *                                                outline so it never reads as
 *                                                destructive)
 *   Excel    FileSpreadsheet   emerald outline  (spreadsheet convention)
 *   Import   Upload            emerald solid    (writes data → primary weight)
 *   Export   Download          slate outline    (reads data out → secondary)
 *   Reset    RotateCcw         ghost            (local, reversible)
 *   Refresh  RefreshCw         ghost            (local, reversible)
 *
 * Built on the shared <Button variant="custom">, so structure (height, padding,
 * radius, focus ring, disabled + loading guards) comes from the button system
 * and only the COLOUR comes from the action token. The two can never disagree.
 *
 * ACCESSIBILITY
 *   Icon-only buttons always carry an `aria-label` naming the ACTION
 *   ("Download PDF", not "PDF"); the glyph is `aria-hidden`.
 *
 * CONCURRENCY
 *   `loading` routes through Button's single activation guard, so a double-click
 *   cannot start two exports. The element is never unmounted while loading, so
 *   focus is retained.
 * =============================================================================
 */

import type { ReactNode } from "react";
import {
  Download,
  FileSpreadsheet,
  FileText,
  RefreshCw,
  RotateCcw,
  Upload,
} from "lucide-react";
import { cn } from "../utils/cn";
import { Button, type ButtonProps } from "./Button";
import { actionIconSize, uiActionToneClass } from "../shared/ui/uiTokens";

export interface ActionButtonProps extends Omit<ButtonProps, "variant" | "icon" | "size"> {
  /** Visible text. Omit for an icon-only button (then `ariaLabel` is required). */
  children?: ReactNode;
  /** Accessible name; defaults to a phrase describing the action. */
  ariaLabel?: string;
  /** Icon-only 32px treatment for dense toolbars and table headers. */
  compact?: boolean;
  size?: ButtonProps["size"];
}

interface InternalProps extends ActionButtonProps {
  tone: keyof typeof uiActionToneClass;
  glyph: ReactNode;
  defaultLabel: string;
}

function SemanticAction({
  tone,
  glyph,
  defaultLabel,
  children,
  ariaLabel,
  compact = false,
  className,
  size,
  ...rest
}: InternalProps) {
  const iconOnly = compact || !children;
  const label = ariaLabel ?? defaultLabel;

  return (
    <Button
      {...rest}
      variant="custom"
      // Toolbar rows are 40px so actions align with the 40px search/filter
      // controls beside them; `compact` uses the button system's icon sizes.
      size={compact ? "sm" : (size ?? "lg")}
      iconOnly={iconOnly}
      aria-label={iconOnly ? label : ariaLabel}
      title={iconOnly ? label : rest.title}
      className={cn(
        uiActionToneClass[tone],
        // Slightly tighter padding than a generic lg button: action buttons
        // carry a short label plus an icon and must not dominate the row.
        !compact && "px-3",
        className,
      )}
      icon={glyph}
    >
      {children}
    </Button>
  );
}

const glyph = (node: ReactNode) => node;

/* --------------------------------------------------------------------------- */

export function PdfButton(props: ActionButtonProps) {
  return (
    <SemanticAction
      {...props}
      tone="pdf"
      defaultLabel="Download PDF"
      glyph={glyph(<FileText size={actionIconSize} strokeWidth={2} aria-hidden="true" />)}
    />
  );
}

export function ExcelButton(props: ActionButtonProps) {
  return (
    <SemanticAction
      {...props}
      tone="excel"
      defaultLabel="Download Excel"
      glyph={glyph(<FileSpreadsheet size={actionIconSize} strokeWidth={2} aria-hidden="true" />)}
    />
  );
}

export function ImportButton(props: ActionButtonProps) {
  return (
    <SemanticAction
      {...props}
      tone="import"
      defaultLabel="Import data"
      glyph={glyph(<Upload size={actionIconSize} strokeWidth={2} aria-hidden="true" />)}
    />
  );
}

export function ExportButton(props: ActionButtonProps) {
  return (
    <SemanticAction
      {...props}
      tone="export"
      defaultLabel="Export data"
      glyph={glyph(<Download size={actionIconSize} strokeWidth={2} aria-hidden="true" />)}
    />
  );
}

export function ResetButton(props: ActionButtonProps) {
  return (
    <SemanticAction
      {...props}
      tone="reset"
      defaultLabel="Reset filters"
      glyph={glyph(<RotateCcw size={actionIconSize} strokeWidth={2} aria-hidden="true" />)}
    />
  );
}

export function RefreshButton(props: ActionButtonProps) {
  return (
    <SemanticAction
      {...props}
      tone="refresh"
      defaultLabel="Refresh"
      glyph={glyph(<RefreshCw size={actionIconSize} strokeWidth={2} aria-hidden="true" />)}
    />
  );
}

/* ---------------------------------------------------------------------------
 * ActionToolbar — lays a set of actions out with one gap/wrap/alignment
 * ------------------------------------------------------------------------- */

export interface ActionToolbarProps {
  children: ReactNode;
  className?: string;
  align?: "start" | "end" | "between";
}

/**
 * Groups page or table actions so a header reads as an organised set rather
 * than a random collection of buttons. Wraps instead of overflowing.
 */
export function ActionToolbar({ children, className, align = "end" }: ActionToolbarProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2",
        align === "end" && "justify-end",
        align === "start" && "justify-start",
        align === "between" && "justify-between",
        className,
      )}
    >
      {children}
    </div>
  );
}
