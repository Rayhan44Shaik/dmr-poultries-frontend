/**
 * =============================================================================
 * GLOBAL TEXT INPUT
 * =============================================================================
 * One chrome for every text-like control: 40px height, control radius, one
 * border colour, one focus ring, one placeholder treatment, one error state.
 *
 * Wrapping in <Field /> gives the label association, `aria-invalid` and
 * `aria-describedby` wiring for free — so a page that uses <Input label=… />
 * is accessible without doing anything extra.
 *
 * The error state swaps border/ring COLOUR only. Nothing changes size, so
 * showing a validation message never moves the control or the fields below it.
 * =============================================================================
 */

import type { InputHTMLAttributes, ReactNode } from "react";
import { forwardRef } from "react";
import { cn } from "../utils/cn";
import { Field } from "./Field";
import {
  uiInputClass,
  uiInputErrorClass,
  uiInputReadOnlyClass,
} from "../shared/ui/uiTokens";

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  label?: string;
  helper?: string;
  error?: string;
  required?: boolean;
  /** Trailing inline element on the label row (unit, counter, hint). */
  labelAction?: ReactNode;
  /** Compact 36px height for dense forms and dialog footers. */
  compact?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, helper, error, required, labelAction, compact, className, readOnly, type = "text", ...props },
  ref,
) {
  const control = (ids: { id: string; describedBy?: string; invalid: boolean }) => (
    <input
      ref={ref}
      id={ids.id || undefined}
      type={type}
      readOnly={readOnly}
      required={required}
      aria-invalid={ids.invalid || undefined}
      aria-describedby={ids.describedBy}
      aria-required={required || undefined}
      className={cn(
        uiInputClass,
        compact && "h-9",
        ids.invalid && uiInputErrorClass,
        readOnly && uiInputReadOnlyClass,
        // Numbers and codes line up when they share a column.
        (type === "number" || type === "tel") && "tabular-nums",
        type === "number" && "no-spinner",
        className,
      )}
      {...props}
    />
  );

  // Without a label there is nothing for <Field /> to add; render the bare
  // control so callers can supply their own `aria-label`.
  if (!label && !helper && !error) {
    return control({
      id: (props.id as string) ?? "",
      describedBy: undefined,
      invalid: false,
    });
  }

  return (
    <Field
      label={label}
      htmlFor={props.id}
      required={required}
      helper={helper}
      error={error}
      labelAction={labelAction}
    >
      {control}
    </Field>
  );
});

// NOTE: `uiFocusRing` is intentionally NOT re-exported from this component
// file — a module that exports both components and constants breaks React Fast
// Refresh. Import it from `shared/ui/uiTokens` (the single source of truth).

export default Input;
