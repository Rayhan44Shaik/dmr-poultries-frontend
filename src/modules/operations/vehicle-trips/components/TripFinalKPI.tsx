// src/modules/operations/vehicle-trips/components/TripFinalKPI.tsx

import { useMemo } from "react";
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

interface Props {
  trip: Trip | null;
  deliveries?: ShopDelivery[];
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function kpiOrDash(ready: boolean, display: string): string {
  return ready ? display : "—";
}

export default function TripFinalKPI({ trip, deliveries }: Props) {
  const persisted = trip;
  const t = (persisted ?? {}) as Trip & Record<string, unknown>;
  const pickupReady = Boolean(persisted?.pickupStepSubmitted);
  const deliveryReady = Boolean(persisted?.deliveryStepSubmitted);
  const farmReady = Boolean(persisted?.farmStepSubmitted);
  const startReady = Boolean(persisted?.startStepSubmitted);
  const endReady = Boolean(persisted?.expensesStepSubmitted || persisted?.endStepSubmitted);

  const persistedDeliveries = useMemo<ShopDelivery[]>(() => {
    if (Array.isArray(deliveries) && deliveries.length) return deliveries;
    return persisted?.deliveries || [];
  }, [deliveries, persisted]);

  const deliveryTotals = useMemo(
    () =>
      persisted
        ? calculateDeliveryDisplayTotals(persisted, persistedDeliveries)
        : { totalBirds: 0, totalWeight: 0, totalMortality: 0, totalMortalityKg: 0 },
    [persisted, persistedDeliveries]
  );

  const mortalityWeight = deliveryTotals.totalMortalityKg;

  const weightLoss = useMemo(() => {
    const dcWeight = persisted?.dcWeight || 0;
    const totalOut = deliveryTotals.totalWeight + mortalityWeight;
    return Math.max(0, dcWeight - totalOut);
  }, [deliveryTotals.totalWeight, mortalityWeight, persisted?.dcWeight]);

  const {
    pickupDistance: pickupDist,
    deliveryDistance: deliveryDist,
    totalDistance: totalDist,
  } = calculateTripDistances(
    persisted ?? { openingMeter: null, destMeter: 0, closingMeter: 0 }
  );

  const mileage = useMemo(() => {
    const startMeter = Number(persisted?.openingMeter || 0);
    const endMeter = Number(t.endMeter ?? t.closingMeter ?? 0);
    const odometerDistanceCovered =
      startMeter > 0 && endMeter > startMeter ? endMeter - startMeter : 0;

    const totalDieselLiters = sumFlattenedDieselLitres(t);
    const backendMileage = t.mileageKmL;

    if (backendMileage != null && Number.isFinite(Number(backendMileage)) && Number(backendMileage) > 0) {
      return Number(backendMileage);
    }

    return odometerDistanceCovered > 0 && totalDieselLiters > 0
      ? odometerDistanceCovered / totalDieselLiters
      : 0;
  }, [persisted, t]);

  const totalExpenses = useMemo(() => {
    const computedExpenses =
      Number(t.meals || 0) +
      Number(t.loading || 0) +
      Number(t.mealsTiffin || 0) +
      Number(t.vehicleMaintenance || 0) +
      Number(t.othersRC || 0) +
      Number(t.others1Amt || 0) +
      Number(t.others2Amt || 0) +
      Number(t.others3Amt || 0) +
      Number(t.others4Amt || 0) +
      Number(t.others5Amt || 0);

    return computedExpenses > 0 ? computedExpenses : Number(t.totalExpenses || 0);
  }, [t]);

  const safeFixed = (value: number, digits = 2) =>
    isFiniteNumber(value) ? value.toFixed(digits) : "—";

  const dcWeightReady = pickupReady && isFiniteNumber(Number(persisted?.dcWeight));
  const totalBirdsReady = pickupReady && isFiniteNumber(Number(persisted?.totalBirds));
  const deliveryMetricsReady = deliveryReady;
  const weightLossReady = pickupReady && deliveryReady;
  const pickupDistReady = startReady && farmReady;
  const deliveryDistReady = farmReady && endReady;
  const totalDistReady = startReady && endReady;
  const tollsReady = farmReady || endReady;
  const mileageReady = endReady;
  const expensesReady = endReady;

  const pickupTolls = Number(persisted?.pickupTolls || 0);
  const deliveryTolls = Number(persisted?.deliveryTolls || 0);
  const shopCount = deliveryReady ? persistedDeliveries.length : 0;

  const row1Cards = [
    {
      label: "DC WEIGHT",
      value: kpiOrDash(dcWeightReady, `${safeFixed(Number(persisted?.dcWeight || 0))} Kg`),
      sub: pickupReady ? "Load from Farm" : "Not submitted",
      bg: "bg-blue-50",
      icon: <Weight size={18} className="text-blue-600" />,
    },
    {
      label: "TOTAL BIRDS",
      value: kpiOrDash(totalBirdsReady, `${persisted?.totalBirds || 0}`),
      sub: pickupReady ? "Picked up from Farm" : "Not submitted",
      bg: "bg-green-50",
      icon: <Bird size={18} className="text-green-600" />,
    },
    {
      label: "DELIVERY WEIGHT",
      value: kpiOrDash(deliveryMetricsReady, `${safeFixed(deliveryTotals.totalWeight)} Kg`),
      sub: deliveryReady ? `${shopCount} Shop Delivery(s)` : "Not submitted",
      bg: "bg-slate-50",
      icon: <ShoppingBag size={18} className="text-slate-700" />,
    },
    {
      label: "DELIVERY BIRDS",
      value: kpiOrDash(deliveryMetricsReady, `${deliveryTotals.totalBirds}`),
      sub: deliveryReady ? "Total to Shops" : "Not submitted",
      bg: "bg-cyan-50",
      icon: <Bird size={18} className="text-cyan-600" />,
    },
    {
      label: "MORTALITY",
      value: kpiOrDash(deliveryMetricsReady, `${deliveryTotals.totalMortality} Birds`),
      sub: deliveryReady ? `${safeFixed(mortalityWeight)} Kg Total` : "Not submitted",
      bg: "bg-red-50",
      icon: <HeartPulse size={18} className="text-red-600" />,
    },
    {
      label: "WEIGHT LOSS",
      value: kpiOrDash(weightLossReady, `${safeFixed(weightLoss)} Kg`),
      sub: weightLossReady ? "DC - Del - Mort" : "Not submitted",
      bg: "bg-amber-50",
      icon: <TrendingDown size={18} className="text-amber-600" />,
    },
  ];

  const row2Cards = [
    {
      label: "PICKUP DIST",
      value: kpiOrDash(pickupDistReady, `${safeFixed(pickupDist)} KM`),
      sub: pickupDistReady ? "Start to Farm" : "Not submitted",
      bg: "bg-indigo-50/50",
      icon: <MapPin size={18} className="text-indigo-600" />,
    },
    {
      label: "DELIVERY DIST",
      value: kpiOrDash(deliveryDistReady, `${safeFixed(deliveryDist)} KM`),
      sub: deliveryDistReady ? "Farm to Last Drop" : "Not submitted",
      bg: "bg-indigo-50/50",
      icon: <Map size={18} className="text-indigo-600" />,
    },
    {
      label: "TOTAL DISTANCE",
      value: kpiOrDash(totalDistReady, `${safeFixed(totalDist)} KM`),
      sub: totalDistReady ? "Full Trip Total" : "Not submitted",
      bg: "bg-indigo-50",
      icon: <Route size={18} className="text-indigo-700" />,
    },
    {
      label: "TOLL GATES",
      value: kpiOrDash(tollsReady, `${(farmReady ? pickupTolls : 0) + (endReady ? deliveryTolls : 0)}`),
      sub: tollsReady
        ? `P: ${farmReady ? pickupTolls : "—"} • D: ${endReady ? deliveryTolls : "—"}`
        : "Not submitted",
      bg: "bg-violet-50",
      icon: <Ticket size={18} className="text-violet-600" />,
    },
    {
      label: "MILEAGE",
      value: kpiOrDash(mileageReady && isFiniteNumber(mileage), safeFixed(mileage)),
      sub: mileageReady ? "KM/Ltr Efficiency" : "Not submitted",
      bg: "bg-purple-50",
      icon: <Fuel size={18} className="text-purple-600" />,
    },
    {
      label: "EXPENSES",
      value: kpiOrDash(expensesReady && isFiniteNumber(totalExpenses), `₹${isFiniteNumber(totalExpenses) ? totalExpenses.toFixed(0) : "—"}`),
      sub: expensesReady ? "Total Trip Spends" : "Not submitted",
      bg: "bg-orange-50",
      icon: <Receipt size={18} className="text-orange-600" />,
    },
  ];

  return (
    <div className="mt-8 p-6 md:p-8 w-full bg-slate-50/50 rounded-3xl border border-slate-200/60 shadow-sm overflow-x-auto scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent">
      <h3 className="text-sm font-bold text-slate-700 mb-5 uppercase tracking-wider pl-1">
        Trip Final KPI Summary
      </h3>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 md:gap-5 mb-5 min-w-[900px] xl:min-w-full">
        {row1Cards.map((card, idx) => (
          <div
            key={`r1-${idx}`}
            className={`${card.bg} p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between gap-3 overflow-hidden min-w-[140px]`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                {card.label}
              </span>
              <div className="p-1.5 bg-white/70 rounded-full border border-slate-100/80 shadow-xs shrink-0">
                {card.icon}
              </div>
            </div>
            <div className="mt-1">
              <div className="text-xl font-bold text-slate-900 truncate">
                {card.value}
              </div>
              <div className="text-xs text-slate-500 font-medium mt-1.5 truncate">
                {card.sub}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 md:gap-5 min-w-[900px] xl:min-w-full">
        {row2Cards.map((card, idx) => (
          <div
            key={`r2-${idx}`}
            className={`${card.bg} p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between gap-3 overflow-hidden min-w-[140px]`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                {card.label}
              </span>
              <div className="p-1.5 bg-white/70 rounded-full border border-slate-100/80 shadow-xs shrink-0">
                {card.icon}
              </div>
            </div>
            <div className="mt-1">
              <div className="text-xl font-bold text-slate-900 truncate">
                {card.value}
              </div>
              <div className="text-xs text-slate-500 font-medium mt-1.5 truncate">
                {card.sub}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
