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
  /** Full line to store: "<place name>, <street/area address>" (or whichever part is known). */
  address: string | null;
  /** Business / landmark name as Google Maps shows it, e.g. "P V P Mall". */
  placeName: string | null;
  /** Postal-style address without the place name. */
  fullAddress: string | null;
  /** Google Plus Code when the page exposes one (e.g. "HH58+5W Gollapudi"). */
  plusCode: string | null;
  /** How the coordinates were obtained — "pin" is the exact place marker. */
  precision: "pin" | "viewport" | "geocoded";
  /** Canonical Google Maps URL to reopen the exact place. */
  mapsUrl: string | null;
};

export type ParsedMapsUrl = {
  latitude?: number;
  longitude?: number;
  placeName?: string;
  /** true when lat/lng came from the !3d/!4d place marker (exact pin). */
  pin?: boolean;
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
    // The !3d/!4d pair is the place marker itself — the exact pin. The
    // "@lat,lng,zoom" triple is only the map viewport centre, which can sit
    // tens of metres away from the shop, so the pin always wins.
    if (!out.pin) {
      const d = hay.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
      if (d) {
        const lat = parseFloat(d[1]);
        const lng = parseFloat(d[2]);
        if (isValidLat(lat) && isValidLng(lng)) {
          out.latitude = lat;
          out.longitude = lng;
          out.pin = true;
        }
      }
    }
    if (out.latitude === undefined) {
      const at = hay.match(/@(-?\d{1,2}(?:\.\d+)?),\s*(-?\d{1,3}(?:\.\d+)?)/);
      if (at) {
        const lat = parseFloat(at[1]);
        const lng = parseFloat(at[2]);
        if (isValidLat(lat) && isValidLng(lng)) {
          out.latitude = lat;
          out.longitude = lng;
          out.pin = false;
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

type MapsPage = {
  finalUrl: string;
  /** Google's own "<name> · <address>" title line, when the page exposes it. */
  placeName?: string;
  fullAddress?: string;
  plusCode?: string;
};

const MAX_PAGE_BYTES = 512 * 1024;

function decodeHtml(v: string): string {
  return v
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/\s+/g, " ")
    .trim();
}

/** Read the Google Maps place page's own name/address line (pure, offline-testable). */
export function parseMapsPage(html: string): Pick<MapsPage, "placeName" | "fullAddress" | "plusCode"> {
  const out: Pick<MapsPage, "placeName" | "fullAddress" | "plusCode"> = {};
  const meta = (prop: string) => {
    const re = new RegExp(
      `<meta[^>]+(?:property|name|itemprop)=["']${prop}["'][^>]*content=["']([^"']*)["']|<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name|itemprop)=["']${prop}["']`,
      "i"
    );
    const m = html.match(re);
    return m ? decodeHtml(m[1] ?? m[2] ?? "") : "";
  };
  const title = meta("og:title") || meta("twitter:title");
  if (title) {
    const dot = title.indexOf(" · ");
    if (dot > 0) {
      out.placeName = title.slice(0, dot).trim();
      out.fullAddress = title.slice(dot + 3).trim();
    } else if (!/google maps/i.test(title)) {
      out.placeName = title.trim();
    }
  }
  if (!out.fullAddress) {
    // Structured data on the place page carries the same street address.
    const addr = html.match(/"streetAddress"\s*:\s*"([^"]+)"/);
    if (addr) out.fullAddress = decodeHtml(addr[1]);
  }
  const plus = html.match(/\b([23456789CFGHJMPQRVWX]{4}\+[23456789CFGHJMPQRVWX]{2,3})\s+([A-Z][^"<,]{2,40}?)(?=[",<])/);
  if (plus) out.plusCode = `${plus[1]} ${plus[2].trim()}`;
  return out;
}

async function fetchMapsPage(startUrl: string): Promise<MapsPage | undefined> {
  let current = startUrl;
  for (let hop = 0; hop < MAX_REDIRECT_HOPS; hop++) {
    const res = await fetch(current, {
      redirect: "manual",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { "User-Agent": USER_AGENT, "Accept-Language": "en-IN,en;q=0.9" },
    });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) return undefined;
      const next = new URL(loc, current).toString();
      if (!isAllowedUrl(next)) return undefined; // never follow off-allowlist
      current = next;
      continue;
    }
    const page: MapsPage = { finalUrl: current };
    if (res.ok && /text\/html/i.test(res.headers.get("content-type") ?? "")) {
      try {
        const html = (await res.text()).slice(0, MAX_PAGE_BYTES);
        Object.assign(page, parseMapsPage(html));
      } catch {
        /* the URL alone is still useful */
      }
    }
    return page;
  }
  return undefined;
}

type NominatimReverse = {
  display_name?: string;
  address?: Record<string, string>;
};

type ReverseResult = { fullAddress: string; placeName: string | null };

