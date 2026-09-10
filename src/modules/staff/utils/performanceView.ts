// src/modules/staff/utils/performanceView.ts
//
// ============================================================================
// PERFORMANCE VIEW HELPERS — shared formatting + grade-story composition
// ============================================================================
// ONE place that turns a `PerformanceAssessment` into drawer-ready, translated
// content and turns raw API numbers into EN-IN formatted strings with the
// correct unit (₹ / km / L / %). Both performance pages and the drawer render
// exclusively through these helpers, so the same data can never be formatted
// or explained two different ways in two components.
// ============================================================================

import type { useI18n } from "../../../i18n";
import type {
  DrawerFactor,
  DrawerImprovement,
} from "../components/performance/PerformanceDrawer";
import type {
  DriverMetricKey,
  MetricBand,
  PerformanceAssessment,
  PerformanceGrade,
  SupervisorMetricKey,
} from "./performanceGrading";
import type {
  DriverPerformanceRow,
  PerformanceRecentTrip,
  SupervisorPerformanceRow,
} from "../types/performance";
import { parseBusinessDate } from "../../../utils/businessDate";

type Translate = ReturnType<typeof useI18n>["t"];

/* -------------------------------------------------------------------------- */
/* Number formatting (EN-IN, tabular-safe)                                    */
/* -------------------------------------------------------------------------- */

/** 12,345 */
export const formatCount = (value: number | null | undefined): string =>
  Number(value ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });

/** 12,345.5 */
export const formatDecimal = (value: number | null | undefined, digits = 1): string =>
  Number(value ?? 0).toLocaleString("en-IN", { maximumFractionDigits: digits });

/** ₹12,345 or ₹12,345.50 */
export const formatMoney = (value: number | null | undefined, digits = 0): string =>
  `₹${Number(value ?? 0).toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  })}`;

/** Derived averages (mileage, cost/km, rates) are meaningless as plain 0. */
export const isMeasurable = (value: number | null | undefined): boolean =>
  Number(value ?? 0) > 0;

/** 12,345 km */
export const formatKm = (value: number | null | undefined): string =>
  `${formatCount(value)} km`;

/** 1,234.5 L */
export const formatLitres = (value: number | null | undefined): string =>
  `${formatDecimal(value, 1)} L`;

/** 5.2 km/L — `—` when no fuel data makes the value unmeasurable. */
export const formatMileage = (value: number | null | undefined): string =>
  isMeasurable(value) ? `${formatDecimal(value, 1)} km/L` : "—";

/** ₹17.5/km — `—` when unmeasurable. */
export const formatCostPerKm = (value: number | null | undefined): string =>
  isMeasurable(value) ? `${formatMoney(value, 1)}/km` : "—";

/** 0.42% */
export const formatPercent = (value: number | null | undefined, digits = 2): string =>
  `${formatDecimal(value, digits)}%`;

/** 123.4 kg */
export const formatKg = (value: number | null | undefined): string =>
  `${formatDecimal(value, 1)} kg`;

/** "—" for unmeasurable values, otherwise the unit-correct formatting. */
export function formatMetric(
  key: DriverMetricKey | SupervisorMetricKey,
  value: number | null | undefined,
): string {
  switch (key) {
    case "trips":
      return formatCount(value);
    case "distance":
      return formatKm(value);
    case "mileage":
      return formatMileage(value);
    case "costPerKm":
      return formatCostPerKm(value);
    case "shops":
      return formatCount(value);
    case "mortalityRate":
      return formatPercent(value);
    case "weightLoss":
      return formatKg(value);
    default:
      return formatCount(value);
  }
}

/** Whether a factor's "better" direction is higher or lower. */
export function metricBetter(
  key: DriverMetricKey | SupervisorMetricKey,
): "higher" | "lower" {
  return key === "costPerKm" || key === "mortalityRate" || key === "weightLoss"
    ? "lower"
    : "higher";
}

/* -------------------------------------------------------------------------- */
/* Grade badge                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Presentation tone per grade. Emerald = brand positive scale, slate =
 * neutral — drawn from the global semantic palette (no new colors). The label
 * itself always carries the meaning (never colour alone). `null` (unranked
 * under the one-Outstanding/one-Excellent/one-Good policy) renders as a quiet
 * neutral chip so it can never be mistaken for an award.
 */
