import { FileSpreadsheet, FileText } from "lucide-react";
import { useLanguage } from "../../../providers/languageContext";

type MasterToolbarProps = {
  moduleName: string;
  status: string;
  totalRecords: number;
  onModuleChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onExcel: () => void;
  onPdf: () => void;
};

function MasterToolbar({
  moduleName,
  status,
  totalRecords,
  onModuleChange,
  onStatusChange,
  onExcel,
  onPdf,
}: MasterToolbarProps) {
  const { t } = useLanguage();

  const moduleOptions = [
    { value: "Shops", label: t("masters.shops") },
    { value: "Farms", label: t("masters.farms") },
    { value: "Vehicles", label: t("masters.vehicles") },
    { value: "Employees", label: t("masters.employees") },
    { value: "Banks", label: t("masters.banks") },
    { value: "BirdTypes", label: t("masters.birdTypes") },
    { value: "Routes", label: t("masters.routes") },
  ];

  return (
    <div className="bg-white rounded-2xl shadow-sm border p-6 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100">
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-5">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">
              {t("common.selectModule")}
            </label>
            <select
              value={moduleName}
              onChange={(e) => onModuleChange(e.target.value)}
              className="w-52 border rounded-xl px-4 py-3 focus:ring-2 focus:ring-green-600 outline-none dark:bg-slate-900 dark:border-slate-600 dark:text-slate-100"
            >
              {moduleOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">
              {t("common.status")}
            </label>
            <select
              value={status}
              onChange={(e) => onStatusChange(e.target.value)}
              className="w-40 border rounded-xl px-4 py-3 focus:ring-2 focus:ring-green-600 outline-none dark:bg-slate-900 dark:border-slate-600 dark:text-slate-100"
            >
              <option value="All">{t("common.all")}</option>
              <option value="Active">{t("status.active")}</option>
              <option value="Inactive">{t("status.inactive")}</option>
            </select>
          </div>
          <div className="pt-7">
            <span className="text-sm text-slate-500 dark:text-slate-400">{t("common.showing")}</span>
            <span className="ml-2 font-semibold text-green-700">{totalRecords}</span>
            <span className="ml-1 text-sm text-slate-500 dark:text-slate-400">{t("common.records")}</span>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onExcel}
            className="flex items-center gap-2 bg-green-700 hover:bg-green-800 text-white px-6 py-3 rounded-xl transition"
          >
            <FileSpreadsheet size={20} /> {t("common.export")} Excel
          </button>
          <button
            onClick={onPdf}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-xl transition"
          >
            <FileText size={20} /> {t("common.export")} PDF
          </button>
        </div>
      </div>
    </div>
  );
}

export default MasterToolbar;
