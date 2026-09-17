import { masterInputClass } from "../../components/masterFormStyles";
import { useState, useRef, useCallback, useMemo } from "react";
import {
  MapPin,
  Navigation,
  CheckCircle2,
  Loader2,
  ExternalLink,
  Crosshair,
  Building2,
} from "lucide-react";
import { useI18n } from "../../../../i18n";
import {
  handleApiError,
  resolveLocation,
  type ResolvedLocation,
} from "../services/shopService";

type LocationPickerProps = {
  id?: string;
  latitude: string;
  longitude: string;
  address?: string;
  onChange: (lat: string, lng: string, address?: string) => void;
  disabled?: boolean;
};

/** What the last capture told us beyond lat/lng (never persisted — the shop
 *  stores the composed `address`; this is the detail the user verifies). */
type CaptureDetail = {
  placeName: string | null;
  fullAddress: string | null;
  plusCode: string | null;
  precision: "pin" | "viewport" | "geocoded" | "gps";
  accuracyM: number | null;
  mapsUrl: string | null;
};

function isValidCoord(lat: string, lng: string): boolean {
  const a = parseFloat(lat);
  const b = parseFloat(lng);
  return (
    Number.isFinite(a) &&
    Number.isFinite(b) &&
    a >= -90 &&
    a <= 90 &&
    b >= -180 &&
    b <= 180
  );
}

function mapsSearchUrl(lat: string, lng: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${parseFloat(lat).toFixed(6)},${parseFloat(lng).toFixed(6)}`,
  )}`;
}

