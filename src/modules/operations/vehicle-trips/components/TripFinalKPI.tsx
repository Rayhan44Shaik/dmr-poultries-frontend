import React from "react";
import type { Trip } from "../types/trip";

export default function TripFinalKPI({ trip }: { trip: Trip }) {
  // Distances
  const pickupDist = trip.destMeter - trip.openingMeter;
  const deliveryDist = trip.closingMeter - trip.destMeter;
  const totalDist = trip.closingMeter - trip.openingMeter;

  const cards = [
    { label: "DC WEIGHT", value: `${trip.dcWeight || 0} Kg`, sub: "Load from Farm", bg: "bg-blue-50" },
    { label: "TOTAL BIRDS", value: `${trip.totalBirds || 0}`, sub: "Picked up", bg: "bg-green-50" },
    { label: "DELIVERY WEIGHT", value: `${trip.totalDeliveredWeight || 0} Kg`, sub: "To Shops", bg: "bg-slate-50" },
    { label: "DELIVERY BIRDS", value: `${trip.totalBirdsDelivered || 0}`, sub: "To Shops", bg: "bg-cyan-50" },
    { label: "MORTALITY (B)", value: `${trip.totalMortalityCount || 0}`, sub: "Dead Birds", bg: "bg-red-50" },
    { label: "MORTALITY (KG)", value: `${trip.totalMortalityWeight || 0} Kg`, sub: "Weight loss", bg: "bg-red-50" },
    { label: "WEIGHT LOSS", value: `${trip.weightLoss || 0} Kg`, sub: "DC - Del - Mort", bg: "bg-amber-50" },
    { label: "TOLL GATES", value: `${(trip.pickupTolls || 0) + (trip.deliveryTolls || 0)}`, sub: `P:${trip.pickupTolls||0} • D:${trip.deliveryTolls||0}`, bg: "bg-indigo-50" },
    { label: "TILL PICKUP", value: `${pickupDist || 0} KM`, sub: "Office to Farm", bg: "bg-sky-50" },
    { label: "DELIVERY DIST.", value: `${deliveryDist || 0} KM`, sub: "Farm to End", bg: "bg-sky-50" },
    { label: "DISTANCE", value: `${totalDist || 0} KM`, sub: "Total Covered", bg: "bg-indigo-50" },
    { label: "SURVIVAL RATE", value: `${trip.survivalRate || 0}%`, sub: "Healthy Birds", bg: "bg-emerald-100" },
  ];

  return (
    <div className="mt-8 p-6 bg-slate-50/50 rounded-3xl border border-slate-200/60">
      <h3 className="text-sm font-bold text-slate-700 mb-4 uppercase tracking-wider">Trip KPI Summary</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {cards.map(card => (
          <div key={card.label} className={`${card.bg} p-4 rounded-2xl border border-slate-100`}>
            <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">{card.label}</div>
            <div className="text-xl font-bold text-slate-900">{card.value}</div>
            {card.sub && <div className="text-[10px] text-slate-500 font-medium mt-1">{card.sub}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}