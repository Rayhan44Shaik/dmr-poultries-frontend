// src/modules/staff/utils/performanceGrading.ts
//
// ============================================================================
// PERFORMANCE GRADING — presentation-level scoring for the performance pages
// ============================================================================
// ONE deterministic scoring helper shared by the Driver Performance page, the
// Supervisor Performance page and the details drawer. The same dataset for the
// same period ALWAYS produces the same grades: no randomness, no timestamps,
// no tie to render order beyond the stable input array.
//
// IMPORTANT — WHAT THIS IS NOT
//   There is no official backend scoring rule for these grades (verified
//   against the repository: the API returns raw aggregates only, no grade or
//   threshold fields, and no scoring constants exist anywhere in the codebase).
//   The bands below are therefore a FRONTEND PRESENTATION CONFIGURATION — a
//   relative, peer-median comparison inside the currently loaded dataset — and
//   must NOT be presented or relied upon as payroll/business policy.
//
// METHOD (deterministic)
//   1. Baselines: for each metric, the median is taken over "participating"
//      rows (rows with real activity) that have a measurable (> 0) value.
//      Median is used because it is robust to a single extreme outlier.
//   2. Bands per metric, relative to that median (tolerance ±10%):
//        higher-is-better → strong ≥ median×1.10 · weak ≤ median×0.90
//        lower-is-better  → strong ≤ median×0.90 · weak ≥ median×1.10
//        everything else  → fair.  Unmeasurable (0/absent) → unavailable.
//   3. Grade from the available bands:
//        OUTSTANDING — ≥2 metrics measured, none weak, ALL strong
//        EXCELLENT   — none weak, at least one strong
//        GOOD        — everything else (at fleet level / any weak metric /
//                      nothing measurable). GOOD is the floor: the page shows
//                      exactly these three grades and no lower one.
//   4. Fewer than 2 participating peers → no meaningful comparison exists, so
//      every band is 'unavailable' and the grade is neutral GOOD (the drawer
//      explains this instead of implying a measurement).
//
//   Improvement areas are derived ONLY from weak bands (never from
//   unavailable metrics), each mapped to one practical recommendation.
// ============================================================================

import type {
  DriverPerformanceRow,
  SupervisorPerformanceRow,
} from "../types/performance";

export type PerformanceGrade = "OUTSTANDING" | "EXCELLENT" | "GOOD";
export type MetricBand = "strong" | "fair" | "weak" | "unavailable";

export type DriverMetricKey = "trips" | "distance" | "mileage" | "costPerKm";
export type SupervisorMetricKey =
  | "shops"
  | "trips"
  | "mortalityRate"
  | "weightLoss";

/** Band tolerance vs the peer median (±10%). */
export const GRADE_BAND_TOLERANCE = 0.1;
/** Minimum participating peers required for a comparative grade. */
export const GRADE_MIN_PEERS = 2;

export interface MetricAssessment<K extends string = string> {
  key: K;
  band: MetricBand;
  /** Actual metric value for the row (`null` when unmeasurable). */
  value: number | null;
  /** Peer median used for the comparison (`null` when no baseline exists). */
  baseline: number | null;
}

export interface ImprovementItem<K extends string = string> {
  /** Metric that is behind the fleet — drives the i18n copy + icon. */
  metricKey: K;
  value: number | null;
  baseline: number | null;
}

export interface PerformanceAssessment<K extends string = string> {
  /** Awarded grade under the top-three policy — `null` when unranked. */
  grade: PerformanceGrade | null;
  /** 1 = Outstanding, 2 = Excellent, 3 = Good; `null` when unranked. */
  awardRank: 1 | 2 | 3 | null;
  /** True when at least one metric could actually be compared. */
  scored: boolean;
  factors: Array<MetricAssessment<K>>;
  improvements: Array<ImprovementItem<K>>;
}

/** Band-level result before the award policy caps it (internal + tests). */
export interface BandAssessment<K extends string = string> {
  grade: PerformanceGrade;
  scored: boolean;
  factors: Array<MetricAssessment<K>>;
  improvements: Array<ImprovementItem<K>>;
}

/* -------------------------------------------------------------------------- */
/* Shared maths                                                               */
/* -------------------------------------------------------------------------- */

