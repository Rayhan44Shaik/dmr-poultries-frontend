// src/modules/operations/vehicle-trips/components/TripFinalKPI.tsx

import React, { useMemo } from "react";
import type { Trip, ShopDelivery } from "../types/trip";
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
  Wallet,
  MapPin,
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

  // ─── Compute totals directly from Shop Deliveries ──────────────────
  const deliveryTotals = useMemo(() => {
    if (!deliveries || deliveries.length === 0) {
      return {
        totalBirds: trip.totalBirdsDelivered || 0,
        totalWeight: trip.totalDeliveredWeight || 0,
        totalMortality: trip.totalMortalityCount || 0,
        totalMortalityKg: trip.totalMortalityWeight || 0,
      };
    }

    return deliveries.reduce(
      (acc, row) => {
        const rowWithExtra = row as ShopDelivery & {
          mortalityWeight?: number;
          mortalityKg?: number;
        };

        let rowMortalityKg =
          rowWithExtra.mortalityWeight ?? rowWithExtra.mortalityKg ?? 0;

        if (rowMortalityKg === 0 && (row.mortality || 0) > 0) {
          const avgPerBird =
            row.birds > 0
              ? row.weight / row.birds
              : trip.totalBirds > 0
              ? (trip.dcWeight || 0) / trip.totalBirds
              : 0;
          rowMortalityKg = row.mortality * avgPerBird;
        }

        return {
          totalBirds: acc.totalBirds + (row.birds || 0),
          totalWeight: acc.totalWeight + (row.weight || 0),
          totalMortality: acc.totalMortality + (row.mortality || 0),
          totalMortalityKg: acc.totalMortalityKg + rowMortalityKg,
        };
      },
      { totalBirds: 0, totalWeight: 0, totalMortality: 0, totalMortalityKg: 0 }
    );
  }, [deliveries, trip]);

  const mortalityWeight = deliveryTotals.totalMortalityKg;

  // ─── Weight Loss ──────────────────────────────────────────────────
  const weightLoss = useMemo(() => {
    const dcWeight = trip.dcWeight || 0;
    const totalOut = deliveryTotals.totalWeight + mortalityWeight;
    
    // Changed to allow negative values (shows actual discrepancy instead of forcing 0)
    return dcWeight - totalOut;
  }, [deliveryTotals.totalWeight, mortalityWeight, trip.dcWeight]);

  // ─── Survival Rate ──────────────────────────────────────────────────
  const survivalRate = useMemo(() => {
    const total = trip.totalBirds || 0;
    const delivered = deliveryTotals.totalBirds;
    return total > 0 ? (delivered / total) * 100 : 0;
  }, [deliveryTotals.totalBirds, trip.totalBirds]);

  // ─── Distances ──────────────────────────────────────────────────────
  const pickupDist = Math.max(0, (trip.destMeter || 0) - (trip.openingMeter || 0));
  const deliveryDist = Math.max(0, (trip.closingMeter || 0) - (trip.destMeter || 0));
  const totalDist = Math.max(0, (trip.closingMeter || 0) - (trip.openingMeter || 0));

  // ─── Mileage & Fuel Calculation ───────────────────────────────────
  let totalDieselLiters = 0;
  for (let i = 1; i <= 6; i++) {
    const key = `dieselLtr${i}`;
    const val = (trip as any)[key];
    if (val !== undefined && val !== null && val !== "") {
      totalDieselLiters += Number(val);
    }
  }
  const totalDistanceCovered = totalDist;
  const mileage = totalDistanceCovered > 0 && totalDieselLiters > 0
    ? totalDistanceCovered / totalDieselLiters
    : 0;

  // ─── Total Expenses Calculation ───────────────────────────────────
  // We calculate this actively so it works even if the backend drops the `totalExpenses` field
  const totalExpenses = useMemo(() => {
    let exp = 0;
    
    // 1. General Expenses
    exp += Number((trip as any).meals || 0);
    exp += Number((trip as any).loading || 0);
    exp += Number((trip as any).mealsTiffin || 0);
    exp += Number((trip as any).vehicleMaintenance || 0);
    exp += Number((trip as any).othersRC || 0);
    for (let i = 1; i <= 5; i++) {
      exp += Number((trip as any)[`others${i}Amt`] || 0);
    }

    // 2. Diesel Expenses
    for (let i = 1; i <= 6; i++) {
      const ltr = Number((trip as any)[`dieselLtr${i}`] || 0);
      const rate = Number((trip as any)[`dieselRate${i}`] || 0);
      exp += (ltr * rate);
    }

    return exp;
  }, [trip]);

  // ─── Define cards ──────────────────────────────────────────────────
  const cards = [
    // --- ROW 1 (6 Cards) ---
    {
      label: "TOTAL BIRDS (FARM)",
      value: `${trip.totalBirds || 0}`,
      sub: "Picked up",
      bg: "bg-green-50",
      icon: <Bird size={18} className="text-green-600" />,
    },
    {
      label: "DC WEIGHT",
      value: `${(trip.dcWeight || 0).toFixed(2)} Kg`,
      sub: "Load from Farm",
      bg: "bg-blue-50",
      icon: <Weight size={18} className="text-blue-600" />,
    },
    {
      label: "DEL BIRDS",
      value: `${deliveryTotals.totalBirds}`,
      sub: "To Shops",
      bg: "bg-cyan-50",
      icon: <Bird size={18} className="text-cyan-600" />,
    },
    {
      label: "DEL WEIGHT",
      value: `${deliveryTotals.totalWeight.toFixed(2)} Kg`,
      sub: "To Shops",
      bg: "bg-slate-50",
      icon: <ShoppingBag size={18} className="text-slate-700" />,
    },
    {
      label: "MORTALITY",
      value: (
        <div className="flex flex-col">
          <span className="text-lg md:text-xl font-bold text-slate-900 leading-tight">
            {deliveryTotals.totalMortality} <span className="text-[11px] font-semibold text-slate-500 uppercase">birds</span>
          </span>
          <span className="text-sm font-bold text-slate-700 mt-0.5">
            {mortalityWeight.toFixed(2)} Kg
          </span>
        </div>
      ),
      sub: "Dead Birds",
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
    
    // --- ROW 2 (6 Cards) ---
    {
      label: "TOLL GATES",
      value: `${(trip.pickupTolls || 0) + (trip.deliveryTolls || 0)}`,
      sub: "Total Tolls",
      bg: "bg-indigo-50",
      icon: <Ticket size={18} className="text-indigo-600" />,
    },
    {
      label: "PICKUP DIST.",
      value: `${pickupDist.toFixed(2)} KM`,
      sub: "Office → Farm",
      bg: "bg-blue-50",
      icon: <Route size={18} className="text-blue-600" />,
    },
    {
      label: "DELIVERY DIST.",
      value: `${deliveryDist.toFixed(2)} KM`,
      sub: `Total: ${totalDist.toFixed(2)} KM`,
      bg: "bg-indigo-50",
      icon: <MapPin size={18} className="text-indigo-600" />,
    },
    {
      label: "MILEAGE",
      value: `${mileage.toFixed(2)} KM/Ltr`,
      sub: `${totalDieselLiters} Ltrs Filled`,
      bg: "bg-purple-50",
      icon: <Fuel size={18} className="text-purple-600" />,
    },
    {
      label: "EXPENSES",
      value: `₹${totalExpenses.toFixed(2)}`,
      sub: "Total Trip Expenses",
      bg: "bg-orange-50",
      icon: <Wallet size={18} className="text-orange-600" />,
    },
    {
      label: "SURVIVAL RATE",
      value: `${survivalRate.toFixed(2)}%`,
      sub: "Healthy Birds",
      bg: "bg-emerald-100",
      icon: <Activity size={18} className="text-emerald-600" />,
    },
  ];

  return (
    <div className="mt-8 px-8 py-6 bg-slate-50/50 rounded-3xl border border-slate-200/60 shadow-sm">
      <h3 className="text-sm font-bold text-slate-700 mb-4 uppercase tracking-wider">
        Trip KPI Summary
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-5">
        {cards.map((card, idx) => {
          return (
            <div
              key={idx}
              className={`${card.bg} p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between gap-2 min-w-0 overflow-hidden`}
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
                {card.sub && typeof card.value === "string" && (
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