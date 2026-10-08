// src/ui/Switch.tsx
// -----------------------------------------------------------------------------
// Accessible toggle switch — controlled, keyboard-friendly, screen-reader
// friendly. Used by the Settings tab for Access Management and Profile toggles.
// -----------------------------------------------------------------------------

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "../utils/cn";

export interface SwitchProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> {
  /** Visual on/off state. */
  checked?: boolean;
  /** When `true`, the switch is disabled (no pointer interaction). */
  disabled?: boolean;
  /** Optional status label rendered next to the switch — e.g. "On" / "Off". */
  label?: ReactNode;
  /** Optional inline description rendered under the label. */
  description?: ReactNode;
}

const Switch = forwardRef<HTMLButtonElement, SwitchProps>(
  ({ checked = false, disabled = false, label, description, className, id, ...rest }, ref) => {
    // ref forwarded to the outer wrapper is unused today; kept so the component
    // can receive a ref when consumed through React.forwardRef consumers.
    const toggleId = id ?? rest.name ?? "switch";
    const hasLabel = !!(label || description);

  return (
    <div className={cn(
      "inline-flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 transition-shadow hover:border-emerald-200 hover:shadow-sm dark:border-slate-700 dark:bg-slate-900",
      disabled && "opacity-50 cursor-not-allowed",
      className,
    )}>
      <button
        ref={ref}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        aria-labelledby={hasLabel ? `${toggleId}-label` : undefined}
        onClick={(event) => {
          if (!disabled) rest.onClick?.(event);
        }}
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border border-slate-200 bg-white shadow-sm transition-all duration-200 flex-shrink-0",
          checked
            ? "bg-emerald-600 border-emerald-600 shadow-emerald-500/20"
            : "bg-slate-100 border-slate-200 hover:bg-slate-200 dark:bg-slate-800 dark:border-slate-600",
          disabled && "cursor-not-allowed opacity-50",
        )}
      >
        <span
          className={cn(
            "pointer-events-none block h-4.5 w-4.5 translate-x-0.5 rounded-full bg-white shadow-sm ring-0 transition-transform duration-200",
            checked ? "translate-x-5" : "translate-x-0.5",
          )}
        />
      </button>

      {hasLabel && (
        <div className="min-w-0 flex-1">
          {label && (
            <span
              id={`${toggleId}-label`}
              className={cn(
                "text-sm font-semibold text-slate-800 dark:text-slate-100",
                checked ? "text-slate-900 dark:text-white" : "text-slate-600 dark:text-slate-400",
              )}
            >
              {label}
            </span>
          )}
          {description && (
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-500">{description}</p>
          )}
        </div>
      )}
    </div>
  );
  },
);

Switch.displayName = "Switch";

export default Switch;
