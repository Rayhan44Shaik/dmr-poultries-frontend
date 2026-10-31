import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  ArrowDown,
  ArrowUp,
  Calendar,
  Ellipsis,
  Eye,
  FileDown,
  Fuel,
  Hash,
  IndianRupee,
  MessageSquareText,
  ReceiptText,
  Search,
  Truck,
  UserCog,
  UserRound,
  Users,
  Utensils,
  Wallet,
  Wrench,
  X,
} from "lucide-react";
import { DatePicker } from "../../../../components/common/DatePicker";
import { apiGet } from "../../../../api";
import { isCanceledError } from "../../../../api/errors";
import { useSafeNotification } from "../../../../hooks/useSafeNotification";
import { useVehicles } from "../../../masters/vehicles/hooks/useVehicles";
import { useEmployees } from "../../../masters/employees/hooks/useEmployees";
import MasterDropdown from "../../../masters/components/MasterDropdown";
import { AppShellModal, BrandRefreshButton, FilterResetButton, Pagination, countActiveFilters } from "../../../../ui";
import { PAGINATION_DEFAULT_PAGE_SIZE, uiActionIconMotionClass, uiTableRowFocusableClass, uiTableRowSelectedClass } from "../../../../shared/ui/uiTokens";
import {
  opsFilterCardClass, opsFilterLabelClass, opsInputClass, opsPdfButtonClass, opsTableCardClass,
  opsTableDivideClass, opsTableHeadRowClass, opsTableRowClass, opsViewButtonClass,
} from "../../../../shared/ui/operationsStyles";
import { useI18n } from "../../../../i18n";
import { formatTripListDay } from "../../vehicle-trips/utils/formatTripListDay";
import { formatVehicleNumber } from "../../../../utils/format";
import { mapApiTripToTrip } from "../../vehicle-trips/services/tripHeaderApiService";
import type { Trip } from "../../vehicle-trips/types/trip";
import StepEnd from "../../vehicle-trips/components/Step_5/StepEnd";
import { listTripExpenses, type ExpenseDetail, type TripExpenseRow } from "../services/tripExpensesService";
import { exportOperationExpensesPdf } from "../utils/exportOperationExpenses";

const money = (value: number) => `₹${Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
type ExpenseSortKey = "tripNo" | "tripDate" | "vehicleNo" | "employeeCount" | "advanceAmount" | "meals" | "supervisorPc" | "vehicleMaintenance" | "diesel" | "others" | "totalExpense";
const AMOUNT_SORTS = new Set<ExpenseSortKey>(["employeeCount", "advanceAmount", "meals", "supervisorPc", "vehicleMaintenance", "diesel", "others", "totalExpense"]);
const SORT_KEYS = new Set<string>(["tripNo", "tripDate", "vehicleNo", "employeeCount", "advanceAmount", "meals", "supervisorPc", "vehicleMaintenance", "diesel", "others", "totalExpense"]);

const thClass = "px-2 py-3 text-xs font-bold uppercase tracking-wide text-slate-600 whitespace-nowrap";
const tdClass = "px-2 py-4 text-[13px] font-medium text-slate-600 text-center align-middle";

function SortArrows({ active, dir }: { active: boolean; dir?: "asc" | "desc" }) {
  const base = "h-3.5 w-3.5 shrink-0 transition-colors";
  const on = "text-emerald-600";
  const off = "text-slate-400 group-hover/sort:text-slate-600";
  return (
    <span className="inline-flex items-center gap-0.5 shrink-0" aria-hidden="true">
      <ArrowUp size={13} strokeWidth={2.7} className={`${base} ${active && dir === "asc" ? on : off}`} />
      <ArrowDown size={13} strokeWidth={2.7} className={`${base} ${active && dir === "desc" ? on : off}`} />
    </span>
  );
}

function SortableTh({
  label,
  icon,
  sortKey,
  sortBy,
  sortDir,
  onSort,
}: {
  label: string;
  icon: ReactNode;
  sortKey: ExpenseSortKey;
  sortBy: string;
  sortDir: "asc" | "desc";
  onSort: (key: ExpenseSortKey) => void;
}) {
  const active = sortBy === sortKey;
  return (
    <th className={`${thClass} text-center`}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
        className={`group/sort inline-flex w-full items-center justify-center gap-1 whitespace-nowrap uppercase tracking-wide font-bold transition-colors hover:text-emerald-700 ${active ? "text-emerald-700" : "text-slate-600"}`}
      >
        {icon}
        <span>{label}</span>
        <SortArrows active={active} dir={sortDir} />
      </button>
    </th>
  );
}

function DieselBunkToggle({
  includeMasterBunks,
  onChange,
}: {
  includeMasterBunks: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        <Fuel size={13} className={includeMasterBunks ? "text-emerald-600" : "text-amber-500"} />
        Diesel
      </span>
      <div
        role="radiogroup"
        aria-label="Diesel bunks"
        className={`relative isolate grid h-10 w-[228px] grid-cols-2 rounded-full p-1 ring-1 transition-colors duration-300 ${
          includeMasterBunks ? "bg-emerald-50/80 ring-emerald-200/80" : "bg-amber-50/80 ring-amber-200/80"
        }`}
      >
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-full shadow-sm ring-1 transition-[left,background-color] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            includeMasterBunks
              ? "left-1 bg-emerald-500 ring-emerald-400/50"
              : "left-[calc(50%+1px)] bg-amber-500 ring-amber-400/50"
          }`}
        />
        <button
          type="button"
          role="radio"
          aria-checked={includeMasterBunks}
          onClick={() => onChange(true)}
          className={`relative z-10 rounded-full text-[11px] font-bold tracking-wide transition-colors duration-200 ${
            includeMasterBunks ? "text-white" : "text-slate-500 hover:text-slate-700"
          }`}
        >
          All bunks
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={!includeMasterBunks}
          onClick={() => onChange(false)}
          className={`relative z-10 rounded-full text-[11px] font-bold tracking-wide transition-colors duration-200 ${
            !includeMasterBunks ? "text-white" : "text-slate-500 hover:text-slate-700"
          }`}
        >
          Others
        </button>
      </div>
    </div>
  );
}

