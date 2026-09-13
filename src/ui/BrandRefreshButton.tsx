/**
 * =============================================================================
 * BRAND REFRESH BUTTON — the canonical "reload this page's data" control
 * =============================================================================
 * ONE refresh treatment for the whole application:
 *
 *   • Orange pill    — a soft rounded-full capsule holding the hen and the
 *     word "Refresh". Deliberately orange rather than the app's usual emerald,
 *     so refresh is distinguishable at a glance from Save / Export / Import.
 *     Orange is otherwise unclaimed: rose is destructive, amber is warning.
 *   • Brand logo     — the DMR hen replaces the generic RefreshCw glyph, so the
 *     control is unmistakably ours.
 *   • Logo animation — the hen itself IS the animation: while `loading` it
 *     dances in place, a springy shimmy with squash-and-stretch punctuated by
 *     a peck. At rest it wiggles on hover. No spinner, no arrow, no ring — the
 *     bird carries the whole thing. See `--animate-brand-*` in tokens.css.
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
 *   The hen animates for EVERY user — the dance/wiggle is intentionally not
 *   gated behind `prefers-reduced-motion` (product decision: the brand motion
 *   is the loading indicator, so it must never silently disappear).
 * =============================================================================
 */

import type { ReactNode } from "react";
import henLogo from "../assets/dmr-hen-cut-256.png";
import { cn } from "../utils/cn";
import { Button, type ButtonProps } from "./Button";

export interface BrandRefreshButtonProps
  extends Omit<ButtonProps, "variant" | "icon" | "iconOnly" | "children"> {
  /** Visible text. Defaults to "Refresh". */
  children?: ReactNode;
  /** Accessible name. Defaults to "Refresh data". */
  ariaLabel?: string;
  /** Icon-only pill for dense toolbars and table headers. */
  compact?: boolean;
}

/**
 * The animated brand glyph — the hen sitting inside the round button.
 *
 *   • loading — the hen DANCES on the spot: a springy shimmy, tilting side to
 *     side with squash-and-stretch. Two nested layers, because the dance and
 *     the peck each animate `transform` and would overwrite each other on a
 *     single element.
 *   • at rest — a gentle wiggle on hover, teasing the animation.
 *
 * No walking track: inside a circle the hen stays centred and dances in place.
 */
function BrandGlyph({ loading, compact }: { loading: boolean; compact: boolean }) {
  const size = compact ? 17 : 20;

  return (
    <span
      className="relative inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
    >
      {/* Dance layer: the shimmy while loading, a wiggle on hover at rest. */}
      <span
        className={cn(
          "inline-flex h-full w-full items-center justify-center",
          loading
            ? "animate-[var(--animate-brand-dance)]"
            : "group-hover:animate-[var(--animate-brand-dance)]",
        )}
      >
        {/* Peck layer: a head-bob punctuating the dance. */}
        <span
          className={cn(
            "inline-flex h-full w-full items-center justify-center",
            loading && "animate-[var(--animate-brand-peck)]",
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
  // The hen + the word "Refresh". Pass `compact` for the icon-only variant.
  const label = children === undefined ? "Refresh" : children;
  const iconOnly = compact || !label;
  const name = ariaLabel ?? "Refresh data";

  return (
    <Button
      {...rest}
      // `loading` is handled here (the dancing hen IS the loading indicator),
      // so the generic spinner is suppressed and only the guard is kept.
      loading={false}
      aria-busy={loading || undefined}
      disabled={rest.disabled || loading}
      variant="custom"
      size={compact ? "xs" : (size ?? "sm")}
      iconOnly={iconOnly}
      aria-label={iconOnly ? name : ariaLabel}
      title={iconOnly ? name : rest.title}
      className={cn(
        "group",
        // --- Orange pill -----------------------------------------------------
        // Deliberately NOT emerald: the app is emerald throughout (Save, Excel,
        // Import, focus rings), so refresh was disappearing into the palette.
        // Orange is unclaimed — rose means destructive and amber means warning,
        // so it stands out without colliding with an existing meaning.
        "!rounded-full",
        "border border-orange-300 bg-gradient-to-b from-orange-50 to-amber-100/80",
        "text-orange-800 shadow-xs",
        "hover:border-orange-400 hover:from-orange-100 hover:to-amber-200/80",
        "hover:text-orange-900",
        "active:from-orange-200 active:to-amber-200",
        "disabled:border-orange-100 disabled:from-orange-50/50 disabled:to-orange-50/50",
        "disabled:text-orange-400 disabled:shadow-none",
        // While refreshing the surface tints deeper, so the whole control reads
        // as busy, not just the hen.
        loading && "border-orange-400 from-orange-100 to-amber-200/90",
        !iconOnly && "gap-1.5 pl-2 pr-3",
        className,
      )}
      icon={<BrandGlyph loading={loading} compact={compact} />}
    >
      {iconOnly ? undefined : label}
    </Button>
  );
}

export default BrandRefreshButton;