export function gradeBadgeClass(grade: PerformanceGrade | null): string {
  switch (grade) {
    case "OUTSTANDING":
      return "bg-emerald-600 text-white border-emerald-600";
    case "EXCELLENT":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "GOOD":
      return "bg-slate-100 text-slate-600 border-slate-200";
    default:
      return "bg-white text-slate-400 border-slate-200 border-dashed";
  }
}

export function translateGrade(grade: PerformanceGrade | null, t: Translate): string {
  return grade == null ? t("staff.perf.grade.unranked") : t(`staff.perf.grade.${grade}`);
}

/* -------------------------------------------------------------------------- */
/* Grade story (drawer)                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Translate every metric factor into one explanation sentence. Unavailable
 * metrics (no data, or no fleet baseline) state that plainly instead of
 * inventing a comparison.
 */
export function buildDrawerFactors<
  K extends DriverMetricKey | SupervisorMetricKey,
>(
  assessment: PerformanceAssessment<K>,
  t: Translate,
): DrawerFactor[] {
  return assessment.factors.map((factor) => {
    const band: MetricBand = factor.band;
    const label = t(`staff.perf.factor.${factor.key}`);
    let text: string;
    if (band === "unavailable" || factor.baseline == null || factor.value == null) {
      text = t("staff.perf.factor.no_baseline");
    } else {
      text = t(`staff.perf.factor.${band}.${metricBetter(factor.key)}`, {
        label,
        value: formatMetric(factor.key, factor.value),
        baseline: formatMetric(factor.key, factor.baseline),
      });
    }
    return { key: factor.key, band, text };
  });
}

/**
 * Improvement areas — ONLY weak metrics, each with its practical
 * recommendation. Unavailable metrics are intentionally excluded.
 */
export function buildDrawerImprovements<
  K extends DriverMetricKey | SupervisorMetricKey,
>(
  assessment: PerformanceAssessment<K>,
  t: Translate,
): DrawerImprovement[] {
  return assessment.improvements.map((improvement) => ({
    key: improvement.metricKey,
    title: t(`staff.perf.improve.${improvement.metricKey}.title`),
    recommendation: t(`staff.perf.improve.${improvement.metricKey}.recommend`),
  }));
}


/* -------------------------------------------------------------------------- */
/* Trip race — which recent trips lagged the person's own period average      */
/* -------------------------------------------------------------------------- */
// Self-relative by design: the drawer's trip detail only loads alongside a
// person-filtered response, where no fleet peers exist to compare against.
// A trip is OFF PACE when it is materially worse than the person's OWN period
// average — never compared to invented thresholds.

export type StaffPerformanceKind = "drivers" | "supervisors";

export interface TripRaceEntry {
  trip: PerformanceRecentTrip;
  offPace: boolean;
  /** Translated headline figures shown on the pace chip. */
  headline: string;
  /** Translated one-line explanation for the lagging-trip card. */
  story: string;
}

function tripMortalityRate(trip: PerformanceRecentTrip): number {
  return trip.totalBirdsDelivered > 0
    ? (trip.totalMortality / trip.totalBirdsDelivered) * 100
    : 0;
}

function tripWeightLossPct(trip: PerformanceRecentTrip): number {
  return trip.totalDeliveredWeight > 0
    ? (trip.weightLoss / trip.totalDeliveredWeight) * 100
    : 0;
}

/**
 * Pace for each recent trip (worst first). Supervisors: mortality rate and
 * weight-loss % above their own period averages. Drivers: distance below
 * their own per-trip average (the "short" trips behind a weak distance).
 * `t` produces the translated explanation shown on the lagging-trip card.
 */
