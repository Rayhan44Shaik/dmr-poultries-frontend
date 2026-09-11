/**
 * =============================================================================
 * BRAND RUN OVERLAY — the hen sprints across the whole page on refresh
 * =============================================================================
 * When a refresh starts, the DMR hen dashes in from off-screen left, runs the
 * full width of the viewport kicking up dust, and exits off-screen right. It is
 * the celebratory, unmissable confirmation that data is reloading.
 *
 * DESIGN NOTES
 *   • Rendered in a PORTAL on <body> with `position: fixed`, so the run spans
 *     the entire viewport rather than being clipped by the toolbar, a card, or
 *     any `overflow-hidden` ancestor the button happens to live in.
 *   • `pointer-events-none` throughout — the hen never blocks a click, so the
 *     page stays fully usable while it runs.
 *   • Purely decorative: `aria-hidden`, no role, nothing announced. The
 *     accessible loading state stays on the button itself (`aria-busy`).
 *   • Skipped entirely for `prefers-reduced-motion` users.
 *
 * The run is a ONE-SHOT animation, deliberately decoupled from how long the
 * request actually takes: a fetch that resolves in 80ms would otherwise produce
 * an ugly flash. `runKey` (incremented per refresh) remounts the element so the
 * animation restarts cleanly on every click.
 * =============================================================================
 */

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { createPortal } from "react-dom";
import henLogo from "../assets/dmr-hen-cut-256.png";
import { cn } from "../utils/cn";

/** How long the hen takes to cross the viewport. Matches --animate-brand-run. */
const RUN_DURATION_MS = 1600;

const HEN_SIZE = 46;

export interface BrandRunOverlayProps {
  /**
   * Increment this to launch a run. Using a counter rather than a boolean means
   * each refresh restarts the animation, even if one is already playing.
   */
  runKey: number;
  /** Vertical position of the run, as a viewport percentage. Default 50 (middle). */
  topPercent?: number;
}

export function BrandRunOverlay({ runKey, topPercent = 50 }: BrandRunOverlayProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // runKey 0 is the initial mount — don't run before the user asks.
    if (runKey <= 0) return;
    // Respect reduced-motion: no dash at all.
    if (
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    setVisible(true);
    const timer = window.setTimeout(() => setVisible(false), RUN_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [runKey]);

  if (!visible || typeof document === "undefined") return null;

  return createPortal(
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[9998] overflow-hidden"
    >
      {/* Travel layer: carries the hen from off-screen left to off-screen right. */}
      <div
        key={runKey}
        className="absolute motion-safe:animate-[var(--animate-brand-run)]"
        style={
          {
            top: `${topPercent}%`,
            left: `-${HEN_SIZE * 2}px`,
            // Cross the full viewport plus the off-screen margins at both ends.
            "--run-distance": `calc(100vw + ${HEN_SIZE * 4}px)`,
          } as CSSProperties
        }
      >
        <div className="relative">
          {/* Dust puffs trailing behind the hen. Staggered so they read as a
              stream of kicked-up dirt rather than one blob. */}
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className={cn(
                "absolute rounded-full bg-emerald-400/40",
                "motion-safe:animate-[var(--animate-brand-dust)]",
              )}
              style={{
                width: 7 - i,
                height: 7 - i,
                left: -6 - i * 7,
                top: HEN_SIZE - 10 + i * 3,
                animationDelay: `${i * 0.13}s`,
              }}
            />
          ))}
          {/* Gallop layer: the vertical bob, independent of the travel. */}
          <div className="motion-safe:animate-[var(--animate-brand-gallop)]">
            <img
              src={henLogo}
              alt=""
              draggable={false}
              className="select-none object-contain drop-shadow-[0_3px_6px_rgb(5_150_105_/_0.35)]"
              style={{ width: HEN_SIZE, height: HEN_SIZE }}
            />
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default BrandRunOverlay;
