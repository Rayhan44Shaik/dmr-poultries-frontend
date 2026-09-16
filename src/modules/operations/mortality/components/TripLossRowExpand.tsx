// src/modules/operations/mortality/components/TripLossRowExpand.tsx
// Expandable detail for ONE completed trip — the panel behind the row chevron.
//
// ONE card, ONE table, full width. The three groups are sections stacked inside
// that single table, separated by full-width section rows:
//
//   ┌ TRIP DETAILS ────────────────────────────── [ Completed ] ┐
//   │ TRIP NO      TRP-…-001  │ DAY         Wed, 16 Sep 2026    │
//   │ VEHICLE      TS09UB1074 │ SUPERVISOR  Ravi Rao           │
//   │ DRIVER       Yesu Kumar │ SOURCE FARM Sai Sreenivasa…    │
//   │ LOADERS      Jagadish…  │ HELPERS     Jagadish Rao, …    │
//   ├ WEIGHTS ──────────────────────────────────────────────────┤
//   │ NAME                            BIRDS   WEIGHT        %   │
//   │ Farm                              319  636.09 kg  100.00% │
//   │ …                                                          │
//   ├ RATES ────────────────────────────────────────────────────┤
//   │ SURVIVAL RATE                       97.49%                 │
//   │ MORTALITY %      2.51%   │ LOSS %  2.13%                   │
//   └───────────────────────────────────────────────────────────┘
//
// Four equal columns carry every section: the first column of each half is the
// field name, the next is its data, right-aligned so each half ends cleanly at
// its edge. Section rows span all four columns, so the card reads as one table
// rather than three boxes with gaps between them.
//
// No shop-wise delivery list here: the shop COUNT already sits on the trip row,
// and shop-level detail lives in the Delivery module where it is actionable.

import { HeartPulse, Scale, Truck } from "lucide-react";
import type { TripLossAnalysis } from "../hooks/useTripLossAnalysis";
import { formatNumber, formatWeight } from "../../../../utils/format";
import { formatTripListDay } from "../../vehicle-trips/utils/formatTripListDay";
import { useI18n } from "../../../../i18n";

interface TripLossRowExpandProps {
  record: TripLossAnalysis;
}

/**
 * Section marks. Each group owns one colour family, so the three blocks stay
 * distinguishable inside the single table:
 *   indigo = the trip · rose = the weights · emerald = the rates.
 */
const SECTION_TILES = {
  indigo: "border-indigo-100 bg-indigo-50/70 text-indigo-500",
  rose: "border-rose-100 bg-rose-50/70 text-rose-500",
  emerald: "border-emerald-100 bg-emerald-50/70 text-emerald-600",
} as const;

type SectionTone = keyof typeof SECTION_TILES;

