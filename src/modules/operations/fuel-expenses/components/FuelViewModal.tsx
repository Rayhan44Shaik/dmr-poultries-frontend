import React from "react";
import { 
  X, 
  Receipt, 
  Calendar, 
  Truck, 
  User, 
  Gauge, 
  Droplets, 
  MapPin, 
  MessageSquare,
  Fuel,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
} from "lucide-react";
import AppShellModal from "../../../../ui/AppShellModal";
import type { FuelExpense } from "../types/fuelExpense";
import { formatVehicleNumber } from "../../../../utils/format";
import { formatTripListDay } from "../../vehicle-trips/utils/formatTripListDay";
import { localizeTripViewText } from "../../vehicle-trips/utils/tripViewLocalization";
import { TripNoBadge } from "../../vehicle-trips/components/TripNoBadge";
import { GpsAddressText } from "../../vehicle-trips/components/GpsAddressText";
import { BillPreviewLink } from "../../vehicle-trips/components/Step_5/BillPreviewLink";
import { useI18n } from "../../../../i18n";
import { uiActionIconMotionClass } from "../../../../shared/ui/uiTokens";

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
  <div className={`flex items-start gap-3.5 p-4 rounded-2xl transition-colors border ${highlight ? 'bg-emerald-50/80 border-emerald-200' : 'bg-white border-slate-200/80 hover:bg-slate-50/80 shadow-xs'}`}>
    <div className={`mt-0.5 flex-shrink-0 p-2.5 rounded-xl ${highlight ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-slate-50 text-slate-600 border border-slate-200/70'}`}>
      <Icon size={18} strokeWidth={2.2} />
    </div>
    <div className="min-w-0 flex-1">
      <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
        {label}
      </div>
      <div className={`text-sm sm:text-base ${highlight ? 'font-extrabold text-emerald-700 text-lg' : 'font-bold text-slate-800'}`}>
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
    <AppShellModal open={isOpen} onClose={onClose} panelClassName="bg-white">
      <div className="bg-white w-full h-full overflow-hidden flex flex-col rounded-2xl">
        
        {/* Header Section — matching Trip View Modal */}
        <div className="border-b border-slate-100 bg-gradient-to-r from-emerald-50/80 via-white to-emerald-50/80 rounded-t-2xl shrink-0">
          <div className="px-6 md:px-8 py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/20 text-white shrink-0">
                <Fuel className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap min-w-0">
                  <h2 className="text-lg md:text-xl font-bold text-slate-800 tracking-tight truncate">
                    Fuel Bill — {bill.billNo}
                  </h2>
                  <span className="hidden sm:inline-flex items-center rounded-full bg-slate-100 border border-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                    {isTrip ? "Trip Auto-Approved" : "Manual Bill"}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-wrap mt-1">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
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
                    <span>{isTrip ? "Approved (Trip Completion)" : bill.status}</span>
                  </span>

                  <span className="text-xs text-slate-400">·</span>

                  <span className="text-xs font-medium text-slate-600 flex items-center gap-1">
                    <Calendar size={13} className="text-emerald-600" />
                    {formatTripListDay(bill.date, language)}
                  </span>
                </div>
              </div>
            </div>

            <button 
              type="button"
              onClick={onClose} 
              className="group relative h-9 w-9 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 transition"
              aria-label={t("common.close")}
            >
              <X size={18} className={uiActionIconMotionClass.close} />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 md:p-8 overflow-y-auto space-y-5 bg-slate-50/50 flex-1">
          
          {/* Top Key Metrics Banner */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Total Fuel Cost
              </div>
              <div className="text-xl md:text-2xl font-extrabold text-emerald-600">
                ₹ {bill.amount.toFixed(2)}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Litres Filled
              </div>
              <div className="text-xl md:text-2xl font-bold text-slate-800">
                {bill.litres.toFixed(2)} <span className="text-sm font-semibold text-slate-500">L</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Rate / Litre
              </div>
              <div className="text-xl md:text-2xl font-bold text-slate-800">
                ₹ {bill.rate.toFixed(2)}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Meter Reading
              </div>
              <div className="text-xl md:text-2xl font-bold text-slate-800">
                {bill.meterReading > 0 ? bill.meterReading.toLocaleString() : "—"} <span className="text-sm font-semibold text-slate-500">KM</span>
              </div>
            </div>
          </div>

          {/* Details Section Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Left Column: Vehicle, Driver, Origin */}
            <div className="space-y-3.5">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider px-1">
                Vehicle & Trip Origin
              </h3>
              
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

              <div className="p-4 rounded-2xl border border-slate-200/80 bg-white shadow-xs">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Source & Linked Trip
                </div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-bold ${
                      isTrip
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200/80"
                        : "bg-slate-100 text-slate-700 border border-slate-200/80"
                    }`}
                  >
                    {isTrip ? "Trip Diesel" : "Manual Direct Entry"}
                  </span>
                  {bill.tripNo && <TripNoBadge tripNo={bill.tripNo} />}
                </div>
              </div>

              <div className="p-4 rounded-2xl border border-slate-200/80 bg-white shadow-xs">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <MapPin size={14} className="text-emerald-600" />
                  <span>Petrol Bunk & Location</span>
                </div>
                <div className="font-bold text-slate-800 text-sm sm:text-base mt-1">
                  {bill.petrolBunk || "—"}
                </div>
                {bill.gpsLat != null && bill.gpsLon != null && (
                  <div className="mt-2.5 pt-2.5 border-t border-slate-100">
                    <GpsAddressText
                      lat={bill.gpsLat}
                      lon={bill.gpsLon}
                      className="text-xs text-emerald-600 font-medium"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Financial Breakdown & Receipt Document */}
            <div className="space-y-3.5">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider px-1">
                Financial Details & Receipt
              </h3>

              <DetailItem 
                icon={Receipt} 
                label="Bill Number" 
                value={bill.billNo} 
              />

              <DetailItem 
                icon={Gauge} 
                label="Odometer / Meter (KM)" 
                value={bill.meterReading > 0 ? `${bill.meterReading.toLocaleString()} KM` : "Not recorded"} 
              />

              <DetailItem 
                icon={Droplets} 
                label="Diesel Quantity" 
                value={`${bill.litres.toFixed(2)} Litres @ ₹ ${bill.rate.toFixed(2)}/L`} 
              />

              {/* Receipt Document Viewer Link */}
              <div className="p-4 rounded-2xl border border-slate-200/80 bg-white shadow-xs flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200">
                    <FileText size={18} />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-800">Receipt Document</div>
                    <div className="text-[11px] text-slate-400">View / inspect uploaded diesel bill</div>
                  </div>
                </div>
                {bill.image ? (
                  <BillPreviewLink
                    href={bill.image}
                    fileName={bill.imageName || `${bill.billNo}.png`}
                  />
                ) : (
                  <span className="text-xs text-slate-400 font-medium">Not Uploaded</span>
                )}
              </div>
            </div>
          </div>

          {/* Remarks Section */}
          {bill.remarks && (
            <div className="p-4 md:p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
              <div className="flex items-start gap-3">
                <MessageSquare size={18} className="text-emerald-600 mt-0.5 shrink-0" />
                <div>
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Remarks / Operator Notes</div>
                  <p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-medium">{bill.remarks}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Section */}
        <div className="px-6 md:px-8 py-4 border-t border-slate-100 bg-gradient-to-r from-slate-50/80 via-white to-slate-50/80 flex items-center justify-end gap-3 rounded-b-2xl shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="group relative inline-flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-all active:scale-95 cursor-pointer"
            aria-label={t("common.close")}
          >
            <span className={`inline-flex ${uiActionIconMotionClass.close}`}>
              <X size={15} />
            </span>
            <span>{t("common.close")}</span>
          </button>
        </div>

      </div>
    </AppShellModal>
  );
}

export default React.memo(FuelViewModal);