/** Median of the measurable values (> 0). `null` when fewer than `minPeers`. */
function medianOf(values: number[], minPeers: number): number | null {
  const usable = values.filter((v) => Number.isFinite(v) && v > 0).sort((a, b) => a - b);
  if (usable.length < minPeers) return null;
  const mid = Math.floor(usable.length / 2);
  return usable.length % 2 === 0 ? (usable[mid - 1] + usable[mid]) / 2 : usable[mid];
}

function bandFor(
  value: number,
  baseline: number | null,
  better: "higher" | "lower",
): MetricBand {
  if (!Number.isFinite(value) || value <= 0 || baseline == null || baseline <= 0) {
    return "unavailable";
  }
  const ratio = value / baseline;
  if (better === "higher") {
    if (ratio >= 1 + GRADE_BAND_TOLERANCE) return "strong";
    if (ratio <= 1 - GRADE_BAND_TOLERANCE) return "weak";
  } else {
    if (ratio <= 1 - GRADE_BAND_TOLERANCE) return "strong";
    if (ratio >= 1 + GRADE_BAND_TOLERANCE) return "weak";
  }
  return "fair";
}

function gradeFromBands(bands: MetricBand[]): PerformanceGrade {
  const measured = bands.filter((b) => b === "strong" || b === "fair" || b === "weak");
  if (measured.length === 0) return "GOOD";
  const weak = measured.filter((b) => b === "weak").length;
  const strong = measured.filter((b) => b === "strong").length;
  if (weak === 0 && strong === measured.length && measured.length >= 2) return "OUTSTANDING";
  if (weak === 0 && strong >= 1) return "EXCELLENT";
  return "GOOD";
}

function assess<K extends string>(
  metrics: Array<{
    key: K;
    value: number;
    baseline: number | null;
    better: "higher" | "lower";
  }>,
): { factors: Array<MetricAssessment<K>>; improvements: Array<ImprovementItem<K>> } {
  const factors = metrics.map((metric) => ({
    key: metric.key,
    band: bandFor(metric.value, metric.baseline, metric.better),
    value: metric.value > 0 ? metric.value : null,
    baseline: metric.baseline,
  }));
  const improvements = factors
    .filter((factor) => factor.band === "weak")
    .map((factor) => ({ metricKey: factor.key, value: factor.value, baseline: factor.baseline }));
  return { factors, improvements };
}

/* -------------------------------------------------------------------------- */
/* Drivers                                                                    */
/* -------------------------------------------------------------------------- */

export interface DriverBaselines {
  trips: number | null;
  distance: number | null;
  mileage: number | null;
  costPerKm: number | null;
  /** Participating rows (real activity) the medians were computed from. */
  peers: number;
}

export function computeDriverBaselines(
  rows: readonly DriverPerformanceRow[],
): DriverBaselines {
  const participating = rows.filter((row) => row.trips > 0 || row.distance > 0);
  return {
    peers: participating.length,
    trips: medianOf(participating.map((r) => r.trips), GRADE_MIN_PEERS),
    distance: medianOf(participating.map((r) => r.distance), GRADE_MIN_PEERS),
    mileage: medianOf(participating.map((r) => r.mileage), GRADE_MIN_PEERS),
    costPerKm: medianOf(participating.map((r) => r.costPerKm), GRADE_MIN_PEERS),
  };
}

export function assessDriverPerformance(
  row: DriverPerformanceRow,
  baselines: DriverBaselines,
): BandAssessment<DriverMetricKey> {
  // Fewer than two comparable drivers → no honest baseline exists.
  const noPeers = baselines.peers < GRADE_MIN_PEERS;
  const { factors, improvements } = assess<DriverMetricKey>([
    { key: "trips", value: row.trips, baseline: noPeers ? null : baselines.trips, better: "higher" },
    { key: "distance", value: row.distance, baseline: noPeers ? null : baselines.distance, better: "higher" },
    { key: "mileage", value: row.mileage, baseline: noPeers ? null : baselines.mileage, better: "higher" },
    { key: "costPerKm", value: row.costPerKm, baseline: noPeers ? null : baselines.costPerKm, better: "lower" },
  ]);
  const hasActivity = row.trips > 0 || row.distance > 0;
  return {
    grade: hasActivity ? gradeFromBands(factors.map((f) => f.band)) : "GOOD",
    scored: hasActivity && !noPeers && factors.some((f) => f.band !== "unavailable"),
    factors,
    improvements: hasActivity ? improvements : [],
  };
}

