/**
 * MasterDirectory — the ONE page shell every master list uses (Shops, Farms,
 * Vehicles, Employees, Banks, Bird Types), built on the Trip List anatomy:
 *
 *   ┌ filter card ───────────────────────────────────────────────────────┐
 *   │ 🔍 Search · [extra filter] · ⏻ Status · ⇅ Sort by                   │
 *   │                 + Add · Reset(n) · Refresh · Import · PDF · Excel   │
 *   └────────────────────────────────────────────────────────────────────┘
 *   ┌ table card ─ tile + title + count ─────────────────────────────────┐
 *   │ <table>  (MasterTh / MasterTd / MasterLoadingRow / MasterEditButton)│
 *   │ <Pagination/>                                                      │
 *   └────────────────────────────────────────────────────────────────────┘
 *
 * The filter card never unmounts while the table loads, so a refresh or a
 * filter change only touches the record surface — no page swap, no blink.
 */
import type { ReactNode } from "react";
import {
  Search,
  ToggleLeft,
  ArrowUpDown,
  Plus,
  Upload,
  FileText,
  FileSpreadsheet,
  Pencil,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { useI18n } from "../../../i18n";
import {
  opsFilterCardClass,
  opsFilterLabelClass,
  opsInputClass,
  opsPrimaryButtonClass,
  opsPdfButtonClass,
  opsExcelButtonClass,
} from "../../../shared/ui/operationsStyles";
import {
  uiImportButtonClass,
  uiActionIconMotionClass,
} from "../../../shared/ui/uiTokens";
import { shouldShowPagination } from "../../../shared/ui/paginationStyles";
import {
  FilterResetButton,
  countActiveFilters,
  BrandRefreshButton,
  Pagination,
} from "../../../ui";
import MasterDropdown from "./MasterDropdown";
import { masterThClass } from "./masterTableStyles";

/* ─────────────────────────── filter card ─────────────────────────── */

export type MasterDirectoryFiltersProps = {
  search: string;
  onSearchChange: (v: string) => void;
  searchPlaceholder: string;
  status: string;
  onStatusChange: (v: string) => void;
  sort: string;
  onSortChange: (v: string) => void;
  /** One optional extra field rendered between Search and Status (e.g. City). */
  extraFilter?: ReactNode;
  /** Whether the extra filter is currently active (feeds the Reset count). */
  extraActive?: boolean;
  onReset: () => void;
  onRefresh: () => void;
  addLabel: string;
  onAdd: () => void;
  onImport?: () => void;
  onExportPDF: () => void;
  onExportExcel: () => void;
  hasRows: boolean;
  loading: boolean;
  saving: boolean;
  /** Accessible name for the filter region. */
  ariaLabel: string;
  searchId: string;
};

export function MasterDirectoryFilters({
  search,
  onSearchChange,
  searchPlaceholder,
  status,
  onStatusChange,
  sort,
  onSortChange,
  extraFilter,
  extraActive = false,
  onReset,
  onRefresh,
  addLabel,
  onAdd,
  onImport,
  onExportPDF,
  onExportExcel,
  hasRows,
  loading,
  saving,
  ariaLabel,
  searchId,
}: MasterDirectoryFiltersProps) {
  const { t } = useI18n();
  const count = countActiveFilters(
    search.trim() !== "",
    extraActive,
    status !== "",
    sort !== "number",
  );
  const cols = extraFilter ? "lg:grid-cols-4" : "lg:grid-cols-3";
  return (
    <section
      data-master-toolbar
      className={`${opsFilterCardClass} motion-safe:animate-[var(--animate-fade-in-up)]`}
      aria-label={ariaLabel}
    >
      <div className={`grid grid-cols-1 gap-3.5 sm:grid-cols-2 ${cols}`}>
        <div>
          <label htmlFor={searchId} className={opsFilterLabelClass}>
            <Search size={17} className="text-slate-400 flex-shrink-0" />
            <span>{t("common.search")}</span>
          </label>
          <div className="relative">
            <Search
              size={18}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              id={searchId}
              type="search"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className={`${opsInputClass} pl-10`}
              autoComplete="off"
            />
          </div>
        </div>
        {extraFilter}
        <div>
          <label className={opsFilterLabelClass}>
            <ToggleLeft size={17} className="text-amber-500 flex-shrink-0" />
            <span>{t("common.status")}</span>
          </label>
          <MasterDropdown
            label={t("common.status")}
            hideLabel
            value={status}
            options={[
              { value: "", label: t("common.all_statuses") },
              { value: "Active", label: t("common.active") },
              { value: "Inactive", label: t("common.inactive") },
            ]}
            onChange={onStatusChange}
            className="w-full"
          />
        </div>
        <div>
          <label className={opsFilterLabelClass}>
            <ArrowUpDown size={17} className="text-violet-500 flex-shrink-0" />
            <span>{t("common.sort_by")}</span>
          </label>
          <MasterDropdown
            label={t("common.sort_by")}
            hideLabel
            value={sort}
            options={[
              { value: "number", label: t("common.number") },
              { value: "name", label: t("common.name") },
              { value: "status", label: t("common.status") },
            ]}
            onChange={onSortChange}
            className="w-full"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onAdd}
          disabled={saving}
          className={`group relative ${opsPrimaryButtonClass}`}
        >
          <span className="inline-flex motion-safe:group-hover:animate-[var(--animate-action-add)]">
            <Plus size={15} />
          </span>
          {addLabel}
        </button>
        <FilterResetButton count={count} onClick={onReset} disabled={loading} />
        <BrandRefreshButton
          onClick={onRefresh}
          loading={loading}
          disabled={saving}
        />
        {onImport && (
          <button
            type="button"
            onClick={onImport}
            disabled={loading || saving}
            className={`group relative ${uiImportButtonClass}`}
          >
            <span className="inline-flex transition-transform motion-safe:group-hover:-translate-y-0.5">
              <Upload size={15} />
            </span>
            {t("common.import")}
          </button>
        )}
        <button
          type="button"
          onClick={onExportPDF}
          disabled={!hasRows || loading}
          className={`group relative ${opsPdfButtonClass}`}
          aria-label="PDF"
        >
          <span
            className={`inline-flex ${hasRows ? "motion-safe:group-hover:animate-[var(--animate-action-pdf)]" : ""}`}
          >
            <FileText size={15} />
          </span>
          PDF
        </button>
        <button
          type="button"
          onClick={onExportExcel}
          disabled={!hasRows || loading}
          className={`group relative ${opsExcelButtonClass}`}
          aria-label="Excel"
        >
          <span
            className={`inline-flex ${hasRows ? "motion-safe:group-hover:animate-[var(--animate-action-excel)]" : ""}`}
          >
            <FileSpreadsheet size={15} />
          </span>
          Excel
        </button>
      </div>
    </section>
  );
}

