// src/modules/operations/mortality/components/TripLossRowExpand.tsx
// Expandable detail for ONE completed trip — the panel behind the row chevron.
//
// THREE SIMPLE TABLES, stacked and full width. No columns squeezed side by
// side, no bars, no decorative boxes: just tables, one after another, each one
// answers a single question.
//
//   1. TRIP DETAILS  — trip no · day · vehicle · supervisor · driver ·
//                      source farm · loaders · helpers (+ status)
//   2. SHOPS         — every shop the trip delivered to, with the birds and
//                      weight that left the vehicle, and the trip total
//   3. WEIGHTS       — farm, delivered, mortality, weight loss, survival:
//                      birds · weight · percentage, one row each
//
// Shop names and per-shop delivered birds/weights live here only.

import { Scale, Truck } from "lucide-react";
import type { TripLossAnalysis } from "../hooks/useTripLossAnalysis";
import { useTripDeliveries } from "../hooks/useTripLossAnalysis";
import { formatNumber, formatWeight } from "../../../../utils/format";
import { formatTripListDay } from "../../vehicle-trips/utils/formatTripListDay";
import TripDeliveryOutput from "./TripDeliveryOutput";
import { useI18n } from "../../../../i18n";

interface TripLossRowExpandProps {
  record: TripLossAnalysis;
}

/** Card shell shared by the three tables: tinted title bar + hairline body. */
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
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/60 px-4 py-2">
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

/** Label column of the trip table — quiet, fixed width, never wraps. */
const TH = "w-[160px] bg-slate-50/40 px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400";
const TD = "px-4 py-2 text-[13px] font-medium text-slate-700";

export default function TripLossRowExpand({ record }: TripLossRowExpandProps) {
  const { t, language } = useI18n();
  // Shop lines are fetched on demand — the table row already carries the shop
  // COUNT, so loading every trip's deliveries up front would be wasted payload.
  const { deliveries, loading: deliveriesLoading } = useTripDeliveries(record.tripId);
  const crew = (names?: string[]) => (names && names.length > 0 ? names.join(", ") : "—");
  const farmWeight = Math.max(record.farmWeight, 1);

  return (
    <div className="border-t border-slate-200/80 bg-slate-100/50 px-3 py-3.5">
      <div className="space-y-3">
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
          <table className="w-full border-collapse">
            <tbody className="divide-y divide-slate-100">
              <tr>
                <th scope="row" className={TH}>
                  {t("ops.mortality.field.trip_no")}
                </th>
                <td className={`${TD} font-bold text-indigo-600`}>{record.tripNo}</td>
                <th scope="row" className={TH}>
                  {t("ops.trip.day")}
                </th>
                <td className={TD}>{formatTripListDay(record.tripDate, language)}</td>
              </tr>
              <tr>
                <th scope="row" className={TH}>
                  {t("common.vehicle")}
                </th>
                <td className={TD}>{record.vehicleNo || "—"}</td>
                <th scope="row" className={TH}>
                  {t("common.supervisor")}
                </th>
                <td className={TD}>{record.supervisorName || "—"}</td>
              </tr>
              <tr>
                <th scope="row" className={TH}>
                  {t("common.driver")}
                </th>
                <td className={TD}>{record.driverName || "—"}</td>
                <th scope="row" className={TH}>
                  {t("ops.mortality.field.source_farm")}
                </th>
                <td className={TD}>{record.sourceFarm || "—"}</td>
              </tr>
              <tr>
                <th scope="row" className={TH}>
                  {t("ops.trip.field.loaders")}
                </th>
                <td className={TD}>{crew(record.loaders)}</td>
                <th scope="row" className={TH}>
                  {t("ops.trip.field.helpers")}
                </th>
                <td className={TD}>{crew(record.helpers)}</td>
              </tr>
            </tbody>
          </table>
        </Card>

        {/* ── 2. SHOPS & DELIVERED BIRDS ──────────────────────────────── */}
        <TripDeliveryOutput deliveries={deliveries} loading={deliveriesLoading} />

        {/* ── 3. WEIGHTS ──────────────────────────────────────────────── */}
        <Card icon={Scale} tone="text-rose-500" title={t("ops.mortality.detail.weight_summary")}>
          <table className="w-full border-collapse text-[13px]">
            <thead className="bg-slate-50/60">
              <tr className="text-[11px] uppercase tracking-wider text-slate-400">
                <th className="px-4 py-2 text-left font-semibold">{t("common.name")}</th>
                <th className="px-4 py-2 text-right font-semibold">{t("common.birds")}</th>
                <th className="px-4 py-2 text-right font-semibold">{t("common.weight")}</th>
                <th className="w-[120px] px-4 py-2 text-right font-semibold">%</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr>
                <td className="px-4 py-2 font-medium text-slate-700">{t("ops.mortality.detail.farm")}</td>
                <td className="px-4 py-2 text-right font-semibold tabular-nums text-amber-700">
                  {formatNumber(record.farmBirds)}
                </td>
                <td className="px-4 py-2 text-right font-semibold tabular-nums text-amber-700">
                  {formatWeight(record.farmWeight)}
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-slate-400">100.00%</td>
              </tr>
              <tr>
                <td className="px-4 py-2 font-medium text-slate-700">{t("ops.mortality.detail.delivered")}</td>
                <td className="px-4 py-2 text-right font-semibold tabular-nums text-sky-700">
                  {formatNumber(record.deliveredBirds)}
                </td>
                <td className="px-4 py-2 text-right font-semibold tabular-nums text-sky-700">
                  {formatWeight(record.deliveredWeight)}
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-slate-500">
                  {((record.deliveredWeight / farmWeight) * 100).toFixed(2)}%
                </td>
              </tr>
              <tr>
                <td className="px-4 py-2 font-medium text-slate-700">{t("ops.mortality.detail.mortality")}</td>
                <td className="px-4 py-2 text-right font-semibold tabular-nums text-orange-600">
                  {formatNumber(record.mortalityCount)}
                </td>
                <td className="px-4 py-2 text-right font-semibold tabular-nums text-orange-600">
                  {formatWeight(record.mortalityWeight)}
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-orange-600">
                  {record.mortalityPercentage.toFixed(2)}%
                </td>
              </tr>
              <tr>
                <td className="px-4 py-2 font-medium text-slate-700">{t("ops.mortality.detail.weight_loss")}</td>
                <td className="px-4 py-2 text-right tabular-nums text-slate-300">—</td>
                <td className="px-4 py-2 text-right font-semibold tabular-nums text-rose-600">
                  {formatWeight(record.weightLoss)}
                </td>
                <td className="px-4 py-2 text-right font-semibold tabular-nums text-rose-600">
                  {record.weightLossPercentage.toFixed(2)}%
                </td>
              </tr>
              <tr className="bg-slate-50/60">
                <td className="px-4 py-2 font-medium text-slate-700">
                  {t("ops.mortality.field.survival_rate")}
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-slate-300">—</td>
                <td className="px-4 py-2 text-right tabular-nums text-slate-300">—</td>
                <td className="px-4 py-2 text-right font-bold tabular-nums text-emerald-700">
                  {(record.survivalRate * 100).toFixed(2)}%
                </td>
              </tr>
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}
