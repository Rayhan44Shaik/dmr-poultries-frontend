import React, { useEffect, useState } from "react";
import {
  X,
  Receipt,
  Calendar,
  Truck,
  User,
  UserCog,
  Gauge,
  IndianRupee,
  Droplets,
  MapPin,
  MessageSquare,
  Fuel,
  Route,
} from "lucide-react";
import type { FuelExpense } from "../types/fuelExpense";
import { loadTripById } from "../../vehicle-trips/services/tripHeaderApiService";
import type { Trip } from "../../vehicle-trips/types/trip";

interface FuelViewModalProps {
  isOpen: boolean;
  bill: FuelExpense | null;
  onClose: () => void;
}

const formatDate = (d?: string | null) => {
  if (!d) return "—";
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return d;
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
};

const DetailItem = ({
  label,
  value,
  icon: Icon,
  highlight = false,
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ElementType;
  highlight?: boolean;
}) => (
  <div className="flex items-start gap-3 p-3 rounded-xl transition-colors hover:bg-slate-50">
    <div className={`mt-0.5 flex-shrink-0 p-2 rounded-lg ${highlight ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
      <Icon size={18} strokeWidth={2.5} />
    </div>
    <div>
      <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">
        {label}
      </div>
      <div className={`text-sm ${highlight ? 'font-bold text-emerald-700 text-base' : 'font-medium text-slate-700'}`}>
        {value ?? "—"}
      </div>
    </div>
  </div>
);

const statusStyles: Record<string, string> = {
  Approved: "bg-green-100 text-green-700 border-green-200",
  "Pending Approval": "bg-amber-100 text-amber-700 border-amber-200",
  Draft: "bg-amber-100 text-amber-700 border-amber-200",
  Rejected: "bg-red-100 text-red-700 border-red-200",
  Deleted: "bg-slate-100 text-slate-500 border-slate-200",
};

export function FuelViewModal({ isOpen, bill, onClose }: FuelViewModalProps) {
  const [trip, setTrip] = useState<Trip | null>(null);
  const [tripLoading, setTripLoading] = useState(false);

  useEffect(() => {
    setTrip(null);
    if (isOpen && bill?.sourceType === "TRIP" && bill.tripId) {
      setTripLoading(true);
      loadTripById(bill.tripId)
        .then(setTrip)
        .catch(() => setTrip(null))
        .finally(() => setTripLoading(false));
    }
  }, [isOpen, bill?.sourceType, bill?.tripId]);

  if (!isOpen || !bill) return null;

  const statusLabel = bill.status === "Pending Approval" || bill.status === "Draft" ? "Pending" : bill.status;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/20">
      <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col ring-1 ring-slate-900/5 transform transition-all">

        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 text-blue-600 rounded-xl">
              <Fuel size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800 leading-tight">Fuel Expense Details</h3>
              <p className="text-xs font-medium text-slate-500">
                {bill.sourceType === "TRIP" ? "Auto-synced from Trip Step 5" : "Manually entered fuel bill"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full cursor-pointer transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6 bg-white">

          <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100">
            <div className="flex items-center gap-6 flex-wrap">
              <div>
                <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Status</div>
                <div className="mt-1">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold border ${statusStyles[bill.status] ?? statusStyles.Draft}`}
                  >
                    {statusLabel}
                    {bill.status === "Approved" && bill.sourceType === "TRIP" && " · Auto-Approved"}
                  </span>
                </div>
              </div>
              <div className="w-px h-8 bg-slate-200 hidden sm:block"></div>
              <div>
                <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Source</div>
                <div className="mt-1">
                  <span
                    className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${
                      bill.sourceType === "TRIP" ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-slate-100 text-slate-600 border-slate-200"
                    }`}
                  >
                    {bill.sourceType}
                  </span>
                </div>
              </div>
              <div className="w-px h-8 bg-slate-200 hidden sm:block"></div>
              <div>
                <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Bill Number</div>
                <div className="mt-1 text-sm font-bold text-slate-700 flex items-center gap-1.5">
                  <Receipt size={14} className="text-slate-400" />
                  {bill.billNo}
                </div>
              </div>
            </div>

            <div className="text-right">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Fuel Date</div>
              <div className="mt-1 text-sm font-bold text-slate-700 flex items-center gap-1.5 justify-end">
                <Calendar size={14} className="text-slate-400" />
                {formatDate(bill.billDate)}
              </div>
            </div>
          </div>

          {bill.status === "Rejected" && (
            <div className="p-4 rounded-2xl bg-red-50 border border-red-100">
              <div className="text-[11px] font-semibold text-red-500 uppercase tracking-wider mb-1">Rejection Details</div>
              <div className="text-sm text-red-700">
                <div>Reason: {bill.rejectedReason || "—"}</div>
                <div className="text-xs text-red-500 mt-1">
                  Rejected by {bill.rejectedBy || "—"} on {formatDate(bill.rejectedAt)}
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-2 gap-y-1">
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider px-3 mb-2 mt-2">Vehicle & Crew</h4>
              <DetailItem icon={Truck} label="Vehicle Number" value={bill.vehicleNo} />
              <DetailItem icon={User} label="Driver Name" value={bill.driverName} />
              <DetailItem icon={UserCog} label="Supervisor" value={bill.supervisorName} />
              <DetailItem icon={MapPin} label="Petrol Bunk" value={bill.pumpName} />
              {bill.bunkAddress && <DetailItem icon={MapPin} label="Bunk Address" value={bill.bunkAddress} />}
            </div>

            <div className="space-y-1">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider px-3 mb-2 mt-2">Fuel & Financials</h4>
              <DetailItem icon={Gauge} label="Meter Reading" value={`${bill.currentMeter.toLocaleString()} KM`} />
              <DetailItem icon={Droplets} label="Litres Filled" value={`${bill.liters.toFixed(2)} L`} />
              <DetailItem icon={IndianRupee} label="Rate per Litre" value={`₹${bill.fuelRate.toFixed(2)}`} />

              <div className="mt-2 p-1 border border-emerald-100 rounded-xl bg-emerald-50/50">
                <DetailItem
                  icon={IndianRupee}
                  label="Total Amount"
                  value={`₹${bill.amount.toFixed(2)}`}
                  highlight
                />
              </div>
            </div>
          </div>

          {bill.sourceType === "TRIP" && (
            <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-100">
              <h4 className="text-xs font-bold text-blue-800 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Route size={14} /> Trip Reference
              </h4>
              {tripLoading && <div className="text-sm text-blue-600">Loading trip details…</div>}
              {!tripLoading && !trip && <div className="text-sm text-blue-600">Trip No: {bill.tripNo || "—"}</div>}
              {!tripLoading && trip && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                  <div><span className="text-blue-500 text-xs block">Trip No</span><span className="font-semibold text-blue-900">{trip.tripNo}</span></div>
                  <div><span className="text-blue-500 text-xs block">Trip Date</span><span className="font-semibold text-blue-900">{formatDate(trip.tripDate)}</span></div>
                  <div><span className="text-blue-500 text-xs block">Vehicle</span><span className="font-semibold text-blue-900">{trip.vehicleNo}</span></div>
                  <div><span className="text-blue-500 text-xs block">Driver</span><span className="font-semibold text-blue-900">{trip.driverName}</span></div>
                  <div><span className="text-blue-500 text-xs block">Supervisor</span><span className="font-semibold text-blue-900">{trip.supervisorName}</span></div>
                  <div><span className="text-blue-500 text-xs block">Opening Meter</span><span className="font-semibold text-blue-900">{trip.openingMeter?.toLocaleString?.() ?? "—"}</span></div>
                  <div><span className="text-blue-500 text-xs block">Closing Meter</span><span className="font-semibold text-blue-900">{trip.closingMeter?.toLocaleString?.() ?? "—"}</span></div>
                  <div><span className="text-blue-500 text-xs block">Total KM</span><span className="font-semibold text-blue-900">{trip.totalKm?.toLocaleString?.() ?? "—"}</span></div>
                  <div><span className="text-blue-500 text-xs block">Fuel Meter</span><span className="font-semibold text-blue-900">{bill.currentMeter.toLocaleString()}</span></div>
                </div>
              )}
            </div>
          )}

          {bill.status === "Approved" && (
            <div className="text-xs text-slate-400 px-1">
              Approved by {bill.approvedBy || "—"} on {formatDate(bill.approvedAt)}
            </div>
          )}

          {bill.remarks && (
            <div className="mt-4 p-4 rounded-2xl bg-slate-50 border border-slate-100">
              <div className="flex items-start gap-3">
                <MessageSquare size={18} className="text-slate-400 mt-0.5" />
                <div>
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Remarks / Notes</div>
                  <p className="text-sm text-slate-700 leading-relaxed">{bill.remarks}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end p-5 border-t border-slate-100 bg-slate-50/50">
          <button
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-xl bg-white px-6 py-2.5 text-sm font-semibold text-slate-700 border border-slate-200 shadow-sm hover:bg-slate-50 hover:text-slate-900 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-slate-200 focus:ring-offset-2"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
