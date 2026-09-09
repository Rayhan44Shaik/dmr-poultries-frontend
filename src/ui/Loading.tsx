/**
 * =============================================================================
 * GLOBAL LOADING — Spinner, Skeleton and the table loading overlay
 * =============================================================================
 * The rule that governs all three: PREVIOUSLY LOADED DATA STAYS VISIBLE during a
 * background refresh. A populated table is dimmed and overlaid, never unmounted
 * and replaced by a blank screen with a centred spinner.
 *
 *   <Spinner />              inline, inherits the current text colour
 *   <Skeleton />             fixed-size placeholder block (no layout shift)
 *   <TableSkeleton rows />   first-load placeholder for a table body
 *   <LoadingOverlay />       dims EXISTING content while a refresh runs
 *
 * All of them expose an accessible busy state without announcing themselves on
 * every keystroke: `aria-hidden` on the visual, `role="status"` + a
 * screen-reader label on the container, so a screen reader hears "loading" once
 * rather than for each skeleton row.
 * =============================================================================
 */

import type { ReactNode } from "react";
import { cn } from "../utils/cn";
import {
  uiLoadingInlineClass,
  uiLoadingOverlayClass,
  uiSkeletonClass,
  uiSkeletonRowClass,
} from "../shared/ui/uiTokens";

/* ---------------------------------------------------------------------------
 * Spinner
 * ------------------------------------------------------------------------- */

export interface SpinnerProps {
  /** Pixel size. Default 16. */
  size?: number;
  className?: string;
  /** Accessible label; omit when the surrounding control already says it. */
  label?: string;
}

export function Spinner({ size = 16, className, label }: SpinnerProps) {
  const spinner = (
    <svg
      className={cn("animate-spin", className)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-90"
        fill="currentColor"
        d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z"
      />
    </svg>
  );

  if (!label) return spinner;

  return (
    <span role="status" aria-live="polite" className="inline-flex items-center gap-2">
      {spinner}
      <span className="ds-sr-only">{label}</span>
    </span>
  );
}

/* ---------------------------------------------------------------------------
 * Skeleton
 * ------------------------------------------------------------------------- */

export interface SkeletonProps {
  className?: string;
  /** Convenience: explicit width/height instead of a class. */
  width?: number | string;
  height?: number | string;
  variant?: "text" | "circular" | "rectangular";
}

export function Skeleton({ className, width, height, variant = "text" }: SkeletonProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        uiSkeletonClass,
        variant === "text" && "h-3 w-full",
        variant === "circular" && "size-8 rounded-full",
        variant === "rectangular" && "h-10 w-full",
        className,
      )}
      style={{
        width: width ?? undefined,
        height: height ?? undefined,
      }}
    />
  );
}

/* ---------------------------------------------------------------------------
 * TableSkeleton — FIRST load only
 * ------------------------------------------------------------------------- */

export interface TableSkeletonProps {
  rows?: number;
  columns?: number;
  className?: string;
  /** Accessible loading label. */
  label?: string;
}

export function TableSkeleton({
  rows = 6,
  columns = 5,
  className,
  label = "Loading records",
}: TableSkeletonProps) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className={cn("w-full", className)}>
      <span className="ds-sr-only">{label}</span>
      <div aria-hidden="true" className="divide-y divide-slate-100">
        {Array.from({ length: rows }, (_, rowIndex) => (
          <div key={rowIndex} className={uiSkeletonRowClass}>
            {Array.from({ length: columns }, (_, columnIndex) => (
              <Skeleton
                key={columnIndex}
                // Vary the widths so the placeholder reads as data, not stripes.
                className={cn(
                  "flex-1",
                  columnIndex === 0 && "max-w-[22%]",
                  columnIndex === columns - 1 && "max-w-[12%]",
                )}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * LoadingOverlay — BACKGROUND refresh over existing content
 * ------------------------------------------------------------------------- */

export interface LoadingOverlayProps {
  /** Show the overlay. */
  visible: boolean;
  label?: string;
  children?: ReactNode;
  className?: string;
}

/**
 * Wraps content and dims it while `visible`. The content is NEVER unmounted, so
 * rows, scroll position and any focus inside the region are all preserved, and
 * there is no spinner flash when a refresh resolves quickly.
 */
export function LoadingOverlay({
  visible,
  label = "Refreshing",
  children,
  className,
}: LoadingOverlayProps) {
  return (
    <div
      className={cn("relative", className)}
      aria-busy={visible || undefined}
      // While refreshing, the region is still readable but not interactive, so
      // a click cannot land on a row that is about to be replaced.
      aria-live={visible ? "polite" : undefined}
    >
      {children}

      {visible ? (
        <div className={uiLoadingOverlayClass}>
          <span role="status" className={uiLoadingInlineClass}>
            <Spinner size={14} />
            <span>{label}</span>
          </span>
        </div>
      ) : null}
    </div>
  );
}

export default Spinner;
