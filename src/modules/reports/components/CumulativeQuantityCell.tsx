import React, { useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { Package, Scale } from "lucide-react";
import {
  cumulativeLoadLines,
  hasCumulativeLoadBreakdown,
  type CumulativeQuantityMetric,
} from "../utils/cumulativeLoadBreakdown";
import type { ShopLedgerCumulativeRow } from "./ShopLedgerPDF";

export interface CumulativeLoadTip {
  key: string;
  rect: DOMRect;
  row: ShopLedgerCumulativeRow;
  metric: CumulativeQuantityMetric;
  /** Table scope the anchor rect was measured in — a stale tip never renders. */
  scope: string;
}

interface CellProps {
  row: ShopLedgerCumulativeRow;
  metric: CumulativeQuantityMetric;
  /** Already-formatted plain value (locale string or fixed decimals). */
  display: string;
  /** Column label for the tooltip heading (translated). */
  label: string;
  tipKey: string;
  openTip: CumulativeLoadTip | null;
  /** The parent stamps the current table scope — the cell only measures the anchor. */
  onOpen: (tip: Omit<CumulativeLoadTip, "scope">) => void;
  onClose: () => void;
  cellClassName?: string;
  buttonClassName?: string;
  title?: string;
}

/**
 * One cumulative quantity cell with a Trip-List-style per-load breakdown:
 * a plain value for single-load shops, a dotted-underline button that opens
 * a floating per-load card once the shop has more than one load. Only one
 * tooltip is ever open — the parent owns the single `openTip` state.
 */
export function CumulativeQuantityCell({
  row,
  metric,
  display,
  label,
  tipKey,
  openTip,
  onOpen,
  onClose,
  cellClassName = "",
  buttonClassName = "",
  title,
}: CellProps): React.ReactElement {
  const showBreakdown = hasCumulativeLoadBreakdown(row, metric);
  const isOpen = openTip?.key === tipKey;
  const open = (element: HTMLElement) => {
    onOpen({ key: tipKey, rect: element.getBoundingClientRect(), row, metric });
  };
  const buttonRef = React.useRef<HTMLButtonElement | null>(null);

  if (!showBreakdown) {
    return (
      <td className={cellClassName} title={title}>
        <span className="tabular-nums">{display}</span>
      </td>
    );
  }

  return (
    <td className={cellClassName} title={title}>
      <span
        className="inline-flex items-center justify-end"
        onMouseLeave={() => {
          if (isOpen) onClose();
        }}
      >
        <button
          ref={buttonRef}
          type="button"
          data-cum-tip={tipKey}
          aria-label={`${row.shop} ${label} by load`}
          aria-expanded={isOpen}
          onMouseEnter={(event) => open(event.currentTarget)}
          onFocus={(event) => open(event.currentTarget)}
          onBlur={() => {
            if (isOpen) onClose();
          }}
          onClick={(event) => {
            // Touch support: tap toggles. Mouse users open on hover, so a
            // click while already open dismisses instead of re-opening.
            if (isOpen) {
              onClose();
            } else {
              open(event.currentTarget);
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              onClose();
              event.currentTarget.blur();
            }
          }}
          className={`rounded border-b border-dotted border-current px-0.5 font-semibold tabular-nums focus:outline-none focus:ring-2 focus:ring-indigo-300 ${buttonClassName}`}
        >
          {display}
        </button>
      </span>
    </td>
  );
}

const DEFAULT_POPOVER_WIDTH = 240;
const MORTALITY_POPOVER_WIDTH = 440;

interface PopoverProps {
  tip: CumulativeLoadTip;
  /** Translated heading, e.g. "D.BIRDS by load". */
  subtitle: string;
  /** Translated per-load prefix, e.g. "Load" / "లోడ్". */
  loadWord: string;
  totalLabel: string;
  totalDisplay: string;
  formatValue: (value: number) => string;
  onClose: () => void;
}

/**
 * The single floating per-load card, rendered through a portal so table
 * overflow and surrounding containers can never clip it. Position is clamped
 * to the viewport; content renders only while a tooltip is open.
 */
export function CumulativeLoadPopover({
  tip,
  subtitle,
  loadWord,
  totalLabel,
  totalDisplay,
  formatValue,
  onClose,
}: PopoverProps): React.ReactElement | null {
  const lines = useMemo(
    () => cumulativeLoadLines(tip.row, tip.metric),
    [tip.row, tip.metric],
  );
  const isMortalityBirds = tip.metric === "mortalityBirds";
  const popoverWidth = isMortalityBirds
    ? MORTALITY_POPOVER_WIDTH
    : DEFAULT_POPOVER_WIDTH;

  const position = useMemo(() => {
    if (typeof window === "undefined") return { left: 12, top: 12 };
    const estimatedHeight = Math.min(420, 118 + lines.length * (isMortalityBirds ? 36 : 44));
    const top =
      tip.rect.bottom + estimatedHeight + 12 <= window.innerHeight
        ? tip.rect.bottom + 8
        : Math.max(12, tip.rect.top - estimatedHeight - 8);
    const left = Math.min(
      Math.max(window.innerWidth - popoverWidth, 0) > 0
        ? window.innerWidth - popoverWidth - 12
        : 12,
      Math.max(12, tip.rect.left + tip.rect.width / 2 - popoverWidth / 2),
    );
    return { left, top: Math.max(8, top) };
  }, [tip.rect, lines.length, isMortalityBirds, popoverWidth]);

  // Dismiss on Escape, any outside interaction, scroll or resize — the anchor
  // rect would go stale otherwise. Button taps are ignored here (they toggle).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const onPointer = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest("[data-cum-tip]")) return;
      onClose();
    };
    const onScroll = () => onClose();
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [onClose]);

  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      role="tooltip"
      style={{
        position: "fixed",
        left: position.left,
        top: position.top,
        width: popoverWidth,
        maxWidth: "calc(100vw - 24px)",
      }}
      className="pointer-events-none z-[10000] overflow-hidden rounded-xl border border-slate-200 bg-white text-left shadow-2xl shadow-slate-900/20"
    >
      <div className="border-b border-slate-200 bg-slate-50 px-3.5 py-2.5">
        <p className="truncate text-xs font-extrabold text-slate-900">{tip.row.shop}</p>
        <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-600">
          {subtitle}
        </p>
      </div>
      <div className="space-y-1 p-2.5">
        {lines.map((line) => {
          const mortality = isMortalityBirds
            ? tip.row.mortalityByLoad?.find((load) => load.load === line.load)
            : undefined;
          return (
            <div
              key={line.load}
              className="flex min-w-0 items-center justify-between gap-3 rounded-md px-2 py-1.5 odd:bg-slate-50"
            >
              <span className="shrink-0 text-[11px] font-bold text-indigo-700">
                {loadWord} {line.load}
              </span>
              {mortality ? (
                <span className="flex min-w-0 items-center justify-end gap-3 whitespace-nowrap text-[10px] font-semibold tabular-nums">
                  <span className="text-[11px] font-extrabold text-slate-900">
                    {formatValue(line.value)}
                  </span>
                  <span className="inline-flex items-center gap-1 text-slate-500">
                    <Package size={12} className="text-amber-600" aria-hidden="true" />
                    Box {Math.round(mortality.boxBirds || 0)} birds · {Number(mortality.boxWeight || 0).toFixed(2)} kg
                  </span>
                  <span className="inline-flex items-center gap-1 text-slate-500">
                    <Scale size={12} className="text-violet-600" aria-hidden="true" />
                    Wt {Math.round(mortality.weightModeBirds || 0)} birds
                  </span>
                </span>
              ) : (
                <span className="text-right">
                  <span className="block text-[11px] font-extrabold text-slate-900 tabular-nums">
                    {formatValue(line.value)}
                  </span>
                  {line.sub ? (
                    <span className="block text-[10px] font-semibold text-slate-400 tabular-nums">
                      {line.sub}
                    </span>
                  ) : null}
                </span>
              )}
            </div>
          );
        })}
      </div>
      <div className="border-t border-slate-200 bg-indigo-50/70 px-3.5 py-2">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700">
            {totalLabel}
          </span>
          <span className="text-xs font-extrabold text-slate-900 tabular-nums">{totalDisplay}</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
