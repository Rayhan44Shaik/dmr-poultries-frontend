/**
 * =============================================================================
 * BRAND REFRESH BUTTON — the canonical "reload this page's data" control
 * =============================================================================
 * ONE refresh treatment for the whole application:
 *
 *   • Round emerald  — a circular control rather than a rounded rectangle, so
 *     it frames the hen like a badge and reads instantly as "refresh".
 *   • Brand logo     — the DMR hen replaces the generic RefreshCw glyph, so the
 *     control is unmistakably ours.
 *   • Logo animation — while `loading` the hen DANCES inside the circle: a
 *     springy shimmy with squash-and-stretch, punctuated by a peck. At rest it
 *     wiggles on hover. See `--animate-brand-*` in styles/tokens.css.
 *
 * USAGE (identical everywhere — do not hand-roll a refresh button again):
 *
 *   <BrandRefreshButton loading={refreshing} onClick={reload} />
 *   <BrandRefreshButton loading={busy} onClick={reload} compact />   // smaller
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
 *   Users with `prefers-reduced-motion` get the static logo — no dance.
 * =============================================================================
 */

import henLogo from "../assets/dmr-hen-cut-256.png";
import { cn } from "../utils/cn";
import { Button, type ButtonProps } from "./Button";

export interface BrandRefreshButtonProps
  extends Omit<ButtonProps, "variant" | "icon" | "iconOnly" | "children"> {
  /** Accessible name. Defaults to "Refresh data". */
  ariaLabel?: string;
  /** Smaller circle for dense toolbars and table headers. */
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
            ? "motion-safe:animate-[var(--animate-brand-dance)]"
            : "motion-safe:group-hover:animate-[var(--animate-brand-dance)]",
        )}
      >
        {/* Peck layer: a head-bob punctuating the dance. */}
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
            className="h-full w-full select-none object-contain"
          />
        </span>
      </span>
    </span>
  );
}

export function BrandRefreshButton({
  ariaLabel,
  compact = false,
  loading = false,
  className,
  size,
  ...rest
}: BrandRefreshButtonProps) {
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
      // Always icon-only: the hen alone fills the circle, so there is no room
      // for a text label. The accessible name carries the meaning instead.
      iconOnly
      size={compact ? "sm" : (size ?? "md")}
      aria-label={name}
      title={rest.title ?? "Refresh"}
      className={cn(
        "group",
        // --- Round emerald control ------------------------------------------
        // A circle rather than the usual rounded rectangle: it frames the hen
        // like a badge and reads instantly as "the refresh control".
        "!rounded-full",
        "border border-emerald-300/80 bg-gradient-to-b from-emerald-50 to-teal-100/80",
        "text-emerald-800 shadow-xs",
        "hover:border-emerald-400 hover:from-emerald-100 hover:to-teal-200/80",
        "active:from-emerald-200 active:to-teal-200",
        "disabled:border-emerald-100 disabled:from-emerald-50/50 disabled:to-emerald-50/50",
        "disabled:shadow-none",
        // While refreshing the ring tints deeper, so the control reads as busy
        // even at a glance.
        loading && "border-emerald-400 from-emerald-100 to-teal-200/90",
        className,
      )}
      icon={<BrandGlyph loading={loading} compact={compact} />}
    />
  );
}

export default BrandRefreshButton;