function BreakdownTooltip({
  title,
  trigger,
  rows,
  width = 260,
}: {
  title: string;
  trigger: ReactNode;
  rows: { label: string; value: string }[];
  width?: number;
}) {
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const openTooltip = (element: HTMLElement) => {
    if (!rows.length) return;
    const rect = element.getBoundingClientRect();
    const estimatedHeight = 54 + rows.length * 32;
    const half = width / 2;
    const top = rect.bottom + estimatedHeight + 12 <= window.innerHeight ? rect.bottom + 8 : rect.top - estimatedHeight - 8;
    setPosition({ left: Math.max(12, Math.min(window.innerWidth - width - 12, rect.left + rect.width / 2 - half)), top: Math.max(8, top) });
  };
  return (
    <span className="inline-flex max-w-full items-center justify-center" onMouseLeave={() => setPosition(null)}>
      <span
        tabIndex={rows.length ? 0 : -1}
        aria-label={title}
        onMouseEnter={(event) => openTooltip(event.currentTarget)}
        onFocus={(event) => openTooltip(event.currentTarget)}
        onBlur={() => setPosition(null)}
        className="max-w-full cursor-default truncate outline-none"
      >
        {trigger}
      </span>
      {position && createPortal(
        <span role="tooltip" style={{ left: position.left, top: position.top, width }} className="pointer-events-none fixed z-[9999] rounded-xl border border-slate-200 bg-white p-3 text-left text-[11px] font-medium text-slate-700 shadow-2xl">
          <span className="mb-2 block border-b border-slate-100 pb-2 font-bold text-slate-700">{title}</span>
          {rows.map((row) => (
            <span key={`${row.label}-${row.value}`} className="flex items-center justify-between gap-5 rounded-md px-1.5 py-1.5 odd:bg-slate-50">
              <span>{row.label}</span>
              {row.value ? <span className="font-bold text-slate-900">{row.value}</span> : null}
            </span>
          ))}
        </span>,
        document.body,
      )}
    </span>
  );
}

function AmountWithTooltip({ value, title, details }: { value: number; title: string; details?: ExpenseDetail[] }) {
  const visible = (details ?? []).filter((item) => Number(item.amount) > 0);
  const rows = visible.map((item) => ({ label: item.name, value: money(item.amount) }));
  if (visible.length > 1) rows.push({ label: "Total", value: money(value) });
  return (
    <span className="inline-flex w-full justify-center tabular-nums">
      {rows.length ? <BreakdownTooltip title={title} trigger={money(value)} rows={rows} /> : money(value)}
    </span>
  );
}

