import { MapPin, Loader2 } from "lucide-react";
import { useReverseGeocodedAddress } from "../hooks/useReverseGeocodedAddress";
import { useI18n } from "../../../../i18n";

/** Compact, non-interactive GPS address display for Trip Entry and Trip List views. */
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
  const { status, address } = useReverseGeocodedAddress(lat, lon);
  const latNum = lat === undefined || lat === null || lat === "" ? null : Number(lat);
  const lonNum = lon === undefined || lon === null || lon === "" ? null : Number(lon);
  const hasCoords = latNum != null && lonNum != null && Number.isFinite(latNum) && Number.isFinite(lonNum);
  const fallbackText = fallback.startsWith("ops.") ? t(fallback) : fallback || t("ops.trip.location_captured");
  const coordFallback = hasCoords ? `GPS ${latNum!.toFixed(5)}°N, ${lonNum!.toFixed(5)}°E` : fallbackText;
  const displayText = status === "resolving"
    ? t("ops.trip.locating")
    : address?.trim() || (status === "failed" || status === "resolved" ? coordFallback : fallbackText);
  const clampClass = maxLines === 1 ? "line-clamp-1" : maxLines === 2 ? "line-clamp-2" : "";

  return (
    <span className={`inline-flex min-w-0 items-start gap-1.5 ${className ?? ""}`}>
      {status === "resolving" ? <Loader2 size={13} className="mt-0.5 shrink-0 animate-spin" /> : <MapPin size={13} className="mt-0.5 shrink-0" />}
      <span className={`min-w-0 ${clampClass}`}>{displayText}</span>
    </span>
  );
}
