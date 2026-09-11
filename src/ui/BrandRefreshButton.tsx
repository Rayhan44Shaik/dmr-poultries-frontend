/**
 * =============================================================================
 * BRAND REFRESH BUTTON — the canonical "reload this page's data" control
 * =============================================================================
 * ONE refresh treatment for the whole application:
 *
 *   • Emerald light  — the same emerald the design system already uses for
 *     "safe, reversible, positive" actions (Excel / Import / focus rings), so
 *     refresh reads as part of the family instead of a new colour. A soft
 *     emerald tint + ring at rest, deepening on hover.
 *   • Brand logo     — the DMR hen replaces the generic RefreshCw glyph, so the
 *     control is unmistakably ours.
 *   • Logo animation — while `loading`, the hen hops and an emerald halo
 *     breathes behind it (`--animate-brand-hop` / `--animate-brand-pulse` in
 *     styles/tokens.css). At rest the hen lifts gently on hover.
 *
 * USAGE (identical everywhere — do not hand-roll a refresh button again):
 *
 *   <BrandRefreshButton loading={refreshing} onClick={reload} />
 *   <BrandRefreshButton loading={busy} onClick={reload} compact />   // icon only
 *
 * Built on the shared <Button variant="custom">, so height, padding, radius,
 * focus ring and the single-activation guard all come from the button system —
 * only the colour and the glyph are supplied here. `loading` therefore also
 * blocks double activation and sets `aria-busy`, exactly like every other
 * action button.
 *
 * ACCESSIBILITY
 *   The hen is decorative (`aria-hidden`), the accessible name is always a
 *   verb phrase ("Refresh data"), and the live state is announced via
 *   `aria-busy` rather than by swapping the label.
 *   Users with `prefers-reduced-motion` get the static logo — no hop, no pulse.
 * =============================================================================
 */

import type { ReactNode } from "react";
import henLogo from "../assets/dmr-hen-cut-256.png";
import { cn } from "../utils/cn";
import { Button, type ButtonProps } from "./Button";

export interface BrandRefreshButtonProps
  extends Omit<ButtonProps, "variant" | "icon" | "iconOnly" | "children"> {
  /** Visible text. Defaults to "Refresh"; pass `null`/`compact` for icon-only. */
  children?: ReactNode;
  /** Accessible name. Defaults to "Refresh data". */
  ariaLabel?: string;
  /** Icon-only 32px treatment for dense toolbars and table headers. */
  compact?: boolean;
}

/** The animated brand glyph: hopping hen over a breathing emerald halo. */
function BrandGlyph({ loading, compact }: { loading: boolean; compact: boolean }) {
  const box = compact ? "size-4" : "size-[18px]";
  return (
    <span className={cn("relative inline-flex items-center justify-center", box)}>
      {/* Emerald halo — only rendered while loading so the resting state stays
          quiet and the row keeps its usual visual weight. */}
      {loading && (
        <span
          aria-hidden="true"
          className={cn(
            "absolute inset-0 rounded-full bg-emerald-400/35",
            "motion-safe:animate-[var(--animate-brand-pulse)]",
          )}
        />
      )}
      <img
        src={henLogo}
        alt=""
        aria-hidden="true"
        draggable={false}
        className={cn(
          "relative h-full w-full select-none object-contain",
          // Hops while refreshing; a gentle lift on hover at rest.
          loading
            ? "motion-safe:animate-[var(--animate-brand-hop)]"
            : "transition-transform duration-150 group-hover:-translate-y-px",
        )}
      />
    </span>
  );
}

export function BrandRefreshButton({
  children,
  ariaLabel,
  compact = false,
  loading = false,
  className,
  size,
  ...rest
}: BrandRefreshButtonProps) {
  const label = children === undefined ? "Refresh" : children;
  const iconOnly = compact || !label;
  const name = ariaLabel ?? "Refresh data";

  return (
    <Button
      {...rest}
      // `loading` is handled here (the brand glyph IS the loading indicator),
      // so the generic spinner is suppressed and only the guard is kept.
      loading={false}
      aria-busy={loading || undefined}
      disabled={rest.disabled || loading}
      variant="custom"
      size={compact ? "sm" : (size ?? "lg")}
      iconOnly={iconOnly}
      aria-label={iconOnly ? name : ariaLabel}
      title={iconOnly ? name : rest.title}
      className={cn(
        "group",
        // Emerald "light": soft tinted surface + ring, deepening on hover.
        "border border-emerald-200 bg-emerald-50/70 text-emerald-700 shadow-xs",
        "hover:bg-emerald-100 hover:border-emerald-300 hover:text-emerald-800",
        "active:bg-emerald-200/70",
        "disabled:border-emerald-100 disabled:bg-emerald-50/50 disabled:text-emerald-400",
        !compact && "px-3",
        className,
      )}
      icon={<BrandGlyph loading={loading} compact={compact} />}
    >
      {iconOnly ? undefined : label}
    </Button>
  );
}

export default BrandRefreshButton;
