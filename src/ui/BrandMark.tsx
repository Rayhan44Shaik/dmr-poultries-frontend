// src/ui/BrandMark.tsx
// DMR Poultries brand mark: a soft circular tile in the brand green with a
// simple bird glyph from the app's existing icon set (lucide-react), so it
// shares the same stroke family as every sidebar icon.
import { Bird } from "lucide-react";

export type BrandMarkSize = "xs" | "sm" | "md" | "lg" | "xl";

export interface BrandMarkProps {
  size?: BrandMarkSize;
  /** Accessible name. Omit when a text logo sits next to it (decorative). */
  label?: string;
  className?: string;
}

const SIZES: Record<BrandMarkSize, { box: string; icon: number }> = {
  xs: { box: "h-6 w-6", icon: 13 },
  sm: { box: "h-8 w-8", icon: 16 },
  md: { box: "h-9 w-9", icon: 19 },
  lg: { box: "h-11 w-11", icon: 22 },
  xl: { box: "h-14 w-14", icon: 28 },
};

export default function BrandMark({ size = "md", label, className = "" }: BrandMarkProps) {
  const s = SIZES[size];
  const decorative = !label;

  return (
    <div
      className={[
        "relative flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full",
        "bg-gradient-to-br from-brand-500 to-brand-700",
        "ring-1 ring-inset ring-white/15 shadow-sm",
        s.box,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : label}
      aria-hidden={decorative || undefined}
    >
      <Bird size={s.icon} strokeWidth={2} className="text-white" />
    </div>
  );
}
