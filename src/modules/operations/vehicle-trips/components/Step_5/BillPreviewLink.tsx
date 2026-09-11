import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "../../../../../i18n";

/**
 * Compact "Uploaded" text link with a portal hover card that shows the full
 * bill preview (never clipped by table overflow / first-row edge).
 */
export function BillPreviewLink({
  href,
  fileName,
  className,
}: {
  href: string;
  fileName: string;
  className?: string;
}) {
  const { t } = useI18n();
  const tipId = useId();
  const anchorRef = useRef<HTMLAnchorElement | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; place: "above" | "below" }>({
    top: 0,
    left: 0,
    place: "below",
  });

  const clearHide = useCallback(() => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  }, []);

  const placeTooltip = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const tipW = Math.min(280, Math.max(220, window.innerWidth * 0.55));
    const gap = 10;
    // Prefer below so first rows aren't cut at the top of the table.
    const spaceBelow = window.innerHeight - r.bottom;
    const spaceAbove = r.top;
    const place: "above" | "below" =
      spaceBelow >= 220 || spaceBelow >= spaceAbove ? "below" : "above";
    // Prefer aligning toward the left of the anchor but keep fully on-screen.
    let left = r.left + r.width / 2 - tipW / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - tipW - 8));
    const top = place === "below" ? r.bottom + gap : r.top - gap;
    setPos({ top, left, place });
  }, []);

  const show = useCallback(() => {
    clearHide();
    placeTooltip();
    setOpen(true);
  }, [clearHide, placeTooltip]);

  const scheduleHide = useCallback(() => {
    clearHide();
    hideTimer.current = setTimeout(() => setOpen(false), 180);
  }, [clearHide]);

  useEffect(() => () => clearHide(), [clearHide]);

  useEffect(() => {
    if (!open) return;
    const onMove = () => placeTooltip();
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
  }, [open, placeTooltip]);

  const tip =
    open && typeof document !== "undefined"
      ? createPortal(
          <div
            id={tipId}
            role="tooltip"
            className="fixed z-[9999] pointer-events-auto"
            style={{
              top: pos.place === "below" ? pos.top : undefined,
              bottom: pos.place === "above" ? Math.max(8, window.innerHeight - pos.top) : undefined,
              left: pos.left,
              width: "min(17.5rem, calc(100vw - 16px))",
            }}
            onMouseEnter={show}
            onMouseLeave={scheduleHide}
          >
            <div className="rounded-xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/20 overflow-hidden ring-1 ring-black/5">
              <div className="bg-slate-50 px-3 py-2 border-b border-slate-100">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                  {t("ops.trip.bill_uploaded_row")}
                </p>
                <p className="text-[12px] font-semibold text-slate-800 break-all leading-snug mt-0.5">
                  {fileName}
                </p>
              </div>
              <div className="p-2.5 bg-white">
                <img
                  src={href}
                  alt={fileName}
                  className="w-full h-40 object-contain rounded-md border border-slate-100 bg-slate-50"
                />
              </div>
              <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-100 text-[10px] text-slate-500 font-medium text-center">
                {t("ops.trip.bill_open_full")}
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <a
        ref={anchorRef}
        href={href}
        target="_blank"
        rel="noreferrer"
        aria-describedby={open ? tipId : undefined}
        onMouseEnter={show}
        onMouseLeave={scheduleHide}
        onFocus={show}
        onBlur={scheduleHide}
        className={
          className ||
          "text-[11px] text-emerald-700 font-semibold underline decoration-emerald-300/70 hover:decoration-emerald-600 leading-tight whitespace-nowrap"
        }
      >
        {t("ops.trip.bill_uploaded_short")}
      </a>
      {tip}
    </>
  );
}
