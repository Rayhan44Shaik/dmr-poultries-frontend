import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Calendar,
  Coffee,
  Ellipsis,
  Eye,
  Fuel,
  Hash,
  IndianRupee,
  MessageSquareText,
  Package,
  ReceiptText,
  Search,
  Truck,
  UserCog,
  UserRound,
  Users,
  Utensils,
  Wallet,
  X,
} from "lucide-react";
import { DatePicker } from "../../../../components/common/DatePicker";
import { apiGet } from "../../../../api";
import { useSafeNotification } from "../../../../hooks/useSafeNotification";
import { useVehicles } from "../../../masters/vehicles/hooks/useVehicles";
import { useEmployees } from "../../../masters/employees/hooks/useEmployees";
import MasterDropdown from "../../../masters/components/MasterDropdown";
import { AppShellModal, BrandRefreshButton, FilterResetButton, Pagination, countActiveFilters } from "../../../../ui";
import { PAGINATION_DEFAULT_PAGE_SIZE } from "../../../../shared/ui/uiTokens";
import {
  opsFilterCardClass, opsFilterLabelClass, opsInputClass, opsTableCardClass,
  opsTableDivideClass, opsTableHeadRowClass, opsTableRowClass,
  opsTableTdClass, opsTableThClass,
} from "../../../../shared/ui/operationsStyles";
import { formatTripListDay } from "../../vehicle-trips/utils/formatTripListDay";
import { formatVehicleNumber } from "../../../../utils/format";
import { mapApiTripToTrip } from "../../vehicle-trips/services/tripHeaderApiService";
import type { Trip } from "../../vehicle-trips/types/trip";
import StepEnd from "../../vehicle-trips/components/Step_5/StepEnd";
import { listTripExpenses, type ExpenseDetail, type TripExpenseRow } from "../services/tripExpensesService";

