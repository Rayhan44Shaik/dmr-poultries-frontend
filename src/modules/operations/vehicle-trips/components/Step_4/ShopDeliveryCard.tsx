import React from "react";
import { Check, Box, Users, Scale, Clock, Pencil, FileText } from "lucide-react";
import type { ShopDelivery } from "../../types/trip";
import { ShopDeliveryWithExtra } from "./useShopDeliveryForm";

interface Props {
  row: ShopDeliveryWithExtra;
  readOnly: boolean;
  onEdit: (row: ShopDelivery) => void;
  onPDF: (row: ShopDeliveryWithExtra) => void;
}

export default function ShopDeliveryCard({ row, readOnly, onEdit, onPDF }: Props) {
  return (
    <div className="group bg-white border border-slate-200 rounded-2xl p-4 shadow-xs hover:shadow-md transition-all duration-300 flex flex-col justify-between">
      <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 mb-2.5">
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="h-6 w-6 rounded-full bg-emerald-500 flex items-center justify-center text-white shrink-0">
            <Check size={14} />
          </div>
          <span className="font-semibold text-slate-800 text-sm truncate" title={row.shopName}>
            {row.shopName}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {!readOnly && (   // ✅ edit icon shows only when readOnly is false
            <button
              onClick={() => onEdit(row)}
              className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600 transition-colors flex items-center gap-1 font-medium text-xs"
              title="Edit"
            >
              <Pencil size={15} />
            </button>
          )}
          <button
            onClick={() => onPDF(row)}
            className="p-1.5 rounded-lg hover:bg-red-50 text-red-600 transition-colors flex items-center gap-1 font-medium text-xs"
            title="Download PDF"
          >
            <FileText size={15} />
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between py-1 my-1">
        <div className="flex items-center gap-1 text-slate-600 font-medium text-xs bg-slate-100 px-2.5 py-1 rounded-lg">
          <Box size={14} className="text-slate-500" />
          <span>{row.boxNo} Box{row.boxNo > 1 ? "es" : ""}</span>
        </div>
        <div className="flex items-center gap-1 text-slate-800 font-semibold text-xs">
          <Users size={14} className="text-blue-500" />
          <span>{row.birds} Birds</span>
        </div>
        <div className="flex items-center gap-1 text-slate-800 font-semibold text-xs">
          <Scale size={14} className="text-emerald-500" />
          <span>{row.weight.toFixed(2)} kg</span>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-slate-100 pt-2 mt-1 text-[11px] text-slate-400">
        <div className="flex items-center gap-1">
          <Clock size={12} />
          <span>{row.autoCaptureTime || "Just now"}</span>
        </div>
      </div>
    </div>
  );
}