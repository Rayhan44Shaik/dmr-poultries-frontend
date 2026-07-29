import React from "react";
import { Check, Box, Users, Scale, Clock, Pencil, FileText, User, Phone, Truck, Calendar, Store } from "lucide-react";
import type { ShopDelivery } from "../../types/trip";
import { ShopDeliveryWithExtra } from "./useShopDeliveryForm";

interface Props {
  row: ShopDeliveryWithExtra;
  readOnly: boolean;
  onEdit: (row: ShopDelivery) => void;
  onPDF: (row: ShopDeliveryWithExtra) => void;
  supervisorName?: string;
  supervisorPhone?: string;
  vehicleNo?: string;
  tripDate?: string;
}

export default function ShopDeliveryCard({
  row,
  readOnly,
  onEdit,
  onPDF,
  supervisorName = "N/A",
  supervisorPhone = "N/A",
  vehicleNo = "N/A",
  tripDate = "N/A",
}: Props) {
  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between gap-3">
      {/* Top Bar: Shop Name & Action Buttons */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="h-7 w-7 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-200/50">
            <Check size={16} className="stroke-[2.5]" />
          </div>
          <span className="font-bold text-slate-800 text-sm truncate" title={row.shopName}>
            {row.shopName}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {!readOnly && (
            <button
              onClick={() => onEdit(row)}
              className="p-1.5 rounded-lg bg-slate-50 hover:bg-blue-50 text-slate-500 hover:text-blue-600 border border-slate-200/60 transition-colors flex items-center gap-1 text-xs font-medium"
              title="Edit"
            >
              <Pencil size={14} className="stroke-[2]" />
            </button>
          )}
          <button
            onClick={() => onPDF(row)}
            className="p-1.5 rounded-lg bg-slate-50 hover:bg-rose-50 text-slate-500 hover:text-rose-600 border border-slate-200/60 transition-colors flex items-center gap-1 text-xs font-medium"
            title="Download PDF"
          >
            <FileText size={14} className="stroke-[2]" />
          </button>
        </div>
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-3 gap-2 bg-slate-50/70 p-2.5 rounded-xl border border-slate-100">
        <div className="flex flex-col items-center justify-center text-center p-1 bg-white rounded-lg border border-slate-200/50 shadow-2xs">
          <span className="text-[10px] uppercase font-semibold text-slate-400 flex items-center gap-1 mb-0.5">
            <Box size={12} className="text-slate-500 stroke-[2]" /> Boxes
          </span>
          <span className="text-xs font-bold text-slate-800">{row.boxNo}</span>
        </div>

        <div className="flex flex-col items-center justify-center text-center p-1 bg-white rounded-lg border border-slate-200/50 shadow-2xs">
          <span className="text-[10px] uppercase font-semibold text-slate-400 flex items-center gap-1 mb-0.5">
            <Users size={12} className="text-blue-500 stroke-[2]" /> Birds
          </span>
          <span className="text-xs font-bold text-slate-800">{row.birds}</span>
        </div>

        <div className="flex flex-col items-center justify-center text-center p-1 bg-white rounded-lg border border-slate-200/50 shadow-2xs">
          <span className="text-[10px] uppercase font-semibold text-slate-400 flex items-center gap-1 mb-0.5">
            <Scale size={12} className="text-emerald-500 stroke-[2]" /> Weight
          </span>
          <span className="text-xs font-bold text-slate-800">{row.weight.toFixed(2)} kg</span>
        </div>
      </div>

      {/* Footer Info */}
      <div className="flex items-center justify-between pt-1 text-[11px] text-slate-400 font-medium">
        <div className="flex items-center gap-1">
          <Clock size={12} className="text-slate-400 stroke-[2]" />
          <span>{row.autoCaptureTime || "Just now"}</span>
        </div>
        {row.birdType && (
          <span className="px-2 py-0.5 bg-blue-50 text-blue-700 font-semibold rounded-md text-[10px] border border-blue-100">
            {row.birdType}
          </span>
        )}
      </div>
    </div>
  );
}