// src/modules/operations/mortality/components/TripLossRowExpand.tsx
// Expandable detail for ONE completed trip — the panel behind the row chevron.
//
// ONE white card, three columns split by hairlines (no nested boxes, no wasted
// margin):
//
//   ┌ TRIP & VEHICLE ──┬ FARM INPUT ➜ LOSS ─┬ DELIVERY OUTPUT ────────┐
//   │ trip no, day,    │ farm → delivered → │ shop-wise birds/weight  │
//   │ vehicle, driver, │ mortality → loss,  │ in a dense scrollable   │
//   │ supervisor, farm │ each on its own    │ table with a pinned     │
//   │ + status, shops, │ proportion bar     │ header and TOTAL row    │
//   │ survival         │                    │                         │
//   └──────────────────┴────────────────────┴─────────────────────────┘
//
// DELIVERY OUTPUT is a real table, not a stack of badges: the column headings
// ("Shop / Birds / Wt") are written ONCE in the header, so no glyph and no label
// is repeated on every shop line. That is the whole point of the panel — every
// row of the grid stays readable when a trip delivers to 40 shops.
//
// Shop names and per-shop delivered birds/weights live here only.

import { Bird, Store, TrendingDown, Truck, Warehouse } from "lucide-react";
import type { TripLossAnalysis } from "../hooks/useTripLossAnalysis";
import { useTripDeliveries } from "../hooks/useTripLossAnalysis";
import { formatNumber, formatWeight, formatDateShort } from "../../../../utils/format";
import TripDeliveryOutput from "./TripDeliveryOutput";
import { useI18n } from "../../../../i18n";

interface TripLossRowExpandProps {
  record: TripLossAnalysis;
}

/** Small caps column heading — identical in all three columns. */
function PanelHeading({ icon: Icon, tone, children }: { icon: typeof Bird; tone: string; children: React.ReactNode }) {
  return (
    <h4 className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
      <Icon size={12} className={tone} aria-hidden="true" />
      {children}
    </h4>
  );
}

/** Label over value — two per line, so six trip facts fit in three lines. */
function Fact({ label, value, valueClass = "text-slate-700", title }: {
  label: string;
  value: React.ReactNode;
  valueClass?: string;
  title?: string;
}) {
  return (
    <div className="min-w-0">
      <dt className="truncate text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className={`truncate text-[12.5px] font-semibold tabular-nums ${valueClass}`} title={title}>
        {value}
      </dd>
    </div>
  );
}

