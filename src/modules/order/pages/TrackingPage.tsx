// src/modules/order/pages/TrackingPage.tsx
// Live tracking screen — prepared for a future GPS backend.

import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Truck } from "lucide-react";
import TrackingPanel from "../components/TrackingPanel";
import CustomerTrackingLink from "../components/CustomerTrackingLink";
import MapPlaceholder from "../components/MapPlaceholder";
import EmptyState from "../components/EmptyState";
import { useOrders } from "../store/orderContext";
import type { VehicleTrackingSnapshot } from "../types/trackingTypes";

export default function TrackingPage() {
  const navigate = useNavigate();
  const { orders } = useOrders();
  const [selectedVehicleId, setSelectedVehicleId] = useState("");

  const vehicles = useMemo(() => {
    const map = new Map<string, { vehicleNo: string; shop: string; orderNumber: string }>();
    for (const o of orders) {
      if (o.vehicleAssignment && !map.has(o.vehicleAssignment.vehicleId)) {
        map.set(o.vehicleAssignment.vehicleId, {
          vehicleNo: o.vehicleAssignment.vehicleNo,
          shop: o.shop.name,
          orderNumber: o.orderNumber,
        });
      }
    }
    return Array.from(map.entries()).map(([id, info]) => ({ id, ...info }));
  }, [orders]);

  const selected = vehicles.find((v) => v.id === selectedVehicleId) ?? null;

  // GPS backend is not connected — pass a disconnected snapshot so the panel
  // renders the correct "Not Connected" state (never fake live positions).
  const snapshot: VehicleTrackingSnapshot | null = selected
    ? {
        vehicleId: selected.id,
        vehicleNo: selected.vehicleNo,
        latitude: null,
        longitude: null,
        speedKmh: null,
        heading: null,
        accuracyMeters: null,
        lastUpdated: null,
        currentStop: null,
        nextStop: null,
        etaMinutes: null,
        status: "Unknown",
        connected: false,
      }
    : null;

  return (
    <div className="mx-auto max-w-[1400px] px-3 py-4 md:px-6 md:py-6">
      <button
        type="button"
        onClick={() => navigate("/order")}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 transition-colors hover:text-slate-800"
      >
        <ArrowLeft size={16} />
        Back to Orders
      </button>

      <div className="mb-4 flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white px-6 py-5 shadow-sm">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
          <Truck size={26} />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Live Tracking</h1>
          <p className="mt-0.5 text-sm text-slate-500">Monitor assigned vehicles and prepare customer tracking links.</p>
        </div>
        {vehicles.length > 0 && (
          <select
            value={selectedVehicleId}
            onChange={(e) => setSelectedVehicleId(e.target.value)}
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-brand-500"
          >
            <option value="">Select vehicle…</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>{v.vehicleNo}</option>
            ))}
          </select>
        )}
      </div>

      {vehicles.length === 0 ? (
        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <EmptyState
            icon={Truck}
            title="No vehicles to track"
            description="Assign orders to vehicles to enable tracking."
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Tracking panel */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm lg:col-span-2">
            <h2 className="mb-4 text-sm font-bold text-slate-800">Vehicle Location</h2>
            {selected ? (
              <div className="space-y-4">
                <TrackingPanel snapshot={snapshot} />

                {/* Prepared delivery readout (requirement #24) */}
                <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Delivery Status</p>
                  <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-2 text-xs sm:grid-cols-3">
                    <Readout label="Vehicle" value={selected.vehicleNo} />
                    <Readout label="Status" value="On the Way" />
                    <Readout label="Current Location" value="Updating…" />
                    <Readout label="Destination" value={selected.shop} />
                    <Readout label="Distance Remaining" value="—" />
                    <Readout label="ETA" value="—" />
                    <Readout label="Last GPS Update" value="—" />
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <p className="text-sm font-semibold text-slate-700">GPS Tracking Not Connected</p>
                <p className="text-xs text-slate-400">Select a vehicle above to view its prepared tracking interface.</p>
              </div>
            )}
          </div>

          {/* Map + customer link */}
          <div className="space-y-4">
            <MapPlaceholder />
            {selected && (
              <CustomerTrackingLink orderNumber={selected.orderNumber} destinationShop={selected.shop} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="font-medium text-slate-700">{value}</p>
    </div>
  );
}
