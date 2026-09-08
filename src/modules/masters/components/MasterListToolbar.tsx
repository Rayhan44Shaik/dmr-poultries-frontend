import { useId, type ReactNode } from "react";
import {
  FileSpreadsheet,
  FileText,
  Plus,
  Search,
  Upload,
  X,
} from "lucide-react";
import { useI18n } from "../../../i18n";
import MasterDropdown from "./MasterDropdown";

interface MasterListToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  addLabel: string;
  onAdd: () => void;
  onExportPDF: () => void;
  onExportExcel: () => void;
  onImport?: () => void;
  loading?: boolean;
  saving?: boolean;
  children?: ReactNode;
}

/** Shared responsive toolbar for Shops, Farms, Vehicles, Employees, Banks and Bird Types. */
export default function MasterListToolbar({
  search,
  onSearchChange,
  searchPlaceholder,
  addLabel,
  onAdd,
  onExportPDF,
  onExportExcel,
  onImport,
  loading = false,
  saving = false,
  children,
}: MasterListToolbarProps) {
  const { t } = useI18n();
  const id = useId();
  return (
    <div
      className="flex flex-wrap items-end justify-between gap-x-5 gap-y-4 rounded-t-xl border-b border-slate-200/80 bg-white p-4"
      data-master-toolbar
    >
      <div className="flex min-w-0 flex-1 flex-wrap items-end gap-3">
        <div className="min-w-0 basis-full sm:min-w-52 sm:max-w-sm sm:flex-1 sm:basis-64">
          <label
            htmlFor={id}
            className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500"
          >
            {t("common.search")}
          </label>
          <div className="relative">
            <Search
              size={14}
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              id={id}
              type="search"
              autoComplete="off"
              aria-label={searchPlaceholder.replace(/\.+$/, "")}
              placeholder={searchPlaceholder}
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              disabled={loading}
              className="h-9 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-8 text-xs text-slate-700 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50 [&::-webkit-search-cancel-button]:appearance-none"
            />
            {search && (
              <button
                type="button"
                disabled={loading}
                aria-label={t("masters.ui.clear_search")}
                onClick={() => onSearchChange("")}
                className="absolute right-1 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-600 disabled:opacity-50"
              >
                <X size={13} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
        {children}
      </div>
      <div
        className="flex flex-wrap items-center gap-2"
        role="group"
        aria-label={t("masters.ui.actions")}
      >
        <MasterDropdown
          label={t("common.export")}
          placeholder={t("common.export")}
          hideLabel
          className="w-28"
          kind="action"
          value=""
          options={[
            { value: "pdf", label: "PDF", icon: <FileText size={14} /> },
            {
              value: "excel",
              label: "Excel",
              icon: <FileSpreadsheet size={14} />,
            },
          ]}
          onChange={(format) => {
            if (format === "pdf") onExportPDF();
            else onExportExcel();
          }}
          disabled={loading || saving}
        />
        {onImport && (
          <button
            type="button"
            onClick={onImport}
            disabled={loading || saving}
            className="flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Upload size={14} aria-hidden="true" />
            {t("masters.ui.import")}
          </button>
        )}
        <button
          type="button"
          onClick={onAdd}
          disabled={loading || saving}
          className="flex h-9 items-center gap-1.5 rounded-xl border border-transparent bg-emerald-600 px-3 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus size={15} aria-hidden="true" />
          {addLabel}
        </button>
      </div>
    </div>
  );
}
