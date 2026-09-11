import React from "react";
import { RotateCcw, Save, SaveAll } from "lucide-react";
import { useI18n } from "../../../../i18n";

interface Props {
  onClear: () => void;
  onSave: () => void;
  onSaveNew: () => void;
}

function TripFooter({ onClear, onSave, onSaveNew }: Props) {
  const { t } = useI18n();
  return (
    <div className="flex justify-end items-center gap-3 pt-4 border-t border-slate-200 mt-8">
      <button
        type="button"
        onClick={onClear}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-all"
      >
        <RotateCcw size={16} />
        {t("common.clear")}
      </button>
      <button
        type="button"
        onClick={onSave}
        className="inline-flex items-center gap-1.5 rounded-lg bg-green-500 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-green-600 transition-all"
      >
        <Save size={16} />
        {t("ops.trip.save_trip")}
      </button>
      <button
        type="button"
        onClick={onSaveNew}
        className="inline-flex items-center gap-1.5 rounded-lg bg-blue-500 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-600 transition-all"
      >
        <SaveAll size={16} />
        {t("ops.trip.save_and_new")}
      </button>
    </div>
  );
}

export default React.memo(TripFooter);