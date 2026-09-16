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
  CheckCircle2,
  Clock,
  AlertCircle,
  FileImage,
} from "lucide-react";
import type { FuelExpense } from "../types/fuelExpense";
import { formatVehicleNumber } from "../../../../utils/format";
import { formatTripListDay } from "../../vehicle-trips/utils/formatTripListDay";
import { localizeTripViewText } from "../../vehicle-trips/utils/tripViewLocalization";
import { TripNoBadge } from "../../vehicle-trips/components/TripNoBadge";
import { GpsAddressText } from "../../vehicle-trips/components/GpsAddressText";
import { BillPreviewLink } from "../../vehicle-trips/components/Step_5/BillPreviewLink";
import { useI18n } from "../../../../i18n";

interface FuelViewModalProps {
  isOpen: boolean;
  bill: FuelExpense | null;
  onClose: () => void;
}

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
  <div className="flex items-start gap-3 p-3 rounded-xl transition-colors hover:bg-slate-50 border border-slate-100/70 bg-white">
    <div className={`mt-0.5 flex-shrink-0 p-2 rounded-xl ${highlight ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-slate-50 text-slate-500 border border-slate-100'}`}>
      <Icon size={16} strokeWidth={2.2} />
    </div>
    <div className="min-w-0 flex-1">
      <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
        {label}
      </div>
      <div className={`text-xs sm:text-sm ${highlight ? 'font-extrabold text-emerald-700 text-base' : 'font-semibold text-slate-800'}`}>
        {value}
      </div>
    </div>
  </div>
);

