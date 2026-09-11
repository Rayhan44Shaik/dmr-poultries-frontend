/**
 * =============================================================================
 * BRAND REFRESH BUTTON — the canonical "reload this page's data" control
 * =============================================================================
 * ONE refresh treatment for the whole application:
 *
 *   • Emerald light  — the same emerald the design system already uses for
 *     "safe, reversible, positive" actions (Excel / Import / focus rings), so
 *     refresh reads as part of the family instead of a new colour. A soft
 *     emerald→teal gradient with a ring at rest, deepening on hover, and
 *     lighting up further while refreshing.
 *   • Brand logo     — the DMR hen replaces the generic RefreshCw glyph, so the
 *     control is unmistakably ours.
 *   • Logo animation — while `loading`, four cues stack so the activity is
 *     obvious at a glance: an expanding ripple, a breathing halo, a sweeping
 *     orbit arc, and the hen hopping (crouch → launch → land squash).
 *     See `--animate-brand-*` in styles/tokens.css. At rest the hen lifts and
 *     tilts on hover.
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

/**
 * The animated brand glyph. While loading, FOUR cues stack so the activity is
 * impossible to miss even though the glyph is only ~18px:
 *   1. an expanding ripple ring,      2. a breathing emerald halo,
 *   3. a sweeping emerald orbit arc,  4. the hen itself hopping.
 * At rest the hen simply lifts on hover.
 */
function BrandGlyph({ loading, compact }: { loading: boolean; compact: boolean }) {
  const box = compact ? "size-[18px]" : "size-[22px]";
  return (
    <span className={cn("relative inline-flex shrink-0 items-center justify-center", box)}>
      {loading && (
        <>
          {/* 1. Ripple — expands and fades outward, reads from a distance. */}
          <span
            aria-hidden="true"
            className="absolute -inset-1 rounded-full border-2 border-emerald-500/60 motion-safe:animate-[var(--animate-brand-ripple)]"
          />
          {/* 2. Halo — soft breathing fill behind the hen. */}
          <span
            aria-hidden="true"
            className="absolute -inset-0.5 rounded-full bg-emerald-400/45 blur-[1px] motion-safe:animate-[var(--animate-brand-pulse)]"
          />
          {/* 3. Orbit — a single emerald arc sweeping around the glyph. The
                 transparent sides turn the ring into a chasing arc. */}
          <span
            aria-hidden="true"
            className={cn(
              "absolute -inset-1 rounded-full border-2",
              "border-emerald-600 border-r-transparent border-b-transparent",
              "motion-safe:animate-[var(--animate-brand-orbit)]",
            )}
          />
        </>
      )}
      {/* 4. The hen — hero of the animation, hopping on the spot. */}
      <img
        src={henLogo}
        alt=""
        aria-hidden="true"
        draggable={false}
        className={cn(
          "relative h-full w-full select-none object-contain",
          loading
            ? "motion-safe:animate-[var(--animate-brand-hop)] drop-shadow-[0_1px_2px_rgb(5_150_105_/_0.45)]"
            : "transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:rotate-3 group-active:translate-y-0",
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
        "group relative overflow-hidden",
        // --- Emerald "light" ------------------------------------------------
        // A gradient from emerald into teal rather than a flat tint: it gives
        // the control depth, keeps it clearly secondary to the solid emerald
        // Save button, and stays legible on both white and slate-50 surfaces.
        "border border-emerald-300/80 bg-gradient-to-b from-emerald-50 to-teal-100/80",
        "font-semibold text-emerald-800 shadow-sm ring-1 ring-emerald-500/10",
        "transition-all duration-200",
        "hover:border-emerald-400 hover:from-emerald-100 hover:to-teal-200/80",
        "hover:text-emerald-900 hover:shadow-md hover:ring-emerald-500/25",
        "active:from-emerald-200 active:to-teal-200 active:shadow-sm",
        "disabled:border-emerald-100 disabled:from-emerald-50/50 disabled:to-emerald-50/50",
        "disabled:text-emerald-400 disabled:shadow-none",
        // While refreshing the surface itself lights up, so the whole control
        // — not just the 22px glyph — signals that work is in flight.
        loading && "border-emerald-400 from-emerald-100 to-teal-200/90 ring-2 ring-emerald-400/30",
        !compact && "px-3.5",
        className,
      )}
      icon={<BrandGlyph loading={loading} compact={compact} />}
    >
      {iconOnly ? undefined : label}
    </Button>
  );
}

export default BrandRefreshButton;
