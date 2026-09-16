// src/modules/operations/dashboard/utils/trendSeries.ts
// Bucketing + formatting for the Operational Trends chart.
//
// Pure data, no JSX: the chart component stays fast-refresh friendly and the
// maths can be exercised without a browser.

export type Granularity = "daily" | "weekly" | "monthly";

const num = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

/* ------------------------------------------------------------------ */
/*  Formatting                                                         */
/* ------------------------------------------------------------------ */

/** 7499.65 → "7,500" (no unit — callers decide). */
export const plain = (value: number, digits = 0, locale = "en-IN"): string =>
  num(value).toLocaleString(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits });

/** 7499.65 → "7,500 kg"; 516245 → "5.16 L kg" ("5.16 లక్షల kg" in Telugu). */
export const compactKg = (value: number, locale = "en-IN"): string => {
  const v = num(value);
  if (Math.abs(v) >= 100_000) {
    const lakh = locale.startsWith("te") ? "లక్షల" : "L";
    return `${(v / 100_000).toFixed(2)} ${lakh} kg`;
  }
  return `${plain(Math.round(v), 0, locale)} kg`;
};

/** Axis ticks only: 0 / 2.5k / 5k / 7.5k. */
export const tickKg = (value: number, locale = "en-IN"): string => {
  const v = num(value);
  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k`;
  return plain(Math.round(v), 0, locale);
};

const monthName = (monthIndex: number, locale = "en-IN"): string =>
  new Date(2026, monthIndex, 1).toLocaleDateString(locale, { month: "short" });

const toLocalDate = (date: Date): Date =>
  new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 12);

const parseLocalDate = (value?: string): Date | null => {
  if (!value) return null;
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
};

const fullDate = (date: Date, locale = "en-IN"): string =>
  date.toLocaleDateString(locale, { day: "2-digit", month: "short", year: "numeric" }).replace(",", "");

function isoWeekRange(raw: string): { week: number; start: Date; end: Date } | null {
  const match = /^(\d{4})-W(\d{1,2})$/.exec(raw);
  if (!match) return null;
  const year = Number(match[1]);
  const week = Number(match[2]);
  if (!Number.isFinite(year) || !Number.isFinite(week) || week < 1 || week > 53) return null;

  // ISO week 1 is the week containing 4 Jan; weeks start on Monday.
  const startUtc = new Date(Date.UTC(year, 0, 4));
  const dayNumber = startUtc.getUTCDay() || 7;
  startUtc.setUTCDate(startUtc.getUTCDate() - dayNumber + 1 + (week - 1) * 7);
  const endUtc = new Date(startUtc);
  endUtc.setUTCDate(startUtc.getUTCDate() + 6);
  return { week, start: toLocalDate(startUtc), end: toLocalDate(endUtc) };
}

function monthRange(raw: string): { start: Date; end: Date } | null {
  const match = /^(\d{4})-(\d{1,2})$/.exec(raw);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return null;
  return {
    start: new Date(year, month - 1, 1, 12),
    end: new Date(year, month, 0, 12),
  };
}

export function formatBucketDateRange(
  raw: string,
  locale = "en-IN",
  clipFrom?: string,
  clipTo?: string,
): { start: string; end: string } | null {
  const baseRange = raw.includes("W") ? isoWeekRange(raw) : monthRange(raw);
  if (!baseRange) return null;

  const clipStart = parseLocalDate(clipFrom);
  const clipEnd = parseLocalDate(clipTo);
  const start = clipStart && clipStart > baseRange.start ? clipStart : baseRange.start;
  const end = clipEnd && clipEnd < baseRange.end ? clipEnd : baseRange.end;
  if (start > end) return null;

  return {
    start: fullDate(start, locale),
    end: fullDate(end, locale),
  };
}

/** "2026-08-10" → "10 Aug"; "2026-W33" → "W33" ("వా33"); "2026-9" → "Sep 2026". */
export function formatBucket(raw: string, locale = "en-IN"): string {
  if (!raw) return "";
  if (raw.includes("W")) {
    const week = raw.slice(raw.indexOf("W"));
    return locale.startsWith("te") ? `వా${week.slice(1)}` : week;
  }
  if (/^\d{4}-\d{1,2}$/.test(raw)) {
    const [year, month] = raw.split("-").map(Number);
    return `${monthName(month - 1, locale)} ${year}`;
  }
  const date = new Date(`${raw}T12:00:00`);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleDateString(locale, { day: "2-digit", month: "short" }).replace(",", "");
}

/** Long form for the tooltip title: "Mon, 10 Aug 2026" — localised. */
export function formatBucketLong(raw: string, locale = "en-IN"): string {
  const telugu = locale.startsWith("te");
  if (raw.includes("W")) {
    const week = raw.slice(raw.indexOf("W") + 1);
    return `${raw.slice(0, 4)} · ${telugu ? "వారం" : "week"} ${Number(week)}`;
  }
  if (/^\d{4}-\d{1,2}$/.test(raw)) {
    const [year, month] = raw.split("-").map(Number);
    return new Date(year, month - 1, 1).toLocaleDateString(locale, { month: "long", year: "numeric" });
  }
  const date = new Date(`${raw}T12:00:00`);
  if (Number.isNaN(date.getTime())) return raw;
  if (telugu) {
    // "సోమ, 07 సెప్టెం 2026" — weekday first, as Telugu reads it.
    const parts = new Intl.DateTimeFormat(locale, {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).formatToParts(date);
    const part = (type: string) => parts.find((piece) => piece.type === type)?.value ?? "";
    return `${part("weekday")}, ${part("day")} ${part("month")} ${part("year")}`;
  }
  return date.toLocaleDateString(locale, {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/* ------------------------------------------------------------------ */
/*  Bucketing                                                          */
/* ------------------------------------------------------------------ */

export function bucketOf(dateStr: string, granularity: Granularity): { key: string; sortKey: string } {
  const date = new Date(`${dateStr}T12:00:00`);
  if (Number.isNaN(date.getTime())) return { key: dateStr, sortKey: dateStr };

  if (granularity === "daily") return { key: dateStr, sortKey: dateStr };

  if (granularity === "monthly") {
    const month = String(date.getMonth() + 1).padStart(2, "0");
    return { key: `${date.getFullYear()}-${date.getMonth() + 1}`, sortKey: `${date.getFullYear()}-${month}` };
  }

  // Weekly: ISO-8601 week number, so a bucket never straddles a year wrongly.
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNumber = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNumber);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((target.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  const key = `${target.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
  return { key, sortKey: key };
}

/** sortKey → the bucket before it; powers the tooltip's change arrows. */
export function previousBySortKey<T extends { sortKey: string }>(buckets: T[]): Map<string, T> {
  const map = new Map<string, T>();
  buckets.forEach((bucket, index) => {
    if (index > 0) map.set(bucket.sortKey, buckets[index - 1]);
  });
  return map;
}

/* ------------------------------------------------------------------ */
/*  Operational buckets — farm / delivered / mortality / loss          */
/* ------------------------------------------------------------------ */

/** The fields the Operational Trends chart needs from one completed trip. */
export interface OperationalRow {
  tripDate: string;
  farmBirds: number;
  farmWeight: number;
  deliveredBirds: number;
  deliveredWeight: number;
  mortalityCount: number;
  mortalityWeight: number;
  weightLoss: number;
}

export interface OperationalRange {
  /** Inclusive ISO calendar endpoints of the global/custom dashboard range. */
  fromDate?: string;
  toDate?: string;
}

export interface OperationalBucket {
  /** Bucket key — "2026-09-12", "2026-W37" or "2026-9". */
  date: string;
  sortKey: string;
  trips: number;
  farmBirds: number;
  farmWeight: number;
  deliveredBirds: number;
  deliveredWeight: number;
  mortalityCount: number;
  mortalityWeight: number;
  weightLoss: number;
  /** Shares of the farm weight, in percent. */
  deliveredPct: number;
  mortalityPct: number;
  weightLossPct: number;
  /** Mortality as a share of the birds loaded, in percent. */
  mortalityBirdPct: number;
  kgPerTrip: number;
  birdsPerTrip: number;
}

export interface OperationalSummary {
  trips: number;
  farmWeight: number;
  deliveredWeight: number;
  mortalityWeight: number;
  mortalityCount: number;
  weightLoss: number;
  avgTrips: number;
  avgFarmWeight: number;
  /** Percentages over the whole period. */
  deliveredPct: number;
  mortalityPct: number;
  weightLossPct: number;
  busiest: OperationalBucket | null;
}

const share = (part: number, whole: number): number => (whole > 0 ? (part / whole) * 100 : 0);

/**
 * Whether a trip belongs in an inclusive dashboard window. The trends API is
 * already asked for these exact dates; retaining this guard makes the chart
 * correct even if a proxy/cache ever supplies an over-broad response.
 */
export function isOperationalRowInRange(
  tripDate: string,
  { fromDate, toDate }: OperationalRange = {}
): boolean {
  const day = String(tripDate).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  return (!fromDate || day >= fromDate) && (!toDate || day <= toDate);
}

/** Bucket completed trips into day / week / month rows, oldest first. */
export function aggregateOperational(
  rows: OperationalRow[],
  granularity: Granularity,
  range: OperationalRange = {}
): OperationalBucket[] {
  type Acc = {
    trips: number;
    farmBirds: number;
    farmWeight: number;
    deliveredBirds: number;
    deliveredWeight: number;
    mortalityCount: number;
    mortalityWeight: number;
    weightLoss: number;
    sortKey: string;
  };
  const groups = new Map<string, Acc>();

  for (const row of rows) {
    if (!isOperationalRowInRange(row.tripDate, range)) continue;
    const { key, sortKey } = bucketOf(String(row.tripDate).slice(0, 10), granularity);
    const acc =
      groups.get(key) ??
      {
        trips: 0,
        farmBirds: 0,
        farmWeight: 0,
        deliveredBirds: 0,
        deliveredWeight: 0,
        mortalityCount: 0,
        mortalityWeight: 0,
        weightLoss: 0,
        sortKey,
      };
    acc.trips += 1;
    acc.farmBirds += num(row.farmBirds);
    acc.farmWeight += num(row.farmWeight);
    acc.deliveredBirds += num(row.deliveredBirds);
    acc.deliveredWeight += num(row.deliveredWeight);
    acc.mortalityCount += num(row.mortalityCount);
    acc.mortalityWeight += num(row.mortalityWeight);
    acc.weightLoss += num(row.weightLoss);
    groups.set(key, acc);
  }

  return [...groups.entries()]
    .sort((a, b) => a[1].sortKey.localeCompare(b[1].sortKey))
    .map(([key, acc]) => ({
      date: key,
      sortKey: acc.sortKey,
      trips: acc.trips,
      farmBirds: acc.farmBirds,
      farmWeight: acc.farmWeight,
      deliveredBirds: acc.deliveredBirds,
      deliveredWeight: acc.deliveredWeight,
      mortalityCount: acc.mortalityCount,
      mortalityWeight: acc.mortalityWeight,
      weightLoss: acc.weightLoss,
      deliveredPct: share(acc.deliveredWeight, acc.farmWeight),
      mortalityPct: share(acc.mortalityWeight, acc.farmWeight),
      weightLossPct: share(acc.weightLoss, acc.farmWeight),
      mortalityBirdPct: share(acc.mortalityCount, acc.farmBirds),
      kgPerTrip: acc.trips > 0 ? acc.farmWeight / acc.trips : 0,
      birdsPerTrip: acc.trips > 0 ? acc.mortalityCount / acc.trips : 0,
    }));
}

/** Period totals for the footer. */
export function summariseOperational(buckets: OperationalBucket[]): OperationalSummary {
  const totals = buckets.reduce(
    (acc, b) => ({
      trips: acc.trips + b.trips,
      farmBirds: acc.farmBirds + b.farmBirds,
      farmWeight: acc.farmWeight + b.farmWeight,
      deliveredWeight: acc.deliveredWeight + b.deliveredWeight,
      mortalityCount: acc.mortalityCount + b.mortalityCount,
      mortalityWeight: acc.mortalityWeight + b.mortalityWeight,
      weightLoss: acc.weightLoss + b.weightLoss,
    }),
    { trips: 0, farmBirds: 0, farmWeight: 0, deliveredWeight: 0, mortalityCount: 0, mortalityWeight: 0, weightLoss: 0 }
  );
  const days = buckets.length || 1;
  return {
    trips: totals.trips,
    farmWeight: totals.farmWeight,
    deliveredWeight: totals.deliveredWeight,
    mortalityWeight: totals.mortalityWeight,
    mortalityCount: totals.mortalityCount,
    weightLoss: totals.weightLoss,
    avgTrips: totals.trips / days,
    avgFarmWeight: totals.farmWeight / days,
    deliveredPct: share(totals.deliveredWeight, totals.farmWeight),
    mortalityPct: share(totals.mortalityWeight, totals.farmWeight),
    weightLossPct: share(totals.weightLoss, totals.farmWeight),
    busiest: buckets.reduce<OperationalBucket | null>(
      (best, bucket) => (best === null || bucket.trips > best.trips ? bucket : best),
      null
    ),
  };
}

/**
 * Granularity that matches the global calendar: a week-long range reads best
 * day by day, a month week by week and a quarter month by month. This is the
 * DEFAULT only — the chip row lets the reader override it.
 */
export function granularityForRange(days: number | undefined): Granularity {
  if (!days || !Number.isFinite(days) || days <= 0) return "weekly";
  if (days <= 21) return "daily";
  if (days <= 70) return "weekly";
  return "monthly";
}
