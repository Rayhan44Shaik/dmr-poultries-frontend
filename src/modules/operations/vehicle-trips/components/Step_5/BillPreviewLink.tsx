import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ExternalLink, X, ZoomIn } from "lucide-react";
import { useI18n } from "../../../../../i18n";

/**
 * Compact "Uploaded" link for diesel fuel bills.
 * - Hover: small portal preview (never clipped by table overflow)
 * - Click: neat full-screen lightbox here (view only — no edit)
 * - Lightbox also has "Open in new tab" for a perfect full-size check
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
  const anchorRef = useRef<HTMLButtonElement | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hoverOpen, setHoverOpen] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
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
    const spaceBelow = window.innerHeight - r.bottom;
    const spaceAbove = r.top;
    const place: "above" | "below" =
      spaceBelow >= 220 || spaceBelow >= spaceAbove ? "below" : "above";
    let left = r.left + r.width / 2 - tipW / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - tipW - 8));
    const top = place === "below" ? r.bottom + gap : r.top - gap;
    setPos({ top, left, place });
  }, []);

  const showHover = useCallback(() => {
    if (lightboxOpen) return;
    clearHide();
    placeTooltip();
    setHoverOpen(true);
  }, [clearHide, placeTooltip, lightboxOpen]);

  const scheduleHide = useCallback(() => {
    clearHide();
    hideTimer.current = setTimeout(() => setHoverOpen(false), 180);
  }, [clearHide]);

  const openLightbox = useCallback(
    (e?: React.MouseEvent) => {
      e?.preventDefault();
      e?.stopPropagation();
      clearHide();
      setHoverOpen(false);
      setLightboxOpen(true);
    },
    [clearHide]
  );

  const closeLightbox = useCallback(() => setLightboxOpen(false), []);

  /** Open the bill image in a real browser tab (works for data: / blob: / http). */
  const openInNewTab = useCallback(
    (e?: React.MouseEvent) => {
      e?.preventDefault();
      e?.stopPropagation();
      if (!href) return;
      try {
        // Prefer a clean HTML page so the image is centered and sharp.
        const safeName = String(fileName || "fuel-bill").replace(/[<>&"']/g, "");
        const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${safeName}</title>
<style>
  html,body{margin:0;height:100%;background:#0f172a;display:flex;flex-direction:column;font-family:system-ui,sans-serif}
  header{flex:0 0 auto;padding:10px 16px;background:#1e293b;color:#e2e8f0;font-size:13px;font-weight:600;display:flex;justify-content:space-between;align-items:center;gap:12px}
  main{flex:1;display:flex;align-items:center;justify-content:center;padding:16px;overflow:auto}
  img{max-width:100%;max-height:calc(100vh - 64px);object-fit:contain;border-radius:8px;box-shadow:0 8px 32px rgba(0,0,0,.45);background:#fff}
</style></head><body>
<header><span>${safeName}</span><span style="opacity:.7;font-weight:500">Fuel bill</span></header>
<main><img src="${href.replace(/"/g, "&quot;")}" alt="${safeName}"/></main>
</body></html>`;
        const blob = new Blob([html], { type: "text/html" });
        const url = URL.createObjectURL(blob);
        const win = window.open(url, "_blank", "noopener,noreferrer");
        if (!win) {
          // Popup blocked — fall back to direct image open.
          window.open(href, "_blank", "noopener,noreferrer");
        } else {
          // Revoke after the tab has a chance to load.
          window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
        }
      } catch {
        window.open(href, "_blank", "noopener,noreferrer");
      }
    },
    [href, fileName]
  );

  useEffect(() => () => clearHide(), [clearHide]);

  useEffect(() => {
    if (!hoverOpen) return;
    const onMove = () => placeTooltip();
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
  }, [hoverOpen, placeTooltip]);

  useEffect(() => {
    if (!lightboxOpen) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") closeLightbox();
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [lightboxOpen, closeLightbox]);

  const hoverTip =
    hoverOpen && !lightboxOpen && typeof document !== "undefined"
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
            onMouseEnter={showHover}
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

  const lightbox =
    lightboxOpen && typeof document !== "undefined"
      ? createPortal(
          <div
            className="fixed inset-0 z-[10000] flex items-center justify-center p-3 sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-label={t("ops.trip.bill_uploaded_row")}
          >
            {/* Backdrop */}
            <button
              type="button"
              className="absolute inset-0 bg-slate-900/70 backdrop-blur-[2px]"
              aria-label={t("common.close")}
              onClick={closeLightbox}
            />
            {/* Panel */}
            <div className="relative z-10 w-full max-w-3xl max-h-[92vh] flex flex-col rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
              <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-100 bg-slate-50 shrink-0">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                    {t("ops.trip.bill_uploaded_row")}
                  </p>
                  <p className="text-sm font-semibold text-slate-800 truncate" title={fileName}>
                    {fileName || t("ops.trip.bill_uploaded_short")}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={openInNewTab}
                    className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold shadow-sm active:scale-[0.98]"
                    title={t("ops.trip.bill_open_new_tab")}
                  >
                    <ExternalLink size={14} strokeWidth={2.25} />
                    <span>{t("ops.trip.bill_open_new_tab")}</span>
                  </button>
                  <button
                    type="button"
                    onClick={closeLightbox}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600"
                    title={t("common.close")}
                    aria-label={t("common.close")}
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
              <div className="flex-1 min-h-0 overflow-auto bg-slate-100/80 p-3 sm:p-5 flex items-center justify-center">
                <img
                  src={href}
                  alt={fileName}
                  className="max-w-full max-h-[min(78vh,900px)] w-auto h-auto object-contain rounded-lg border border-slate-200 bg-white shadow-md"
                />
              </div>
              <div className="px-4 py-2.5 border-t border-slate-100 bg-white text-[11px] text-slate-500 font-medium flex items-center justify-between gap-2 shrink-0">
                <span className="inline-flex items-center gap-1">
                  <ZoomIn size={12} className="text-slate-400" />
                  {t("ops.trip.bill_view_hint")}
                </span>
                <button
                  type="button"
                  onClick={openInNewTab}
                  className="text-emerald-700 font-semibold hover:underline"
                >
                  {t("ops.trip.bill_open_new_tab")}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        aria-describedby={hoverOpen ? tipId : undefined}
        onMouseEnter={showHover}
        onMouseLeave={scheduleHide}
        onFocus={showHover}
        onBlur={scheduleHide}
        onClick={openLightbox}
        className={
          className ||
          "text-[11px] text-emerald-700 font-semibold underline decoration-emerald-300/70 hover:decoration-emerald-600 leading-tight whitespace-nowrap cursor-pointer bg-transparent border-0 p-0"
        }
        title={t("ops.trip.bill_open_full")}
      >
        {t("ops.trip.bill_uploaded_short")}
      </button>
      {hoverTip}
      {lightbox}
    </>
  );
}