const money = (value: number) => `₹${Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fullDay = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return "—";
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return `${date.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" })} ${date.getUTCDate()}, ${date.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" })}`;
};

function AmountWithTooltip({ value, details }: { value: number; details?: ExpenseDetail[] }) {
  const visible = (details ?? []).filter((item) => Number(item.amount) > 0);
  return (
    <span className="group relative inline-flex cursor-default justify-end font-semibold tabular-nums text-slate-800" tabIndex={visible.length ? 0 : -1}>
      {money(value)}
      {visible.length > 0 && <span role="tooltip" className="pointer-events-none absolute bottom-full right-0 z-40 mb-2 hidden min-w-52 rounded-xl bg-slate-900 p-3 text-left text-[11px] font-medium text-white shadow-xl group-hover:block group-focus:block">
        {visible.map((item) => <span key={item.name} className="flex items-center justify-between gap-5 py-0.5"><span className="text-slate-300">{item.name}</span><span>{money(item.amount)}</span></span>)}
        <span className="mt-1 flex justify-between border-t border-white/15 pt-1 font-bold"><span>Total</span><span>{money(value)}</span></span>
      </span>}
    </span>
  );
}

function ExpenseView({ trip, onClose }: { trip: Trip | null; onClose: () => void }) {
  return <AppShellModal open={Boolean(trip)} onClose={onClose} ariaLabelledBy="expense-view-title">
    <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/70 px-5 py-3">
      <div><h2 id="expense-view-title" className="font-bold text-slate-900">Expenses Sheet</h2><p className="text-xs text-slate-500">{trip?.tripNo} · {formatVehicleNumber(trip?.vehicleNo ?? "")}</p></div>
      <button onClick={onClose} className="rounded-lg border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-100" aria-label="Close"><X size={17}/></button>
    </div>
    <div className="min-h-0 overflow-y-auto p-4 sm:p-5">{trip && <StepEnd trip={{ ...trip, expensesStepSubmitted: true, endStepSubmitted: true }} updateTrip={() => {}} canEdit={false} editable={false} hideWizardClose />}</div>
  </AppShellModal>;
}

export default function TripExpensesPage() {
  const { showNotification } = useSafeNotification();
  const { vehicles } = useVehicles();
  const { employees } = useEmployees();
  const [rows, setRows] = useState<TripExpenseRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGINATION_DEFAULT_PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [supervisorId, setSupervisorId] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("tripDate:desc");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [viewTrip, setViewTrip] = useState<Trip | null>(null);

  const vehicleOptions = useMemo(() => vehicles.map((v) => ({ value: String(v.id), label: formatVehicleNumber(v.vehicleNumber), searchText: v.vehicleNumber })), [vehicles]);
  const supervisorOptions = useMemo(() => employees.filter((e) => `${e.department} ${e.secondaryDepartment ?? ""}`.toLowerCase().includes("supervisor")).map((e) => ({ value: String(e.id), label: e.employeeName })), [employees]);
  const activeFilterCount = countActiveFilters(Boolean(fromDate || toDate), Boolean(vehicleId), Boolean(supervisorId), Boolean(search.trim()), sort !== "tripDate:desc");

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const [sortBy, sortDir] = sort.split(":");
      const result = await listTripExpenses({ fromDate: fromDate || undefined, toDate: toDate || undefined, vehicleId: vehicleId || undefined, supervisorId: supervisorId || undefined, search: search.trim() || undefined, sortBy, sortDir, page, limit: pageSize }, signal);
      setRows(result.data); setTotal(result.meta.total);
    } catch (error) {
      if ((error as { name?: string }).name !== "CanceledError") showNotification("Unable to load completed trip expenses.", "error");
    } finally { if (!signal?.aborted) setLoading(false); }
  }, [fromDate, toDate, vehicleId, supervisorId, search, sort, page, pageSize, showNotification]);

  useEffect(() => { const controller = new AbortController(); const timer = window.setTimeout(() => void load(controller.signal), 180); return () => { window.clearTimeout(timer); controller.abort(); }; }, [load]);

  const reset = () => { setFromDate(""); setToDate(""); setVehicleId(""); setSupervisorId(""); setSearch(""); setSort("tripDate:desc"); setPage(1); };
  const openTrip = async (tripId: number | null) => {
    if (!tripId) return showNotification("Select a trip to view its Expenses Sheet.", "info");
    try {
      const { data } = await apiGet<Record<string, unknown>>(`/operations/trip-list/${tripId}`);
      setViewTrip(mapApiTripToTrip(data));
    } catch { showNotification("Unable to open the Expenses Sheet.", "error"); }
  };
  const sortOptions = [
    { value: "tripDate:desc", label: "Day — Latest first" }, { value: "tripDate:asc", label: "Day — Oldest first" },
    { value: "tripNo:asc", label: "Trip Number — A to Z" }, { value: "vehicleNo:asc", label: "Vehicle — A to Z" },
    { value: "supervisorName:asc", label: "Supervisor — A to Z" }, { value: "totalExpense:desc", label: "Expense — High to low" },
  ];

  return <div className="w-full space-y-5">
    <div className={opsFilterCardClass}>
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-5">
        <div><label className={opsFilterLabelClass}><Calendar size={16} className="text-emerald-500"/>From</label><DatePicker value={fromDate} onChange={(v) => { setFromDate(v); setPage(1); }} className="w-full text-xs" /></div>
        <div><label className={opsFilterLabelClass}><Calendar size={16} className="text-emerald-500"/>To</label><DatePicker value={toDate} onChange={(v) => { setToDate(v); setPage(1); }} className="w-full text-xs" /></div>
        <div><label className={opsFilterLabelClass}><Truck size={16} className="text-blue-500"/>Vehicle</label><MasterDropdown hideLabel label="Vehicle" value={vehicleId} options={vehicleOptions} onChange={(v) => { setVehicleId(v); setPage(1); }} placeholder="All Vehicles" searchable allowClear /></div>
        <div><label className={opsFilterLabelClass}><UserCog size={16} className="text-violet-500"/>Supervisor</label><MasterDropdown hideLabel label="Supervisor" value={supervisorId} options={supervisorOptions} onChange={(v) => { setSupervisorId(v); setPage(1); }} placeholder="All Supervisors" searchable allowClear /></div>
        <div><label className={opsFilterLabelClass}>Sort By</label><MasterDropdown hideLabel label="Sort By" value={sort} options={sortOptions} onChange={(v) => { setSort(v || "tripDate:desc"); setPage(1); }} /></div>
      </div>
      <div className="mt-4 flex flex-wrap items-end gap-2">
        <div className="w-full sm:w-[22rem] lg:w-[26rem]"><label className={opsFilterLabelClass}><Search size={16} className="text-slate-400"/>Search</label><div className="relative"><Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/><input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className={`${opsInputClass} pl-9`} placeholder="Trip, vehicle or supervisor"/></div></div>
        <div className="hidden flex-1 lg:block" aria-hidden="true" />
        <button type="button" onClick={() => void openTrip(selectedId)} disabled={!selectedId} className="inline-flex h-10 items-center gap-2 rounded-lg bg-slate-800 px-4 text-xs font-semibold text-white disabled:opacity-40"><Eye size={15}/>View</button>
        <FilterResetButton count={activeFilterCount} onClick={reset}/><BrandRefreshButton onClick={() => void load()}/>
      </div>
    </div>

    <div className={opsTableCardClass}>
      <div className="flex items-center border-b border-slate-100 bg-gradient-to-r from-blue-50/60 via-white to-blue-50/40 px-6 py-3">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-blue-100 bg-blue-50/70 text-blue-500 shadow-inner"><ReceiptText size={20}/></span>
          <h3 className="text-base font-bold tracking-tight text-slate-800">Operation Expenses</h3>
        </div>
      </div>
      <div className="overflow-x-auto"><table className="min-w-[1720px] w-full"><thead className={opsTableHeadRowClass}><tr>
        <th className={`${opsTableThClass} w-10 text-center`}><Hash size={14} className="mx-auto text-slate-400" aria-label="Serial number" /></th>
        <th className={opsTableThClass}><span className="flex items-center gap-1.5"><Hash size={14} className="shrink-0 text-blue-500"/><span>Trip Number</span></span></th>
        <th className={opsTableThClass}><span className="flex items-center gap-1.5"><Calendar size={14} className="shrink-0 text-emerald-500"/><span>Day</span></span></th>
        <th className={opsTableThClass}><span className="flex items-center gap-1.5"><Truck size={14} className="shrink-0 text-indigo-500"/><span>Vehicle No.</span></span></th>
        <th className={opsTableThClass}><span className="flex items-center gap-1.5"><UserCog size={14} className="shrink-0 text-violet-500"/><span>Supervisor</span></span></th>
        <th className={`${opsTableThClass} text-center`}><span className="flex items-center justify-center gap-1.5"><Users size={14} className="shrink-0 text-cyan-500"/><span>Emp</span></span></th>
        <th className={`${opsTableThClass} text-right`}><span className="flex items-center justify-end gap-1.5"><Wallet size={14} className="shrink-0 text-amber-500"/><span>Advance Given</span></span></th>
        <th className={`${opsTableThClass} text-right`}><span className="flex items-center justify-end gap-1.5"><Utensils size={14} className="shrink-0 text-orange-500"/><span>Meals</span></span></th>
        <th className={`${opsTableThClass} text-right`}><span className="flex items-center justify-end gap-1.5"><Package size={14} className="shrink-0 text-sky-500"/><span>Loading</span></span></th>
        <th className={`${opsTableThClass} text-right`}><span className="flex items-center justify-end gap-1.5"><Coffee size={14} className="shrink-0 text-rose-500"/><span>Tiffin</span></span></th>
        <th className={`${opsTableThClass} text-right`}><span className="flex items-center justify-end gap-1.5"><UserRound size={14} className="shrink-0 text-purple-500"/><span>S.PC</span></span></th>
        <th className={`${opsTableThClass} text-right`}><span className="flex items-center justify-end gap-1.5"><Fuel size={14} className="shrink-0 text-emerald-600"/><span>Diesel</span></span></th>
        <th className={`${opsTableThClass} text-right`}><span className="flex items-center justify-end gap-1.5"><Ellipsis size={14} className="shrink-0 text-slate-500"/><span>Others</span></span></th>
        <th className={`${opsTableThClass} text-right`}><span className="flex items-center justify-end gap-1.5"><IndianRupee size={14} className="shrink-0 text-green-600"/><span>Total Expense</span></span></th>
        <th className={opsTableThClass}><span className="flex items-center gap-1.5"><MessageSquareText size={14} className="shrink-0 text-teal-500"/><span>Remarks</span></span></th>
      </tr></thead><tbody className={`${opsTableDivideClass} bg-white`}>
        {loading ? <tr><td colSpan={15} className="py-16 text-center text-sm text-slate-400">Loading completed trip expenses…</td></tr> : rows.length === 0 ? <tr><td colSpan={15} className="py-16 text-center text-sm text-slate-400">No completed trip expenses found.</td></tr> : rows.map((row, index) => {
          const personnelDetails = row.expenseBreakdown.filter((x) => x.name.includes("Bata"));
          const standardDetails = row.expenseBreakdown;
          const dieselDetails = row.dieselBreakdown.map((x, i) => ({ name: `${x.bunk || `Diesel ${i + 1}`} · ${Number(x.litres || 0).toFixed(2)} L`, amount: x.amount }));
          const employeeDetails = [{ name: row.supervisorName, role: "Supervisor" }, { name: row.driverName, role: "Driver" }, ...row.employees].filter((e) => e.name);
          return <tr key={row.id} onClick={() => setSelectedId(row.id === selectedId ? null : row.id)} onDoubleClick={() => { setSelectedId(row.id); void openTrip(row.id); }} className={`${opsTableRowClass} cursor-pointer ${selectedId === row.id ? "bg-amber-50/60" : ""}`}>
            <td className={opsTableTdClass}>{(page - 1) * pageSize + index + 1}</td><td className={`${opsTableTdClass} font-semibold text-blue-700`}>{row.tripNo}</td><td className={opsTableTdClass} title={formatTripListDay(row.tripDate)}>{fullDay(row.tripDate)}</td><td className={`${opsTableTdClass} font-medium`}>{formatVehicleNumber(row.vehicleNo)}</td><td className={opsTableTdClass}>{row.supervisorName || "—"}</td>
            <td className={`${opsTableTdClass} text-center`}><span className="group relative inline-flex rounded-full border border-indigo-100 bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700" tabIndex={0}>EMP - {row.employeeCount}<span role="tooltip" className="pointer-events-none absolute bottom-full left-1/2 z-40 mb-2 hidden min-w-48 -translate-x-1/2 rounded-xl bg-slate-900 p-3 text-left text-[11px] text-white shadow-xl group-hover:block group-focus:block">{employeeDetails.map((e, i) => <span key={`${e.role}-${e.name}-${i}`} className="flex justify-between gap-4 py-0.5"><span>{e.name || "Assigned employee"}</span><span className="text-slate-300">{e.role}</span></span>)}</span></span></td>
            <td className={`${opsTableTdClass} text-right`}><AmountWithTooltip value={row.advanceAmount} details={[{ name: "Step 1 advance", amount: row.advanceAmount }]}/></td>
            <td className={`${opsTableTdClass} text-right`}><AmountWithTooltip value={row.meals} details={standardDetails.filter((x) => x.name === "Meals")}/></td><td className={`${opsTableTdClass} text-right`}><AmountWithTooltip value={row.loading} details={standardDetails.filter((x) => x.name === "Loading")}/></td><td className={`${opsTableTdClass} text-right`}><AmountWithTooltip value={row.tiffin} details={standardDetails.filter((x) => x.name === "Tiffin")}/></td><td className={`${opsTableTdClass} text-right`}><AmountWithTooltip value={row.supervisorPc} details={personnelDetails}/></td><td className={`${opsTableTdClass} text-right`}><AmountWithTooltip value={row.diesel} details={dieselDetails}/></td><td className={`${opsTableTdClass} text-right`}><AmountWithTooltip value={row.others} details={[...row.otherBreakdown, ...standardDetails.filter((x) => ["Vehicle Maintenance","Tea / RC","RTO"].includes(x.name))]}/></td>
            <td className={`${opsTableTdClass} text-right`}><AmountWithTooltip value={row.totalExpense} details={[...standardDetails, ...row.otherBreakdown, { name: "Diesel", amount: row.diesel }]}/></td><td className={`${opsTableTdClass} max-w-64 truncate`} title={row.remarks || ""}>{row.remarks || "—"}</td>
          </tr>;
        })}
      </tbody></table></div>
      {total > 0 && <Pagination page={page} pageSize={pageSize} totalItems={total} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}/>} 
    </div>
    <ExpenseView trip={viewTrip} onClose={() => setViewTrip(null)}/>
  </div>;
}
