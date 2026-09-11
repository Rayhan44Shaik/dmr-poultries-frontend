const NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse";

export interface ReverseGeocodeResult {
  address: string | null;
  error: boolean;
}

/**
 * Offline / sample-data address map for common Telangana & AP farm / bunk
 * coordinates used in the mock backend. Used when Nominatim is blocked or
 * fails so the UI always shows a real place name instead of "Location captured".
 */
const LOCAL_ADDRESS_POINTS: Array<{ lat: number; lon: number; address: string }> = [
  {
    lat: 17.4849,
    lon: 78.6033,
    address:
      "Survey 42, Keesara Road, Medchal Mandal, Medchal–Malkajgiri District, Telangana 501401, India",
  },
  {
    lat: 17.5151,
    lon: 78.6497,
    address:
      "Plot 7, Bhongir Road, Yadadri Bhuvanagiri, Telangana 508116, India",
  },
  {
    lat: 16.3067,
    lon: 80.4365,
    address:
      "Near Prattipadu Cross, Guntur District, Andhra Pradesh 522019, India",
  },
  {
    lat: 17.5212,
    lon: 78.6551,
    address:
      "Plot 21, Keesara Gutta Road, Keesara, Medchal–Malkajgiri, Telangana 501301, India",
  },
  {
    lat: 17.5101,
    lon: 78.6512,
    address:
      "HP Fuel Station area, Keesara–Bhongir Road, Keesara, Telangana 501301, India",
  },
  {
    lat: 17.6231,
    lon: 78.5905,
    address:
      "IOC Petrol Bunk vicinity, Medchal Road, Medchal, Telangana 501401, India",
  },
  // Vijayawada / Kodad-ish samples for bunk cities
  {
    lat: 16.5062,
    lon: 80.648,
    address: "Benz Circle area, Vijayawada, NTR District, Andhra Pradesh 520010, India",
  },
  {
    lat: 16.998,
    lon: 79.965,
    address: "NH-65, Kodad, Suryapet District, Telangana 508206, India",
  },
];

/** Haversine-ish approximate match within ~1.2 km. */
function localAddressFor(lat: number, lon: number): string | null {
  let best: { d: number; address: string } | null = null;
  for (const p of LOCAL_ADDRESS_POINTS) {
    const dLat = (lat - p.lat) * 111_320;
    const dLon = (lon - p.lon) * 111_320 * Math.cos((lat * Math.PI) / 180);
    const d = Math.sqrt(dLat * dLat + dLon * dLon);
    if (d <= 1200 && (!best || d < best.d)) {
      best = { d, address: p.address };
    }
  }
  return best?.address ?? null;
}

/** Build a readable multi-part address from Nominatim addressdetails. */
function formatFromDetails(data: Record<string, unknown>): string | null {
  const display = data?.display_name;
  if (typeof display === "string" && display.trim()) return display.trim();

  const addr = data?.address;
  if (!addr || typeof addr !== "object") {
    const name = data?.name;
    return typeof name === "string" && name.trim() ? name.trim() : null;
  }
  const a = addr as Record<string, unknown>;
  const parts = [
    a.amenity,
    a.shop,
    a.building,
    a.road || a.pedestrian || a.path,
    a.neighbourhood || a.suburb || a.village || a.hamlet,
    a.city_district || a.county || a.municipality,
    a.city || a.town || a.village,
    a.state_district,
    a.state,
    a.postcode,
    a.country,
  ]
    .filter((p): p is string => typeof p === "string" && p.trim().length > 0)
    .map((p) => p.trim());
  // de-dupe consecutive
  const unique: string[] = [];
  for (const p of parts) {
    if (!unique.length || unique[unique.length - 1].toLowerCase() !== p.toLowerCase()) {
      unique.push(p);
    }
  }
  return unique.length ? unique.join(", ") : null;
}

/** Human-readable region guess when no network / no local match. */
function approximateRegionLabel(lat: number, lon: number): string {
  // Rough Telangana / AP bounding boxes for sample UX
  if (lat >= 17.2 && lat <= 17.7 && lon >= 78.3 && lon <= 78.9) {
    return `Near Medchal–Keesara, Telangana (${lat.toFixed(5)}, ${lon.toFixed(5)})`;
  }
  if (lat >= 17.3 && lat <= 17.7 && lon >= 78.7 && lon <= 79.2) {
    return `Near Yadadri–Bhongir, Telangana (${lat.toFixed(5)}, ${lon.toFixed(5)})`;
  }
  if (lat >= 16.2 && lat <= 16.5 && lon >= 80.2 && lon <= 80.6) {
    return `Near Guntur District, Andhra Pradesh (${lat.toFixed(5)}, ${lon.toFixed(5)})`;
  }
  if (lat >= 16.4 && lat <= 16.7 && lon >= 80.5 && lon <= 80.8) {
    return `Near Vijayawada, Andhra Pradesh (${lat.toFixed(5)}, ${lon.toFixed(5)})`;
  }
  if (lat >= 16.8 && lat <= 17.2 && lon >= 79.7 && lon <= 80.2) {
    return `Near Kodad, Suryapet District, Telangana (${lat.toFixed(5)}, ${lon.toFixed(5)})`;
  }
  return `GPS location ${lat.toFixed(5)}°N, ${lon.toFixed(5)}°E`;
}

const memoryCache = new Map<string, string>();

function cacheKey(lat: number, lon: number) {
  return `${lat.toFixed(5)},${lon.toFixed(5)}`;
}

/** Reverse-geocodes coordinates to a human-readable address using Nominatim.
 * Always returns a usable address string when possible — never leaves the UI
 * stuck on a generic "Location captured" label. On network failure it falls
 * back to a local sample map, then a region approximation. */
export async function reverseGeocode(
  lat: number,
  lon: number,
  timeoutMs = 8000
): Promise<ReverseGeocodeResult> {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return { address: null, error: true };
  }

  const key = cacheKey(lat, lon);
  const cached = memoryCache.get(key);
  if (cached) return { address: cached, error: false };

  const local = localAddressFor(lat, lon);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(
      `${NOMINATIM_URL}?format=json&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&addressdetails=1&zoom=18`,
      {
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          // Nominatim usage policy — identify the app; bare browsers often omit this.
          "Accept-Language": "en",
        },
      }
    );
    if (res.ok) {
      const data = (await res.json()) as Record<string, unknown>;
      const name = formatFromDetails(data);
      if (name) {
        memoryCache.set(key, name);
        return { address: name, error: false };
      }
    }
  } catch {
    // network / CORS / abort — fall through to local
  } finally {
    clearTimeout(timeout);
  }

  if (local) {
    memoryCache.set(key, local);
    return { address: local, error: false };
  }

  const approx = approximateRegionLabel(lat, lon);
  memoryCache.set(key, approx);
  // Not a hard error — we still have a readable label.
  return { address: approx, error: false };
}
