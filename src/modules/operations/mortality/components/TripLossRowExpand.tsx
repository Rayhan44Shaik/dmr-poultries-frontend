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
        <h4 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-600">
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

/**
 * One label/value cell. The label owns a fixed width and the value follows it
 * immediately, so the two always read together — a value pushed to the far edge
 * of a half-width cell is what left the wide empty band between an entry and
 * the next one.
 */
function Cell({ field }: { field: DetailField }) {
  return (
    <div className="flex items-baseline gap-2.5 px-3.5 py-1.5">
      <span className="w-[104px] shrink-0 text-[11px] font-bold uppercase tracking-wide text-slate-500">
        {field.label}
      </span>
      <span
        className={`min-w-0 flex-1 text-[13px] font-semibold tabular-nums ${
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

  // TWO label/value pairs per row — trip no + day, vehicle + supervisor, then
  // driver + farm and the crew. Two columns keep each line short enough that the
  // label and its value read as one entry.
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

  // Quantities only — the percentages live in the Rates box beside this table,
  // so no figure is printed twice inside the same panel.
  const weightRows: Array<{ label: string; birds: React.ReactNode; weight: string; tone: string }> = [
    {
      label: t("ops.mortality.detail.farm"),
      birds: formatNumber(record.farmBirds),
      weight: formatWeight(record.farmWeight),
      tone: "text-amber-700",
    },
    {
      label: t("ops.mortality.detail.delivered"),
      birds: formatNumber(record.deliveredBirds),
      weight: formatWeight(record.deliveredWeight),
      tone: "text-sky-700",
    },
    {
      label: t("ops.mortality.detail.mortality"),
      birds: formatNumber(record.mortalityCount),
      weight: formatWeight(record.mortalityWeight),
      tone: "text-orange-600",
    },
    {
      label: t("ops.mortality.detail.weight_loss"),
      // Loss is a weight figure; it has no bird count of its own.
      birds: <span className="text-slate-300">—</span>,
      weight: formatWeight(record.weightLoss),
      tone: "text-rose-600",
    },
  ];

  return (
    <div className="border-t border-slate-200/80 bg-slate-100/60 px-3 py-2.5">
      <div className="space-y-2">
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
            {detailRows.map((row, rowIndex) => (
              <div
                key={rowIndex}
                className="grid grid-cols-1 divide-y divide-slate-100 sm:grid-cols-2 sm:divide-x sm:divide-y-0"
              >
                {row.map((field, cellIndex) => (
                  <Cell key={cellIndex} field={field} />
                ))}
              </div>
            ))}
          </div>
        </Card>

        {/* ── 2. WEIGHTS + RATES ──────────────────────────────────────── */}
        {/* Two small boxes side by side rather than one wide one: the table
            holds the quantities, the box beside it holds the rates. Rows are
            one line tall and the columns are sized to their content, so each
            box is only as big as what it prints. */}
        <div className="grid gap-2.5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <Card icon={Scale} tone="text-rose-500" title={t("ops.mortality.detail.weight_summary")}>
            <table className="w-full table-fixed border-collapse text-[12.5px]">
              <thead>
                <tr className="border-b border-slate-100 text-[10.5px] uppercase tracking-wider text-slate-600">
                  <th className="w-[46%] px-3 py-1 text-left font-bold">{t("common.name")}</th>
                  <th className="w-[24%] px-3 py-1 text-right font-bold">{t("common.birds")}</th>
                  <th className="w-[30%] px-3 py-1 text-right font-bold">{t("common.weight")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {weightRows.map((row) => (
                  <tr key={row.label}>
                    <td className="px-3 py-1 font-medium text-slate-700">{row.label}</td>
                    <td className={`px-3 py-1 text-right font-semibold tabular-nums ${row.tone}`}>
                      {row.birds}
                    </td>
                    <td className={`px-3 py-1 text-right font-semibold tabular-nums ${row.tone}`}>
                      {row.weight}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {/* The rates the trip is judged on, as one small box. */}
          <Card icon={HeartPulse} tone="text-emerald-600" title={t("ops.mortality.detail.rates")}>
            <div className="flex items-center justify-between gap-3 border-b border-emerald-100 bg-emerald-50/70 px-3 py-1.5">
              <span className="text-[10.5px] font-bold uppercase tracking-wide text-emerald-700">
                {t("ops.mortality.field.survival_rate")}
              </span>
              <span className="text-[17px] font-extrabold leading-none tabular-nums text-emerald-700">
                {(record.survivalRate * 100).toFixed(2)}%
              </span>
            </div>
            <div className="divide-y divide-slate-100">
              <div className="flex items-center justify-between gap-3 px-3 py-1">
                <span className="text-[10.5px] font-bold uppercase tracking-wide text-slate-600">
                  {t("ops.mortality.field.mortality_pct")}
                </span>
                <span className="text-[13px] font-bold tabular-nums text-orange-600">
                  {record.mortalityPercentage.toFixed(2)}%
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 px-3 py-1">
                <span className="text-[10.5px] font-bold uppercase tracking-wide text-slate-600">
                  {t("ops.mortality.field.weight_loss_pct")}
                </span>
                <span className="text-[13px] font-bold tabular-nums text-rose-600">
                  {record.weightLossPercentage.toFixed(2)}%
                </span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
