/**
 * =============================================================================
 * GLOBAL SELECT
 * =============================================================================
 * A native <select> is used on purpose: it already provides the full keyboard
 * contract (Enter/Space to open, Arrow Up/Down to move, type-ahead, Escape to
 * close, Home/End) and correct screen-reader semantics on every platform.
 * Re-implementing that with a div would be both less accessible and less
 * stable, so the design system styles the native control instead.
 *
 * Chrome is identical to <Input /> — same 40px height, radius, border, focus
 * ring and error treatment — so a filter row mixing inputs, selects and the
 * DatePicker aligns on one grid line.
 *
 * Use `react-select` (themed once via `opsReactSelectStyles`) only where
 * type-ahead search over a large option list is genuinely required.
 * =============================================================================
 */

import type { ReactNode, SelectHTMLAttributes } from "react";
import { forwardRef } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "../utils/cn";
import { Field } from "./Field";
import { uiInputErrorClass, uiInputReadOnlyClass, uiSelectClass } from "../shared/ui/uiTokens";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  helper?: string;
  error?: string;
  required?: boolean;
  labelAction?: ReactNode;
  compact?: boolean;
  /** Rendered as a leading disabled/empty option (e.g. "All departments"). */
  placeholder?: string;
  /** Declarative options; use `children` instead for grouped/custom markup. */
  options?: SelectOption[];
  children?: ReactNode;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  {
    label,
    helper,
    error,
    required,
    labelAction,
    compact,
    placeholder,
    options,
    children,
    className,
    disabled,
    ...props
  },
  ref,
) {
  const control = (ids: { id: string; describedBy?: string; invalid: boolean }) => (
    <div className="relative w-full min-w-0">
      <select
        ref={ref}
        id={ids.id || undefined}
        required={required}
        disabled={disabled}
        aria-invalid={ids.invalid || undefined}
        aria-describedby={ids.describedBy}
        aria-required={required || undefined}
        className={cn(
          uiSelectClass,
          compact && "h-9",
          ids.invalid && uiInputErrorClass,
          disabled && uiInputReadOnlyClass,
          // An unselected placeholder reads as muted, a real value as ink.
          placeholder && !props.value && "text-slate-400",
          className,
        )}
        {...props}
      >
        {placeholder ? (
          <option value="" disabled={required}>
            {placeholder}
          </option>
        ) : null}
        {options
          ? options.map((option) => (
              <option key={option.value} value={option.value} disabled={option.disabled}>
                {option.label}
              </option>
            ))
          : children}
      </select>

      {/* Custom chevron: the native arrow is removed by `appearance-none` so
          the control matches the other fields exactly. Non-interactive, so it
          can never swallow a click meant for the select. */}
      <ChevronDown
        size={16}
        aria-hidden="true"
        focusable="false"
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400"
      />
    </div>
  );

  if (!label && !helper && !error) {
    return control({ id: (props.id as string) ?? "", describedBy: undefined, invalid: false });
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

export default Select;