/** One metric with its proportion bar — the "farm → loss" waterfall. */
function FlowRow({
  label,
  value,
  bar,
  max,
  barClass,
  valueClass,
}: {
  label: string;
  value: string;
  bar: number;
  max: number;
  barClass: string;
  valueClass: string;
}) {
  const width = max > 0 ? Math.max(2, Math.min(100, (bar / max) * 100)) : 0;
  return (
    <div>
      <div className="mb-0.5 flex items-center justify-between gap-2 text-[11px]">
        <span className="truncate text-slate-500">{label}</span>
        <span className={`shrink-0 font-semibold tabular-nums ${valueClass}`}>{value}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${barClass}`} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

export default function TripLossRowExpand({ record }: TripLossRowExpandProps) {
  const { t } = useI18n();
  const maxWeight = Math.max(record.farmWeight, record.deliveredWeight, 1);
  // Shop lines are fetched on demand — the table row already carries the shop
  // COUNT, so loading every trip's deliveries up front would be wasted payload.
  const { deliveries, loading: deliveriesLoading } = useTripDeliveries(record.tripId);

  return (
    <div className="border-t border-slate-200/80 bg-slate-100/50 px-3 py-3">
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="grid divide-y divide-slate-100 lg:grid-cols-3 lg:divide-x lg:divide-y-0">
          {/* ── 1. TRIP & VEHICLE ─────────────────────────────────────── */}
          <div className="p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <PanelHeading icon={Truck} tone="text-indigo-500">
                {t("ops.mortality.detail.trip_overview")}
              </PanelHeading>
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-[1px] text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                {record.status}
              </span>
            </div>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-2">
              <Fact
                label={t("ops.mortality.field.trip_no")}
                value={record.tripNo}
                valueClass="text-indigo-600"
              />
              <Fact label={t("common.date")} value={formatDateShort(record.tripDate)} />
              <Fact
                label={t("common.vehicle")}
                value={record.vehicleNo || "—"}
                title={record.vehicleNo || undefined}
              />
              <Fact
                label={t("common.driver")}
                value={record.driverName || "—"}
                title={record.driverName || undefined}
              />
              <Fact
                label={t("ops.mortality.field.source_farm")}
                value={record.sourceFarm || "—"}
                title={record.sourceFarm || undefined}
              />
              <Fact
                label={t("common.supervisor")}
                value={record.supervisorName || "—"}
                title={record.supervisorName || undefined}
              />
            </dl>

            {/* Reconciliation strip — the three numbers that prove the trip
                closed cleanly, without a whole section of their own. */}
            <div className="mt-2.5 grid grid-cols-3 gap-1.5 border-t border-slate-100 pt-2.5">
              {[
                { label: t("ops.mortality.field.shops"), value: formatNumber(record.deliveryShops), tone: "text-slate-700" },
                {
                  label: t("ops.mortality.field.delivered_birds"),
                  value: formatNumber(record.deliveredBirds),
                  tone: "text-sky-700",
                },
                {
                  label: t("ops.mortality.field.survival_rate"),
                  value: `${(record.survivalRate * 100).toFixed(1)}%`,
                  tone: "text-emerald-700",
                },
              ].map((item) => (
                <div key={item.label} className="rounded-lg bg-slate-50/80 px-2 py-1.5 text-center">
                  <p className="truncate text-[9.5px] font-semibold uppercase tracking-wide text-slate-400">
                    {item.label}
                  </p>
                  <p className={`text-[12.5px] font-bold tabular-nums ${item.tone}`}>{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── 2. FARM INPUT ➜ LOSS ──────────────────────────────────── */}
          <div className="space-y-2.5 p-3">
            <PanelHeading icon={Warehouse} tone="text-amber-500">
              {t("ops.mortality.detail.farm_input")}
            </PanelHeading>

            <div className="flex items-center gap-2 rounded-lg bg-amber-50/60 px-2.5 py-1.5 text-[12px]">
              <Bird size={13} className="shrink-0 text-amber-500" aria-hidden="true" />
              <span className="font-semibold tabular-nums text-amber-700">{formatNumber(record.farmBirds)}</span>
              <span className="text-[10px] uppercase tracking-wide text-slate-400">
                {t("ops.mortality.field.farm_birds")}
              </span>
              <span className="ml-auto text-[11px] tabular-nums text-slate-500">
                {formatWeight(record.farmWeight)}
              </span>
            </div>

            <FlowRow
              label={t("ops.mortality.field.farm_weight")}
              value={formatWeight(record.farmWeight)}
              bar={record.farmWeight}
              max={maxWeight}
              barClass="bg-amber-400"
              valueClass="text-amber-700"
            />
            <FlowRow
              label={t("ops.mortality.field.delivery_weight")}
              value={formatWeight(record.deliveredWeight)}
              bar={record.deliveredWeight}
              max={maxWeight}
              barClass="bg-sky-400"
              valueClass="text-sky-700"
            />
            <FlowRow
              label={t("ops.mortality.field.mortality_weight")}
              value={formatWeight(record.mortalityWeight)}
              bar={record.mortalityWeight}
              max={maxWeight}
              barClass="bg-orange-400"
              valueClass="text-orange-700"
            />
            <div className="border-t border-slate-100 pt-2.5">
              <FlowRow
                label={t("ops.mortality.field.weight_loss")}
                value={`${formatWeight(record.weightLoss)} · ${record.weightLossPercentage.toFixed(2)}%`}
                bar={record.weightLoss}
                max={maxWeight}
                barClass="bg-rose-400"
                valueClass="text-rose-700"
              />
            </div>

            {/* Mortality, kept to one line: birds · kg · % */}
            <div className="flex items-center gap-2 rounded-lg bg-orange-50/60 px-2.5 py-1.5 text-[12px]">
              <TrendingDown size={13} className="shrink-0 text-orange-500" aria-hidden="true" />
              <span className="font-semibold tabular-nums text-orange-700">
                {formatNumber(record.mortalityCount)}
              </span>
              <span className="text-[10px] uppercase tracking-wide text-slate-400">
                {t("ops.mortality.field.mortality_birds")}
              </span>
              <span className="ml-auto text-[11px] font-semibold tabular-nums text-orange-700">
                {record.mortalityPercentage.toFixed(2)}%
              </span>
            </div>
          </div>

          {/* ── 3. DELIVERY OUTPUT — shop-wise ────────────────────────── */}
          <div className="flex min-w-0 flex-col p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <PanelHeading icon={Store} tone="text-sky-500">
                {t("ops.mortality.detail.delivery_output")}
              </PanelHeading>
              <span className="shrink-0 rounded-full border border-sky-100 bg-sky-50 px-2 py-[1px] text-[10px] font-bold tabular-nums text-sky-700">
                {t(
                  deliveries.length === 1
                    ? "ops.mortality.detail.shop_count_one"
                    : "ops.mortality.detail.shop_count",
                  { count: formatNumber(deliveries.length) }
                )}
              </span>
            </div>

            {deliveriesLoading ? (
              <div className="space-y-1.5">
                {[0, 1, 2].map((rowIndex) => (
                  <div key={rowIndex} className="h-6 w-full animate-pulse rounded-md bg-slate-100" />
                ))}
              </div>
            ) : deliveries.length === 0 ? (
              <p className="text-xs text-slate-400">{t("ops.mortality.detail.no_deliveries")}</p>
            ) : (
              <TripDeliveryOutput deliveries={deliveries} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