async function reverseGeocode(lat: number, lng: number): Promise<ReverseResult | null> {
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
  const fullAddress = composed || data.display_name || "";
  if (!fullAddress) return null;
  const placeName = a.amenity ?? a.shop ?? a.building ?? null;
  return { fullAddress, placeName };
}

type ForwardResult = { latitude: number; longitude: number; fullAddress: string | null };

async function forwardGeocode(query: string): Promise<ForwardResult | null> {
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
  return { latitude: lat, longitude: lng, fullAddress: row.display_name ?? null };
}

/** Compose the stored line + canonical Maps URL from whatever parts are known. */
function finish(
  latitude: number,
  longitude: number,
  parts: {
    placeName?: string | null;
    fullAddress?: string | null;
    plusCode?: string | null;
    precision: ResolvedLocation["precision"];
  }
): ResolvedLocation {
  const placeName = parts.placeName?.trim() || null;
  const fullAddress = parts.fullAddress?.trim() || null;
  const address =
    placeName && fullAddress && !fullAddress.toLowerCase().startsWith(placeName.toLowerCase())
      ? `${placeName}, ${fullAddress}`
      : fullAddress ?? placeName;
  const q = placeName ? `${placeName} ${latitude.toFixed(6)},${longitude.toFixed(6)}` : `${latitude.toFixed(6)},${longitude.toFixed(6)}`;
  return {
    latitude,
    longitude,
    address,
    placeName,
    fullAddress,
    plusCode: parts.plusCode?.trim() || null,
    precision: parts.precision,
    mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`,
  };
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
    let page: MapsPage | undefined;

    // Always try the place page: short links carry nothing themselves, and
    // even a long link only has the name — the page has the postal address.
    try {
      page = await fetchMapsPage(input);
      if (page) {
        const fromFinal = parseMapsUrl(page.finalUrl);
        // Take the pin if either URL has one; otherwise whatever is known.
        parsed = fromFinal.pin || parsed.latitude === undefined ? { ...parsed, ...fromFinal } : parsed;
        if (fromFinal.placeName && !parsed.placeName) parsed.placeName = fromFinal.placeName;
      }
    } catch {
      /* network blocked/offline: fall through to what the URL itself says */
    }

    const placeName = page?.placeName ?? parsed.placeName ?? null;

    if (parsed.latitude !== undefined && parsed.longitude !== undefined) {
      let fullAddress = page?.fullAddress ?? null;
      if (!fullAddress) {
        const rev = await reverseGeocode(parsed.latitude, parsed.longitude).catch(() => null);
        fullAddress = rev?.fullAddress ?? null;
      }
      if (!fullAddress && !placeName) {
        throw new GeoResolveError(
          "Location coordinates were read from the link, but the address could not be resolved. You can still save the shop with these coordinates."
        );
      }
      return finish(parsed.latitude, parsed.longitude, {
        placeName,
        fullAddress,
        plusCode: page?.plusCode,
        precision: parsed.pin ? "pin" : "viewport",
      });
    }

    if (placeName) {
      const geo = await forwardGeocode(page?.fullAddress ? `${placeName}, ${page.fullAddress}` : placeName).catch(() => null);
      if (geo) {
        return finish(geo.latitude, geo.longitude, {
          placeName,
          fullAddress: page?.fullAddress ?? geo.fullAddress,
          plusCode: page?.plusCode,
          precision: "geocoded",
        });
      }
      throw new GeoResolveError(
        `Could not determine coordinates for "${placeName}". Paste the full Google Maps link instead.`
      );
    }

    const isShortLink = /(^|\.)goo\.gl$/i.test(new URL(input).hostname);
    throw new GeoResolveError(
      isShortLink && !page
        ? "Could not reach Google Maps to expand this short link (no internet access from the server). Open the link in Google Maps, copy the full URL from the address bar and paste that instead."
        : "This link does not contain a readable location. Open it in Google Maps and copy the link again, or paste the address."
    );
  }

  // Plain "lat, lng" text (also what the Get GPS button sends back).
  const pair = input.match(/^(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)$/);
  if (pair) {
    const lat = parseFloat(pair[1]);
    const lng = parseFloat(pair[2]);
    if (!isValidLat(lat) || !isValidLng(lng)) {
      throw new GeoResolveError("Coordinates must be within latitude -90..90 and longitude -180..180.");
    }
    const rev = await reverseGeocode(lat, lng).catch(() => null);
    return finish(lat, lng, {
      placeName: rev?.placeName,
      fullAddress: rev?.fullAddress,
      precision: "pin",
    });
  }

  // Free-text address.
  const geo = await forwardGeocode(input).catch(() => null);
  if (geo) {
    return finish(geo.latitude, geo.longitude, {
      fullAddress: geo.fullAddress ?? input,
      precision: "geocoded",
    });
  }
  throw new GeoResolveError(
    "Could not find this address. Paste the Google Maps link of the shop instead."
  );
}