function EmployeeCountCell({ count, employees }: { count: number; employees: { name: string; role: string }[] }) {
  return (
    <BreakdownTooltip
      title="Employees"
      trigger={count}
      rows={employees.map((employee) => ({ label: employee.name || "Assigned employee", value: employee.role }))}
    />
  );
}

function ExpenseView({ trip, onClose }: { trip: Trip | null; onClose: () => void }) {
  return <AppShellModal open={Boolean(trip)} onClose={onClose} ariaLabelledBy="expense-view-title">
    <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/70 px-5 py-3">
      <div><h2 id="expense-view-title" className="font-bold text-slate-900">Expenses Sheet</h2><p className="text-xs text-slate-500">{trip?.tripNo} · {formatVehicleNumber(trip?.vehicleNo ?? "")}</p></div>
      <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-100" aria-label="Close"><X size={17}/></button>
    </div>
    <div className="min-h-0 overflow-y-auto p-4 sm:p-5">{trip && <StepEnd trip={{ ...trip, expensesStepSubmitted: true, endStepSubmitted: true }} updateTrip={() => {}} canEdit={false} editable={false} hideWizardClose />}</div>
  </AppShellModal>;
}

export default function TripExpensesPage() {
  const { t } = useI18n();
  const { showNotification } = useSafeNotification();
  const { vehicles } = useVehicles();
  const { employees } = useEmployees();
  const [rows, setRows] = useState<TripExpenseRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGINATION_DEFAULT_PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [supervisorId, setSupervisorId] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("tripDate:desc");
  const [includeMasterBunks, setIncludeMasterBunks] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [viewTrip, setViewTrip] = useState<Trip | null>(null);
  const [exporting, setExporting] = useState(false);
  const hasRowsRef = useRef(false);
  const loadSeqRef = useRef(0);
  const loadAbortRef = useRef<AbortController | null>(null);
  const viewSeqRef = useRef(0);
  const exportBusyRef = useRef(false);
  const deferredSearch = useDeferredValue(search.trim());

  const vehicleOptions = useMemo(() => vehicles.map((v) => ({ value: String(v.id), label: formatVehicleNumber(v.vehicleNumber), searchText: v.vehicleNumber })), [vehicles]);
  const supervisorOptions = useMemo(() => employees.filter((e) => `${e.department} ${e.secondaryDepartment ?? ""}`.toLowerCase().includes("supervisor")).map((e) => ({ value: String(e.id), label: e.employeeName })), [employees]);
  const [sortByRaw, sortDirRaw] = sort.split(":");
  const sortBy = SORT_KEYS.has(sortByRaw) ? sortByRaw : "tripDate";
  const sortDir: "asc" | "desc" = sortDirRaw === "asc" ? "asc" : "desc";
  const activeFilterCount = countActiveFilters(Boolean(fromDate || toDate), Boolean(vehicleId), Boolean(supervisorId), Boolean(search.trim()), sort !== "tripDate:desc");
  const canExportPdf = Boolean(fromDate || toDate || vehicleId || supervisorId);

  const queryBase = useMemo(() => ({
    fromDate: fromDate || undefined,
    toDate: toDate || undefined,
    vehicleId: vehicleId || undefined,
    supervisorId: supervisorId || undefined,
    search: deferredSearch || undefined,
    sortBy,
    sortDir,
    includeMasterBunks,
  }), [fromDate, toDate, vehicleId, supervisorId, deferredSearch, sortBy, sortDir, includeMasterBunks]);

  const load = useCallback(async (quiet = false) => {
    const requestSeq = loadSeqRef.current + 1;
    loadSeqRef.current = requestSeq;
    loadAbortRef.current?.abort();
    const controller = new AbortController();
    loadAbortRef.current = controller;
    if (quiet) setRefreshing(true);
    else setLoading(true);
    try {
      const result = await listTripExpenses({ ...queryBase, page, limit: pageSize }, controller.signal);
      if (requestSeq !== loadSeqRef.current) return false;
      setRows(result.data);
      setTotal(result.meta.total);
      setSelectedId((current) => current != null && !result.data.some((row) => row.id === current) ? null : current);
      return true;
    } catch (error) {
      if (isCanceledError(error) || requestSeq !== loadSeqRef.current) return false;
      showNotification("Unable to load completed trip expenses.", "error");
      return false;
    } finally {
      if (requestSeq === loadSeqRef.current) {
        loadAbortRef.current = null;
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [queryBase, page, pageSize, showNotification]);

  useEffect(() => { hasRowsRef.current = rows.length > 0; }, [rows.length]);
  useEffect(() => {
    const quiet = hasRowsRef.current;
    const timer = window.setTimeout(() => void load(quiet), quiet ? 80 : 160);
    return () => {
      window.clearTimeout(timer);
      loadAbortRef.current?.abort();
    };
  }, [load]);

  const reset = () => {
    setFromDate("");
    setToDate("");
    setVehicleId("");
    setSupervisorId("");
    setSearch("");
    setSort("tripDate:desc");
    setIncludeMasterBunks(true);
    setPage(1);
    showNotification(t("ops.trip.filters_reset"), "info");
  };
  const handleRefresh = () => {
    void load(hasRowsRef.current).then((ok) => {
      if (ok) showNotification(t("notification.data_refreshed"), "success");
    });
  };
  const setBunkMode = (next: boolean) => {
    if (next === includeMasterBunks) return;
    setIncludeMasterBunks(next);
    setPage(1);
  };
  const toggleSort = (key: ExpenseSortKey) => {
    if (sortBy === key) setSort(`${key}:${sortDir === "desc" ? "asc" : "desc"}`);
    else setSort(`${key}:${AMOUNT_SORTS.has(key) ? "desc" : "asc"}`);
    setPage(1);
  };
  const openTrip = async (tripId: number | null) => {
    if (!tripId) return showNotification("Select a trip to view its Expenses Sheet.", "info");
    const requestSeq = viewSeqRef.current + 1;
    viewSeqRef.current = requestSeq;
    try {
      const { data } = await apiGet<Record<string, unknown>>(`/operations/trip-list/${tripId}`);
      if (requestSeq !== viewSeqRef.current) return;
      setViewTrip(mapApiTripToTrip(data));
    } catch (error) {
      if (isCanceledError(error) || requestSeq !== viewSeqRef.current) return;
      showNotification("Unable to open the Expenses Sheet.", "error");
    }
  };
  const exportPdf = async () => {
    if (exportBusyRef.current || exporting || !canExportPdf) return showNotification("Choose a date, vehicle or supervisor to export the PDF.", "info");
    exportBusyRef.current = true;
    setExporting(true);
    try {
      const result = await listTripExpenses({ ...queryBase, export: true });
      if (!result.data.length) return showNotification("No completed trip expenses to export.", "info");
      await exportOperationExpensesPdf(result.data, {
        includeMasterBunks,
        fromDate,
        toDate,
        filename: `operation-expenses-${new Date().toISOString().slice(0, 10)}`,
      });
    } catch (error) {
      if (!isCanceledError(error)) showNotification("Unable to create the expenses PDF.", "error");
    } finally {
      exportBusyRef.current = false;
      setExporting(false);
    }
  };
  const handleRowKeyDown = (event: KeyboardEvent<HTMLTableRowElement>, tripId: number) => {
    if (event.key === "Enter") {
      event.preventDefault();
      setSelectedId(tripId);
      void openTrip(tripId);
    }
  };
  const canView = Boolean(selectedId);

  return <div className="w-full space-y-5">
    <div className={opsFilterCardClass}>
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <div><label className={opsFilterLabelClass}><Calendar size={16} className="text-emerald-500"/>From</label><DatePicker value={fromDate} onChange={(v) => { setFromDate(v); setPage(1); }} className="w-full text-xs" /></div>
        <div><label className={opsFilterLabelClass}><Calendar size={16} className="text-emerald-500"/>To</label><DatePicker value={toDate} onChange={(v) => { setToDate(v); setPage(1); }} className="w-full text-xs" /></div>
        <div><label className={opsFilterLabelClass}><Truck size={16} className="text-blue-500"/>Vehicle</label><MasterDropdown hideLabel label="Vehicle" value={vehicleId} options={vehicleOptions} onChange={(v) => { setVehicleId(v); setPage(1); }} placeholder="All Vehicles" searchable allowClear /></div>
        <div><label className={opsFilterLabelClass}><UserCog size={16} className="text-violet-500"/>Supervisor</label><MasterDropdown hideLabel label="Supervisor" value={supervisorId} options={supervisorOptions} onChange={(v) => { setSupervisorId(v); setPage(1); }} placeholder="All Supervisors" searchable allowClear /></div>
      </div>
      <div className="mt-4 flex flex-wrap items-end gap-2">
        <div className="w-full sm:w-[22rem] lg:w-[26rem]"><label className={opsFilterLabelClass}><Search size={16} className="text-slate-400"/>Search</label><div className="relative"><Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/><input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className={`${opsInputClass} pl-9`} placeholder="Trip, vehicle or supervisor"/></div></div>
        <div className="hidden flex-1 lg:block" aria-hidden="true" />
        <button type="button" onClick={() => void exportPdf()} disabled={!canExportPdf || !total || exporting} title={canExportPdf ? "Export the filtered expenses as PDF" : "Choose a date, vehicle or supervisor to export PDF"} className={`${opsPdfButtonClass} disabled:cursor-not-allowed disabled:opacity-40`} aria-label="Export Operation Expenses PDF"><FileDown size={15}/>PDF</button>
        <button type="button" onClick={() => void openTrip(selectedId)} disabled={!canView} className={`group ${opsViewButtonClass} disabled:cursor-not-allowed disabled:opacity-40`} aria-label="View expenses sheet">
          <span className={`inline-flex ${canView ? uiActionIconMotionClass.view : ""}`}><Eye size={14} /></span>
          View
        </button>
        <FilterResetButton count={activeFilterCount} onClick={reset}/><BrandRefreshButton onClick={handleRefresh} loading={loading || refreshing} size="md"/>
      </div>
    </div>

    <div className={opsTableCardClass}>
      <div className="flex flex-col gap-3 border-b border-slate-100 bg-gradient-to-r from-blue-50/60 via-white to-blue-50/40 px-6 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-blue-100 bg-blue-50/70 text-blue-500 shadow-inner"><ReceiptText size={20}/></span>
          <h3 className="text-base font-bold tracking-tight text-slate-800">Operation Expenses</h3>
        </div>
        <DieselBunkToggle includeMasterBunks={includeMasterBunks} onChange={setBunkMode} />
      </div>
      <div className="relative overflow-hidden" aria-busy={loading || refreshing}>
        {refreshing && <div aria-hidden="true" className="absolute inset-x-0 top-0 z-10 h-0.5 overflow-hidden bg-transparent"><div className={`h-full w-full animate-pulse ${includeMasterBunks ? "bg-emerald-400/80" : "bg-amber-400/80"}`} /></div>}
        <table className="w-full table-fixed">
          <colgroup>
            <col className="w-[4%]" />
            <col className="w-[12%]" />
            <col className="w-[11%]" />
            <col className="w-[10%]" />
            <col className="w-[5%]" />
            <col className="w-[7%]" />
            <col className="w-[7%]" />
            <col className="w-[6%]" />
            <col className="w-[6%]" />
            <col className="w-[8%]" />
            <col className="w-[7%]" />
            <col className="w-[8%]" />
            <col className="w-[9%]" />
          </colgroup>
          <thead className={opsTableHeadRowClass}><tr>
            <th className={`${thClass} text-center`}><Hash size={14} className="mx-auto text-slate-400" aria-label="Serial number" /></th>
            <SortableTh label="Trip Number" icon={<Hash size={14} className="shrink-0 text-blue-500"/>} sortKey="tripNo" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
            <SortableTh label="Day" icon={<Calendar size={14} className="shrink-0 text-emerald-500"/>} sortKey="tripDate" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
            <SortableTh label="Vehicle No." icon={<Truck size={14} className="shrink-0 text-indigo-500"/>} sortKey="vehicleNo" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
            <SortableTh label="Emp" icon={<Users size={14} className="shrink-0 text-cyan-500"/>} sortKey="employeeCount" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
            <SortableTh label="Advance" icon={<Wallet size={14} className="shrink-0 text-amber-500"/>} sortKey="advanceAmount" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
            <SortableTh label="Meals" icon={<Utensils size={14} className="shrink-0 text-orange-500"/>} sortKey="meals" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
            <SortableTh label="S.PC" icon={<UserRound size={14} className="shrink-0 text-purple-500"/>} sortKey="supervisorPc" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
            <SortableTh label="V.M" icon={<Wrench size={14} className="shrink-0 text-slate-500"/>} sortKey="vehicleMaintenance" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
            <SortableTh label="Diesel" icon={<Fuel size={14} className="shrink-0 text-emerald-600"/>} sortKey="diesel" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
            <SortableTh label="Others" icon={<Ellipsis size={14} className="shrink-0 text-slate-500"/>} sortKey="others" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
            <SortableTh label="Total" icon={<IndianRupee size={14} className="shrink-0 text-green-600"/>} sortKey="totalExpense" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
            <th className={`${thClass} text-center`}><span className="inline-flex items-center justify-center gap-1"><MessageSquareText size={14} className="shrink-0 text-teal-500"/><span>Remarks</span></span></th>
          </tr></thead>
          <tbody className={`${opsTableDivideClass} bg-white`}>
            {loading && !rows.length ? <tr><td colSpan={13} className="py-16 text-center text-sm text-slate-400">Loading completed trip expenses…</td></tr> : rows.length === 0 ? <tr><td colSpan={13} className="py-16 text-center text-sm text-slate-400">No completed trip expenses found.</td></tr> : rows.map((row, index) => {
              const dieselDetails = row.dieselBreakdown.map((item, dieselIndex) => ({ name: `${item.bunk || `Diesel ${dieselIndex + 1}`} · ${Number(item.litres || 0).toFixed(2)} L`, amount: item.amount }));
              const vehicleDetails = row.vehicleMaintenance > 0 ? [{ name: row.vehicleMaintenanceNote || "Vehicle Maintenance", amount: row.vehicleMaintenance }] : [];
              const employeeDetails = [{ name: row.supervisorName, role: "Supervisor" }, { name: row.driverName, role: "Driver" }, ...row.employees].filter((employee) => employee.name);
              const selected = selectedId === row.id;
              return <tr
                key={row.id}
                tabIndex={0}
                aria-selected={selected}
                onClick={() => setSelectedId(row.id === selectedId ? null : row.id)}
                onDoubleClick={() => { setSelectedId(row.id); void openTrip(row.id); }}
                onKeyDown={(event) => handleRowKeyDown(event, row.id)}
                className={`${opsTableRowClass} ${uiTableRowFocusableClass} cursor-pointer ${selected ? uiTableRowSelectedClass : ""}`}
              >
                <td className={`${tdClass} text-slate-500`}>{(page - 1) * pageSize + index + 1}</td>
                <td className="px-2 py-4 text-center align-middle">
                  <span className="inline-block max-w-full truncate whitespace-nowrap text-[13px] font-bold text-emerald-600" title={row.tripNo}>{row.tripNo}</span>
                </td>
                <td className={tdClass}>{formatTripListDay(row.tripDate)}</td>
                <td className={`${tdClass} text-slate-700`}>{formatVehicleNumber(row.vehicleNo)}</td>
                <td className={tdClass}><EmployeeCountCell count={row.employeeCount} employees={employeeDetails}/></td>
                <td className={tdClass}><AmountWithTooltip value={row.advanceAmount} title="Advance" details={[{ name: "Step 1 advance", amount: row.advanceAmount }]}/></td>
                <td className={tdClass}><AmountWithTooltip value={row.meals} title="Meals" details={[{ name: "Meals", amount: row.meals }]}/></td>
                <td className={tdClass}><AmountWithTooltip value={row.supervisorPc} title="S.PC" details={[{ name: "Supervisor (PC)", amount: row.supervisorPc }]}/></td>
                <td className={tdClass}><AmountWithTooltip value={row.vehicleMaintenance} title="V.M" details={vehicleDetails}/></td>
                <td className={tdClass}><AmountWithTooltip value={row.diesel} title="Diesel" details={dieselDetails}/></td>
                <td className={tdClass}><AmountWithTooltip value={row.others} title="Others" details={row.otherBreakdown}/></td>
                <td className={tdClass}><AmountWithTooltip value={row.totalExpense} title="Total" details={row.expenseBreakdown}/></td>
                <td className={`${tdClass} truncate`}>{row.remarks ? <BreakdownTooltip title="Remarks" trigger={row.remarks} rows={[{ label: row.remarks, value: "" }]} width={280} /> : "—"}</td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>
      {total > 0 && <Pagination page={page} pageSize={pageSize} totalItems={total} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}/>}
    </div>
    <ExpenseView trip={viewTrip} onClose={() => setViewTrip(null)}/>
  </div>;
}