/** A full-width band that opens a section of the table. */
function SectionRow({
  icon: Icon,
  tone,
  title,
  colSpan,
  action,
}: {
  icon: typeof Truck;
  tone: SectionTone;
  title: string;
  colSpan: number;
  action?: React.ReactNode;
}) {
  return (
    <tr className="bg-slate-50/80">
      <th colSpan={colSpan} scope="colgroup" className="px-3 py-1.5 text-left">
        <span className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-wider text-slate-900">
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border shadow-inner ${SECTION_TILES[tone]}`}
            >
              <Icon size={12} strokeWidth={2.4} aria-hidden="true" />
            </span>
            {title}
          </span>
          {action}
        </span>
      </th>
    </tr>
  );
}

/** One label │ value pair, filling two of the four columns. */
function Pair({ label, value, tone, rule = true }: {
  label: string;
  value: React.ReactNode;
  tone?: string;
  /** Draw the hairline between this pair's name and its data. */
  rule?: boolean;
}) {
  return (
    <>
      <th
        scope="row"
        className={`w-1/4 px-3 py-2.5 text-left align-middle text-[10.5px] font-bold uppercase leading-tight tracking-wide text-slate-900 ${
          rule ? "border-l border-slate-100" : ""
        }`}
      >
        {label}
      </th>
      <td
        className={`w-1/4 border-l border-slate-200 px-3 py-2.5 text-right align-middle text-[12.5px] font-semibold tabular-nums ${
          tone ?? "text-slate-700"
        }`}
      >
        {value}
      </td>
    </>
  );
}

export default function TripLossRowExpand({ record }: TripLossRowExpandProps) {
  const { t, language } = useI18n();
  const crew = (names?: string[]) => (names && names.length > 0 ? names.join(", ") : "—");

  /** Trip facts, two pairs per row — trip no + day, vehicle + supervisor, … */
  const detailRows: Array<Array<{ label: string; value: React.ReactNode; tone?: string }>> = [
    [
      { label: t("ops.mortality.field.trip_no"), value: record.tripNo, tone: "text-indigo-600" },
      { label: t("ops.trip.day"), value: formatTripListDay(record.tripDate, language) },
    ],
    [
      { label: t("common.vehicle"), value: record.vehicleNo || "—" },
      { label: t("common.supervisor"), value: record.supervisorName || "—" },
    ],
    [
      { label: t("common.driver"), value: record.driverName || "—" },
      { label: t("ops.mortality.field.source_farm"), value: record.sourceFarm || "—" },
    ],
    [
      { label: t("ops.trip.field.loaders"), value: crew(record.loaders) },
      { label: t("ops.trip.field.helpers"), value: crew(record.helpers) },
    ],
  ];

  /** Quantities, one row per measure, with that measure's own percentage. */
  const weightRows: Array<{ label: string; birds: React.ReactNode; weight: string; pct: string; tone: string }> = [
    {
      label: t("ops.mortality.detail.farm"),
      birds: formatNumber(record.farmBirds),
      weight: formatWeight(record.farmWeight),
      pct: "100.00%",
      tone: "text-amber-700",
    },
    {
      label: t("ops.mortality.detail.delivered"),
      birds: formatNumber(record.deliveredBirds),
      weight: formatWeight(record.deliveredWeight),
      pct: `${((record.deliveredWeight / Math.max(record.farmWeight, 1)) * 100).toFixed(2)}%`,
      tone: "text-sky-700",
    },
    {
      label: t("ops.mortality.detail.mortality"),
      birds: formatNumber(record.mortalityCount),
      weight: formatWeight(record.mortalityWeight),
      pct: `${record.mortalityPercentage.toFixed(2)}%`,
      tone: "text-orange-600",
    },
    {
      label: t("ops.mortality.detail.weight_loss"),
      // Loss is a weight figure; it has no bird count of its own.
      birds: <span className="text-slate-300">—</span>,
      weight: formatWeight(record.weightLoss),
      pct: `${record.weightLossPercentage.toFixed(2)}%`,
      tone: "text-rose-600",
    },
  ];

  const numericHead = "w-1/4 border-l border-slate-200 px-3 py-2 text-right text-[10.5px] font-bold uppercase tracking-wide text-slate-900";

  return (
    <div className="border-t border-slate-200/80 bg-slate-100/60 px-2 py-2.5">
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {/* ── Card header — the trip section, so the table opens straight into
            its first rows. ────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/80 px-3 py-1.5">
          <h4 className="flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-wider text-slate-900">
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border shadow-inner ${SECTION_TILES.indigo}`}
            >
              <Truck size={12} strokeWidth={2.4} aria-hidden="true" />
            </span>
            {t("ops.mortality.detail.trip_overview")}
          </h4>
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-[1px] text-[10px] font-bold uppercase tracking-wide text-emerald-700">
            {record.status}
          </span>
        </div>

        <table className="w-full table-fixed border-collapse text-[12.5px]">
          <tbody className="divide-y divide-slate-100">
            {/* ── TRIP DETAILS ─────────────────────────────────────── */}
            {detailRows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((field, fieldIndex) => (
                  <Pair
                    key={fieldIndex}
                    label={field.label}
                    value={field.value}
                    tone={field.tone}
                    rule={fieldIndex === 1}
                  />
                ))}
              </tr>
            ))}

            {/* ── WEIGHTS ──────────────────────────────────────────── */}
            <SectionRow
              icon={Scale}
              tone="rose"
              title={t("ops.mortality.detail.weight_summary")}
              colSpan={4}
            />
            <tr>
              <th scope="col" className="w-1/4 px-3 py-2 text-left text-[10.5px] font-bold uppercase tracking-wide text-slate-900">
                {t("common.name")}
              </th>
              <th scope="col" className={numericHead}>
                {t("common.birds")}
              </th>
              <th scope="col" className={numericHead}>
                {t("common.weight")}
              </th>
              <th scope="col" className={numericHead}>
                %
              </th>
            </tr>
            {weightRows.map((row) => (
              <tr key={row.label}>
                <th
                  scope="row"
                  className="w-1/4 px-3 py-2.5 text-left align-middle text-[12.5px] font-medium text-slate-700"
                >
                  {row.label}
                </th>
                <td className={`w-1/4 border-l border-slate-100 px-3 py-2.5 text-right align-middle font-semibold tabular-nums ${row.tone}`}>
                  {row.birds}
                </td>
                <td className={`w-1/4 border-l border-slate-100 px-3 py-2.5 text-right align-middle font-semibold tabular-nums ${row.tone}`}>
                  {row.weight}
                </td>
                <td className={`w-1/4 border-l border-slate-100 px-3 py-2.5 text-right align-middle font-semibold tabular-nums ${row.tone}`}>
                  {row.pct}
                </td>
              </tr>
            ))}

            {/* ── RATES ────────────────────────────────────────────── */}
            <SectionRow
              icon={HeartPulse}
              tone="emerald"
              title={t("ops.mortality.detail.rates")}
              colSpan={4}
            />
            <tr>
              <th
                scope="row"
                className="w-1/4 bg-emerald-50/70 px-3 py-2.5 text-left align-middle text-[10.5px] font-bold uppercase leading-tight tracking-wide text-emerald-700"
              >
                {t("ops.mortality.field.survival_rate")}
              </th>
              <td
                colSpan={3}
                className="bg-emerald-50/70 px-3 py-2.5 text-right align-middle text-[15px] font-extrabold tabular-nums text-emerald-700"
              >
                {(record.survivalRate * 100).toFixed(2)}%
              </td>
            </tr>
            <tr>
              <Pair
                label={t("ops.mortality.field.mortality_pct")}
                value={`${record.mortalityPercentage.toFixed(2)}%`}
                tone="text-orange-600"
                rule={false}
              />
              <Pair
                label={t("ops.mortality.field.weight_loss_pct")}
                value={`${record.weightLossPercentage.toFixed(2)}%`}
                tone="text-rose-600"
              />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