export function FuelViewModal({ isOpen, bill, onClose }: FuelViewModalProps) {
  const { t, language } = useI18n();

  if (!isOpen || !bill) return null;

  const isTrip = bill.sourceType === "TRIP" || !!bill.tripNo;
  const isApproved = isTrip || bill.status === "Approved";
  const isPending = !isTrip && bill.status === "Pending";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-hidden flex flex-col ring-1 ring-slate-900/5 transform transition-all animate-in zoom-in-95 duration-200 border border-slate-200/80">
        
        {/* Header Section — styled cleanly matching Trip View Modal */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-emerald-50/60 via-white to-emerald-50/40">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-200 shadow-inner">
              <Fuel size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800 leading-tight">Fuel Bill Details</h3>
              <p className="text-xs font-medium text-slate-500">Transaction summary & receipt document</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full cursor-pointer transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-4 bg-slate-50/40">
          
          {/* Top Row: Quick Status & Primary Identifiers */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm">
            <div className="flex items-center gap-5 flex-wrap">
              <div>
                <div className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">Status</div>
                <div className="mt-1">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                      isApproved
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : isPending
                        ? "bg-orange-50 text-orange-700 border border-orange-200"
                        : "bg-rose-50 text-rose-700 border border-rose-200"
                    }`}
                  >
                    {isApproved ? (
                      <CheckCircle2 size={12} className="text-emerald-600" />
                    ) : isPending ? (
                      <Clock size={12} className="text-orange-500" />
                    ) : (
                      <AlertCircle size={12} className="text-rose-500" />
                    )}
                    <span>{isTrip ? "Auto Approved (Trip)" : bill.status}</span>
                  </span>
                </div>
              </div>
              <div className="w-px h-8 bg-slate-200 hidden sm:block" />
              <div>
                <div className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">Bill Number</div>
                <div className="mt-1 text-sm font-bold text-slate-800 flex items-center gap-1.5 font-mono">
                  <Receipt size={14} className="text-slate-400" />
                  {bill.billNo}
                </div>
              </div>
            </div>
            
            <div className="text-left sm:text-right">
              <div className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">{t("table.date")}</div>
              <div className="mt-1 text-sm font-bold text-slate-700 flex items-center gap-1.5 sm:justify-end">
                <Calendar size={14} className="text-blue-500" />
                {formatTripListDay(bill.date, language)}
              </div>
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Left Column: Vehicle & Trip */}
            <div className="space-y-2.5">
              <div className="text-xs font-bold text-slate-700 uppercase tracking-wider px-1">
                Vehicle & Driver
              </div>
              
              <DetailItem 
                icon={Truck} 
                label={t("common.vehicle")} 
                value={localizeTripViewText(formatVehicleNumber(bill.vehicleNo), language)} 
              />
              
              <DetailItem 
                icon={User} 
                label={t("common.driver")} 
                value={localizeTripViewText(bill.driverName || "—", language)} 
              />

              <div className="p-3 rounded-xl border border-slate-100 bg-white">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Source & Origin
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-bold ${
                      isTrip
                        ? "bg-indigo-50 text-indigo-700 border border-indigo-200/80"
                        : "bg-slate-100 text-slate-700 border border-slate-200/80"
                    }`}
                  >
                    {isTrip ? "Trip Diesel" : "Manual Direct Entry"}
                  </span>
                  {bill.tripNo && <TripNoBadge tripNo={bill.tripNo} />}
                </div>
              </div>

              <div className="p-3 rounded-xl border border-slate-100 bg-white">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <MapPin size={13} className="text-rose-500" />
                  <span>Petrol Bunk & Location</span>
                </div>
                <div className="font-semibold text-slate-800 text-xs sm:text-sm mb-1">
                  {bill.petrolBunk || "—"}
                </div>
                {bill.gpsLat != null && bill.gpsLon != null && (
                  <div className="mt-1.5 pt-1.5 border-t border-slate-100">
                    <GpsAddressText
                      lat={bill.gpsLat}
                      lon={bill.gpsLon}
                      className="text-xs text-emerald-600 font-medium"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Fuel & Financials */}
            <div className="space-y-2.5">
              <div className="text-xs font-bold text-slate-700 uppercase tracking-wider px-1">
                Fuel & Financials
              </div>
              
              <DetailItem 
                icon={Gauge} 
                label="Meter Reading" 
                value={bill.meterReading > 0 ? `${bill.meterReading.toLocaleString()} KM` : "—"} 
              />
              
              <DetailItem 
                icon={Droplets} 
                label="Litres Filled" 
                value={`${bill.litres.toFixed(2)} L`} 
              />
              
              <DetailItem 
                icon={IndianRupee} 
                label="Rate per Litre" 
                value={`₹ ${bill.rate.toFixed(2)}`} 
              />
              
              {/* Highlighted Total Amount Card */}
              <div className="p-1 rounded-xl bg-emerald-50/70 border border-emerald-200 shadow-sm">
                <DetailItem 
                  icon={IndianRupee} 
                  label="Total Fuel Cost" 
                  value={`₹ ${bill.amount.toFixed(2)}`} 
                  highlight 
                />
              </div>

              {/* Receipt Document Link */}
              <div className="p-3 rounded-xl border border-slate-100 bg-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileImage size={16} className="text-indigo-500" />
                  <span className="text-xs font-bold text-slate-700">Receipt Document</span>
                </div>
                {bill.image ? (
                  <BillPreviewLink
                    href={bill.image}
                    fileName={bill.imageName || `${bill.billNo}.png`}
                  />
                ) : (
                  <span className="text-xs text-slate-400">Not Uploaded</span>
                )}
              </div>
            </div>
          </div>

          {/* Remarks Section */}
          {bill.remarks && (
            <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm">
              <div className="flex items-start gap-3">
                <MessageSquare size={16} className="text-slate-400 mt-0.5" />
                <div>
                  <div className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider mb-1">Remarks</div>
                  <p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-medium">{bill.remarks}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Section */}
        <div className="flex justify-end p-4 border-t border-slate-100 bg-gradient-to-r from-slate-50/80 via-white to-slate-50/80">
          <button
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-xl bg-white px-6 py-2 text-xs font-bold text-slate-700 border border-slate-200 shadow-sm hover:bg-slate-50 transition active:scale-95 cursor-pointer"
          >
            {t("common.close")}
          </button>
        </div>

      </div>
    </div>
  );
}

export default React.memo(FuelViewModal);
