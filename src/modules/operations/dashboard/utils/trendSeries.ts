// src/modules/operations/dashboard/utils/trendSeries.ts
// Bucketing + formatting for the Operational Trends chart.
//
// Pure data, no JSX: the chart component stays fast-refresh friendly and the
// maths can be exercised without a browser.

export interface TrendPoint {
  date: string;
  trips: number;
  weight: number;
  mortality?: number;
}

export type Granularity = "daily" | "weekly" | "monthly";

export interface Bucket {
  /** Bucket key — also the X-axis category ("2026-08-10", "2026-W33", "2026-8"). */
  date: string;
  trips: number;
  weight: number;
  mortality: number;
  /** Derived: birds lost per trip (the line on the counts axis). */
  birdsPerTrip: number;
  /** Derived: kilograms delivered per trip. */
  kgPerTrip: number;
  /** 3-bucket trailing average of weight; null for the first two buckets. */
  movingAvg: number | null;
  /** Ordering key (sorts week/month keys chronologically). */
  sortKey: string;
}

export interface TrendSummary {
  trips: number;
  weight: number;
  mortality: number;
  avgTrips: number;
  avgWeight: number;
  birdsPerTrip: number;
  busiest: Bucket | null;
}

const num = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

/* ------------------------------------------------------------------ */
/*  Formatting                                                         */
/* ------------------------------------------------------------------ */

/** 7499.65 → "7,500" (no unit — callers decide). */
export const plain = (value: number, digits = 0): string =>
  num(value).toLocaleString("en-IN", { minimumFractionDigits: digits, maximumFractionDigits: digits });

/** 7499.65 → "7,500 kg"; 516245 → "5.16 L kg". */
export const compactKg = (value: number): string => {
  const v = num(value);
  if (Math.abs(v) >= 100_000) return `${(v / 100_000).toFixed(2)} L kg`;
  return `${plain(Math.round(v))} kg`;
};

/** Axis ticks only: 0 / 2.5k / 5k / 7.5k. */
export const tickKg = (value: number): string => {
  const v = num(value);
  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k`;
  return plain(Math.round(v));
};

/** +12.5% / -4.0% — used for the tooltip's change arrows. */
export const pct = (value: number): string => `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;

const monthName = (monthIndex: number): string =>
  new Date(2026, monthIndex, 1).toLocaleDateString("en-IN", { month: "short" });

/** "2026-08-10" → "10 Aug"; "2026-W33" → "W33"; "2026-8" → "Aug 2026". */
export function formatBucket(raw: string): string {
  if (!raw) return "";
  if (raw.includes("W")) return raw.slice(raw.indexOf("W"));
  if (/^\d{4}-\d{1,2}$/.test(raw)) {
    const [year, month] = raw.split("-").map(Number);
    return `${monthName(month - 1)} ${year}`;
  }
  const date = new Date(`${raw}T12:00:00`);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }).replace(",", "");
}

/** Long form for the tooltip title: "Mon, 10 Aug 2026". */
export function formatBucketLong(raw: string): string {
  if (raw.includes("W")) {
    const week = raw.slice(raw.indexOf("W") + 1);
    return `${raw.slice(0, 4)} · week ${Number(week)}`;
  }
  if (/^\d{4}-\d{1,2}$/.test(raw)) {
    const [year, month] = raw.split("-").map(Number);
    return new Date(year, month - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  }
  const date = new Date(`${raw}T12:00:00`);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleDateString("en-IN", {
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

/** Sum the daily rows into day / week / month buckets, oldest first. */
export function aggregate(data: TrendPoint[], granularity: Granularity): Bucket[] {
  const groups = new Map<string, { trips: number; weight: number; mortality: number; sortKey: string }>();

  for (const point of data) {
    const { key, sortKey } = bucketOf(point.date, granularity);
    const current = groups.get(key) ?? { trips: 0, weight: 0, mortality: 0, sortKey };
    current.trips += num(point.trips);
    current.weight += num(point.weight);
    current.mortality += num(point.mortality);
    groups.set(key, current);
  }

  const buckets: Bucket[] = [...groups.entries()]
    .sort((a, b) => a[1].sortKey.localeCompare(b[1].sortKey))
    .map(([key, value]) => ({
      date: key,
      trips: value.trips,
      weight: value.weight,
      mortality: value.mortality,
      birdsPerTrip: value.trips > 0 ? value.mortality / value.trips : 0,
      kgPerTrip: value.trips > 0 ? value.weight / value.trips : 0,
      movingAvg: null,
      sortKey: value.sortKey,
    }));

  // 3-bucket trailing average of weight — smooths a spiky daily series so the
  // direction of travel reads without a statistics lesson.
  buckets.forEach((bucket, index) => {
    if (index < 2) return;
    const window = buckets.slice(index - 2, index + 1);
    bucket.movingAvg = window.reduce((sum, item) => sum + item.weight, 0) / window.length;
  });

  return buckets;
}

/** Footer numbers for the whole (bucketed) period. */
export function summarise(buckets: Bucket[]): TrendSummary {
  const trips = buckets.reduce((sum, b) => sum + b.trips, 0);
  const weight = buckets.reduce((sum, b) => sum + b.weight, 0);
  const mortality = buckets.reduce((sum, b) => sum + b.mortality, 0);
  const days = buckets.length || 1;
  return {
    trips,
    weight,
    mortality,
    avgTrips: trips / days,
    avgWeight: weight / days,
    birdsPerTrip: trips > 0 ? mortality / trips : 0,
    busiest: buckets.reduce<Bucket | null>(
      (best, bucket) => (best === null || bucket.trips > best.trips ? bucket : best),
      null
    ),
  };
}

/** sortKey → the bucket before it; powers the tooltip's change arrows. */
export function previousBySortKey(buckets: Bucket[]): Map<string, Bucket> {
  const map = new Map<string, Bucket>();
  buckets.forEach((bucket, index) => {
    if (index > 0) map.set(bucket.sortKey, buckets[index - 1]);
  });
  return map;
}
