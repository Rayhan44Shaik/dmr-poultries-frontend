import { Box, Users, Scale, Clock, Pencil, FileText, Package, AlertCircle } from "lucide-react";
import type { ShopDelivery } from "../../types/trip";
import type { ShopDeliveryWithExtra } from "./useShopDeliveryForm";
import { useI18n } from "../../../../../i18n";

interface Props {
  row: ShopDeliveryWithExtra;
  readOnly: boolean;
  onEdit: (row: ShopDelivery) => void;
  onPDF: (row: ShopDeliveryWithExtra) => void;
}

/** Soft, low-eye-strain tints for box-number chips in the card. */
const BOX_CHIP_PALETTE = [
  "bg-slate-100 text-slate-700 border-slate-200",
  "bg-sky-50 text-sky-700 border-sky-100",
  "bg-indigo-50 text-indigo-700 border-indigo-100",
  "bg-teal-50 text-teal-700 border-teal-100",
  "bg-amber-50 text-amber-700 border-amber-100",
  "bg-rose-50 text-rose-600 border-rose-100",
];

export default function ShopDeliveryCard({ row, readOnly, onEdit, onPDF }: Props) {
  const { t } = useI18n();
  const isWeightMode = row.deliveryMode === "weight";
  const selectedBoxes = row.selectedBoxIds || [];
  const manyBoxes = selectedBoxes.length > 30;
  const mortalityCount = row.mortality ?? 0;
  const mortKg = row.mortKg ?? 0;
  const display = (value: string | number | null | undefined) => {
    if (value == null || value === "" || (typeof value === "number" && Number.isNaN(value))) return t("ops.trip.not_entered");
    return String(value);
  };

  return (
    <div className="group relative overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm hover:shadow-md transition-all duration-200 flex flex-col">
      <div className="p-3 flex flex-col gap-2.5 flex-1">
        {/* Header — mode tile + shop name vertically centred on the logo */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 border ${
                isWeightMode
                  ? "bg-purple-50 text-purple-600 border-purple-100"
                  : "bg-blue-50 text-blue-600 border-blue-100"
              }`}
              title={isWeightMode ? t("ops.trip.weight_mode") : t("ops.trip.box_mode")}
            >
              {isWeightMode ? <Scale size={15} /> : <Box size={15} />}
            </div>
            <p className="font-bold text-slate-800 text-[13px] truncate leading-tight" title={row.shopName}>
              {row.shopName || t("ops.trip.not_entered")}
            </p>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {!readOnly && (
              <button
                onClick={() => onEdit(row)}
                className="p-1.5 rounded-lg bg-slate-50 hover:bg-blue-50 text-slate-500 hover:text-blue-600 border border-slate-200/60 transition-colors flex items-center justify-center"
                title={t("ops.trip.edit_shop_delivery")}
              >
                <Pencil size={13} className="stroke-[2]" />
              </button>
            )}
            <button
              onClick={() => onPDF(row)}
              className="p-1.5 rounded-lg bg-slate-50 hover:bg-rose-50 text-slate-500 hover:text-rose-600 border border-slate-200/60 transition-colors flex items-center justify-center"
              title={t("ops.trip.download_pdf")}
            >
              <FileText size={13} className="stroke-[2]" />
            </button>
          </div>
        </div>

        {/* KPI trio */}
        <div className="grid grid-cols-3 gap-1.5 bg-slate-50/70 p-1.5 rounded-lg border border-slate-100">
          <div className="flex flex-col items-center justify-center text-center p-1 bg-white rounded-md border border-slate-200/50">
            <span className="text-[9px] uppercase font-semibold text-slate-400 flex items-center gap-0.5 mb-0.5">
              <Box size={10} className="text-slate-500 stroke-[2]" /> {t("common.boxes")}
            </span>
            <span className="text-[13px] font-bold text-slate-800">{display(selectedBoxes.length || row.boxNo)}</span>
          </div>
          <div className="flex flex-col items-center justify-center text-center p-1 bg-white rounded-md border border-slate-200/50">
            <span className="text-[9px] uppercase font-semibold text-slate-400 flex items-center gap-0.5 mb-0.5">
              <Users size={10} className="text-blue-500 stroke-[2]" /> {t("common.birds")}
            </span>
            <span className="text-[13px] font-bold text-slate-800">{row.birds ? row.birds : t("ops.trip.not_entered")}</span>
          </div>
          <div className="flex flex-col items-center justify-center text-center p-1 bg-white rounded-md border border-slate-200/50">
            <span className="text-[9px] uppercase font-semibold text-slate-400 flex items-center gap-0.5 mb-0.5">
              <Scale size={10} className="text-emerald-500 stroke-[2]" /> {t("common.weight")}
            </span>
            <span className="text-[13px] font-bold text-slate-800">
              {row.weight ? `${Number(row.weight).toFixed(2)} kg` : t("ops.trip.not_entered")}
            </span>
          </div>
        </div>

        {(mortalityCount > 0 || mortKg > 0) && (
          <div className="flex items-center justify-between px-2 py-1 bg-rose-50/70 rounded-md border border-rose-100 text-[10px]">
            <span className="text-rose-500 font-semibold">{t("operations.mortality_count")}</span>
            <span className="text-rose-600 font-bold">
              {mortalityCount} {t("common.birds")} · {mortKg ? Number(mortKg).toFixed(2) : "0.00"} kg
            </span>
          </div>
        )}

        {selectedBoxes.length > 0 && (
          <div
            className={`flex items-center gap-1.5 px-2 py-1.5 bg-slate-100/70 rounded-md border border-slate-200/40 overflow-x-auto no-scrollbar ${
              manyBoxes ? "text-[9px]" : "text-[10px]"
            }`}
          >
            <span className="text-slate-400 font-semibold flex items-center gap-1 shrink-0 text-[9px] uppercase">
              <Package size={11} className="text-slate-500" /> {t("ops.trip.box_nos")}:
            </span>
            <div className={`flex items-center flex-wrap ${manyBoxes ? "gap-0.5" : "gap-1"}`}>
              {selectedBoxes.map((id, idx) => (
                <span
                  key={id}
                  className={`rounded border font-bold shrink-0 ${
                    manyBoxes ? "px-1 py-px text-[9px]" : "px-1.5 py-0.5 text-[10px]"
                  } ${BOX_CHIP_PALETTE[idx % BOX_CHIP_PALETTE.length]}`}
                >
                  {id}
                </span>
              ))}
            </div>
          </div>
        )}

        {row.remarks ? (
          <p className="text-[10px] text-slate-500 px-0.5 truncate" title={row.remarks}>
            <span className="font-semibold text-slate-400 uppercase text-[9px]">{t("common.remarks")}: </span>
            {row.remarks}
          </p>
        ) : null}

        {/* Footer — mortality + bird type take the old "time" slot (left),
            captured time moves to the right */}
        <div className="flex items-center justify-between gap-2 pt-1 mt-auto text-[10px] font-medium border-t border-slate-100">
          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
            {mortalityCount > 0 && (
              <span className="px-1.5 py-px rounded bg-rose-50 text-rose-600 border border-rose-200/60 shrink-0 flex items-center gap-1 text-[10px] font-bold">
                <AlertCircle size={11} className="text-rose-400 stroke-[2.5]" />
                <span>
                  {t("operations.mortality_count")}: {mortalityCount}
                </span>
              </span>
            )}
            {row.birdType ? (
              <span className="px-1.5 py-px rounded bg-blue-50 text-blue-700 font-semibold text-[10px] border border-blue-100 shrink-0">
                {row.birdType}
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-1 shrink-0 text-slate-400">
            <Clock size={11} className="text-slate-400 stroke-[2]" />
            <span>{t("ops.trip.captured")} {row.autoCaptureTime || "—"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