export function buildTripRace(
  kind: StaffPerformanceKind,
  trips: readonly PerformanceRecentTrip[],
  row: DriverPerformanceRow | SupervisorPerformanceRow,
  t: Translate,
): TripRaceEntry[] {
  if (trips.length === 0) return [];
  const entries: TripRaceEntry[] = trips.map((trip) => {
    if (kind === "supervisors") {
      const supervisor = row as SupervisorPerformanceRow;
      const mRate = tripMortalityRate(trip);
      const lossPct = tripWeightLossPct(trip);
      // The row's weightLoss is an ABSOLUTE kg figure — derive the person's
      // own loss PERCENTAGE so trip % is compared against a like-for-like %.
      const ownLossPct =
        supervisor.weight > 0 ? (supervisor.weightLoss / supervisor.weight) * 100 : 0;
      const off =
        (trip.totalBirdsDelivered > 0 &&
          supervisor.mortalityRate > 0 &&
          mRate > supervisor.mortalityRate) ||
        (trip.totalDeliveredWeight > 0 &&
          ownLossPct > 0 &&
          lossPct > ownLossPct);
      return {
        trip,
        offPace: off,
        headline: `${formatDecimal(mRate, 2)}% · ${formatDecimal(lossPct, 2)}%`,
        story: t("staff.perf.trips.sup_story", {
          m: formatDecimal(mRate, 2),
          pm: formatDecimal(supervisor.mortalityRate, 2),
          l: formatDecimal(lossPct, 2),
          pl: formatDecimal(ownLossPct, 2),
        }),
      };
    }
    const driver = row as DriverPerformanceRow;
    const avg = driver.avgDistancePerTrip;
    const off = avg > 0 && trip.totalKm < avg;
    const pct = off ? Math.round((1 - trip.totalKm / avg) * 100) : 0;
    return {
      trip,
      offPace: off,
      headline:
        avg > 0
          ? `${formatCount(trip.totalKm)} / ${formatDecimal(avg, 0)} km`
          : `${formatCount(trip.totalKm)} km`,
      story: t("staff.perf.trips.driver_story", {
        km: formatCount(trip.totalKm),
        avg: formatDecimal(avg, 0),
        pct,
      }),
    };
  });
  // Off-pace first, then newest first — the lagging trips lead the story.
  return entries.sort((a, b) => {
    if (a.offPace !== b.offPace) return a.offPace ? -1 : 1;
    return b.trip.tripDate.localeCompare(a.trip.tripDate);
  });
}

/** Trip numbers that are off pace (worst first, capped). */
export function offPaceTripNos(entries: readonly TripRaceEntry[]): string[] {
  return entries.filter((entry) => entry.offPace).map((entry) => entry.trip.tripNo);
}

/* -------------------------------------------------------------------------- */
/* Chart ↔ trips: which recent trips fall inside a weekly bucket              */
/* -------------------------------------------------------------------------- */

export interface WeekTripRow {
  tripNo: string;
  /** Translated per-metric summary for the chart tooltip. */
  summary: string;
}

/**
 * Recent trips that belong to the week ending `weekEnd` (a Mon–Sat bucket).
 * Uses ONLY trips the API already returned (`detail.recentTrips`), so the
 * mapping is real — when no detail loaded, the list is simply empty.
 */
export function recentTripsForWeek(
  weekEnd: string | number,
  trips: readonly PerformanceRecentTrip[],
  kind: StaffPerformanceKind,
): WeekTripRow[] {
  const end = parseBusinessDate(String(weekEnd));
  if (!end || trips.length === 0) return [];
  const endMs = end.getTime();
  const DAY = 86_400_000;
  const rows: WeekTripRow[] = [];
  for (const trip of trips) {
    const date = parseBusinessDate(trip.tripDate);
    if (!date) continue;
    // Sundays sit outside every Mon–Sat bucket; consistent with the rest of
    // the app they belong to the reporting week that ended the day before.
    const adjusted = date.getDay() === 0 ? date.getTime() - DAY : date.getTime();
    const offset = Math.round((endMs - adjusted) / DAY);
    if (offset < 0 || offset > 5) continue; // outside this Mon–Sat bucket
    rows.push({
      tripNo: trip.tripNo,
      summary:
        kind === "drivers"
          ? `${formatCount(trip.totalKm)} km · ${formatCount(trip.totalShops)}`
          : `${formatCount(trip.totalBirdsDelivered)} · ${formatDecimal(tripMortalityRate(trip), 1)}%`,
    });
  }
  return rows;
}
