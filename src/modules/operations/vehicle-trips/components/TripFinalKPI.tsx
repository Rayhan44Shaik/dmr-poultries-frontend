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

export default function TripFinalKPI({ trip, deliveries = [] }: Props) {
  // ─── SAFETY & STRICT SUBMISSION CHECK ─────────────────────────────────
  if (!trip) {
    return null;
  }

  const t = trip as any;
  const isEndStepSubmitted = Boolean(t.expensesStepSubmitted || t.endStepSubmitted);
  const validCompletedStatuses = ["Completed", "Submitted", "Settled", "Closed"];
  const hasValidStatus = trip.status && validCompletedStatuses.includes(trip.status);

  // Only render if the final step has been submitted OR the trip status strictly reflects completion.
  if (!isEndStepSubmitted && !hasValidStatus) {
    return null;
  }

  // Shared delivery totals are used by both Desktop and Mobile KPI views.
  const deliveryTotals = useMemo(
    () => calculateDeliveryDisplayTotals(trip, deliveries),
    [deliveries, trip]
  );

  const mortalityWeight = deliveryTotals.totalMortalityKg;

  // ─── Weight Loss ──────────────────────────────────────────────────
  const weightLoss = useMemo(() => {
    const dcWeight = trip.dcWeight || 0;
    const totalOut = deliveryTotals.totalWeight + mortalityWeight;
    return Math.max(0, dcWeight - totalOut);
  }, [deliveryTotals.totalWeight, mortalityWeight, trip.dcWeight]);

  // ─── Distances (For Display) ────────────────────────────────────────
  const {
    pickupDistance: pickupDist,
    deliveryDistance: deliveryDist,
    totalDistance: totalDist,
  } = calculateTripDistances(trip);

  // ─── Synchronized Mileage (Odometer Logic) ──────────────────────────
  const mileage = useMemo(() => {
    const startMeter = Number(trip.openingMeter || 0);
    const endMeter = Number(t.endMeter ?? t.closingMeter ?? 0);
    const odometerDistanceCovered = (startMeter > 0 && endMeter > startMeter) ? endMeter - startMeter : 0;
    
    const totalDieselLiters = sumFlattenedDieselLitres(t);
    const backendMileage = t.mileageKmL;

    if (backendMileage != null && Number.isFinite(Number(backendMileage)) && Number(backendMileage) > 0) {
      return Number(backendMileage);
    }
    
    return odometerDistanceCovered > 0 && totalDieselLiters > 0
      ? odometerDistanceCovered / totalDieselLiters
      : 0;
  }, [trip, t]);

  // ─── Synchronized Expenses ──────────────────────────────────────────
  const totalExpenses = useMemo(() => {
    // 1:1 match with StepEnd.tsx expense calculation logic
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

    // Fallback to backend saved totalExpenses if computed is 0
    return computedExpenses > 0 ? computedExpenses : Number(t.totalExpenses || 0);
  }, [t]);

  // ─── Define Row 1 Cards ─────────────────────────────────────────────
  const row1Cards = [
    {
      label: "DC WEIGHT",
      value: `${(trip.dcWeight || 0).toFixed(2)} Kg`,
      sub: "Load from Farm",
      bg: "bg-blue-50",
      icon: <Weight size={18} className="text-blue-600" />,
    },
    {
      label: "TOTAL BIRDS",
      value: `${trip.totalBirds || 0}`,
      sub: "Picked up from Farm",
      bg: "bg-green-50",
      icon: <Bird size={18} className="text-green-600" />,
    },
    {
      label: "DELIVERY WEIGHT",
      value: `${deliveryTotals.totalWeight.toFixed(2)} Kg`,
      sub: `${deliveries.length} Shop Delivery(s)`,
      bg: "bg-slate-50",
      icon: <ShoppingBag size={18} className="text-slate-700" />,
    },
    {
      label: "DELIVERY BIRDS",
      value: `${deliveryTotals.totalBirds}`,
      sub: "Total to Shops",
      bg: "bg-cyan-50",
      icon: <Bird size={18} className="text-cyan-600" />,
    },
    {
      label: "MORTALITY",
      value: `${deliveryTotals.totalMortality} Birds`,
      sub: `${mortalityWeight.toFixed(2)} Kg Total`,
      bg: "bg-red-50",
      icon: <HeartPulse size={18} className="text-red-600" />,
    },
    {
      label: "WEIGHT LOSS",
      value: `${weightLoss.toFixed(2)} Kg`,
      sub: "DC - Del - Mort",
      bg: "bg-amber-50",
      icon: <TrendingDown size={18} className="text-amber-600" />,
    },
  ];

  // ─── Define Row 2 Cards ─────────────────────────────────────────────
  const row2Cards = [
    {
      label: "PICKUP DIST",
      value: `${pickupDist.toFixed(2)} KM`,
      sub: "Start to Farm",
      bg: "bg-indigo-50/50",
      icon: <MapPin size={18} className="text-indigo-600" />,
    },
    {
      label: "DELIVERY DIST",
      value: `${deliveryDist.toFixed(2)} KM`,
      sub: "Farm to Last Drop",
      bg: "bg-indigo-50/50",
      icon: <Map size={18} className="text-indigo-600" />,
    },
    {
      label: "TOTAL DISTANCE",
      value: `${totalDist.toFixed(2)} KM`,
      sub: "Full Trip Total",
      bg: "bg-indigo-50",
      icon: <Route size={18} className="text-indigo-700" />,
    },
    {
      label: "TOLL GATES",
      value: `${(trip.pickupTolls || 0) + (trip.deliveryTolls || 0)}`,
      sub: `P: ${trip.pickupTolls || 0} • D: ${trip.deliveryTolls || 0}`,
      bg: "bg-violet-50",
      icon: <Ticket size={18} className="text-violet-600" />,
    },
    {
      label: "MILEAGE",
      value: `${mileage.toFixed(2)}`,
      sub: "KM/Ltr Efficiency",
      bg: "bg-purple-50",
      icon: <Fuel size={18} className="text-purple-600" />,
    },
    {
      label: "EXPENSES",
      value: `₹${totalExpenses.toFixed(0)}`,
      sub: "Total Trip Spends",
      bg: "bg-orange-50",
      icon: <Receipt size={18} className="text-orange-600" />,
    },
  ];

  return (
    <div className="mt-8 p-6 md:p-8 w-full bg-slate-50/50 rounded-3xl border border-slate-200/60 shadow-sm overflow-x-auto scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent">
      <h3 className="text-sm font-bold text-slate-700 mb-5 uppercase tracking-wider pl-1">
        Trip Final KPI Summary
      </h3>
      
      {/* ─── Row 1: Load, Delivery & Mortality (Forced Wide Layout) ─── */}
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

      {/* ─── Row 2: Distance, Tolls, Metrics (Forced Wide Layout) ─── */}
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