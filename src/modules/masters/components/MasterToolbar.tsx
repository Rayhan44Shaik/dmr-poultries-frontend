import { FileSpreadsheet, FileText } from "lucide-react";
import MasterDropdown from "./MasterDropdown";

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
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-end gap-3">
        <MasterDropdown
          label="Select Module"
          value={moduleName}
          onChange={onModuleChange}
          options={[
            "Shops",
            "Farms",
            "Vehicles",
            "Employees",
            "Banks",
            "Bird Types",
            "Routes",
          ]}
          className="w-56"
        />
        <MasterDropdown
          label="Status"
          value={status}
          onChange={onStatusChange}
          options={["All", "Active", "Inactive"]}
          className="w-56"
        />
        <p className="pb-2 text-xs text-slate-500">
          Showing{" "}
          <span className="font-semibold tabular-nums text-emerald-700">
            {totalRecords}
          </span>{" "}
          records
        </p>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onExcel}
          className="flex h-9 items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          <FileSpreadsheet size={14} />
          Excel
        </button>
        <button
          type="button"
          onClick={onPdf}
          className="flex h-9 items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          <FileText size={14} />
          PDF
        </button>
      </div>
    </div>
  );
}

export default MasterToolbar;
