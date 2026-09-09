/**
 * =============================================================================
 * GLOBAL BUTTON — one button system for the whole application
 * =============================================================================
 * Variants: primary · secondary · outline · ghost · destructive ·
 *           destructiveOutline · success · info
 * Sizes:    xs (28) · sm (32) · md (36) · lg (40)
 *
 * Heights come from the design tokens, so a button always matches the input,
 * select or DatePicker it sits beside in the same toolbar row.
 *
 * STABILITY / CONCURRENCY
 *   • `type="button"` by default. The implicit `type="submit"` was a source of
 *     accidental double submissions when Enter was pressed in a form field.
 *     Pass `type="submit"` explicitly where a submit is intended.
 *   • While `loading`, the button uses `aria-disabled` rather than the native
 *     `disabled` attribute. Native `disabled` makes the browser DROP FOCUS from
 *     the element, which is the "focus disappears after clicking Save" bug.
 *     `aria-disabled` keeps focus, keeps the element in the accessibility tree
 *     and still blocks activation via the click guard below.
 *   • The click guard is the same code path for mouse and keyboard: a native
 *     <button> fires `click` for Enter and Space, so there is exactly ONE
 *     activation path and no possibility of a keyboard action duplicating a
 *     request that the mouse path already made.
 *   • The element is never unmounted while loading, so no spinner flash and no
 *     lost focus.
 *
 * ACCESSIBILITY
 *   • `aria-busy` while loading.
 *   • `iconOnly` buttons REQUIRE an `aria-label`; the component throws in
 *     development if one is missing, because an unnamed icon button is
 *     unusable with a screen reader.
 * =============================================================================
 */

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../utils/cn";
import { uiButton, uiIconButton, type ButtonSize, type ButtonVariant } from "../shared/ui/uiTokens";

/** Legacy alias kept so pre-existing variant names continue to work. */
export type ButtonVariantName = ButtonVariant | "danger";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariantName;
  size?: ButtonSize;
  /** Shows a spinner, blocks re-activation and sets `aria-busy`. */
  loading?: boolean;
  /** Renders as a square icon button. `aria-label` becomes mandatory. */
  iconOnly?: boolean;
  /** Leading icon slot. Prefer this over manual spacing in children. */
  icon?: ReactNode;
  children?: ReactNode;
}

const VARIANT_ALIAS: Record<string, ButtonVariant> = {
  danger: "destructive",
};

/** Spinner drawn inside the button. Size tracks the button size. */
function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={cn("animate-spin", className)}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-90"
        fill="currentColor"
        d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z"
      />
    </svg>
  );
}

const SPINNER_SIZE: Record<ButtonSize, string> = {
  xs: "size-3",
  sm: "size-3.5",
  md: "size-3.5",
  lg: "size-4",
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  iconOnly = false,
  icon,
  children,
  className,
  disabled,
  type,
  onClick,
  "aria-label": ariaLabel,
  ...rest
}: ButtonProps) {
  const resolvedVariant: ButtonVariant = VARIANT_ALIAS[variant] ?? variant;
  const isBlocked = Boolean(disabled) || loading;

  if (import.meta.env?.DEV && iconOnly && !ariaLabel) {
    // Fail loudly in development: an icon-only button with no accessible name
    // is invisible to screen readers.
    console.error(
      "[Button] iconOnly buttons require an aria-label (or title) for accessibility.",
    );
  }

  return (
    <button
      type={type ?? "button"}
      className={cn(
        iconOnly ? uiIconButton(resolvedVariant, size) : uiButton(resolvedVariant, size),
        // aria-disabled styling: mirrors the disabled look without dropping focus.
        "aria-disabled:cursor-not-allowed aria-disabled:opacity-55",
        className,
      )}
      disabled={disabled}
      aria-disabled={isBlocked || undefined}
      aria-busy={loading || undefined}
      aria-label={ariaLabel}
      onClick={(event) => {
        // Single guard for BOTH mouse and keyboard activation. Existing
        // isSaving / inFlight / deletingId guards in callers stay authoritative;
        // this only prevents a second activation of the same control.
        if (isBlocked) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        onClick?.(event);
      }}
      {...rest}
    >
      {loading ? <Spinner className={SPINNER_SIZE[size]} /> : icon}
      {children}
    </button>
  );
}

export default Button;
