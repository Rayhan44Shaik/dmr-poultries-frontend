import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MapPin, ExternalLink, Loader2, Copy, Check } from "lucide-react";
import { useReverseGeocodedAddress } from "../hooks/useReverseGeocodedAddress";
import { useI18n } from "../../../../i18n";

/**
 * Resolves coordinates to a human-readable address.
 *
 * When `withTooltip` is true:
 *  - Hover/focus opens a fixed portal card with the COMPLETE address
 *  - Tooltip stays open while the pointer is over the card (so Maps is clickable)
 *  - "Open in Google Maps" is a real <a> link (pointer-events enabled)
 *  - Never shows bare "Location captured" when coords exist — reverse geocode
 *    always supplies a place name / region label
 */
export function GpsAddressText({
  lat,
  lon,
  fallback = "ops.trip.location_captured",
  className,
  withTooltip = false,
  maxLines = 0,
}: {
  lat?: number | string | null;
  lon?: number | string | null;
  fallback?: string;
  className?: string;
  withTooltip?: boolean;
  maxLines?: number;
}) {
  const { t } = useI18n();
  const tipId = useId();
  const anchorRef = useRef<HTMLSpanElement | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; place: "above" | "below" }>({
    top: 0,
    left: 0,
    place: "above",
  });

  const { status, address } = useReverseGeocodedAddress(lat, lon);

  const latNum = lat === undefined || lat === null || lat === "" ? null : Number(lat);
  const lonNum = lon === undefined || lon === null || lon === "" ? null : Number(lon);
  const hasCoords =
    latNum != null && lonNum != null && Number.isFinite(latNum) && Number.isFinite(lonNum);
  const coordLabel = hasCoords ? `${latNum!.toFixed(6)}, ${lonNum!.toFixed(6)}` : "";
  const mapsUrl = hasCoords
    ? `https://www.google.com/maps?q=${latNum},${lonNum}`
    : null;

  // Prefer real reverse-geocoded address. Never stick on generic "Location captured"
  // when we have coordinates — show coords as last resort.
  const fallbackText =
    fallback.startsWith("ops.") ? t(fallback) : fallback || t("ops.trip.location_captured");
  const coordFallback = hasCoords
    ? `GPS ${latNum!.toFixed(5)}°N, ${lonNum!.toFixed(5)}°E`
    : fallbackText;

  const displayText =
    status === "resolving"
      ? t("ops.trip.locating")
      : address && address.trim()
        ? address.trim()
        : status === "failed" || status === "resolved"
          ? coordFallback
          : fallbackText;

  const fullLocation = address && address.trim() ? address.trim() : displayText;

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
    const tipW = Math.min(380, Math.max(280, window.innerWidth * 0.72));
    const gap = 8;
    const spaceAbove = r.top;
    const place: "above" | "below" = spaceAbove > 200 ? "above" : "below";
    let left = r.left;
    left = Math.max(8, Math.min(left, window.innerWidth - tipW - 8));
    const top = place === "above" ? r.top - gap : r.bottom + gap;
    setPos({ top, left, place });
  }, []);

  const show = useCallback(() => {
    clearHide();
    placeTooltip();
    setOpen(true);
  }, [clearHide, placeTooltip]);

  const scheduleHide = useCallback(() => {
    clearHide();
    // Grace period so the pointer can travel from anchor → portal card
    hideTimer.current = setTimeout(() => setOpen(false), 220);
  }, [clearHide]);

  useEffect(() => {
    return () => clearHide();
  }, [clearHide]);

  useEffect(() => {
    if (!open) return;
    const onScrollOrResize = () => placeTooltip();
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [open, placeTooltip]);

  const copyAddress = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(fullLocation);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }, [fullLocation]);

  const lineClampStyle =
    maxLines > 0
      ? {
          display: "-webkit-box" as const,
          WebkitLineClamp: maxLines,
          WebkitBoxOrient: "vertical" as const,
          overflow: "hidden" as const,
        }
      : undefined;

  const inline = (
    <span
      ref={anchorRef}
      className={className}
      style={lineClampStyle}
      title={!withTooltip ? fullLocation : undefined}
      aria-describedby={withTooltip && open ? tipId : undefined}
      onMouseEnter={withTooltip ? show : undefined}
      onMouseLeave={withTooltip ? scheduleHide : undefined}
      onFocus={withTooltip ? show : undefined}
      onBlur={withTooltip ? scheduleHide : undefined}
    >
      {displayText}
    </span>
  );

  if (!withTooltip || !hasCoords) {
    return inline;
  }

  const tooltip =
    open && typeof document !== "undefined"
      ? createPortal(
          <div
            id={tipId}
            role="tooltip"
            // pointer-events ON so Maps / Copy are clickable
            className="fixed z-[9999] pointer-events-auto"
            style={{
              top: pos.place === "above" ? undefined : pos.top,
              bottom: pos.place === "above" ? Math.max(8, window.innerHeight - pos.top) : undefined,
              left: pos.left,
              width: "min(24rem, calc(100vw - 16px))",
            }}
            onMouseEnter={show}
            onMouseLeave={scheduleHide}
          >
            <div
              className={`rounded-xl border border-emerald-200/90 bg-white shadow-2xl shadow-slate-900/25 ring-1 ring-black/5 overflow-hidden ${
                pos.place === "above" ? "origin-bottom" : "origin-top"
              }`}
            >
              <div className="flex items-center gap-2.5 bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 px-3 py-2.5 border-b border-emerald-100">
                <span className="h-8 w-8 rounded-lg bg-emerald-100 text-emerald-700 border border-emerald-200 flex items-center justify-center shrink-0 shadow-sm">
                  {status === "resolving" ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <MapPin size={15} />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700/90">
                    {t("ops.trip.field.gps_address")}
                  </p>
                  <p className="text-[11px] font-semibold text-slate-600 tabular-nums tracking-tight">
                    {coordLabel}
                  </p>
                </div>
              </div>

              <div className="px-3.5 py-3 bg-white max-h-[min(44vh,18rem)] overflow-y-auto">
                {status === "resolving" ? (
                  <p className="text-xs text-slate-500 italic flex items-center gap-2">
                    <Loader2 size={12} className="animate-spin" />
                    {t("ops.trip.locating")}
                  </p>
                ) : (
                  <p className="text-[13px] sm:text-sm font-semibold text-slate-800 leading-relaxed break-words whitespace-pre-wrap">
                    {fullLocation}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border-t border-slate-100">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    void copyAddress();
                  }}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-600 hover:bg-slate-100"
                  title="Copy address"
                >
                  {copied ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} />}
                  {copied ? "Copied" : "Copy"}
                </button>

                {mapsUrl ? (
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-emerald-300 bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white shadow-sm hover:bg-emerald-700 active:bg-emerald-800"
                  >
                    {t("ops.trip.open_in_maps")}
                    <ExternalLink size={12} />
                  </a>
                ) : null}
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      {inline}
      {tooltip}
    </>
  );
}