/** Wrapper for the optional extra filter so it matches the built-in fields. */
export function MasterDirectoryField({
  icon: Icon,
  iconClass = "text-emerald-500",
  label,
  children,
}: {
  icon: LucideIcon;
  iconClass?: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className={opsFilterLabelClass}>
        <Icon size={17} className={`${iconClass} flex-shrink-0`} />
        <span>{label}</span>
      </label>
      {children}
    </div>
  );
}

/* ─────────────────────────── table card ─────────────────────────── */

export type MasterDirectoryCardProps = {
  icon: LucideIcon;
  title: string;
  total: number;
  error?: string | null;
  loading: boolean;
  onRetry: () => void;
  retryLabel: string;
  page: number;
  pageSize: number;
  onPageChange: (p: number) => void;
  onPageSizeChange: (s: number) => void;
  children: ReactNode;
};

export function MasterDirectoryCard({
  icon: Icon,
  title,
  total,
  error,
  loading,
  onRetry,
  retryLabel,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  children,
}: MasterDirectoryCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden text-xs md:text-sm">
      <div className="flex items-center justify-between gap-3 px-6 py-3 border-b border-slate-100 bg-gradient-to-r from-emerald-50/60 via-white to-emerald-50/40">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-9 w-9 rounded-xl bg-emerald-50/70 border border-emerald-100 flex items-center justify-center text-emerald-600 shadow-inner shrink-0">
            <Icon className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-slate-800 tracking-tight truncate">
            {title}
          </h3>
        </div>
        <span
          className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold tabular-nums text-slate-600"
          aria-live="polite"
        >
          {total.toLocaleString("en-IN")}
        </span>
      </div>

      {error && !loading && (
        <div
          className="mx-4 mt-3 px-3 py-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between gap-3"
          role="alert"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={onRetry}
            className="shrink-0 text-xs font-semibold text-red-700 underline"
          >
            {retryLabel}
          </button>
        </div>
      )}

      {children}

      {shouldShowPagination(total) && (
        <Pagination
          page={page}
          pageSize={pageSize}
          totalItems={total}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
          disabled={loading}
        />
      )}
    </div>
  );
}

