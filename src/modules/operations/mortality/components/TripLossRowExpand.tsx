// src/modules/operations/mortality/components/TripLossRowExpand.tsx
// Expandable detail for ONE completed trip — the panel behind the row chevron.
//
// TWO SIMPLE TABLES, stacked and full width — the same detail-card idiom the
// Fleet module uses (label left, value right-aligned, two label/value pairs per
// row, hairline dividers, nothing else):
//
//   1. TRIP DETAILS — trip no · day · vehicle · supervisor · driver ·
//      source farm · loaders · helpers (+ status chip in the title bar)
//   2. WEIGHTS — Farm · Delivered · Mortality · Weight Loss, each with birds,
//      weight and percentage, closed by a tinted Survival Rate strip
//
// No shop-wise delivery list here: the shop COUNT already sits on the trip row,
// and the shop-level detail lives in the Delivery module where it is actionable.
// Rows are one line tall and the two cards sit 10px apart — nothing is padded
// out, nothing is repeated.

import { HeartPulse, Scale, Truck } from "lucide-react";
import type { TripLossAnalysis } from "../hooks/useTripLossAnalysis";
import { formatNumber, formatWeight } from "../../../../utils/format";
import { formatTripListDay } from "../../vehicle-trips/utils/formatTripListDay";
import { useI18n } from "../../../../i18n";

interface TripLossRowExpandProps {
  record: TripLossAnalysis;
}

/** Card shell: tinted title bar + hairline body — the Fleet detail-card idiom. */
function Card({
  icon: Icon,
  tone,
  title,
  action,
  children,
}: {
  icon: typeof Truck;
  tone: string;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/60 px-4 py-1.5">
        <h4 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
          <Icon size={13} className={tone} aria-hidden="true" />
          {title}
        </h4>
        {action}
      </div>
      {children}
    </div>
  );
}

type DetailField = {
  label: string;
  value: React.ReactNode;
  tone?: string;
  /** Crew lists may wrap; single values stay on one line and truncate. */
  wrap?: boolean;
  title?: string;
};

/** One label/value cell: LABEL left, value right-aligned — the one-line
 *  "VEHICLE NO. … TS 08 UB 1037" idiom. Values are never left dangling after
 *  the label, which is what left a wide empty band in the earlier layout. */
function Cell({ field }: { field: DetailField }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-1.5">
      <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        {field.label}
      </span>
      <span
        className={`min-w-0 text-right text-[13px] font-semibold tabular-nums ${
          field.tone ?? "text-slate-700"
        } ${field.wrap ? "" : "truncate"}`}
        title={field.title}
      >
        {field.value}
      </span>
    </div>
  );
}

export default function TripLossRowExpand({ record }: TripLossRowExpandProps) {
  const { t, language } = useI18n();
  const crew = (names?: string[]) => (names && names.length > 0 ? names.join(", ") : "—");
  const farmWeight = Math.max(record.farmWeight, 1);

  const detailRows: Array<[DetailField, DetailField]> = [
    [
      { label: t("ops.mortality.field.trip_no"), value: record.tripNo, tone: "text-indigo-600" },
      { label: t("ops.trip.day"), value: formatTripListDay(record.tripDate, language) },
    ],
    [
      { label: t("common.vehicle"), value: record.vehicleNo || "—", title: record.vehicleNo || undefined },
      { label: t("common.supervisor"), value: record.supervisorName || "—" },
    ],
    [
      { label: t("common.driver"), value: record.driverName || "—" },
      {
        label: t("ops.mortality.field.source_farm"),
        value: record.sourceFarm || "—",
        title: record.sourceFarm || undefined,
      },
    ],
    [
      { label: t("ops.trip.field.loaders"), value: crew(record.loaders), wrap: true },
      { label: t("ops.trip.field.helpers"), value: crew(record.helpers), wrap: true },
    ],
  ];

  const weightRows: Array<{
    label: string;
    birds: React.ReactNode;
    weight: string;
    pct: string;
    tone: string;
    pctTone?: string;
  }> = [
    {
      label: t("ops.mortality.detail.farm"),
      birds: formatNumber(record.farmBirds),
      weight: formatWeight(record.farmWeight),
      pct: "100.00%",
      tone: "text-amber-700",
      pctTone: "text-slate-400",
    },
    {
      label: t("ops.mortality.detail.delivered"),
      birds: formatNumber(record.deliveredBirds),
      weight: formatWeight(record.deliveredWeight),
      pct: `${((record.deliveredWeight / farmWeight) * 100).toFixed(2)}%`,
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
      // Loss is a weight-and-percentage figure; it has no bird count of its own.
      birds: <span className="text-slate-300">—</span>,
      weight: formatWeight(record.weightLoss),
      pct: `${record.weightLossPercentage.toFixed(2)}%`,
      tone: "text-rose-600",
    },
  ];

  return (
    <div className="border-t border-slate-200/80 bg-slate-100/60 px-3 py-2.5">
      <div className="space-y-2.5">
        {/* ── 1. TRIP DETAILS ─────────────────────────────────────────── */}
        <Card
          icon={Truck}
          tone="text-indigo-500"
          title={t("ops.mortality.detail.trip_overview")}
          action={
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-[1px] text-[10px] font-bold uppercase tracking-wide text-emerald-700">
              {record.status}
            </span>
          }
        >
          <div className="divide-y divide-slate-100">
            {detailRows.map((pair, rowIndex) => (
              <div
                key={rowIndex}
                className="grid grid-cols-1 divide-y divide-slate-100 sm:grid-cols-2 sm:divide-x sm:divide-y-0"
              >
                {pair.map((field, cellIndex) => (
                  <Cell key={cellIndex} field={field} />
                ))}
              </div>
            ))}
          </div>
        </Card>

        {/* ── 2. WEIGHTS ──────────────────────────────────────────────── */}
        <Card icon={Scale} tone="text-rose-500" title={t("ops.mortality.detail.weight_summary")}>
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] uppercase tracking-wider text-slate-400">
                <th className="px-4 py-1.5 text-left font-semibold">{t("common.name")}</th>
                <th className="px-4 py-1.5 text-right font-semibold">{t("common.birds")}</th>
                <th className="px-4 py-1.5 text-right font-semibold">{t("common.weight")}</th>
                <th className="w-[110px] px-4 py-1.5 text-right font-semibold">%</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {weightRows.map((row) => (
                <tr key={row.label}>
                  <td className="px-4 py-1.5 font-medium text-slate-700">{row.label}</td>
                  <td className={`px-4 py-1.5 text-right font-semibold tabular-nums ${row.tone}`}>
                    {row.birds}
                  </td>
                  <td className={`px-4 py-1.5 text-right font-semibold tabular-nums ${row.tone}`}>
                    {row.weight}
                  </td>
                  <td
                    className={`px-4 py-1.5 text-right font-semibold tabular-nums ${
                      row.pctTone ?? row.tone
                    }`}
                  >
                    {row.pct}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Headline strip — one tinted bar, like a detail card's total row. */}
          <div className="flex items-center justify-between gap-3 border-t border-emerald-100 bg-emerald-50/70 px-4 py-2">
            <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-emerald-700">
              <HeartPulse size={13} aria-hidden="true" />
              {t("ops.mortality.field.survival_rate")}
            </span>
            <span className="text-[15px] font-extrabold tabular-nums text-emerald-700">
              {(record.survivalRate * 100).toFixed(2)}%
            </span>
          </div>
        </Card>
      </div>
    </div>
  );
}
