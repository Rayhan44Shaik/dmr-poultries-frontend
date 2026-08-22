import { useReverseGeocodedAddress } from "../hooks/useReverseGeocodedAddress";
import { useI18n } from "../../../../i18n";

/** Resolves coordinates to a human-readable address (Nominatim). Shows
 * "Locating..." while resolving and falls back to a neutral label if the
 * lookup fails — coordinates are never fabricated. */
export function GpsAddressText({
  lat,
  lon,
  fallback = "ops.trip.location_captured",
  className,
}: {
  lat?: number | string | null;
  lon?: number | string | null;
  fallback?: string;
  className?: string;
}) {
  const { t } = useI18n();
  const { status, address } = useReverseGeocodedAddress(lat, lon);
  const fallbackText = t(fallback);
  if (status === "resolving") {
    return <span className={className}>{t("ops.trip.locating")}</span>;
  }
  if (status === "failed") {
    return <span className={className}>{fallbackText}</span>;
  }
  return <span className={className}>{address || fallbackText}</span>;
}