// src/modules/operations/vehicle-trips/components/TripFinalKPI.tsx

import type { Trip, ShopDelivery } from "../types/trip";
import {
  calculateDeliveryDisplayTotals,
  calculateTripDistances,
  sumFlattenedDieselLitres,
} from "../../../../shared/trip/calculations";
import {
  Weight,
  Bird,
  ShoppingBag,
  HeartPulse,
  TrendingDown,
  Ticket,
  Route,
  Fuel,
  MapPin,
  Map,
  Receipt,
} from "lucide-react";
import { useI18n } from "../../../../i18n";
import { tripExpenseTotals } from "../utils/tripExpenseTotals";

interface Props {
  trip: Trip | null;
  deliveries?: ShopDelivery[];
}

function kpiNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function formatKg(value: number | null, unit: string): string {
  return value == null ? "—" : `${value.toFixed(2)} ${unit}`;
}

function formatCount(value: number | null, suffix = ""): string {
  if (value == null) return "—";
  return suffix ? `${value}${suffix}` : String(value);
}

function formatKm(value: number | null, unit: string): string {
  return value == null ? "—" : `${value.toFixed(2)} ${unit}`;
}

export default function TripFinalKPI({ trip, deliveries = [] }: Props) {
  const { t: translate } = useI18n();
  if (!trip) {
    return null;
  }

  const tripRecord = trip as Trip & Record<string, unknown>;
  const pickupSubmitted = Boolean(trip.pickupStepSubmitted);
  const farmSubmitted = Boolean(trip.farmStepSubmitted);
  const deliverySubmitted = Boolean(trip.deliveryStepSubmitted);
  const expensesSubmitted = Boolean(tripRecord.expensesStepSubmitted || tripRecord.endStepSubmitted);

  const completedLoads = (trip.legs ?? [])
    .filter((leg) => leg.deliveryStepSubmitted)
    .map((leg) => {
      const rows = leg.deliveries ?? [];
      const birds = rows.reduce((sum, row) => sum + Number(row.birds || 0), 0);
      const weight = rows.reduce((sum, row) => sum + Number(row.weight || 0), 0);
      const mortality = rows.reduce((sum, row) => sum + Number(row.mortality || 0), 0);
      const mortalityKg = rows.reduce((sum, row) => sum + Number(row.mortKg || 0), 0);
      return {
        load: Number(leg.legIndex),
        dcWeight: Number(leg.dcWeight || 0),
        pickupBirds: Number(leg.totalBirds || 0),
        birds,
        weight,
        mortality,
        mortalityKg,
        weightLoss: Math.max(0, Number(leg.dcWeight || 0) - weight - mortalityKg),
      };
    });
  const hasMultipleLoads = completedLoads.length > 1;
  const loadSub = (field: keyof Omit<(typeof completedLoads)[number], "load">, unit = "") =>
    hasMultipleLoads
      ? completedLoads.map((load) => `L${load.load}: ${Number(load[field]).toFixed(field === "birds" || field === "pickupBirds" || field === "mortality" ? 0 : 2)}${unit}`).join(" · ")
      : "";

  const persistedDeliveries = deliverySubmitted
    ? (Array.isArray(deliveries) && deliveries.length ? deliveries : trip.deliveries || [])
    : [];

  const deliveryTotals = deliverySubmitted
    ? calculateDeliveryDisplayTotals(trip, persistedDeliveries)
    : { totalBirds: 0, totalWeight: 0, totalMortality: 0, totalMortalityKg: 0 };

  const mortalityWeight = deliveryTotals.totalMortalityKg;

  // ─── Weight Loss ──────────────────────────────────────────────────
  const weightLoss = (() => {
    const dcWeight = trip.dcWeight || 0;
    const totalOut = deliveryTotals.totalWeight + mortalityWeight;
    return Math.max(0, dcWeight - totalOut);
  })();

  // ─── Distances (For Display) ────────────────────────────────────────
  const {
    pickupDistance: pickupDist,
    deliveryDistance: deliveryDist,
    totalDistance: totalDist,
  } = calculateTripDistances(trip);

  // ─── Synchronized Mileage (Odometer Logic) ──────────────────────────
  const mileage = (() => {
    const startMeter = Number(trip.openingMeter || 0);
    const endMeter = Number(tripRecord.endMeter ?? tripRecord.closingMeter ?? 0);
    const odometerDistanceCovered = (startMeter > 0 && endMeter > startMeter) ? endMeter - startMeter : 0;

    const totalDieselLiters = sumFlattenedDieselLitres(tripRecord);
    const backendMileage = tripRecord.mileageKmL;

    if (backendMileage != null && Number.isFinite(Number(backendMileage)) && Number(backendMileage) > 0) {
      return Number(backendMileage);
    }

    return odometerDistanceCovered > 0 && totalDieselLiters > 0
      ? odometerDistanceCovered / totalDieselLiters
      : 0;
  })();

  const dcWeight = completedLoads.length ? completedLoads.reduce((s, l) => s + l.dcWeight, 0) : pickupSubmitted ? kpiNumber(trip.dcWeight) : null;
  const totalBirds = completedLoads.length ? completedLoads.reduce((s, l) => s + l.pickupBirds, 0) : pickupSubmitted ? kpiNumber(trip.totalBirds) : null;
  const deliveryWeight = completedLoads.length ? completedLoads.reduce((s, l) => s + l.weight, 0) : deliverySubmitted ? kpiNumber(deliveryTotals.totalWeight) : null;
  const deliveryBirds = completedLoads.length ? completedLoads.reduce((s, l) => s + l.birds, 0) : deliverySubmitted ? kpiNumber(deliveryTotals.totalBirds) : null;
  const mortalityCount = completedLoads.length ? completedLoads.reduce((s, l) => s + l.mortality, 0) : deliverySubmitted ? kpiNumber(deliveryTotals.totalMortality) : null;
  const mortalityKg = completedLoads.length ? completedLoads.reduce((s, l) => s + l.mortalityKg, 0) : deliverySubmitted ? kpiNumber(mortalityWeight) : null;
  const weightLossValue =
    completedLoads.length ? completedLoads.reduce((s, l) => s + l.weightLoss, 0) : pickupSubmitted && deliverySubmitted ? kpiNumber(weightLoss) : null;
  const pickupDistValue = farmSubmitted && trip.startStepSubmitted ? kpiNumber(pickupDist) : null;
  const deliveryDistValue = expensesSubmitted ? kpiNumber(deliveryDist) : null;
  const totalDistValue = expensesSubmitted ? kpiNumber(totalDist) : null;
  const pickupTollsValue = farmSubmitted ? kpiNumber(trip.pickupTolls) ?? 0 : null;
  const deliveryTollsValue = expensesSubmitted ? kpiNumber(trip.deliveryTolls) ?? 0 : null;
  const tollsValue =
    pickupTollsValue == null && deliveryTollsValue == null
      ? null
      : (pickupTollsValue ?? 0) + (deliveryTollsValue ?? 0);
  const mileageValue = expensesSubmitted ? kpiNumber(mileage) : null;
  const expenseBreakdown = tripExpenseTotals(trip);
  const expensesValue = expensesSubmitted ? kpiNumber(expenseBreakdown.total) : null;

  const row1Cards = [
    {
      label: translate("ops.trip.kpi_dc_weight"),
      value: formatKg(dcWeight, translate("common.kg")),
      sub: loadSub("dcWeight", ` ${translate("common.kg")}`) || translate("ops.trip.load_from_farm"),
      bg: "bg-blue-50/70",
      icon: <Weight size={18} className="text-blue-500" />,
    },
    {
      label: translate("ops.trip.kpi_total_birds"),
      value: formatCount(totalBirds),
      sub: loadSub("pickupBirds") || translate("ops.trip.picked_from_farm"),
      bg: "bg-green-50/70",
      icon: <Bird size={18} className="text-green-500" />,
    },
    {
      label: translate("ops.trip.kpi_delivery_weight"),
      value: formatKg(deliveryWeight, translate("common.kg")),
      sub: loadSub("weight", ` ${translate("common.kg")}`) || (deliverySubmitted ? translate("ops.trip.shop_deliveries_count", { count: persistedDeliveries.length }) : translate("ops.trip.not_submitted")),
      bg: "bg-slate-50",
      icon: <ShoppingBag size={18} className="text-slate-700" />,
    },
    {
      label: translate("ops.trip.kpi_delivery_birds"),
      value: formatCount(deliveryBirds),
      sub: loadSub("birds") || translate("ops.trip.total_to_shops"),
      bg: "bg-cyan-50/70",
      icon: <Bird size={18} className="text-cyan-500" />,
    },
    {
      label: translate("operations.total_mortality"),
      value: mortalityCount == null ? "—" : `${mortalityCount} ${translate("common.birds")}`,
      sub: loadSub("mortality") || (mortalityKg == null ? translate("ops.trip.not_submitted") : `${mortalityKg.toFixed(2)} ${translate("common.kg")} ${translate("common.total")}`),
      bg: "bg-red-50/70",
      icon: <HeartPulse size={18} className="text-red-500" />,
    },
    {
      label: translate("ops.trip.kpi_weight_loss"),
      value: formatKg(weightLossValue, translate("common.kg")),
      sub: loadSub("weightLoss", ` ${translate("common.kg")}`) || translate("ops.trip.dc_del_mort"),
      bg: "bg-amber-50/70",
      icon: <TrendingDown size={18} className="text-amber-500" />,
    },
  ];

  const row2Cards = [
    {
      label: translate("ops.trip.kpi_pickup_dist"),
      value: formatKm(pickupDistValue, translate("common.km")),
      sub: translate("ops.trip.start_to_farm"),
      bg: "bg-indigo-50/50",
      icon: <MapPin size={18} className="text-indigo-500" />,
    },
    {
      label: translate("ops.trip.kpi_delivery_dist"),
      value: formatKm(deliveryDistValue, translate("common.km")),
      sub: translate("ops.trip.farm_to_last_drop"),
      bg: "bg-indigo-50/50",
      icon: <Map size={18} className="text-indigo-500" />,
    },
    {
      label: translate("ops.trip.kpi_total_distance"),
      value: formatKm(totalDistValue, translate("common.km")),
      sub: translate("ops.trip.full_trip_total"),
      bg: "bg-indigo-50/70",
      icon: <Route size={18} className="text-indigo-500" />,
    },
    {
      label: translate("ops.trip.kpi_toll_gates"),
      value: formatCount(tollsValue),
      sub:
        pickupTollsValue == null && deliveryTollsValue == null
          ? translate("ops.trip.not_submitted")
          : `${translate("ops.trip.pickup")}: ${pickupTollsValue ?? 0} • ${translate("ops.trip.delivered")}: ${deliveryTollsValue ?? 0}`,
      bg: "bg-violet-50/70",
      icon: <Ticket size={18} className="text-violet-500" />,
    },
    {
      label: translate("ops.trip.kpi_mileage"),
      value: mileageValue == null ? "—" : mileageValue.toFixed(2),
      sub: translate("ops.trip.km_ltr_efficiency"),
      bg: "bg-purple-50/70",
      icon: <Fuel size={18} className="text-purple-500" />,
    },
    {
      label: translate("ops.trip.kpi_expenses"),
      value: expensesValue == null ? "—" : `₹${expensesValue.toFixed(0)}`,
      sub: expensesSubmitted ? `Diesel ₹${expenseBreakdown.diesel.toFixed(2)} · General ₹${expenseBreakdown.general.toFixed(2)}` : translate("ops.trip.total_trip_spends"),
      bg: "bg-orange-50/70",
      icon: <Receipt size={18} className="text-orange-500" />,
    },
  ];

  return (
    <div className="mt-8 p-6 md:p-8 w-full bg-slate-50/50 rounded-3xl border border-slate-200/60 shadow-sm overflow-x-auto scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent">
      <h3 className="text-[15px] font-bold text-slate-700 mb-5 uppercase tracking-wider pl-1">
        {translate("ops.trip.final_kpi_summary")}
      </h3>
      
      {/* ─── Row 1: Load, Delivery & Mortality (Forced Wide Layout) ─── */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 md:gap-5 mb-5 min-w-[900px] xl:min-w-full">
        {row1Cards.map((card, idx) => (
          <div
            key={`r1-${idx}`}
            className={`${card.bg} p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between gap-3 overflow-hidden min-w-[140px]`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                {card.label}
              </span>
              <div className="p-1.5 bg-white/70 rounded-full border border-slate-100/80 shadow-xs shrink-0">
                {card.icon}
              </div>
            </div>
            <div className="mt-1">
              <div className="text-[21px] font-bold text-slate-900 truncate">
                {card.value}
              </div>
              <div className="text-[12px] text-slate-500 font-medium mt-1.5 whitespace-normal leading-snug">
                {card.sub}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ─── Row 2: Distance, Tolls, Metrics (Forced Wide Layout) ─── */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 md:gap-5 min-w-[900px] xl:min-w-full">
        {row2Cards.map((card, idx) => (
          <div
            key={`r2-${idx}`}
            className={`${card.bg} p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between gap-3 overflow-hidden min-w-[140px]`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                {card.label}
              </span>
              <div className="p-1.5 bg-white/70 rounded-full border border-slate-100/80 shadow-xs shrink-0">
                {card.icon}
              </div>
            </div>
            <div className="mt-1">
              <div className="text-[21px] font-bold text-slate-900 truncate">
                {card.value}
              </div>
              <div className="text-[12px] text-slate-500 font-medium mt-1.5 whitespace-normal leading-snug">
                {card.sub}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
