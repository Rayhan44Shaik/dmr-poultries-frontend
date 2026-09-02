// src/ui/BrandMark.tsx
//
// ─── ASSET SWITCH ──────────────────────────────────────────────────────────
// RIGHT NOW: uses the black-background JPG you already have. The black is
// cancelled at render time with `mix-blend-mode: screen` over the dark tile,
// so nothing looks like a black box and the build resolves with zero new files.
import henUrl from "../assets/dmr-hen.jpg";
const HEN_HAS_ALPHA: boolean = false;

// AFTER you run scripts/remove-black-bg.(mjs|py), delete the two lines above
// and uncomment these two. Nothing else in the file changes.
// import henUrl from "../assets/dmr-hen.png";
// const HEN_HAS_ALPHA: boolean = true;
// ───────────────────────────────────────────────────────────────────────────

export type BrandMarkSize = "xs" | "sm" | "md" | "lg" | "xl";
export type BrandMarkVariant = "tile" | "plain";
/** Breathing room between the hen and the tile edge. */
export type BrandMarkInset = "tight" | "normal" | "roomy";

export interface BrandMarkProps {
  size?: BrandMarkSize;
  variant?: BrandMarkVariant;
  inset?: BrandMarkInset;
  /** Accessible name. Omit when a text logo sits next to it (decorative). */
  label?: string;
  className?: string;
}

const SIZES: Record<BrandMarkSize, { box: string; px: number }> = {
  xs: { box: "h-6 w-6   rounded-md",     px: 24 },
  sm: { box: "h-8 w-8   rounded-lg",     px: 32 },
  md: { box: "h-9 w-9   rounded-[10px]", px: 36 },
  lg: { box: "h-11 w-11 rounded-xl",     px: 44 },
  xl: { box: "h-14 w-14 rounded-2xl",    px: 56 },
};

// Fraction of the tile reserved as padding on each side. 0.09 keeps the comb
// and tail clear of the rounded corners at every size.
const INSETS: Record<BrandMarkInset, number> = {
  tight: 0.045,
  normal: 0.09,
  roomy: 0.14,
};

const TILE =
  "bg-gradient-to-br from-[#1B3A3A] to-[#0E2222] " +
  "ring-1 ring-inset ring-white/10 shadow-sm";

export default function BrandMark({
  size = "md",
  variant = "tile",
  inset = "normal",
  label,
  className = "",
}: BrandMarkProps) {
  const s = SIZES[size];
  const decorative = !label;

  // A non-alpha asset can only be shown on the tile (that's what kills the black).
  const blend = !HEN_HAS_ALPHA;
  const isTile = (blend ? "tile" : variant) === "tile";

  // Padding applies in blend mode too — black JPG margin screens to the exact
  // tile colour, so there is no visible seam, just breathing room.
  const pad = isTile ? Math.max(1, Math.round(s.px * INSETS[inset])) : 0;

  return (
    <div
      className={[
        "relative shrink-0 select-none overflow-hidden isolate",
        "flex items-center justify-center",
        s.box,
        isTile ? TILE : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ padding: pad || undefined }}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : label}
      aria-hidden={decorative || undefined}
    >
      <img
        src={henUrl}
        width={s.px - pad * 2}
        height={s.px - pad * 2}
        alt=""
        aria-hidden="true"
        draggable={false}
        loading="eager"
        decoding="async"
        className={[
          "h-full w-full object-contain",
          blend ? "mix-blend-screen" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      />
    </div>
  );
}