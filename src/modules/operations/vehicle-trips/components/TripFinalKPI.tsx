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
  Activity,
  Fuel,
} from "lucide-react";

interface Props {
  trip: Trip | null;
  deliveries?: ShopDelivery[];
}

export default function TripFinalKPI({ trip, deliveries = [] }: Props) {
  // ─── SAFETY: If trip is null or missing required fields, show nothing ──────
  if (!trip) {
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

  // ─── Survival Rate ──────────────────────────────────────────────────
  const survivalRate = useMemo(() => {
    const total = trip.totalBirds || 0;
    const delivered = deliveryTotals.totalBirds;
    return total > 0 ? (delivered / total) * 100 : 0;
  }, [deliveryTotals.totalBirds, trip.totalBirds]);

  // ─── Distances ──────────────────────────────────────────────────────
  const {
    pickupDistance: pickupDist,
    deliveryDistance: deliveryDist,
    totalDistance: totalDist,
  } = calculateTripDistances(trip);

  // ─── Mileage ──────────────────────────────────────────────────────
  const totalDieselLiters = sumFlattenedDieselLitres(
    trip as unknown as Record<string, unknown>
  );
  const mileage = totalDist > 0 && totalDieselLiters > 0
    ? totalDist / totalDieselLiters
    : 0;

  // ─── Define cards ──────────────────────────────────────────────────
  const cards = [
    {
      label: "DC WEIGHT",
      value: `${(trip.dcWeight || 0).toFixed(2)} Kg`,
      sub: "Load from Farm",
      bg: "bg-blue-50",
      icon: <Weight size={18} className="text-blue-600" />,
    },
    {
      label: "TOTAL BIRDS (FARM)",
      value: `${trip.totalBirds || 0}`,
      sub: "Picked up",
      bg: "bg-green-50",
      icon: <Bird size={18} className="text-green-600" />,
    },
    {
      label: "DELIVERY WEIGHT",
      value: `${deliveryTotals.totalWeight.toFixed(2)} Kg`,
      sub: "To Shops",
      bg: "bg-slate-50",
      icon: <ShoppingBag size={18} className="text-slate-700" />,
    },
    {
      label: "DELIVERY BIRDS",
      value: `${deliveryTotals.totalBirds}`,
      sub: "To Shops",
      bg: "bg-cyan-50",
      icon: <Bird size={18} className="text-cyan-600" />,
    },
    {
      label: "MORTALITY (B)",
      value: `${deliveryTotals.totalMortality}`,
      sub: "Dead Birds",
      bg: "bg-red-50",
      icon: <HeartPulse size={18} className="text-red-600" />,
    },
    {
      label: "MORTALITY (KG)",
      value: `${mortalityWeight.toFixed(2)} Kg`,
      sub: "From Shop data",
      bg: "bg-red-50",
      icon: <Weight size={18} className="text-red-600" />,
    },
    {
      label: "WEIGHT LOSS",
      value: `${weightLoss.toFixed(2)} Kg`,
      sub: "DC - Del - Mort",
      bg: "bg-amber-50",
      icon: <TrendingDown size={18} className="text-amber-600" />,
    },
    {
      label: "TOLL GATES",
      value: `${(trip.pickupTolls || 0) + (trip.deliveryTolls || 0)}`,
      sub: `P:${trip.pickupTolls || 0} • D:${trip.deliveryTolls || 0}`,
      bg: "bg-indigo-50",
      icon: <Ticket size={18} className="text-indigo-600" />,
    },
    // ─── Combined Distance Card (double width) ──────────────────────
    {
      label: "DISTANCE",
      span: "col-span-2 md:col-span-3",
      value: (
        <div className="text-xs text-slate-600 space-y-0.5 mt-0.5 w-full">
          <div className="flex justify-between items-center">
            <span className="font-normal text-slate-500">Pickup:</span>
            <span className="font-bold text-slate-800">{pickupDist.toFixed(2)} KM</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="font-normal text-slate-500">Delivery:</span>
            <span className="font-bold text-slate-800">{deliveryDist.toFixed(2)} KM</span>
          </div>
          <div className="flex justify-between items-center border-t border-slate-200 pt-0.5 mt-0.5">
            <span className="font-semibold text-slate-600">Total:</span>
            <span className="font-bold text-slate-900">{totalDist.toFixed(2)} KM</span>
          </div>
        </div>
      ),
      sub: "Office → Farm → End",
      bg: "bg-indigo-50",
      icon: <Route size={18} className="text-indigo-600" />,
    },
    {
      label: "SURVIVAL RATE",
      value: `${survivalRate.toFixed(2)}%`,
      sub: "Healthy Birds",
      bg: "bg-emerald-100",
      icon: <Activity size={18} className="text-emerald-600" />,
    },
    // ─── Mileage card ────────────────────────────────────────────────
    ...(mileage > 0
      ? [
          {
            label: "MILEAGE",
            value: `${mileage.toFixed(2)} KM/Ltr`,
            sub: "Fuel Efficiency",
            bg: "bg-purple-50",
            icon: <Fuel size={18} className="text-purple-600" />,
          },
        ]
      : []),
  ];

  return (
    <div className="mt-8 px-8 py-6 bg-slate-50/50 rounded-3xl border border-slate-200/60 shadow-sm">
      <h3 className="text-sm font-bold text-slate-700 mb-4 uppercase tracking-wider">
        Trip KPI Summary
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-5">
        {cards.map((card, idx) => {
          const colSpan = card.span || "";
          return (
            <div
              key={idx}
              className={`${card.bg} p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between gap-2 min-w-0 overflow-hidden ${colSpan}`}
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
                {typeof card.value === "string" ? (
                  <div className="text-lg md:text-xl font-bold text-slate-900 truncate">
                    {card.value}
                  </div>
                ) : (
                  card.value
                )}
                {card.sub && (
                  <div className="text-[10px] text-slate-500 font-medium mt-0.5 truncate">
                    {card.sub}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}