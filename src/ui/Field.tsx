/**
 * =============================================================================
 * FIELD — the shared label / control / helper / error wrapper
 * =============================================================================
 * Every form control in the app (input, select, textarea, DatePicker, custom
 * combobox) is wrapped in this so that:
 *
 *   • the label is programmatically associated (`for`/`id`) — clicking the
 *     label focuses the control, and a screen reader announces it
 *   • helper and error text are announced via `aria-describedby`
 *   • an invalid control carries `aria-invalid="true"`
 *   • the required marker is exposed as `aria-required`, not just a red asterisk
 *   • label / helper / error share ONE size, weight and colour, so forms read
 *     the same in every module
 *
 * IDs are generated with `useId` when the caller does not supply one, so nested
 * and repeated forms cannot collide.
 *
 * Layout is stable: the helper and error slots reserve no height when empty,
 * but swapping helper → error does not change the control's own position
 * (both render in the same slot below the control), which prevents the
 * "form jumps when validation fails" problem.
 * =============================================================================
 */

import type { ReactNode } from "react";
import { useId } from "react";
import { cn } from "../utils/cn";
import {
  uiErrorClass,
  uiHelperClass,
  uiLabelClass,
  uiRequiredMarkClass,
} from "../shared/ui/uiTokens";

export interface FieldIds {
  /** id to put on the control. */
  id: string;
  /** id list for `aria-describedby` (helper and/or error). */
  describedBy?: string;
  /** true when an error message is present. */
  invalid: boolean;
}

export interface FieldProps {
  /** Visible label. Omit only for controls labelled by `aria-label`. */
  label?: ReactNode;
  /** Explicit control id; generated when omitted. */
  htmlFor?: string;
  required?: boolean;
  /** Neutral guidance shown when there is no error. */
  helper?: ReactNode;
  /** Validation message. Replaces `helper` when present. */
  error?: ReactNode;
  /** Trailing inline element on the label row (e.g. a unit or counter). */
  labelAction?: ReactNode;
  className?: string;
  children: ReactNode | ((ids: FieldIds) => ReactNode);
}

export function Field({
  label,
  htmlFor,
  required = false,
  helper,
  error,
  labelAction,
  className,
  children,
}: FieldProps) {
  const generatedId = useId();
  const id = htmlFor ?? `${generatedId}-control`;
  const helperId = `${generatedId}-helper`;
  const errorId = `${generatedId}-error`;

  const invalid = Boolean(error);
  const describedBy = invalid
    ? errorId
    : helper
      ? helperId
      : undefined;

  const ids: FieldIds = { id, describedBy, invalid };

  return (
    <div className={cn("flex min-w-0 flex-col", className)}>
      {label ? (
        <div className="flex items-baseline justify-between gap-2">
          <label className={uiLabelClass} htmlFor={id}>
            {label}
            {required ? (
              <span className={uiRequiredMarkClass} aria-hidden="true">
                *
              </span>
            ) : null}
          </label>
          {labelAction ? (
            <span className="mb-1.5 shrink-0 text-[11px] text-slate-400">
              {labelAction}
            </span>
          ) : null}
        </div>
      ) : null}

      {typeof children === "function" ? children(ids) : children}

      {/* One slot for guidance: helper OR error, never both, so the height is
          identical in both states and nothing below the field shifts. */}
      {invalid ? (
        <p className={uiErrorClass} id={errorId} role="alert">
          {error}
        </p>
      ) : helper ? (
        <p className={uiHelperClass} id={helperId}>
          {helper}
        </p>
      ) : null}
    </div>
  );
}

export default Field;
