// src/ui/BrandMark.tsx
// Use a pre-cut transparent asset from the first render. Rendering the source
// JPG and removing its background in an effect causes a black-box flash.

import henUrl from "../assets/dmr-hen-transparent.png";

export type BrandMarkSize = "xs" | "sm" | "md" | "lg" | "xl";
export type BrandMarkInset = "tight" | "normal" | "roomy";

export interface BrandMarkProps {
  size?: BrandMarkSize;
  inset?: BrandMarkInset;
  label?: string;
  className?: string;
}

const SIZES: Record<BrandMarkSize, { box: string; px: number }> = {
  xs: { box: "h-6 w-6", px: 24 },
  sm: { box: "h-8 w-8", px: 32 },
  md: { box: "h-9 w-9", px: 36 },
  lg: { box: "h-11 w-11", px: 44 },
  xl: { box: "h-14 w-14", px: 56 },
};

const INSETS: Record<BrandMarkInset, number> = {
  tight: 0.04,
  normal: 0.08,
  roomy: 0.12,
};

export default function BrandMark({
  size = "md",
  inset = "normal",
  label,
  className = "",
}: BrandMarkProps) {
  const s = SIZES[size];
  const decorative = !label;
  const pad = Math.max(1, Math.round(s.px * INSETS[inset]));

  return (
    <div
      className={[
        "relative shrink-0 select-none",
        "flex items-center justify-center",
        s.box,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ padding: pad }}
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
        className="h-full w-full object-contain object-center"
      />
    </div>
  );
}
