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
 *   • loading — the hen WALKS along a track: it strolls left → right, turns
 *     around at the far end, walks back, and turns again, looping. Two nested
 *     elements keep the motion clean: the outer one travels and handles the
 *     turn (scaleX flip), the inner one does the footstep bob. Combining both
 *     on one element would fight over `transform`.
 *   • at rest — hovering makes the hen do a short side-to-side dance, teasing
 *     the animation before you click.
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
          <img
            src={henLogo}
            alt=""
            aria-hidden="true"
            draggable={false}
            className="h-full w-full select-none object-contain"
          />
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
        // --- Emerald "light" ------------------------------------------------
        // A soft emerald→teal gradient rather than a flat tint: enough depth to
        // feel deliberate, while staying clearly secondary to the solid emerald
        // Save button beside it.
        "border border-emerald-300/80 bg-gradient-to-b from-emerald-50 to-teal-100/80",
        "text-emerald-800 shadow-xs",
        "hover:border-emerald-400 hover:from-emerald-100 hover:to-teal-200/80",
        "hover:text-emerald-900",
        "active:from-emerald-200 active:to-teal-200",
        "disabled:border-emerald-100 disabled:from-emerald-50/50 disabled:to-emerald-50/50",
        "disabled:text-emerald-400 disabled:shadow-none",
        // While refreshing the surface tints a touch deeper, so the whole
        // control — not just the glyph — reads as busy.
        loading && "border-emerald-400 from-emerald-100 to-teal-200/90",
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
