import { MapPin, Loader2 } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useReverseGeocodedAddress } from "../hooks/useReverseGeocodedAddress";
import { useI18n } from "../../../../i18n";

/**
 * Compact GPS address with a portal hover tip (same pattern as BillPreviewLink)
 * so the tip is never clipped by the diesel table's overflow-x-auto.
 */
export function GpsAddressText({
  lat,
  lon,
  fallback = "ops.trip.location_captured",
  className,
  maxLines = 0,
}: {
  lat?: number | string | null;
  lon?: number | string | null;
  fallback?: string;
  className?: string;
  maxLines?: number;
}) {
  const { t } = useI18n();
  const tipId = useId();
  const anchorRef = useRef<HTMLSpanElement | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hoverOpen, setHoverOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; place: "above" | "below" }>({
    top: 0,
    left: 0,
    place: "below",
  });

  const { status, address } = useReverseGeocodedAddress(lat, lon);
  const latNum = lat === undefined || lat === null || lat === "" ? null : Number(lat);
  const lonNum = lon === undefined || lon === null || lon === "" ? null : Number(lon);
  const hasCoords =
    latNum != null && lonNum != null && Number.isFinite(latNum) && Number.isFinite(lonNum);
  const fallbackText = fallback.startsWith("ops.")
    ? t(fallback)
    : fallback || t("ops.trip.location_captured");
  const coordFallback = hasCoords
    ? `GPS ${latNum!.toFixed(5)}°N, ${lonNum!.toFixed(5)}°E`
    : fallbackText;
  const displayText =
    status === "resolving"
      ? t("ops.trip.locating")
      : address?.trim() ||
        (status === "failed" || status === "resolved" ? coordFallback : fallbackText);
  const clampClass = maxLines === 1 ? "line-clamp-1" : maxLines === 2 ? "line-clamp-2" : "";

  const fullTitle = hasCoords
    ? `${displayText}\nLat: ${latNum!.toFixed(6)}°N\nLon: ${lonNum!.toFixed(6)}°E`
    : displayText;

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
    const tipW = Math.min(320, Math.max(220, window.innerWidth * 0.5));
    const gap = 10;
    const spaceBelow = window.innerHeight - r.bottom;
    const spaceAbove = r.top;
    const place: "above" | "below" =
      spaceBelow >= 120 || spaceBelow >= spaceAbove ? "below" : "above";
    let left = r.left + r.width / 2 - tipW / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - tipW - 8));
    const top = place === "below" ? r.bottom + gap : r.top - gap;
    setPos({ top, left, place });
  }, []);

  const showHover = useCallback(() => {
    clearHide();
    placeTooltip();
    setHoverOpen(true);
  }, [clearHide, placeTooltip]);

  const scheduleHide = useCallback(() => {
    clearHide();
    hideTimer.current = setTimeout(() => setHoverOpen(false), 280);
  }, [clearHide]);

  useEffect(() => () => clearHide(), [clearHide]);

  useEffect(() => {
    if (!hoverOpen) return;
    const onScroll = () => placeTooltip();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [hoverOpen, placeTooltip]);

  return (
    <>
      <span
        ref={anchorRef}
        className={`inline-flex min-w-0 items-start gap-1.5 cursor-default ${className ?? ""}`}
        aria-describedby={hoverOpen ? tipId : undefined}
        onMouseEnter={showHover}
        onMouseLeave={scheduleHide}
        onFocus={showHover}
        onBlur={scheduleHide}
      >
        {status === "resolving" ? (
          <Loader2 size={13} className="mt-0.5 shrink-0 animate-spin" />
        ) : (
          <MapPin size={13} className="mt-0.5 shrink-0" />
        )}
        <span className={`min-w-0 ${clampClass}`}>{displayText}</span>
      </span>
      {hoverOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            id={tipId}
            role="tooltip"
            className="fixed z-[99999] pointer-events-none"
            style={{
              top: pos.place === "below" ? pos.top : undefined,
              bottom: pos.place === "above" ? window.innerHeight - pos.top : undefined,
              left: pos.left,
              width: Math.min(320, Math.max(220, window.innerWidth * 0.5)),
            }}
            onMouseEnter={showHover}
            onMouseLeave={scheduleHide}
          >
            <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-xl shadow-slate-200/80 text-left">
              <p className="text-[12px] font-semibold text-slate-800 leading-snug whitespace-pre-line">
                {fullTitle}
              </p>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
