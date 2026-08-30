// src/modules/operations/mortality/components/TripLossRowExpand.tsx
// Expandable detail for ONE completed trip.
//
// Trip Overview -> Farm Input -> Delivery Output (per shop + TOTAL DELIVERY)
// -> Mortality -> Weight Loss -> Delivery Reconciliation.
// Shop names and per-shop delivered birds/weights live here only.

import { Bird, Package, Scale, Store, Truck, UserCheck, Warehouse } from "lucide-react";
import type { TripLossAnalysis } from "../hooks/useTripLossAnalysis";
import { useTripDeliveries } from "../hooks/useTripLossAnalysis";
import { formatNumber, formatWeight, formatDateShort } from "../../../../utils/format";
import { useI18n } from "../../../../i18n";

interface TripLossRowExpandProps {
  record: TripLossAnalysis;
}

type IconComponent = React.ComponentType<{ size?: number; className?: string }>;

function Section({
  titleKey,
  icon: Icon,
  children,
}: {
  titleKey: string;
  icon?: IconComponent;
  children: React.ReactNode;
}) {
  const { t } = useI18n();
  return (
    <section className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-sm">
      <h4 className="mb-2.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
        {Icon && <Icon size={12} className="text-slate-400" />}
        {t(titleKey)}
      </h4>
      {children}
    </section>
  );
}

function Field({
  labelKey,
  value,
  valueClass = "text-slate-800",
}: {
  labelKey: string;
  value: React.ReactNode;
  valueClass?: string;
}) {
  const { t } = useI18n();
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <span className="text-xs text-slate-500">{t(labelKey)}</span>
      <span className={`text-[13px] font-semibold tabular-nums ${valueClass}`}>{value}</span>
    </div>
  );
}

/** Simple horizontal bar scaled to a reference max. */
function Bar({ value, max, className }: { value: number; max: number; className: string }) {
  const width = max > 0 ? Math.max(2, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
      <div className={`h-full rounded-full ${className}`} style={{ width: `${width}%` }} />
    </div>
  );
}

function MetricRow({
  labelKey,
  value,
  bar,
  max,
  barClass,
  valueClass,
}: {
  labelKey: string;
  value: string;
  bar: number;
  max: number;
  barClass: string;
  valueClass: string;
}) {
  const { t } = useI18n();
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[11px]">
        <span className="text-slate-500">{t(labelKey)}</span>
        <span className={`font-semibold tabular-nums ${valueClass}`}>{value}</span>
      </div>
      <Bar value={bar} max={max} className={barClass} />
    </div>
  );
}

