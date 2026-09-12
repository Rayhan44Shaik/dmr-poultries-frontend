import { cn } from "../utils/cn";

type ActionTooltipProps = {
  label: string;
  placement?: "top" | "bottom";
  side?: "top" | "bottom";
  className?: string;
};

const placementClass = {
  top: "bottom-full left-1/2 mb-2 -translate-x-1/2 group-hover:-translate-y-0.5",
  bottom: "top-full left-1/2 mt-2 -translate-x-1/2 group-hover:translate-y-0.5",
};

/**
 * Reusable polished tooltip for icon/action buttons.
 * Place inside a `relative group` button/link/container.
 */
export function ActionTooltip({ label, placement = "top", side, className }: ActionTooltipProps) {
  const resolvedPlacement = side ?? placement;
  return (
    <span
      role="tooltip"
      className={cn(
        "pointer-events-none absolute z-[90] max-w-[240px] whitespace-nowrap rounded-xl bg-slate-900/95 px-2.5 py-1.5 text-[11px] font-semibold leading-none text-white shadow-xl shadow-slate-900/20 opacity-0 scale-95 transition-all duration-150 group-hover:opacity-100 group-hover:scale-100 group-focus-visible:opacity-100 group-focus-visible:scale-100",
        placementClass[resolvedPlacement],
        className,
      )}
    >
      {label}
      <span
        className={cn(
          "absolute left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 bg-slate-900/95",
          resolvedPlacement === "top" ? "-bottom-1" : "-top-1",
        )}
        aria-hidden="true"
      />
    </span>
  );
}

export default ActionTooltip;
