import type { Language } from "../../../../i18n";
import type { Trip } from "../../vehicle-trips/types/trip";
import { formatTripListDay } from "../../vehicle-trips/utils/formatTripListDay";
import { localizeTripViewText } from "../../vehicle-trips/utils/tripViewLocalization";
import { formatVehicleNumber } from "../../../../utils/format";

const WEEKDAYS_SHORT_TE = ["ఆది", "సోమ", "మంగళ", "బుధ", "గురు", "శుక్ర", "శని"] as const;
const WEEKDAYS_LONG_TE = ["ఆదివారం", "సోమవారం", "మంగళవారం", "బుధవారం", "గురువారం", "శుక్రవారం", "శనివారం"] as const;
const MONTHS_SHORT_TE = ["జన", "ఫిబ్ర", "మార్చి", "ఏప్రి", "మే", "జూన్", "జూలై", "ఆగ", "సెప్టెం", "అక్టో", "నవం", "డిసెం"] as const;

function parseUtcDate(tripDate: string | null | undefined): Date | null {
  if (tripDate == null) return null;
  const raw = String(tripDate).trim();
  if (!raw) return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (!iso) return null;
  const year = Number(iso[1]);
  const month = Number(iso[2]);
  const day = Number(iso[3]);
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (
    utc.getUTCFullYear() !== year ||
    utc.getUTCMonth() !== month - 1 ||
    utc.getUTCDate() !== day
  ) {
    return null;
  }
  return utc;
}

export function formatRateEntryDay(tripDate: string | null | undefined, language: Language): string {
  if (language !== "te") return formatTripListDay(tripDate);
  const utc = parseUtcDate(tripDate);
  if (!utc) return "—";
  return `${WEEKDAYS_SHORT_TE[utc.getUTCDay()]}, ${utc.getUTCDate()} ${MONTHS_SHORT_TE[utc.getUTCMonth()]} ${utc.getUTCFullYear()}`;
}

export function formatRateEntryWeekday(tripDate: string | null | undefined, language: Language): string {
  const utc = parseUtcDate(tripDate);
  if (!utc) return "—";
  if (language === "te") return WEEKDAYS_LONG_TE[utc.getUTCDay()];
  return new Intl.DateTimeFormat("en-IN", { weekday: "long", timeZone: "UTC" }).format(utc);
}

export function formatRateEntryTripDate(tripDate: string | null | undefined): string {
  const utc = parseUtcDate(tripDate);
  if (!utc) return String(tripDate || "—");
  return `${String(utc.getUTCDate()).padStart(2, "0")}-${String(utc.getUTCMonth() + 1).padStart(2, "0")}-${utc.getUTCFullYear()}`;
}

export function displayRateEntryName(value: string | null | undefined, language: Language): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "—";
  return language === "te" ? localizeTripViewText(raw, language) : raw;
}

export function displayRateEntryShopName(value: string | null | undefined, language: Language): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "—";
  return language === "te" ? localizeTripViewText(raw, language, { cleanShopCode: true }) : raw;
}

function normalizeSearchValue(value: unknown): string {
  return String(value ?? "")
    .toLocaleLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function compactSearchValue(value: unknown): string {
  return normalizeSearchValue(value).replace(/[\s._/-]+/g, "");
}

function searchVariants(value: unknown, language: Language): string[] {
  const raw = String(value ?? "").trim();
  if (!raw) return [];
  const variants = [raw, formatVehicleNumber(raw)];
  if (language === "te") variants.push(localizeTripViewText(raw, language));
  return Array.from(new Set(variants.flatMap((item) => [normalizeSearchValue(item), compactSearchValue(item)]))).filter(Boolean);
}

export function matchesRateEntrySearch(trip: Trip, query: string, language: Language): boolean {
  const queries = searchVariants(query, language);
  if (queries.length === 0) return true;

  const day = formatRateEntryDay(trip.tripDate, language);
  const fields = [
    trip.tripNo,
    trip.tripDate,
    day,
    trip.vehicleNo,
    formatVehicleNumber(trip.vehicleNo),
    trip.supervisorName,
    displayRateEntryName(trip.supervisorName, language),
    trip.sourceFarm,
    displayRateEntryName(trip.sourceFarm, language),
    trip.totalShops,
    trip.totalBirds,
    trip.totalWeight,
    Number(trip.totalWeight || 0).toFixed(2),
  ].flatMap((item) => [normalizeSearchValue(item), compactSearchValue(item)]);

  return queries.some((needle) => fields.some((field) => field.includes(needle)));
}