/** Deterministic award order: strongest bands first, then primary output. */
function awardComparator<K extends string>(
  a: { scored: boolean; factors: Array<MetricAssessment<K>>; name: string; id: number; primary: number },
  b: { scored: boolean; factors: Array<MetricAssessment<K>>; name: string; id: number; primary: number },
): number {
  const strength = (x: typeof a) => {
    const measured = x.factors.filter((f) => f.band !== "unavailable");
    return {
      strong: measured.filter((f) => f.band === "strong").length,
      weak: measured.filter((f) => f.band === "weak").length,
    };
  };
  const sa = strength(a);
  const sb = strength(b);
  if (sa.strong !== sb.strong) return sb.strong - sa.strong;
  if (sa.weak !== sb.weak) return sa.weak - sb.weak;
  if (a.primary !== b.primary) return b.primary - a.primary;
  const byName = a.name.localeCompare(b.name, undefined, { sensitivity: "accent", numeric: true });
  if (byName !== 0) return byName;
  return a.id - b.id;
}

const AWARDS: readonly (1 | 2 | 3)[] = [1, 2, 3];

/** Apply the one-Outstanding/one-Excellent/one-Good award policy to banded rows. */
function applyAwards<K extends string, R>(
  banded: ReadonlyMap<number, BandAssessment<K>>,
  meta: ReadonlyMap<number, R>,
  idOf: (row: R) => number,
  nameOf: (row: R) => string,
  primaryOf: (row: R) => number,
): Map<number, PerformanceAssessment<K>> {
  type Entry = { id: number; assessment: BandAssessment<K>; meta: R };
  const eligible = [...banded.entries()]
    .filter(([, assessment]) => assessment.scored)
    .map(([id, assessment]): Entry => ({ id, assessment, meta: meta.get(id)! }))
    .sort((x, y) =>
      awardComparator<K>(
        { scored: x.assessment.scored, factors: x.assessment.factors, name: nameOf(x.meta), id: idOf(x.meta), primary: primaryOf(x.meta) },
        { scored: y.assessment.scored, factors: y.assessment.factors, name: nameOf(y.meta), id: idOf(y.meta), primary: primaryOf(y.meta) },
      ),
    );
  const result = new Map<number, PerformanceAssessment<K>>();
  for (const [id, assessment] of banded) {
    const awardIndex = eligible.findIndex((entry) => entry.id === id);
    const awardRank = awardIndex >= 0 && awardIndex < AWARDS.length ? AWARDS[awardIndex] : null;
    result.set(id, {
      grade: awardRank == null ? null : awardRank === 1 ? "OUTSTANDING" : awardRank === 2 ? "EXCELLENT" : "GOOD",
      awardRank,
      scored: assessment.scored,
      factors: assessment.factors,
      improvements: assessment.improvements,
    });
  }
  return result;
}

/**
 * Grade every driver row from ONE shared baseline, then award exactly one
 * Outstanding / one Excellent / one Good. Stable and order-safe.
 */
export function assessDriverRows(
  rows: readonly DriverPerformanceRow[],
): Map<number, PerformanceAssessment<DriverMetricKey>> {
  const baselines = computeDriverBaselines(rows);
  const banded = new Map<number, BandAssessment<DriverMetricKey>>();
  const meta = new Map<number, DriverPerformanceRow>();
  for (const row of rows) {
    banded.set(row.driverId, assessDriverPerformance(row, baselines));
    meta.set(row.driverId, row);
  }
  return applyAwards(
    banded,
    meta,
    (row) => row.driverId,
    (row) => row.driverName,
    (row) => row.trips,
  );
}

/**
 * Presentation order for the table: the three awarded rows first (rank
 * 1-3), then unranked rows by primary output desc → name → id, so the
 * RANK column stays meaningful without implying a grade.
 */
export function rankDriverRows(
  rows: readonly DriverPerformanceRow[],
): Array<{ row: DriverPerformanceRow; rank: number; assessment: PerformanceAssessment<DriverMetricKey> }> {
  const assessments = assessDriverRows(rows);
  const order = (id: number): [number, number, string, number] => {
    const assessment = assessments.get(id)!;
    const row = rows.find((r) => r.driverId === id)!;
    return [
      assessment.awardRank ?? Number.MAX_SAFE_INTEGER,
      row.trips,
      row.driverName,
      row.driverId,
    ];
  };
  return [...rows]
    .sort((a, b) => {
      const [ar, at, an, ai] = order(a.driverId);
      const [br, bt, bn, bi] = order(b.driverId);
      if (ar !== br) return ar - br;
      if (at !== bt) return bt - at;
      const byName = an.localeCompare(bn, undefined, { sensitivity: "accent", numeric: true });
      if (byName !== 0) return byName;
      return ai - bi;
    })
    .map((row, index) => ({ row, rank: index + 1, assessment: assessments.get(row.driverId)! }));
}

