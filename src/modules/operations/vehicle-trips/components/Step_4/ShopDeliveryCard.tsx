import { Box, Users, Scale, Clock, Pencil, FileText, Package, AlertCircle, Store } from "lucide-react";
import type { ShopDelivery } from "../../types/trip";
import type { ShopDeliveryWithExtra } from "./useShopDeliveryForm";
import { useI18n } from "../../../../../i18n";

interface Props {
  row: ShopDeliveryWithExtra;
  readOnly: boolean;
  onEdit: (row: ShopDelivery) => void;
  onPDF: (row: ShopDeliveryWithExtra) => void;
  supervisorName?: string;
  supervisorPhone?: string;
  vehicleNo?: string;
  tripDate?: string;
  /** Delivered outside the assignment plan — keep visible, never invent qty. */
  unassigned?: boolean;
}

export default function ShopDeliveryCard({
  row,
  readOnly,
  onEdit,
  onPDF,
  unassigned = false,
}: Props) {
  const { t } = useI18n();
  const isWeightMode = row.deliveryMode === "weight";
  const selectedBoxes = row.selectedBoxIds || [];
  const perBox = row.perBoxData || [];
  const mortalityCount = row.mortality ?? 0;
  const mortKg = row.mortKg ?? 0;
  const display = (value: string | number | null | undefined) => {
    if (value == null || value === "" || (typeof value === "number" && Number.isNaN(value))) return t("ops.trip.not_entered");
    return String(value);
  };

  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border shadow-sm hover:shadow-lg transition-all duration-200 flex flex-col ${
        unassigned
          ? "bg-orange-50/70 border-orange-200"
          : "bg-white border-slate-200/80"
      }`}
    >
      {/* Top accent strip */}
      <span
        className={`absolute inset-x-0 top-0 h-1 ${
          unassigned
            ? "bg-gradient-to-r from-orange-400 to-amber-400"
            : isWeightMode
              ? "bg-gradient-to-r from-purple-500 to-fuchsia-500"
              : "bg-gradient-to-r from-emerald-500 to-teal-500"
        }`}
      />

      <div className="p-4 flex flex-col gap-3 flex-1 pt-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 border ${
                unassigned
                  ? "bg-orange-100 text-orange-600 border-orange-200"
                  : isWeightMode
                    ? "bg-purple-50 text-purple-600 border-purple-100"
                    : "bg-emerald-50 text-emerald-600 border-emerald-100"
              }`}
            >
              {isWeightMode ? <Scale size={17} /> : <Store size={17} />}
            </div>
            <div className="min-w-0">
              <p className="font-bold text-slate-800 text-sm truncate leading-tight" title={row.shopName}>
                {row.shopName || t("ops.trip.not_entered")}
              </p>
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                <span
                  title={`${t("ops.trip.delivery_mode")}: ${isWeightMode ? t("ops.trip.weight_mode") : t("ops.trip.box_mode")}`}
                  className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold shrink-0 border ${
                    isWeightMode
                      ? "bg-purple-50 text-purple-700 border-purple-200/60"
                      : "bg-amber-50 text-amber-700 border-amber-200/60"
                  }`}
                >
                  {isWeightMode ? t("ops.trip.weight_mode") : t("ops.trip.box_mode")}
                </span>
                {mortalityCount > 0 && (
                  <span
                    title={`${t("operations.mortality_count")}: ${mortalityCount} ${t("common.birds")}`}
                    className="px-1.5 py-0.5 rounded-md bg-red-50 text-red-700 border border-red-200/60 shrink-0 flex items-center gap-1 text-[10px] font-bold"
                  >
                    <AlertCircle size={12} className="text-rose-500 stroke-[2.5]" />
                    <span>{mortalityCount}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {!readOnly && (
              <button
                onClick={() => onEdit(row)}
                className="p-1.5 rounded-lg bg-slate-50 hover:bg-blue-50 text-slate-500 hover:text-blue-600 border border-slate-200/60 transition-colors flex items-center justify-center"
                title={t("ops.trip.edit_shop_delivery")}
              >
                <Pencil size={14} className="stroke-[2]" />
              </button>
            )}
            <button
              onClick={() => onPDF(row)}
              className="p-1.5 rounded-lg bg-slate-50 hover:bg-rose-50 text-slate-500 hover:text-rose-600 border border-slate-200/60 transition-colors flex items-center justify-center"
              title={t("ops.trip.download_pdf")}
            >
              <FileText size={14} className="stroke-[2]" />
            </button>
          </div>
        </div>

        {/* KPI trio */}
        <div className="grid grid-cols-3 gap-2 bg-slate-50/70 p-2 rounded-xl border border-slate-100">
          <div className="flex flex-col items-center justify-center text-center p-1.5 bg-white rounded-lg border border-slate-200/50 shadow-2xs">
            <span className="text-[10px] uppercase font-semibold text-slate-400 flex items-center gap-1 mb-0.5">
              <Box size={11} className="text-slate-500 stroke-[2]" /> {t("common.boxes")}
            </span>
            <span className="text-sm font-bold text-slate-800">{display(selectedBoxes.length || row.boxNo)}</span>
          </div>
          <div className="flex flex-col items-center justify-center text-center p-1.5 bg-white rounded-lg border border-slate-200/50 shadow-2xs">
            <span className="text-[10px] uppercase font-semibold text-slate-400 flex items-center gap-1 mb-0.5">
              <Users size={11} className="text-blue-500 stroke-[2]" /> {t("common.birds")}
            </span>
            <span className="text-sm font-bold text-slate-800">{row.birds ? row.birds : t("ops.trip.not_entered")}</span>
          </div>
          <div className="flex flex-col items-center justify-center text-center p-1.5 bg-white rounded-lg border border-slate-200/50 shadow-2xs">
            <span className="text-[10px] uppercase font-semibold text-slate-400 flex items-center gap-1 mb-0.5">
              <Scale size={11} className="text-emerald-500 stroke-[2]" /> {t("common.weight")}
            </span>
            <span className="text-sm font-bold text-slate-800">
              {row.weight ? `${row.weight.toFixed(2)} kg` : t("ops.trip.not_entered")}
            </span>
          </div>
        </div>

        {(mortalityCount > 0 || mortKg > 0) && (
          <div className="flex items-center justify-between px-2.5 py-1.5 bg-red-50/70 rounded-lg border border-red-100 text-[11px]">
            <span className="text-red-600 font-semibold">{t("operations.mortality_count")}</span>
            <span className="text-red-700 font-bold">
              {mortalityCount} {t("common.birds")} · {mortKg ? mortKg.toFixed(2) : "0.00"} kg
            </span>
          </div>
        )}

        {selectedBoxes.length > 0 && (
          <div className="flex items-center gap-1.5 px-2.5 py-2 bg-slate-100/70 rounded-lg border border-slate-200/40 text-[11px] overflow-x-auto no-scrollbar">
            <span className="text-slate-400 font-semibold flex items-center gap-1 shrink-0 text-[10px] uppercase">
              <Package size={12} className="text-slate-500" /> {t("ops.trip.box_nos")}:
            </span>
            <div className="flex items-center gap-1 flex-wrap">
              {selectedBoxes.map((id) => (
                <span
                  key={id}
                  className="px-1.5 py-0.5 bg-white text-slate-700 font-bold rounded-md border border-slate-200/80 text-[10px] shadow-2xs shrink-0"
                >
                  #{id}
                </span>
              ))}
            </div>
          </div>
        )}

        {perBox.length > 0 && (
          <div className="rounded-lg border border-slate-200/60 bg-white px-2.5 py-2 text-[11px]">
            <span className="text-slate-400 font-semibold uppercase text-[10px]">{t("ops.trip.per_box_allocation")}</span>
            <div className="mt-1 space-y-1">
              {perBox.map((pb) => (
                <div key={pb.boxNo} className="flex justify-between text-slate-700 gap-2">
                  <span className="font-bold shrink-0">#{pb.boxNo}</span>
                  <span className="text-right">
                    {pb.birds} {t("common.birds")} · {Number(pb.weight || 0).toFixed(2)} kg
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {unassigned ? (
          <p className="rounded-lg border border-orange-200 bg-orange-100/80 px-2.5 py-1.5 text-[11px] font-semibold text-orange-800">
            {t("ops.trip.assignment_details_unavailable")}
          </p>
        ) : null}

        {row.remarks ? (
          <p className="text-[11px] text-slate-500 px-1">
            <span className="font-semibold text-slate-400 uppercase text-[10px]">{t("common.remarks")} </span>
            {row.remarks}
          </p>
        ) : null}

        <div className="flex items-center justify-between pt-1 mt-auto text-[11px] text-slate-400 font-medium border-t border-slate-100">
          <div className="flex items-center gap-1">
            <Clock size={12} className="text-slate-400 stroke-[2]" />
            <span>{t("ops.trip.captured")} {row.autoCaptureTime || "—"}</span>
          </div>
          {row.birdType ? (
            <span className="px-2 py-0.5 bg-blue-50 text-blue-700 font-semibold rounded-md text-[10px] border border-blue-100">
              {row.birdType}
            </span>
          ) : (
            <span className="text-[10px]">{t("ops.trip.not_entered")}</span>
          )}
        </div>
      </div>
    </div>
  );
}
