import type { ReactNode } from "react";
import { cn } from "../utils/cn";

type ActionTooltipProps = {
  /** Text, or a small layout of lines — the tooltip is content-sized either way. */
  label: ReactNode;
  placement?: "top" | "bottom";
  side?: "top" | "bottom";
  className?: string;
};

const placementClass = {
  top: "bottom-full left-1/2 mb-2.5 -translate-x-1/2",
  bottom: "top-full left-1/2 mt-2.5 -translate-x-1/2",
};

/**
 * Global polished tooltip - very neat perfect way, supports Telugu as well
 * - rounded-2xl with backdrop-blur
 * - soft shadow, border, animation
 * - whitespace-normal, break-words, leading-relaxed for Telugu script
 * - arrow with same bg
 * Place inside a `relative group` button/link/container.
 */
export function ActionTooltip({ label, placement = "top", side, className }: ActionTooltipProps) {
  const resolvedPlacement = side ?? placement;
  const isTop = resolvedPlacement === "top";
  return (
    <span
      role="tooltip"
      className={cn(
        // base - neat perfect global
        "pointer-events-none absolute z-[90] max-w-[320px] min-w-[72px]",
        "rounded-2xl border border-white/10 bg-slate-900/95 backdrop-blur-xl",
        "px-3.5 py-2.5 text-center text-[12px] font-semibold leading-[1.6] tracking-wide text-white",
        "shadow-[0_8px_32px_rgba(0,0,0,0.24),0_2px_8px_rgba(0,0,0,0.12)] ring-1 ring-white/5",
        "whitespace-normal break-words text-pretty",
        // animation - like trip list refresh hen dance smoothness
        "invisible opacity-0 scale-[0.92] transition-[opacity,transform,visibility] duration-150 ease-out",
        "group-hover:visible group-hover:opacity-100 group-hover:scale-100",
        "group-focus-visible:visible group-focus-visible:opacity-100 group-focus-visible:scale-100",
        // origin for scale
        isTop ? "origin-bottom" : "origin-top",
        placementClass[resolvedPlacement],
        className,
      )}
      style={{
        // font smoothing for Telugu
        fontFeatureSettings: '"liga" 1, "calt" 1',
        textRendering: "optimizeLegibility",
        WebkitFontSmoothing: "antialiased",
      }}
    >
      <span className="block">{label}</span>
      {/* arrow - neat diamond */}
      <span
        className={cn(
          "absolute left-1/2 h-2.5 w-2.5 -translate-x-1/2 rotate-45 bg-slate-900/95 border-r border-b border-white/10 backdrop-blur-xl",
          isTop ? "-bottom-[5px]" : "-top-[5px] border-r-0 border-b-0 border-l border-t",
        )}
        aria-hidden="true"
      />
      {/* subtle inner highlight for neatness */}
      <span className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-b from-white/[0.08] to-transparent" aria-hidden="true" />
    </span>
  );
}

export default ActionTooltip;
