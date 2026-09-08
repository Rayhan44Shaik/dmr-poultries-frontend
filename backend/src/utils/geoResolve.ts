/**
 * Location resolution for the Shops master (POST /api/masters/resolve-location).
 *
 * Google Maps share links carry the authoritative place data in the URL
 * itself — `/place/<Place Name>/@lat,lng,…` or `?q=…` / `!3d!4d` parameters.
 * Reverse geocoding the coordinates alone (what the old ERP integration did)
 * returns the nearest road/area — e.g. "Kummaripalem, Vidhyadharapuram…" for
 * a link that points at "P V P Mall" — so the place name embedded in the URL
 * always wins, and reverse geocoding is only a fallback when the URL has
 * coordinates but no name.
 *
 * Design constraints (production standards):
 *  - `parseMapsUrl` is pure and deterministic — fully unit-testable offline.
 *  - Outbound fetches are limited to a Google/Nominatim host allowlist (SSRF),
 *    bounded redirects, 8s timeouts, and a polite User-Agent.
 *  - Identical in-flight requests are de-duplicated and results cached with a
 *    TTL, so rapid re-clicks never produce duplicate outbound calls.
 *  - Failures throw `GeoResolveError` with a user-actionable message; nothing
 *    is silently fabricated.
 */

export type ResolvedLocation = {
  latitude: number;
  longitude: number;
  address: string | null;
};

export type ParsedMapsUrl = {
  latitude?: number;
  longitude?: number;
  placeName?: string;
};

export class GeoResolveError extends Error {
  status: number;
  constructor(message: string, status = 422) {
    super(message);
    this.name = "GeoResolveError";
    this.status = status;
  }
}
/** Hosts we are willing to follow/fetch. Everything else is rejected. */
const ALLOWED_HOST_SUFFIXES = [
  "goo.gl",
  "google.com",
  "google.co.in",
  "openstreetmap.org",
  "nominatim.openstreetmap.org",
] as const;

const FETCH_TIMEOUT_MS = 8_000;
const MAX_REDIRECT_HOPS = 5;
const CACHE_TTL_MS = 10 * 60_000;
const CACHE_MAX_ENTRIES = 200;
const USER_AGENT = "DMRPoultriesERP/1.0 (self-hosted; +contact:ops)";

function isAllowedUrl(value: string): boolean {
  try {
    const u = new URL(value);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    const host = u.hostname.toLowerCase();
    return ALLOWED_HOST_SUFFIXES.some(
      (s) => host === s || host.endsWith(`.${s}`)
    );
  } catch {
    return false;
  }
}

function isValidLat(v: number): boolean {
  return Number.isFinite(v) && v >= -90 && v <= 90;
}
function isValidLng(v: number): boolean {
  return Number.isFinite(v) && v >= -180 && v <= 180;
}

function decodePlaceName(raw: string): string {
  try {
    return decodeURIComponent(raw.replace(/\+/g, " "))
      .replace(/\s+/g, " ")
      .replace(/[,/]+$/, "")
      .trim();
  } catch {
    return raw.replace(/\+/g, " ").replace(/\s+/g, " ").trim();
  }
}

