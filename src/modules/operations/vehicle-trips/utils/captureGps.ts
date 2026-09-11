/**
 * Quiet GPS capture for Trip Entry (farm + diesel).
 *
 * Browsers inside iframe / preview / denied permission often fail
 * getCurrentPosition and used to show "Unable to retrieve your location".
 * That toast is intentionally never raised — on failure we quietly apply a
 * stable regional fallback so the trip can continue.
 */

export type CapturedGps = {
  latitude: number;
  longitude: number;
  accuracy: number;
  capturedAt: string;
  /** true when browser coords were used; false when fallback was applied */
  fromDevice: boolean;
};

/** Andhra / Telangana corridor — used only when the device cannot supply GPS. */
const FALLBACK_LAT = 16.5062;
const FALLBACK_LON = 80.6480;
const FALLBACK_ACCURACY = 50;

function isValidCoords(lat: number, lon: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180 &&
    !(lat === 0 && lon === 0)
  );
}

function fallbackGps(): CapturedGps {
  return {
    latitude: FALLBACK_LAT,
    longitude: FALLBACK_LON,
    accuracy: FALLBACK_ACCURACY,
    capturedAt: new Date().toISOString(),
    fromDevice: false,
  };
}

/**
 * Resolve current coordinates without throwing and without requiring the
 * caller to surface an error toast. Always resolves with a usable point.
 */
export function captureGpsQuiet(options?: {
  /** Prefer a nearby farm/previous point as fallback instead of the default. */
  preferLat?: number | null;
  preferLon?: number | null;
  timeoutMs?: number;
}): Promise<CapturedGps> {
  const timeoutMs = options?.timeoutMs ?? 8000;
  const preferLat = options?.preferLat != null ? Number(options.preferLat) : NaN;
  const preferLon = options?.preferLon != null ? Number(options.preferLon) : NaN;
  const preferred =
    isValidCoords(preferLat, preferLon)
      ? {
          latitude: preferLat,
          longitude: preferLon,
          accuracy: FALLBACK_ACCURACY,
          capturedAt: new Date().toISOString(),
          fromDevice: false as const,
        }
      : fallbackGps();

  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return Promise.resolve(preferred);
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: CapturedGps) => {
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
            accuracy: Number.isFinite(accuracy) && accuracy >= 0 ? accuracy : FALLBACK_ACCURACY,
            capturedAt: new Date(position.timestamp || Date.now()).toISOString(),
            fromDevice: true,
          });
        },
        () => {
          // Permission denied / unavailable / timeout — silent fallback, no toast.
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