export default function TripLossRowExpand({ record }: TripLossRowExpandProps) {
  const { t } = useI18n();
  const maxWeight = Math.max(record.farmWeight, record.deliveredWeight, 1);
  // Shop lines are fetched on demand — the table row already carries the shop
  // COUNT, so loading every trip's deliveries up front would be wasted payload.
  const { deliveries, loading: deliveriesLoading } = useTripDeliveries(record.tripId);
  const deliveryBirdsTotal = deliveries.reduce((s, d) => s + (d.birds || 0), 0);
  const deliveryWeightTotal = deliveries.reduce((s, d) => s + (d.weight || 0), 0);

  return (
    <div className="border-t border-slate-200 bg-slate-50/70 px-4 py-4">
      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
        {/* ── TRIP OVERVIEW ───────────────────────────────────────── */}
        <Section titleKey="ops.mortality.detail.trip_overview" icon={Truck}>
          <Field labelKey="ops.mortality.field.trip_no" value={record.tripNo} />
          <Field labelKey="common.date" value={formatDateShort(record.tripDate)} />
          <Field labelKey="ops.mortality.field.vehicle" value={record.vehicleNo || "—"} />
          <Field labelKey="common.driver" value={record.driverName || "—"} />
          <Field labelKey="common.supervisor" value={record.supervisorName || "—"} />
          <Field
            labelKey="common.status"
            value={
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                {record.status}
              </span>
            }
          />
        </Section>

        {/* ── FARM INPUT ──────────────────────────────────────────── */}
        <Section titleKey="ops.mortality.detail.farm_input" icon={Warehouse}>
          <Field labelKey="ops.mortality.field.source_farm" value={record.sourceFarm || "—"} />
          <Field
            labelKey="ops.mortality.field.farm_birds"
            value={formatNumber(record.farmBirds)}
          />
          <Field
            labelKey="ops.mortality.field.farm_weight"
            value={formatWeight(record.farmWeight)}
          />
        </Section>

        {/* ── DELIVERY OUTPUT ─────────────────────────────────────── */}
        <Section titleKey="ops.mortality.detail.delivery_output" icon={Store}>
          {deliveriesLoading ? (
            <p className="text-xs text-slate-400">{t("ops.mortality.loading")}</p>
          ) : deliveries.length === 0 ? (
            <p className="text-xs text-slate-400">{t("ops.mortality.detail.no_deliveries")}</p>
          ) : (
            <div className="space-y-1.5">
              {deliveries.map((d) => (
                <div
                  key={d.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-sky-100 bg-sky-50/40 px-3 py-1.5"
                >
                  <span className="truncate text-[13px] font-medium text-slate-700">{d.shopName}</span>
                  <span className="flex shrink-0 items-center gap-3 text-[13px] tabular-nums">
                    <span className="inline-flex items-center gap-1 text-sky-700">
                      <Bird size={11} />
                      {formatNumber(d.birds || 0)}
                    </span>
                    <span className="font-semibold text-slate-800">{formatWeight(d.weight)}</span>
                  </span>
                </div>
              ))}

              {/* TOTAL DELIVERY — shops · birds · weight */}
              <div className="space-y-1 rounded-lg border border-sky-200 bg-sky-50/70 px-3 py-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-sky-700">
                  {t("ops.mortality.detail.total_delivery")}
                </p>
                <div className="flex items-center justify-between gap-4 py-0.5">
                  <span className="text-xs text-slate-500">
                    {t("ops.mortality.field.shops")}
                  </span>
                  <span className="text-[13px] font-semibold tabular-nums text-sky-700">
                    {formatNumber(deliveries.length)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4 py-0.5">
                  <span className="text-xs text-slate-500">
                    {t("ops.mortality.field.delivered_birds")}
                  </span>
                  <span className="text-[13px] font-semibold tabular-nums text-sky-700">
                    {formatNumber(deliveryBirdsTotal)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4 py-0.5">
                  <span className="text-xs text-slate-500">
                    {t("ops.mortality.field.delivery_weight")}
                  </span>
                  <span className="text-[13px] font-semibold tabular-nums text-sky-700">
                    {formatWeight(deliveryWeightTotal)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </Section>

        {/* ── MORTALITY ───────────────────────────────────────────── */}
        <Section titleKey="ops.mortality.detail.mortality" icon={Bird}>
          <div className="rounded-lg border border-orange-100 bg-orange-50/40 p-3">
            <Field
              labelKey="ops.mortality.field.mortality_birds"
              value={formatNumber(record.mortalityCount)}
              valueClass="text-orange-700"
            />
            <Field
              labelKey="ops.mortality.field.mortality_weight"
              value={formatWeight(record.mortalityWeight)}
              valueClass="text-orange-700"
            />
            <div className="mt-2">
              <div className="mb-1 flex items-center justify-between text-[11px]">
                <span className="text-slate-500">{t("ops.mortality.field.mortality_pct")}</span>
                <span className="font-bold tabular-nums text-orange-700">
                  {record.mortalityPercentage.toFixed(2)}%
                </span>
              </div>
              <Bar
                value={record.mortalityCount}
                max={Math.max(record.farmBirds, 1)}
                className="bg-orange-400"
              />
            </div>
          </div>
        </Section>

        {/* ── WEIGHT LOSS ─────────────────────────────────────────── */}
        <Section titleKey="ops.mortality.detail.weight_loss" icon={Scale}>
          <div className="space-y-2 rounded-lg border border-rose-100 bg-rose-50/40 p-3">
            <MetricRow
              labelKey="ops.mortality.field.farm_weight"
              value={formatWeight(record.farmWeight)}
              bar={record.farmWeight}
              max={maxWeight}
              barClass="bg-amber-400"
              valueClass="text-amber-700"
            />
            <MetricRow
              labelKey="ops.mortality.field.delivery_weight"
              value={formatWeight(record.deliveredWeight)}
              bar={record.deliveredWeight}
              max={maxWeight}
              barClass="bg-sky-400"
              valueClass="text-sky-700"
            />
            <MetricRow
              labelKey="ops.mortality.field.mortality_weight"
              value={formatWeight(record.mortalityWeight)}
              bar={record.mortalityWeight}
              max={maxWeight}
              barClass="bg-orange-400"
              valueClass="text-orange-700"
            />
            <div className="border-t border-rose-100 pt-2">
              <MetricRow
                labelKey="ops.mortality.field.weight_loss"
                value={`${formatWeight(record.weightLoss)} (${record.weightLossPercentage.toFixed(2)}%)`}
                bar={record.weightLoss}
                max={maxWeight}
                barClass="bg-rose-400"
                valueClass="text-rose-700"
              />
            </div>
            <p className="pt-1 text-[10px] leading-snug text-slate-400">
              farmWeight − deliveredWeight − mortalityWeight = weightLoss
            </p>
          </div>
        </Section>

        {/* ── DELIVERY RECONCILIATION ─────────────────────────────── */}
        <Section
          titleKey="ops.mortality.detail.delivery_reconciliation"
          icon={UserCheck}
        >
          <Field
            labelKey="ops.mortality.field.shops"
            value={formatNumber(record.deliveryShops)}
          />
          <Field
            labelKey="ops.mortality.field.delivered_birds"
            value={formatNumber(record.deliveredBirds)}
            valueClass="text-sky-700"
          />
          <Field
            labelKey="ops.mortality.field.delivery_weight"
            value={formatWeight(record.deliveredWeight)}
            valueClass="text-sky-700"
          />
          <Field
            labelKey="ops.mortality.field.survival_rate"
            // The backend stores survival_rate as a 0–1 fraction (single
            // source of truth), so no scale guessing is needed here.
            value={`${(record.survivalRate * 100).toFixed(2)}%`}
            valueClass="text-emerald-700"
          />
        </Section>
      </div>
    </div>
  );
}
