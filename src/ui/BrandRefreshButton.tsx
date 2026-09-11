/**
 * =============================================================================
 * BRAND REFRESH BUTTON — the canonical "reload this page's data" control
 * =============================================================================
 * ONE refresh treatment for the whole application:
 *
 *   • White surface  — a clean white button with an emerald border and label,
 *     washing faintly emerald on hover and while refreshing.
 *   • Brand logo     — the DMR hen replaces the generic RefreshCw glyph, so the
 *     control is unmistakably ours. The logo is a WHITE hen, so on this white
 *     surface it is given an emerald CSS outline to keep it legible.
 *   • Logo animation — while `loading` the hen WALKS across the button: left
 *     → right, a turn at the far end, then back again, looping, with a
 *     footstep bob throughout. At rest, hovering makes it do a short dance.
 *     See `--animate-brand-*` in styles/tokens.css.
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

import type { CSSProperties, ReactNode } from "react";
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
 * The animated brand glyph.
 *
 *   • loading — the hen STRUTS along a track: sets off, pauses mid-way to
 *     peck, carries on, turns at the far end, and struts back, looping. Three
 *     nested layers compose the motion — travel + turn (scaleX flip), the
 *     bouncy footstep bob, and the peck — because each animates `transform`
 *     and they would overwrite each other on a single element.
 *   • at rest — hovering makes the hen do a springy shimmy, teasing the
 *     animation before you click.
 *
 * No rings, halos or orbits — the hen alone carries the motion.
 */
function BrandGlyph({ loading, compact }: { loading: boolean; compact: boolean }) {
  const size = compact ? 15 : 16;
  // A short track: just enough travel to read as a walk, not enough to stretch
  // the button. The hen stays visually part of the label, not a parade float.
  const distance = compact ? 5 : 7;

  return (
    <span
      className="relative inline-flex shrink-0 items-center"
      style={{ width: size + distance, height: size }}
    >
      {/* Outer: travels left→right and flips to face the way it's heading. */}
      <span
        className={cn(
          "absolute left-0 top-0 inline-flex items-center justify-center",
          loading && "motion-safe:animate-[var(--animate-brand-walk)]",
        )}
        style={
          {
            width: size,
            height: size,
            "--walk-distance": `${distance}px`,
          } as CSSProperties
        }
      >
        {/* Inner: the footstep bob / hover dance. */}
        <span
          className={cn(
            "inline-flex h-full w-full items-center justify-center",
            loading
              ? "motion-safe:animate-[var(--animate-brand-step)]"
              : "motion-safe:group-hover:animate-[var(--animate-brand-dance)]",
          )}
        >
          {/* Innermost: the peck, timed to land in the walk's pauses. Each
              layer owns one `transform` animation — they'd overwrite each
              other if combined on a single element. */}
          <span
            className={cn(
              "inline-flex h-full w-full items-center justify-center",
              loading && "motion-safe:animate-[var(--animate-brand-peck)]",
            )}
          >
            <img
              src={henLogo}
              alt=""
              aria-hidden="true"
              draggable={false}
              // The logo is a WHITE hen, which would be invisible on the white
              // button. Four stacked drop-shadows (one per direction) trace an
              // emerald outline around the silhouette. Done in CSS rather than
              // baked into the PNG because it follows the alpha channel exactly
              // and stays smooth at any size — a pre-rendered outline goes
              // jagged once scaled down to 16px.
              className={cn(
                "h-full w-full select-none object-contain",
                "[filter:drop-shadow(0.7px_0_0_var(--color-emerald-600))_drop-shadow(-0.7px_0_0_var(--color-emerald-600))_drop-shadow(0_0.7px_0_var(--color-emerald-600))_drop-shadow(0_-0.7px_0_var(--color-emerald-600))]",
              )}
            />
          </span>
        </span>
      </span>
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
      // Compact by default: "sm" (h-8) keeps the control small and neat next
      // to the autosave pill. Callers can still pass an explicit size.
      size={compact ? "xs" : (size ?? "sm")}
      iconOnly={iconOnly}
      aria-label={iconOnly ? name : ariaLabel}
      title={iconOnly ? name : rest.title}
      className={cn(
        "group",
        // --- White surface --------------------------------------------------
        // A clean white button with an emerald border and label. The white hen
        // would vanish against it, so the glyph carries its own emerald outline
        // (see BrandGlyph) — that outline is what makes the bird readable here.
        "border border-emerald-300 bg-white",
        "text-emerald-700 shadow-xs",
        "hover:border-emerald-400 hover:bg-emerald-50/60 hover:text-emerald-800",
        "active:bg-emerald-100/70",
        "disabled:border-slate-200 disabled:bg-white",
        "disabled:text-slate-400 disabled:shadow-none",
        // While refreshing, a faint emerald wash so the whole control — not
        // just the glyph — reads as busy.
        loading && "border-emerald-400 bg-emerald-50/70",
        // Tighter gap than the button default: the hen's walking track already
        // carries its own trailing space, so the stock gap looks like a gap.
        !iconOnly && "gap-1 pl-2 pr-2.5",
        className,
      )}
      icon={<BrandGlyph loading={loading} compact={compact} />}
    >
      {iconOnly ? undefined : label}
    </Button>
  );
}

export default BrandRefreshButton;
