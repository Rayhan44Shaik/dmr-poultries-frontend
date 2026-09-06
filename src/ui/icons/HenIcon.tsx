// src/ui/icons/HenIcon.tsx
// Neat hen logo for Bird Types — uses the same transparent cut hen as BrandMark.
// Rendered as an <img> so the sidebar gets a true hen silhouette, not the generic Bird.
// Implements the LucideIcon signature (size, className, strokeWidth ignored) for nav compatibility.

import henCutUrl from "../../assets/dmr-hen-cut.png";

export type HenIconProps = {
  size?: number;
  className?: string;
  strokeWidth?: number;
};

export default function HenIcon({ size = 17, className = "" }: HenIconProps) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <img
        src={henCutUrl}
        width={size}
        height={size}
        alt=""
        draggable={false}
        loading="eager"
        decoding="async"
        className="h-full w-full object-contain object-center"
        style={{
          transform: "translateZ(0)",
          filter: "drop-shadow(0 0.5px 0.5px rgba(15,23,42,0.08))",
        }}
      />
    </span>
  );
}

// Also export as Lucide-compatible for NAV_SECTIONS typing
export const HenLucideIcon = HenIcon as unknown as import("lucide-react").LucideIcon;
