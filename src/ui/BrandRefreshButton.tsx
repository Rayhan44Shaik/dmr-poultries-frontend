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
 *   • Refresh symbol — a circular refresh arrow forms a RING, and the hen sits
 *     inside it. The ring spins while `loading`; the hen dances in the middle
 *     (springy shimmy + peck), and wiggles on hover at rest.
 *     See `--animate-brand-*` in styles/tokens.css.
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
  const box = compact ? 22 : 26;
  // The hen sits INSIDE the refresh ring, so it must be small enough to clear
  // the stroke and the arrowhead.
  const hen = Math.round(box * 0.46);

  return (
    <span
      className="relative inline-flex shrink-0 items-center justify-center"
      style={{ width: box, height: box }}
    >
      {/* The refresh symbol itself: a circular arrow drawn as an SVG ring with
          a gap and an arrowhead. It spins while loading. Drawn as a ring rather
          than a lucide icon so the centre stays hollow for the hen. */}
      <svg
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        className={cn(
          "absolute inset-0 h-full w-full text-emerald-600",
          loading && "motion-safe:animate-[var(--animate-brand-spin)]",
        )}
      >
        {/* Arc: a near-complete circle, open at the top-right for the arrow. */}
        <path
          d="M21 12a9 9 0 1 1-2.64-6.36"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
        />
        {/* Arrowhead closing the loop. */}
        <path
          d="M21 3.2v5.2h-5.2"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      {/* The hen, centred inside the ring. Dance layer: shimmy while loading,
          wiggle on hover at rest. */}
      <span
        className={cn(
          "relative inline-flex items-center justify-center",
          loading
            ? "motion-safe:animate-[var(--animate-brand-dance)]"
            : "motion-safe:group-hover:animate-[var(--animate-brand-dance)]",
        )}
        style={{ width: hen, height: hen }}
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
            // The hen is white; inside the emerald ring it needs a hairline
            // emerald edge so the silhouette still reads at this size.
            className={cn(
              "h-full w-full select-none object-contain",
              "[filter:drop-shadow(0.5px_0_0_var(--color-emerald-700))_drop-shadow(-0.5px_0_0_var(--color-emerald-700))_drop-shadow(0_0.5px_0_var(--color-emerald-700))_drop-shadow(0_-0.5px_0_var(--color-emerald-700))]",
            )}
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