function LocationPicker({
  id,
  latitude,
  longitude,
  address: initialAddress,
  onChange,
  disabled = false,
}: LocationPickerProps) {
  const { t } = useI18n();
  const [locationInput, setLocationInput] = useState("");
  const [isResolving, setIsResolving] = useState(false);
  const [isGettingGps, setIsGettingGps] = useState(false);
  const [error, setError] = useState("");
  /** The short share link that could not be expanded server-side. */
  const [shortLinkStuck, setShortLinkStuck] = useState<string | null>(null);
  const [capturedAddress, setCapturedAddress] = useState(initialAddress || "");
  const [detail, setDetail] = useState<CaptureDetail | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const hasValidCoords = isValidCoord(latitude, longitude);

  const applyResolved = useCallback(
    (result: ResolvedLocation) => {
      const lat = result.latitude.toFixed(6);
      const lng = result.longitude.toFixed(6);
      const line = result.address || undefined;
      onChange(lat, lng, line);
      setCapturedAddress(line ?? "");
      setDetail({
        placeName: result.placeName ?? null,
        fullAddress: result.fullAddress ?? null,
        plusCode: result.plusCode ?? null,
        precision: result.precision ?? "pin",
        accuracyM: null,
        mapsUrl: result.mapsUrl ?? mapsSearchUrl(lat, lng),
      });
    },
    [onChange],
  );

  const handleResolveInput = useCallback(
    async (override?: string) => {
      const input = (override ?? locationInput).trim();
      if (!input || isResolving) return;
      setError("");
      setShortLinkStuck(null);
      setIsResolving(true);
      try {
        applyResolved(await resolveLocation(input));
        setLocationInput("");
      } catch (err: unknown) {
        const isShort = /^https?:\/\/(maps\.app\.)?goo\.gl\//i.test(input);
        if (isShort) {
          // The link is fine — only the expansion failed. Guide to the full URL
          // (which resolves offline: name + exact pin live in the URL itself).
          setShortLinkStuck(input);
        } else {
          setError(
            handleApiError(err) || t("masters.shops.location.err_generic"),
          );
        }
      } finally {
        setIsResolving(false);
      }
    },
    [locationInput, isResolving, applyResolved, t],
  );

  const handleGetGps = useCallback(() => {
    if (isGettingGps) return;
    if (!navigator.geolocation) {
      setError(t("masters.shops.location.err_unsupported"));
      return;
    }
    setIsGettingGps(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude.toFixed(6);
        const lng = pos.coords.longitude.toFixed(6);
        const accuracyM = Math.round(pos.coords.accuracy);
        // Show the coordinates immediately, then enrich with the address the
        // resolver reads for that exact point (place + postal line).
        onChange(lat, lng);
        setCapturedAddress("");
        setDetail({
          placeName: null,
          fullAddress: null,
          plusCode: null,
          precision: "gps",
          accuracyM,
          mapsUrl: mapsSearchUrl(lat, lng),
        });
        setIsGettingGps(false);
        setIsResolving(true);
        try {
          const r = await resolveLocation(`${lat}, ${lng}`);
          const line = r.address || undefined;
          onChange(lat, lng, line);
          setCapturedAddress(line ?? "");
          setDetail({
            placeName: r.placeName ?? null,
            fullAddress: r.fullAddress ?? null,
            plusCode: r.plusCode ?? null,
            precision: "gps",
            accuracyM,
            mapsUrl: mapsSearchUrl(lat, lng),
          });
        } catch {
          /* coordinates are already captured; address stays editable */
        } finally {
          setIsResolving(false);
        }
      },
      (err) => {
        setIsGettingGps(false);
        if (err.code === err.PERMISSION_DENIED) {
          setError(t("masters.shops.location.err_denied"));
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setError(t("masters.shops.location.err_unavailable"));
        } else {
          setError(t("masters.shops.location.err_timeout"));
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  }, [onChange, isGettingGps, t]);

  const handleClearLocation = useCallback(() => {
    onChange("", "", "");
    setCapturedAddress("");
    setDetail(null);
    setLocationInput("");
    setError("");
    setShortLinkStuck(null);
    inputRef.current?.focus();
  }, [onChange]);

  const isLoading = isResolving || isGettingGps;

  const precisionLabel = useMemo(() => {
    if (!detail) return "";
    switch (detail.precision) {
      case "pin":
        return t("masters.shops.location.precision_pin");
      case "viewport":
        return t("masters.shops.location.precision_viewport");
      case "geocoded":
        return t("masters.shops.location.precision_geocoded");
      case "gps":
        return t("masters.shops.location.precision_gps", {
          m: detail.accuracyM ?? "—",
        });
    }
  }, [detail, t]);

  const mapsHref =
    detail?.mapsUrl ??
    (hasValidCoords ? mapsSearchUrl(latitude, longitude) : null);

  return (
    <div className="space-y-2">
      {/* Location input + Get GPS */}
      <div className="flex gap-2">
        <div className="relative flex-1 min-w-0">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            <MapPin size={15} />
          </div>
          <input
            id={id}
            ref={inputRef}
            type="text"
            value={locationInput}
            onChange={(e) => {
              setLocationInput(e.target.value);
              setError("");
              setShortLinkStuck(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void handleResolveInput();
              }
            }}
            onPaste={() => {
              // A pasted Maps link is captured on its own — no extra click.
              window.setTimeout(() => {
                const v = inputRef.current?.value.trim() ?? "";
                if (/^https?:\/\//i.test(v)) void handleResolveInput(v);
              }, 0);
            }}
            placeholder={t("masters.shops.location.placeholder")}
            className={masterInputClass()}
            disabled={disabled || isLoading}
            autoComplete="off"
          />
        </div>
        <button
          type="button"
          onClick={handleGetGps}
          disabled={disabled || isLoading}
          className="inline-flex h-9 items-center gap-1.5 px-3.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl hover:bg-emerald-100 transition-colors disabled:opacity-50 shrink-0 whitespace-nowrap"
        >
          {isGettingGps ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <Navigation size={13} />
          )}
          {isGettingGps
            ? t("masters.shops.location.getting")
            : t("masters.shops.location.get_gps")}
        </button>
      </div>

      {/* Resolve button when input present */}
      {locationInput.trim() && !isLoading && (
        <button
          type="button"
          onClick={() => void handleResolveInput()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl hover:bg-emerald-100 transition-colors"
        >
          <MapPin size={12} />
          {t("masters.shops.location.capture")}
        </button>
      )}

      {/* Loading state */}
      {isResolving && (
        <div
          className="flex items-center gap-2 text-xs text-slate-500"
          role="status"
          aria-live="polite"
        >
          <Loader2 size={13} className="animate-spin" />
          {t("masters.shops.location.resolving")}
        </div>
      )}

      {/* Short link could not be expanded — show the way through, not a dead end. */}
      {shortLinkStuck && !isLoading && (
        <div
          className="rounded-xl border border-amber-200 bg-amber-50/70 px-3.5 py-3 motion-safe:animate-[var(--animate-fade-in-up)]"
          role="alert"
        >
          <p className="text-xs font-bold text-amber-800">
            {t("masters.shops.location.short_link_title")}
          </p>
          <p className="mt-1 text-[12px] leading-relaxed text-amber-800/90">
            {t("masters.shops.location.short_link_help")}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <a
              href={shortLinkStuck}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100 transition-colors"
            >
              <ExternalLink size={12} />
              {t("masters.shops.location.open_link")}
            </a>
            <button
              type="button"
              onClick={() => {
                const link = shortLinkStuck;
                setShortLinkStuck(null);
                void handleResolveInput(link);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              {t("masters.shops.location.retry")}
            </button>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="text-red-600 text-xs" role="alert">
          {error}
        </p>
      )}

      {/* Captured location card */}
      {hasValidCoords && !error && (
        <div className="rounded-xl border border-emerald-200/70 bg-emerald-50/60 px-3.5 py-3 motion-safe:animate-[var(--animate-fade-in-up)]">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-1.5 min-w-0">
              <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
              <span className="text-xs font-bold text-emerald-800">
                {t("masters.shops.location.captured")}
              </span>
              {precisionLabel && (
                <span className="hidden sm:inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-emerald-700 whitespace-nowrap">
                  <Crosshair size={10} />
                  {precisionLabel}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={handleClearLocation}
              disabled={disabled}
              className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 shrink-0"
            >
              {t("masters.shops.location.change")}
            </button>
          </div>

          <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1.5 pl-5 sm:grid-cols-[auto_1fr]">
            {detail?.placeName && (
              <>
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700/70">
                  {t("masters.shops.location.place")}
                </dt>
                <dd className="flex items-start gap-1.5 text-sm font-bold text-slate-900 break-words">
                  <Building2
                    size={14}
                    className="mt-0.5 shrink-0 text-emerald-600"
                  />
                  {detail.placeName}
                </dd>
              </>
            )}
            {(detail?.fullAddress || capturedAddress) && (
              <>
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700/70">
                  {t("masters.shops.location.address")}
                </dt>
                <dd className="text-[13px] leading-relaxed text-slate-800 break-words">
                  {detail?.fullAddress || capturedAddress}
                </dd>
              </>
            )}
            {detail?.plusCode && (
              <>
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700/70">
                  {t("masters.shops.location.plus_code")}
                </dt>
                <dd className="text-[13px] font-semibold tabular-nums text-slate-800">
                  {detail.plusCode}
                </dd>
              </>
            )}
          </dl>

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 pl-5 text-[11px] font-medium tabular-nums text-emerald-700/80">
            <span>Lat {parseFloat(latitude).toFixed(6)}</span>
            <span className="text-emerald-400">·</span>
            <span>Lng {parseFloat(longitude).toFixed(6)}</span>
            {mapsHref && (
              <a
                href={mapsHref}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-white px-2 py-1 font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors"
              >
                <ExternalLink size={11} />
                {t("masters.shops.location.open_maps")}
              </a>
            )}
          </div>
        </div>
      )}

      {/* Not captured */}
      {!hasValidCoords && !error && !isResolving && (
        <p className="text-[11px] text-slate-400 italic pl-0.5">
          {t("masters.shops.location.not_captured")}
        </p>
      )}
    </div>
  );
}

export default LocationPicker;
