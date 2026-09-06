// src/ui/BrandMark.tsx
// Fast, stable, no-blink hen mark. Pre-cut transparent PNG — no canvas,
// no flash, no box. Completely free-floating logo, bigger sizes.

import henCutUrl from "../assets/dmr-hen-cut.png";

export type BrandMarkSize = "xs" | "sm" | "md" | "lg" | "xl";
export type BrandMarkVariant = "tile" | "plain";
export type BrandMarkInset = "tight" | "normal" | "roomy";

export interface BrandMarkProps {
  size?: BrandMarkSize;
  variant?: BrandMarkVariant;
  inset?: BrandMarkInset;
  label?: string;
  className?: string;
}

// Bigger, free-floating sizes — requested "big free, no box"
const SIZES: Record<BrandMarkSize, { box: string; px: number }> = {
  xs: { box: "h-7 w-7", px: 28 },
  sm: { box: "h-9 w-9", px: 36 },
  md: { box: "h-11 w-11", px: 44 },
  lg: { box: "h-14 w-14", px: 56 },
  xl: { box: "h-[4.5rem] w-[4.5rem]", px: 72 },
};

// Kept for legacy `variant="tile"` callers — now very subtle, no green/black.
const TILE =
  "bg-white ring-1 ring-inset ring-slate-200/70 shadow-sm " +
  "dark:bg-slate-800 dark:ring-slate-700";

export default function BrandMark({
  size = "md",
  variant = "plain",
  // inset retained for API compatibility — plain variant is always free with no padding
  inset: _inset = "normal",
  label,
  className = "",
}: BrandMarkProps) {
  const s = SIZES[size];
  const decorative = !label;
  const isTile = variant === "tile";

  // Plain = completely free, no background, no padding, no ring.
  // Tile = rare fallback (kept deterministic, white only).
  return (
    <div
      className={[
        "relative shrink-0 select-none overflow-hidden",
        "flex items-center justify-center",
        "bg-transparent",
        s.box,
        isTile ? TILE + " rounded-[10px] p-1" : "rounded-none",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={
        isTile
          ? undefined
          : {
              // Ensure no layout shift: explicit containment
              contain: "layout style" as const,
            }
      }
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : label}
      aria-hidden={decorative || undefined}
    >
      <img
        src={henCutUrl}
        width={s.px}
        height={s.px}
        alt=""
        aria-hidden="true"
        draggable={false}
        loading="eager"
        decoding="async"
        fetchPriority="high"
        className="h-full w-full object-contain object-center antialiased"
        style={{
          imageRendering: "auto",
          // Soft drop to lift hen off white without a box — very subtle
          filter: isTile ? undefined : "drop-shadow(0 1px 2px rgba(15,23,42,0.06))",
          // GPU layer for smooth scaling without flicker
          transform: "translateZ(0)",
          backfaceVisibility: "hidden" as const,
        }}
      />
    </div>
  );
}