/** Extract place name / coordinates embedded in any Google Maps URL shape. */
export function parseMapsUrl(input: string): ParsedMapsUrl {
  const out: ParsedMapsUrl = {};
  let u: URL;
  try {
    u = new URL(input.trim());
  } catch {
    return out;
  }
  // Some share links hide parameters in the fragment.
  const haystacks = [input, `${u.pathname}${u.search}`, u.hash.replace(/^#/, "?")];

  for (const hay of haystacks) {
    if (out.latitude === undefined) {
      const at = hay.match(/@(-?\d{1,2}(?:\.\d+)?),\s*(-?\d{1,3}(?:\.\d+)?)/);
      if (at) {
        const lat = parseFloat(at[1]);
        const lng = parseFloat(at[2]);
        if (isValidLat(lat) && isValidLng(lng)) {
          out.latitude = lat;
          out.longitude = lng;
        }
      }
    }
    if (out.latitude === undefined) {
      const d = hay.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
      if (d) {
        const lat = parseFloat(d[1]);
        const lng = parseFloat(d[2]);
        if (isValidLat(lat) && isValidLng(lng)) {
          out.latitude = lat;
          out.longitude = lng;
        }
      }
    }
    if (out.placeName === undefined) {
      const seg = hay.match(/\/(?:place|search|dir)\/([^/?#]+)/);
      if (seg) {
        const name = decodePlaceName(seg[1]);
        if (name) out.placeName = name;
      }
    }
  }

  // q / query parameters: numeric pair = coordinates, otherwise a place query.
  try {
    const q = u.searchParams.get("q") ?? u.searchParams.get("query");
    if (q) {
      const pair = q.match(/^(-?\d{1,2}(?:\.\d+)?)\s*[ ,]\s*(-?\d{1,3}(?:\.\d+)?)$/);
      if (pair) {
        const lat = parseFloat(pair[1]);
        const lng = parseFloat(pair[2]);
        if (isValidLat(lat) && isValidLng(lng)) {
          out.latitude ??= lat;
          out.longitude ??= lng;
        }
      } else if (out.placeName === undefined) {
        const name = decodePlaceName(q);
        if (name) out.placeName = name;
      }
    }
  } catch {
    /* keep whatever was parsed so far */
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Network steps (allowlisted, bounded, cached)                        */
/* ------------------------------------------------------------------ */

async function fetchFinalUrl(startUrl: string): Promise<string | undefined> {
  let current = startUrl;
  for (let hop = 0; hop < MAX_REDIRECT_HOPS; hop++) {
    const res = await fetch(current, {
      redirect: "manual",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { "User-Agent": USER_AGENT },
    });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) return undefined;
      const next = new URL(loc, current).toString();
      if (!isAllowedUrl(next)) return undefined; // never follow off-allowlist
      current = next;
      continue;
    }
    return current;
  }
  return undefined;
}

type NominatimReverse = {
  display_name?: string;
  address?: Record<string, string>;
};

async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  const url =
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2` +
    `&lat=${encodeURIComponent(lat.toFixed(6))}&lon=${encodeURIComponent(lng.toFixed(6))}` +
    `&zoom=18&addressdetails=1`;
  const res = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as NominatimReverse;
  const a = data.address ?? {};
  // Prefer the most specific street-level line, then the wider address.
  const specific = [a.amenity, a.building, a.road, a.house_number]
    .filter(Boolean)
    .join(", ");
  const wider = [a.suburb ?? a.neighbourhood, a.city ?? a.town ?? a.village, a.state, a.postcode]
    .filter(Boolean)
    .join(", ");
  const composed = [specific, wider].filter(Boolean).join(", ");
  return composed || data.display_name || null;
}

async function forwardGeocode(query: string): Promise<ResolvedLocation | null> {
  const url =
    `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1` +
    `&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
  });
  if (!res.ok) return null;
  const rows = (await res.json()) as Array<{
    lat: string;
    lon: string;
    display_name?: string;
  }>;
  const row = rows[0];
  if (!row) return null;
  const lat = parseFloat(row.lat);
  const lng = parseFloat(row.lon);
  if (!isValidLat(lat) || !isValidLng(lng)) return null;
  return { latitude: lat, longitude: lng, address: row.display_name ?? null };
}

/* ------------------------------------------------------------------ */
/* Cache + in-flight de-duplication                                    */
/* ------------------------------------------------------------------ */

const cache = new Map<string, { expiresAt: number; promise: Promise<ResolvedLocation> }>();

function remember(key: string, promise: Promise<ResolvedLocation>): Promise<ResolvedLocation> {
  const entry = { expiresAt: Date.now() + CACHE_TTL_MS, promise };
  cache.set(key, entry);
  if (cache.size > CACHE_MAX_ENTRIES) {
    // Evict oldest-inserted entries (Map preserves insertion order).
    for (const k of cache.keys()) {
      if (cache.size <= CACHE_MAX_ENTRIES) break;
      cache.delete(k);
    }
  }
  promise.catch(() => cache.delete(key)); // failed lookups stay retryable
  return promise;
}

/**
 * Resolve a pasted Google Maps link, coordinates, or free-text address into
 * `{ latitude, longitude, address }`. The URL's own place name always wins
 * over reverse geocoding; reverse/forward geocoding are fallbacks only.
 */
export function resolveLocationInput(rawInput: string): Promise<ResolvedLocation> {
  const input = (rawInput ?? "").trim();
  if (!input) {
    return Promise.reject(
      new GeoResolveError("Paste a Google Maps link or an address to capture the location.")
    );
  }
  const key = input.toLowerCase();
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.promise;
  if (hit) cache.delete(key);
  return remember(key, doResolve(input));
}

async function doResolve(input: string): Promise<ResolvedLocation> {
  const looksLikeUrl = /^https?:\/\//i.test(input);

  if (looksLikeUrl) {
    if (!isAllowedUrl(input)) {
      throw new GeoResolveError(
        "Only Google Maps links (maps.app.goo.gl / google.com/maps) or plain addresses are supported."
      );
    }

    let parsed = parseMapsUrl(input);

    // Short share links carry no data themselves — follow to the final URL.
    if (parsed.placeName === undefined && parsed.latitude === undefined) {
      try {
        const finalUrl = await fetchFinalUrl(input);
        if (finalUrl) parsed = parseMapsUrl(finalUrl);
      } catch {
        /* network blocked/offline: fall through to what we have (nothing) */
      }
    }

    if (parsed.latitude !== undefined && parsed.longitude !== undefined) {
      let address = parsed.placeName ?? null;
      if (address === null) {
        try {
          address = await reverseGeocode(parsed.latitude, parsed.longitude);
        } catch {
          address = null;
        }
      }
      if (address === null) {
        throw new GeoResolveError(
          "Location coordinates were read from the link, but the address could not be resolved. You can still save the shop with these coordinates."
        );
      }
      return { latitude: parsed.latitude, longitude: parsed.longitude, address };
    }

    if (parsed.placeName !== undefined) {
      const geo = await forwardGeocode(parsed.placeName).catch(() => null);
      if (geo) return { ...geo, address: parsed.placeName };
      throw new GeoResolveError(
        `Could not determine coordinates for "${parsed.placeName}". Paste the full Google Maps link instead.`
      );
    }

    throw new GeoResolveError(
      "This link does not contain a readable location. Open it in Google Maps and copy the link again, or paste the address."
    );
  }

  // Plain address / "lat, lng" text.
  const pair = input.match(/^(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)$/);
  if (pair) {
    const lat = parseFloat(pair[1]);
    const lng = parseFloat(pair[2]);
    if (!isValidLat(lat) || !isValidLng(lng)) {
      throw new GeoResolveError("Coordinates must be within latitude -90..90 and longitude -180..180.");
    }
    let address: string | null = null;
    try {
      address = await reverseGeocode(lat, lng);
    } catch {
      address = null;
    }
    return { latitude: lat, longitude: lng, address };
  }

  const geo = await forwardGeocode(input).catch(() => null);
  if (geo) return geo;
  throw new GeoResolveError(
    "Could not find this address. Paste the Google Maps link of the shop instead."
  );
}
