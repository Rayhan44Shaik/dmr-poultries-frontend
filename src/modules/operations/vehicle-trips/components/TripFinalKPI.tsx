import React, { useMemo } from "react";
import type { Trip, ShopDelivery } from "../types/trip";
import {
  Weight,
  Bird,
  ShoppingBag,
  HeartPulse,
  TrendingDown,
  Ticket,
  MapPin,
  Route,
  Activity,
} from "lucide-react";

interface Props {
  trip: Trip;
  deliveries?: ShopDelivery[];
}

export default function TripFinalKPI({ trip, deliveries = [] }: Props) {
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

        // 1. Check if direct mortality weight was saved on the row
        let rowMortalityKg =
          rowWithExtra.mortalityWeight ?? rowWithExtra.mortalityKg ?? 0;

        // 2. If not directly entered, calculate from the shop row or trip average
        if (rowMortalityKg === 0 && (row.mortality || 0) > 0) {
          const avgPerBird =
            row.birds > 0
              ? row.weight / row.birds // Shop average per bird
              : trip.totalBirds > 0
              ? (trip.dcWeight || 0) / trip.totalBirds // Trip fallback average per bird
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

  // Direct mortality weight straight from the shop data
  const mortalityWeight = deliveryTotals.totalMortalityKg;

  // ─── Weight Loss (DC Weight - Delivered Weight - Mortality Weight) ───
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
  const pickupDist = Math.max(0, (trip.destMeter || 0) - (trip.openingMeter || 0));
  const deliveryDist = Math.max(0, (trip.closingMeter || 0) - (trip.destMeter || 0));
  const totalDist = Math.max(0, (trip.closingMeter || 0) - (trip.openingMeter || 0));

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
    {
      label: "TILL PICKUP",
      value: `${pickupDist} KM`,
      sub: "Office to Farm",
      bg: "bg-sky-50",
      icon: <MapPin size={18} className="text-sky-600" />,
    },
    {
      label: "DELIVERY DIST.",
      value: `${deliveryDist} KM`,
      sub: "Farm to End",
      bg: "bg-sky-50",
      icon: <Route size={18} className="text-sky-600" />,
    },
    {
      label: "DISTANCE",
      value: `${totalDist} KM`,
      sub: "Total Covered",
      bg: "bg-indigo-50",
      icon: <Route size={18} className="text-indigo-600" />,
    },
    {
      label: "SURVIVAL RATE",
      value: `${survivalRate.toFixed(1)}%`,
      sub: "Healthy Birds",
      bg: "bg-emerald-100",
      icon: <Activity size={18} className="text-emerald-600" />,
    },
  ];

  return (
    <div className="mt-8 p-6 bg-slate-50/50 rounded-3xl border border-slate-200/60 shadow-sm">
      <h3 className="text-sm font-bold text-slate-700 mb-4 uppercase tracking-wider">
        Trip KPI Summary
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className={`${card.bg} p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between gap-2`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                {card.label}
              </span>
              <div className="p-1.5 bg-white/70 rounded-full border border-slate-100/80 shadow-xs">
                {card.icon}
              </div>
            </div>
            <div className="mt-1">
              <div className="text-lg md:text-xl font-bold text-slate-900">
                {card.value}
              </div>
              {card.sub && (
                <div className="text-[10px] text-slate-500 font-medium mt-0.5">
                  {card.sub}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}