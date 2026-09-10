import React, { useCallback } from "react";
import { Pencil, X } from "lucide-react";
import type { Trip } from "../types/trip";
import { useI18n } from "../../../../i18n";

interface Props {
  open: boolean;
  trip: Trip | null;
  onClose: () => void;
  onEdit: (trip: Trip) => void;
}

function TripEditModal({ open, trip, onClose, onEdit }: Props) {
  const { t } = useI18n();
  const handleEdit = useCallback(() => {
    if (trip) {
      onClose();
      onEdit(trip);
    }
  }, [trip, onClose, onEdit]);

  if (!open || !trip) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl w-[480px]">
        <div className="flex items-center justify-between px-6 py-5 border-b">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-green-100 flex items-center justify-center">
              <Pencil size={22} className="text-green-700" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">{t("ops.trip.edit_trip")}</h2>
              <p className="text-sm text-slate-500">{t("ops.trip.edit_selected_trip")}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="h-10 w-10 rounded-full hover:bg-slate-100 flex items-center justify-center"
          >
            <X size={20} />
          </button>
        </div>
        <div className="px-6 py-6 space-y-5">
          <div className="text-slate-700">
            {t("ops.trip.edit_load_hint")}
          </div>
          <div className="rounded-xl border bg-slate-50 p-5 space-y-3">
            <div className="flex justify-between">
              <span className="text-slate-500">{t("operations.trip_no")}</span>
              <span className="font-semibold">{trip.tripNo}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">{t("common.vehicle")}</span>
              <span>{trip.vehicleNo}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">{t("common.driver")}</span>
              <span>{trip.driverName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">{t("common.date")}</span>
              <span>{trip.tripDate}</span>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-5 border-t">
          <button onClick={onClose} className="h-10 px-5 rounded-xl border inline-flex items-center justify-center shrink-0">
            {t("common.cancel")}
          </button>
          <button
            onClick={handleEdit}
            className="h-10 px-5 rounded-xl bg-green-700 hover:bg-green-800 text-white inline-flex items-center justify-center shrink-0"
          >
            {t("ops.trip.edit_trip")}
          </button>
        </div>
      </div>
    </div>
  );
}

export default React.memo(TripEditModal);