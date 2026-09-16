import React from "react";
import { 
  X, 
  Receipt, 
  Calendar, 
  Truck, 
  User, 
  Gauge, 
  IndianRupee, 
  Droplets, 
  MapPin, 
  MessageSquare,
  Fuel,
  Route,
} from "lucide-react";
import type { FuelExpense } from "../types/fuelExpense";

interface FuelViewModalProps {
  isOpen: boolean;
  bill: FuelExpense | null;
  onClose: () => void;
}

const formatDate = (d: string) => {
  const date = new Date(d);
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

const DetailItem = ({ 
  label, 
  value, 
  icon: Icon, 
  highlight = false 
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
        {value}
      </div>
    </div>
  </div>
);

export function FuelViewModal({ isOpen, bill, onClose }: FuelViewModalProps) {
  if (!isOpen || !bill) return null;

  const isTrip = bill.sourceType === "TRIP" || !!bill.tripNo;
  const isApproved = isTrip || bill.status === "Approved";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col ring-1 ring-slate-900/5 transform transition-all animate-in zoom-in-95 duration-200">
        
        {/* Header Section */}
        <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100 shadow-sm">
              <Fuel size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800 leading-tight">Fuel Bill Details</h3>
              <p className="text-xs font-medium text-slate-500">Transaction summary & receipt</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full cursor-pointer transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-5 bg-white">
          
          {/* Top Row: Quick Status & Primary Identifiers */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100">
            <div className="flex items-center gap-6">
              <div>
                <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Status</div>
                <div className="mt-1">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                      isApproved
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : bill.status === "Rejected"
                        ? "bg-rose-50 text-rose-700 border border-rose-200"
                        : "bg-amber-50 text-amber-700 border border-amber-200"
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${isApproved ? "bg-emerald-500" : bill.status === "Rejected" ? "bg-rose-500" : "bg-amber-500"}`} />
                    {isTrip ? "Auto Approved (Trip)" : bill.status}
                  </span>
                </div>
              </div>
              <div className="w-px h-8 bg-slate-200 hidden sm:block"></div>
              <div>
                <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Bill Number</div>
                <div className="mt-1 text-sm font-bold text-slate-800 flex items-center gap-1.5 font-mono">
                  <Receipt size={14} className="text-slate-400" />
                  {bill.billNo}
                </div>
              </div>
            </div>
            
            <div className="text-right">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Transaction Date</div>
              <div className="mt-1 text-sm font-bold text-slate-700 flex items-center gap-1.5 justify-end">
                <Calendar size={14} className="text-slate-400" />
                {formatDate(bill.date)}
              </div>
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-2 gap-y-1">
            {/* Left Column */}
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider px-3 mb-2 mt-2">Vehicle & Trip</h4>
              <DetailItem icon={Truck} label="Vehicle Number" value={bill.vehicleNo} />
              <DetailItem icon={User} label="Driver Name" value={bill.driverName || "—"} />
              {bill.tripNo && (
                <DetailItem icon={Route} label="Trip Number" value={bill.tripNo} />
              )}
              <DetailItem icon={MapPin} label="Petrol Bunk" value={bill.petrolBunk || "—"} />
            </div>

            {/* Right Column */}
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider px-3 mb-2 mt-2">Fuel & Financials</h4>
              <DetailItem icon={Gauge} label="Meter Reading" value={bill.meterReading > 0 ? `${bill.meterReading.toLocaleString()} KM` : "—"} />
              <DetailItem icon={Droplets} label="Litres Filled" value={`${bill.litres.toFixed(2)} L`} />
              <DetailItem icon={IndianRupee} label="Rate per Litre" value={`₹ ${bill.rate.toFixed(2)}`} />
              
              {/* Highlighted Total Amount */}
              <div className="mt-2 p-1 border border-emerald-100 rounded-xl bg-emerald-50/50">
                <DetailItem 
                  icon={IndianRupee} 
                  label="Total Amount" 
                  value={`₹ ${bill.amount.toFixed(2)}`} 
                  highlight 
                />
              </div>
            </div>
          </div>

          {/* Remarks Section */}
          {bill.remarks && (
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
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

        {/* Footer Section */}
        <div className="flex justify-end p-4 border-t border-slate-100 bg-slate-50/50">
          <button
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-xl bg-white px-6 py-2 text-sm font-semibold text-slate-700 border border-slate-200 shadow-sm hover:bg-slate-50 transition cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
