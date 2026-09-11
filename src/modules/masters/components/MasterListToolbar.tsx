import { useId, type ReactNode } from "react";
import { FileSpreadsheet, FileText, Plus } from "lucide-react";
import { useI18n } from "../../../i18n";
import { BrandRefreshButton, Button, ImportButton, SearchInput } from "../../../ui";
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
  onRefresh?: () => void;
  status?: string;
  onStatusChange?: (value: string) => void;
  sort?: string;
  onSortChange?: (value: string) => void;
}

/**
 * Shared responsive toolbar for Shops, Farms, Vehicles, Employees, Banks and
 * Bird Types.
 *
 * Standardised on the global UI kit (search, semantic action buttons, button
 * system) so a master list toolbar is pixel-identical to every other toolbar in
 * the application — same 40px control row, same 8px radius, same emerald focus
 * ring, and the canonical Upload icon + emerald treatment for Import.
 *
 * Behaviour is unchanged: search still filters on every keystroke (`onChange`),
 * PDF/Excel still route through the Export dropdown, and Import stays optional.
 * SearchInput adds Enter-to-run, Escape/click-to-clear and an identical-value
 * guard on top of that.
 */
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
  onRefresh, status, onStatusChange, sort, onSortChange,
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
          <SearchInput
            id={id}
            value={search}
            // Instant filtering preserved: onChange only, no debounce.
            onChange={onSearchChange}
            placeholder={searchPlaceholder}
            // No aria-label: the visible <label htmlFor={id}> above IS the
            // accessible name (WCAG 2.5.3 "label in name"). The previous
            // aria-label silently overrode it, so screen readers announced the
            // placeholder instead of "Search".
          />
        </div>
        {children}
        {onStatusChange && <MasterDropdown label="Status" value={status ?? ""} options={[{ value: "", label: "All statuses" }, { value: "Active", label: "Active" }, { value: "Inactive", label: "Inactive" }]} onChange={onStatusChange} />}
        {onSortChange && <MasterDropdown label="Sort by" value={sort ?? "number"} options={[{ value: "number", label: "Number" }, { value: "name", label: "Name" }, { value: "status", label: "Status" }]} onChange={onSortChange} />}
      </div>
      <div
        className="flex flex-wrap items-center gap-2"
        role="group"
        aria-label={t("masters.ui.actions")}
      >
        {onRefresh && (
          <BrandRefreshButton
            onClick={onRefresh}
            loading={loading}
            disabled={saving}
          />
        )}
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
          <ImportButton
            onClick={onImport}
            loading={saving}
            disabled={loading || saving}
          >
            {t("masters.ui.import")}
          </ImportButton>
        )}
        <Button
          onClick={onAdd}
          loading={saving}
          disabled={loading || saving}
          icon={<Plus size={16} aria-hidden="true" />}
        >
          {addLabel}
        </Button>
      </div>
    </div>
  );
}