/* ───────────────────────── table primitives ─────────────────────── */

export function MasterTable({
  minWidth = "min-w-[56rem]",
  children,
}: {
  minWidth?: string;
  children: ReactNode;
}) {
  return (
    <div className="w-full overflow-x-auto">
      <table
        className={`${minWidth} w-full text-[13px] text-left border-collapse`}
      >
        {children}
      </table>
    </div>
  );
}

export function MasterThead({ children }: { children: ReactNode }) {
  return (
    <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600">
      <tr>{children}</tr>
    </thead>
  );
}

export function MasterTh({
  icon: Icon,
  label,
  align = "left",
  className = "",
  iconClass = "text-slate-400",
}: {
  icon: LucideIcon;
  label: string;
  align?: "left" | "center" | "right";
  className?: string;
  /** Glyph colour — every head carries its own tint (see `masterHeadTint`). */
  iconClass?: string;
}) {
  const justify =
    align === "center"
      ? "justify-center"
      : align === "right"
        ? "justify-end"
        : "";
  return (
    <th className={`${masterThClass} text-${align} ${className}`}>
      <div className={`flex items-center gap-1.5 ${justify}`}>
        <Icon size={14} className={`${iconClass} flex-shrink-0`} />
        <span>{label}</span>
      </div>
    </th>
  );
}

export function MasterLoadingRow({
  colSpan,
  label,
}: {
  colSpan: number;
  label: string;
}) {
  return (
    <tr>
      <td
        colSpan={colSpan}
        className="py-16 text-center text-sm font-medium text-slate-400"
      >
        <span
          className="inline-flex items-center gap-2.5"
          role="status"
          aria-live="polite"
        >
          <span
            className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-emerald-600"
            aria-hidden="true"
          />
          {label}
        </span>
      </td>
    </tr>
  );
}

export function MasterEmptyRow({
  colSpan,
  label,
}: {
  colSpan: number;
  label: string;
}) {
  return (
    <tr>
      <td
        colSpan={colSpan}
        className="py-12 text-center text-slate-400 text-[13px] font-medium"
      >
        {label}
      </td>
    </tr>
  );
}

/** Edit / delete tiles — glyph animation from the global tokens, no tooltip. */
export function MasterEditButton({
  onClick,
  ariaLabel,
}: {
  onClick: () => void;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group inline-flex h-8 w-8 items-center justify-center rounded-lg border border-blue-100 bg-blue-50/70 text-blue-600 transition-all hover:-translate-y-0.5 hover:bg-blue-100 hover:shadow-sm active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
      aria-label={ariaLabel}
    >
      <span className={`inline-flex ${uiActionIconMotionClass.edit}`}>
        <Pencil size={14} />
      </span>
    </button>
  );
}

export function MasterDeleteButton({
  onClick,
  ariaLabel,
}: {
  onClick: () => void;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-100 bg-red-50/70 text-red-600 transition-all hover:-translate-y-0.5 hover:bg-red-100 hover:shadow-sm active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
      aria-label={ariaLabel}
    >
      <span className={`inline-flex ${uiActionIconMotionClass.delete}`}>
        <Trash2 size={14} />
      </span>
    </button>
  );
}