/* -------------------------------------------------------------------------- */
/* Supervisors                                                                */
/* -------------------------------------------------------------------------- */

export interface SupervisorBaselines {
  shops: number | null;
  trips: number | null;
  mortalityRate: number | null;
  weightLoss: number | null;
  peers: number;
}

export function computeSupervisorBaselines(
  rows: readonly SupervisorPerformanceRow[],
): SupervisorBaselines {
  const participating = rows.filter((row) => row.trips > 0 || row.shops > 0);
  return {
    peers: participating.length,
    shops: medianOf(participating.map((r) => r.shops), GRADE_MIN_PEERS),
    trips: medianOf(participating.map((r) => r.trips), GRADE_MIN_PEERS),
    mortalityRate: medianOf(participating.map((r) => r.mortalityRate), GRADE_MIN_PEERS),
    weightLoss: medianOf(participating.map((r) => r.weightLoss), GRADE_MIN_PEERS),
  };
}

export function assessSupervisorPerformance(
  row: SupervisorPerformanceRow,
  baselines: SupervisorBaselines,
): BandAssessment<SupervisorMetricKey> {
  const noPeers = baselines.peers < GRADE_MIN_PEERS;
  const { factors, improvements } = assess<SupervisorMetricKey>([
    { key: "shops", value: row.shops, baseline: noPeers ? null : baselines.shops, better: "higher" },
    { key: "trips", value: row.trips, baseline: noPeers ? null : baselines.trips, better: "higher" },
    // A mortality rate is only meaningful when birds were actually delivered.
    {
      key: "mortalityRate",
      value: row.birds > 0 ? row.mortalityRate : 0,
      baseline: noPeers ? null : baselines.mortalityRate,
      better: "lower",
    },
    // Weight loss is only meaningful when delivered weight exists.
    {
      key: "weightLoss",
      value: row.weight > 0 ? row.weightLoss : 0,
      baseline: noPeers ? null : baselines.weightLoss,
      better: "lower",
    },
  ]);
  const hasActivity = row.trips > 0 || row.shops > 0;
  return {
    grade: hasActivity ? gradeFromBands(factors.map((f) => f.band)) : "GOOD",
    scored: hasActivity && !noPeers && factors.some((f) => f.band !== "unavailable"),
    factors,
    improvements: hasActivity ? improvements : [],
  };
}

/** Grade + award supervisors (same top-three policy, primary metric: shops). */
export function assessSupervisorRows(
  rows: readonly SupervisorPerformanceRow[],
): Map<number, PerformanceAssessment<SupervisorMetricKey>> {
  const baselines = computeSupervisorBaselines(rows);
  const banded = new Map<number, BandAssessment<SupervisorMetricKey>>();
  const meta = new Map<number, SupervisorPerformanceRow>();
  for (const row of rows) {
    banded.set(row.supervisorId, assessSupervisorPerformance(row, baselines));
    meta.set(row.supervisorId, row);
  }
  return applyAwards(
    banded,
    meta,
    (row) => row.supervisorId,
    (row) => row.supervisorName,
    (row) => row.shops,
  );
}

/** Presentation order for the supervisor table (awards first, then output). */
export function rankSupervisorRows(
  rows: readonly SupervisorPerformanceRow[],
): Array<{ row: SupervisorPerformanceRow; rank: number; assessment: PerformanceAssessment<SupervisorMetricKey> }> {
  const assessments = assessSupervisorRows(rows);
  return [...rows]
    .sort((a, b) => {
      const aa = assessments.get(a.supervisorId)!;
      const ab = assessments.get(b.supervisorId)!;
      const ar = aa.awardRank ?? Number.MAX_SAFE_INTEGER;
      const br = ab.awardRank ?? Number.MAX_SAFE_INTEGER;
      if (ar !== br) return ar - br;
      if (a.shops !== b.shops) return b.shops - a.shops;
      const byName = a.supervisorName.localeCompare(b.supervisorName, undefined, { sensitivity: "accent", numeric: true });
      if (byName !== 0) return byName;
      return a.supervisorId - b.supervisorId;
    })
    .map((row, index) => ({ row, rank: index + 1, assessment: assessments.get(row.supervisorId)! }));
}
