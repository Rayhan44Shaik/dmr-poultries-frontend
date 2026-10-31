/** Parse "lat,lon" (and common GPS label variants) stored in bunk_address. */
export function parseCoordPair(value?: string | null): { lat: number; lon: number } | null {
  if (value == null) return null;
  const text = String(value).trim();
  if (!text) return null;
  const patterns = [
    /^(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)$/,
    /^(-?\d+(?:\.\d+)?)°?\s*[NnSs]?\s*[, ]\s*(-?\d+(?:\.\d+)?)°?\s*[EeWw]?$/,
    /^GPS\s+(-?\d+(?:\.\d+)?)°?\s*[Nn]?,?\s*(-?\d+(?:\.\d+)?)°?\s*[Ee]?$/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;
    const lat = Number(match[1]);
    const lon = Number(match[2]);
    if (!isValidGps(lat, lon)) continue;
    return { lat, lon };
  }
  return null;
}

export function isValidGps(lat?: number | null, lon?: number | null): boolean {
  const latitude = Number(lat);
  const longitude = Number(lon);
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180 &&
    !(latitude === 0 && longitude === 0)
  );
}

export function isCoordOnlyAddress(value?: string | null): boolean {
  return parseCoordPair(value) != null;
}

export function resolveFuelGps(
  lat?: number | null,
  lon?: number | null,
  address?: string | null,
): { lat: number | null; lon: number | null; placeName: string } {
  const parsed = parseCoordPair(address);
  const resolvedLat = isValidGps(lat, lon) ? Number(lat) : parsed?.lat ?? null;
  const resolvedLon = isValidGps(lat, lon) ? Number(lon) : parsed?.lon ?? null;
  const placeName = address && !isCoordOnlyAddress(address) ? String(address).trim() : "";
  return { lat: resolvedLat, lon: resolvedLon, placeName };
}

export function googleMapsUrl(lat: number, lon: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${lat.toFixed(6)},${lon.toFixed(6)}`,
  )}`;
}
