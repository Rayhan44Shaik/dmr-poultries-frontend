/**
 * Quiet GPS capture for Trip Entry (farm + diesel).
 *
 * Production-honest contract (Gate 0 — no silent fallback data):
 *   · device fix            → resolves with the real coordinates
 *   · caller-supplied point → resolves with that real point (fromDevice: false)
 *   · nothing available     → resolves with `null`
 *
 * The caller decides what to do with `null` (surface an actionable message,
 * keep validation errors). Coordinates are NEVER invented here: fabricated
 * business values must never reach the database.
 */

export type CapturedGps = {
  latitude: number;
  longitude: number;
  accuracy: number;
  capturedAt: string;
  /** true when browser coords were used; false when a caller-supplied point was used */
  fromDevice: boolean;
};

const DEFAULT_ACCURACY = 50;

function isValidCoords(lat: number, lon: number): boolean {
  return (
    Number.isFinite(lat) && Number.isFinite(lon) &&
    lat >= -90 && lat <= 90 &&
    lon >= -180 && lon <= 180 &&
    !(lat === 0 && lon === 0)
  );
}

/**
 * Resolve current coordinates without throwing. Resolves `null` when the
 * device cannot supply a fix and no caller-supplied point is available —
 * callers must treat that as an actionable failure, never as "GPS captured".
 */
export function captureGpsQuiet(options?: {
  /** A real, already-known point (e.g. a previous capture) to fall back to. */
  preferLat?: number | null;
  preferLon?: number | null;
  timeoutMs?: number;
}): Promise<CapturedGps | null> {
  const timeoutMs = options?.timeoutMs ?? 8000;
  const preferLat = options?.preferLat != null ? Number(options.preferLat) : NaN;
  const preferLon = options?.preferLon != null ? Number(options.preferLon) : NaN;
  const preferred: CapturedGps | null =
    isValidCoords(preferLat, preferLon)
      ? {
          latitude: preferLat,
          longitude: preferLon,
          accuracy: DEFAULT_ACCURACY,
          capturedAt: new Date().toISOString(),
          fromDevice: false,
        }
      : null;

  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return Promise.resolve(preferred);
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: CapturedGps | null) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    const timer = window.setTimeout(() => finish(preferred), timeoutMs + 500);

    try {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          window.clearTimeout(timer);
          const { latitude, longitude, accuracy } = position.coords;
          if (!isValidCoords(latitude, longitude)) {
            finish(preferred);
            return;
          }
          finish({
            latitude,
            longitude,
            accuracy: Number.isFinite(accuracy) && accuracy >= 0 ? accuracy : DEFAULT_ACCURACY,
            capturedAt: new Date(position.timestamp || Date.now()).toISOString(),
            fromDevice: true,
          });
        },
        () => {
          // Permission denied / unavailable / timeout — no fabricated point.
          window.clearTimeout(timer);
          finish(preferred);
        },
        {
          enableHighAccuracy: true,
          timeout: timeoutMs,
          maximumAge: 60_000,
        }
      );
    } catch {
      window.clearTimeout(timer);
      finish(preferred);
    }
  });
}
