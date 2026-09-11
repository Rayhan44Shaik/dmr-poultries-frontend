import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ExternalLink, X, ZoomIn } from "lucide-react";
import { useI18n } from "../../../../../i18n";

/**
 * Compact "Uploaded" control for diesel fuel bills (view only).
 * - Hover: small preview card
 * - Click Uploaded / preview / "view bill": large in-page lightbox
 * - Lightbox: Open in new tab for full-size check
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
    const tipW = Math.min(300, Math.max(240, window.innerWidth * 0.55));
    const gap = 10;
    const spaceBelow = window.innerHeight - r.bottom;
    const spaceAbove = r.top;
    const place: "above" | "below" =
      spaceBelow >= 240 || spaceBelow >= spaceAbove ? "below" : "above";
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
    // Longer delay so user can move into the tip and click "view bill".
    hideTimer.current = setTimeout(() => setHoverOpen(false), 400);
  }, [clearHide]);

  const openLightbox = useCallback(
    (e?: React.SyntheticEvent) => {
      e?.preventDefault();
      e?.stopPropagation();
      clearHide();
      setHoverOpen(false);
      if (!href) return;
      setLightboxOpen(true);
    },
    [clearHide, href]
  );

  const closeLightbox = useCallback((e?: React.SyntheticEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    setLightboxOpen(false);
  }, []);

  /** Open bill image in a real browser tab (data: / blob: / http). */
  const openInNewTab = useCallback(
    (e?: React.SyntheticEvent) => {
      e?.preventDefault();
      e?.stopPropagation();
      if (!href) return;

      const safeName = String(fileName || "fuel-bill").replace(/[<>&"']/g, "");

      // Large data: URLs break if embedded in an HTML string — open image directly.
      const isHugeData = href.startsWith("data:") && href.length > 80_000;

      try {
        if (isHugeData || href.startsWith("blob:") || href.startsWith("http")) {
          const win = window.open(href, "_blank", "noopener,noreferrer");
          if (win) return;
        }

        // Build a neat viewer page; for moderate data: URLs put src on the img.
        const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${safeName}</title>
<style>
html,body{margin:0;height:100%;background:#0f172a;display:flex;flex-direction:column;font-family:system-ui,sans-serif}
header{flex:0 0 auto;padding:10px 16px;background:#1e293b;color:#e2e8f0;font-size:13px;font-weight:600}
main{flex:1;display:flex;align-items:center;justify-content:center;padding:16px;overflow:auto}
img{max-width:100%;max-height:calc(100vh - 64px);object-fit:contain;border-radius:8px;box-shadow:0 8px 32px rgba(0,0,0,.45);background:#fff}
</style></head><body>
<header>${safeName}</header>
<main><img id="bill" alt="${safeName}"/></main>
<script>
(function(){
  var img=document.getElementById("bill");
  var src=${JSON.stringify(href)};
  img.src=src;
})();
</script>
</body></html>`;
        const blob = new Blob([html], { type: "text/html;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const win = window.open(url, "_blank", "noopener,noreferrer");
        if (!win) {
          // Popup blocked — still try direct image.
          window.open(href, "_blank", "noopener,noreferrer");
        } else {
          window.setTimeout(() => URL.revokeObjectURL(url), 120_000);
        }
      } catch {
        try {
          window.open(href, "_blank", "noopener,noreferrer");
        } catch {
          /* ignore */
        }
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
      if (ev.key === "Escape") setLightboxOpen(false);
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [lightboxOpen]);

  const tipW = "min(18.75rem, calc(100vw - 16px))";

  const hoverTip =
    hoverOpen && !lightboxOpen && typeof document !== "undefined"
      ? createPortal(
          <div
            id={tipId}
            role="dialog"
            className="fixed z-[99999] pointer-events-auto"
            style={{
              top: pos.place === "below" ? pos.top : undefined,
              bottom: pos.place === "above" ? Math.max(8, window.innerHeight - pos.top) : undefined,
              left: pos.left,
              width: tipW,
            }}
            onMouseEnter={showHover}
            onMouseLeave={scheduleHide}
          >
            <div className="rounded-xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/25 overflow-hidden ring-1 ring-black/5">
              <div className="bg-slate-50 px-3 py-2 border-b border-slate-100">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                  {t("ops.trip.bill_uploaded_row")}
                </p>
                <p className="text-[12px] font-semibold text-slate-800 break-all leading-snug mt-0.5">
                  {fileName}
                </p>
              </div>
              {/* Whole image area opens lightbox */}
              <button
                type="button"
                className="block w-full p-2.5 bg-white text-left cursor-zoom-in border-0"
                onClick={openLightbox}
                onMouseDown={(e) => e.preventDefault()}
                title={t("ops.trip.bill_open_full")}
              >
                <img
                  src={href}
                  alt={fileName}
                  className="w-full h-44 object-contain rounded-md border border-slate-100 bg-slate-50 pointer-events-none"
                  draggable={false}
                />
              </button>
              <div className="px-2.5 py-2 bg-slate-50 border-t border-slate-100 flex items-center gap-2">
                <button
                  type="button"
                  onClick={openLightbox}
                  onMouseDown={(e) => e.preventDefault()}
                  className="flex-1 h-8 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-[11px] font-bold shadow-sm"
                >
                  {t("ops.trip.bill_open_full")}
                </button>
                <button
                  type="button"
                  onClick={openInNewTab}
                  onMouseDown={(e) => e.preventDefault()}
                  className="h-8 px-2.5 rounded-lg border border-emerald-100 bg-white hover:bg-emerald-50/70 text-emerald-500 text-[11px] font-bold inline-flex items-center gap-1"
                  title={t("ops.trip.bill_open_new_tab")}
                >
                  <ExternalLink size={12} />
                  <span className="hidden sm:inline">{t("ops.trip.bill_open_new_tab")}</span>
                </button>
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
            className="fixed inset-0 z-[100000] flex items-center justify-center p-3 sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-label={t("ops.trip.bill_uploaded_row")}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="absolute inset-0 bg-slate-900/75 backdrop-blur-[2px]"
              onClick={closeLightbox}
              aria-hidden
            />
            <div
              className="relative z-10 w-full max-w-3xl max-h-[92vh] flex flex-col rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
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
                    className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-emerald-100 bg-emerald-50/70 hover:bg-emerald-50/80 text-emerald-500 text-xs font-bold shadow-sm"
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
                {href ? (
                  <img
                    src={href}
                    alt={fileName}
                    className="max-w-full max-h-[min(78vh,900px)] w-auto h-auto object-contain rounded-lg border border-slate-200 bg-white shadow-md"
                  />
                ) : (
                  <p className="text-sm text-slate-500">{t("ops.trip.bill_image_required")}</p>
                )}
              </div>
              <div className="px-4 py-2.5 border-t border-slate-100 bg-white text-[11px] text-slate-500 font-medium flex items-center justify-between gap-2 shrink-0">
                <span className="inline-flex items-center gap-1">
                  <ZoomIn size={12} className="text-slate-400" />
                  {t("ops.trip.bill_view_hint")}
                </span>
                <button
                  type="button"
                  onClick={openInNewTab}
                  className="text-emerald-500 font-semibold hover:underline"
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
        // Do NOT hide on blur — that killed clicks on the hover tip before.
        onClick={openLightbox}
        onPointerDown={(e) => e.stopPropagation()}
        className={
          className ||
          "inline-flex items-center gap-0.5 text-[11px] text-emerald-500 font-semibold underline decoration-emerald-300/70 hover:decoration-emerald-600 leading-tight whitespace-nowrap cursor-pointer bg-transparent border-0 p-0.5 rounded hover:bg-emerald-50/70"
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
