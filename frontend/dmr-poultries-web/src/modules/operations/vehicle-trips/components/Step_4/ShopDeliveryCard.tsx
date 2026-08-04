import React from "react";
import { Check, Box, Users, Scale, Clock, Pencil, FileText, Package, AlertCircle } from "lucide-react";
import type { ShopDelivery } from "../../types/trip";
import type { ShopDeliveryWithExtra } from "./useShopDeliveryForm";

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
}: Props) {
  const isWeightMode = row.deliveryMode === "weight";
  const selectedBoxes = row.selectedBoxIds || [];
  const mortalityCount = row.mortality || 0;

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-3.5 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between gap-2.5">
      {/* Top Bar: Shop Name, Mode Icon Badge, Mortality Badge & Actions */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 gap-2">
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="h-7 w-7 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-200/50">
            <Check size={16} className="stroke-[2.5]" />
          </div>

          <div className="flex items-center gap-1.5 overflow-hidden">
            <span
              className="font-bold text-slate-800 text-sm truncate"
              title={row.shopName}
            >
              {row.shopName}
            </span>

            {/* Compact Mode Logo Badge */}
            {isWeightMode ? (
              <span
                title="Delivery Mode: Weight"
                className="p-1 rounded-md bg-purple-50 text-purple-700 border border-purple-200/60 shrink-0 flex items-center justify-center"
              >
                <Scale size={13} className="stroke-[2.5]" />
              </span>
            ) : (
              <span
                title="Delivery Mode: Box"
                className="p-1 rounded-md bg-amber-50 text-amber-700 border border-amber-200/60 shrink-0 flex items-center justify-center"
              >
                <Box size={13} className="stroke-[2.5]" />
              </span>
            )}

            {/* Mortality Badge (Shown only if mortality > 0) */}
            {mortalityCount > 0 && (
              <span
                title={`Mortality: ${mortalityCount} birds`}
                className="px-1.5 py-0.5 rounded-md bg-red-50 text-red-700 border border-red-200/60 shrink-0 flex items-center gap-1 text-[10px] font-bold"
              >
                <AlertCircle size={13} className="text-rose-500 stroke-[2.5]" />
                <span>{mortalityCount}</span>
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {!readOnly && (
            <button
              onClick={() => onEdit(row)}
              className="p-1.5 rounded-lg bg-slate-50 hover:bg-blue-50 text-slate-500 hover:text-blue-600 border border-slate-200/60 transition-colors flex items-center justify-center"
              title="Edit Shop Delivery"
            >
              <Pencil size={14} className="stroke-[2]" />
            </button>
          )}

          <button
            onClick={() => onPDF(row)}
            className="p-1.5 rounded-lg bg-slate-50 hover:bg-rose-50 text-slate-500 hover:text-rose-600 border border-slate-200/60 transition-colors flex items-center justify-center"
            title="Download PDF"
          >
            <FileText size={14} className="stroke-[2]" />
          </button>
        </div>
      </div>

      {/* Details Grid: Boxes, Birds, Weight */}
      <div className="grid grid-cols-3 gap-2 bg-slate-50/70 p-2 rounded-xl border border-slate-100">
        <div className="flex flex-col items-center justify-center text-center p-1 bg-white rounded-lg border border-slate-200/50 shadow-2xs">
          <span className="text-[10px] uppercase font-semibold text-slate-400 flex items-center gap-1 mb-0.5">
            <Box size={11} className="text-slate-500 stroke-[2]" /> Boxes
          </span>
          <span className="text-xs font-bold text-slate-800">{row.boxNo}</span>
        </div>

        <div className="flex flex-col items-center justify-center text-center p-1 bg-white rounded-lg border border-slate-200/50 shadow-2xs">
          <span className="text-[10px] uppercase font-semibold text-slate-400 flex items-center gap-1 mb-0.5">
            <Users size={11} className="text-blue-500 stroke-[2]" /> Birds
          </span>
          <span className="text-xs font-bold text-slate-800">{row.birds}</span>
        </div>

        <div className="flex flex-col items-center justify-center text-center p-1 bg-white rounded-lg border border-slate-200/50 shadow-2xs">
          <span className="text-[10px] uppercase font-semibold text-slate-400 flex items-center gap-1 mb-0.5">
            <Scale size={11} className="text-emerald-500 stroke-[2]" /> Weight
          </span>
          <span className="text-xs font-bold text-slate-800">
            {row.weight ? row.weight.toFixed(2) : "0.00"} kg
          </span>
        </div>
      </div>

      {/* Box Numbers Badges Section */}
      {selectedBoxes.length > 0 && (
        <div className="flex items-center gap-1.5 px-2 py-1.5 bg-slate-100/60 rounded-lg border border-slate-200/40 text-[11px] overflow-x-auto no-scrollbar">
          <span className="text-slate-400 font-semibold flex items-center gap-1 shrink-0 text-[10px] uppercase">
            <Package size={12} className="text-slate-500" /> Box Nos:
          </span>
          <div className="flex items-center gap-1 flex-wrap">
            {selectedBoxes.map((id) => (
              <span
                key={id}
                className="px-1.5 py-0.2 bg-white text-slate-700 font-bold rounded border border-slate-200/80 text-[10px] shadow-2xs shrink-0"
              >
                #{id}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Footer Info: Time & Bird Type */}
      <div className="flex items-center justify-between pt-0.5 text-[11px] text-slate-400 font-medium">
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