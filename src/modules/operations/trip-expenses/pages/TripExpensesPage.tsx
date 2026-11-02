import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  Calendar,
  CheckCircle2,
  Ellipsis,
  Eye,
  FileDown,
  Fuel,
  Hash,
  IndianRupee,
  MessageSquareText,
  Plus,
  Pencil,
  Trash2,
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
import { isCanceledError } from "../../../../api/errors";
import { useSafeNotification } from "../../../../hooks/useSafeNotification";
import { useEmployees } from "../../../masters/employees/hooks/useEmployees";
import MasterDropdown from "../../../masters/components/MasterDropdown";
import { AppShellModal, BrandRefreshButton, FilterResetButton, Pagination, countActiveFilters } from "../../../../ui";
import { PAGINATION_DEFAULT_PAGE_SIZE, uiActionIconMotionClass } from "../../../../shared/ui/uiTokens";
import {
  opsFilterCardClass, opsFilterLabelClass, opsInputClass, opsPdfButtonClass, opsPrimaryButtonClass, opsTableCardClass,
  opsTableDivideClass, opsTableHeadRowClass, opsTableRowClass, opsViewButtonClass,
} from "../../../../shared/ui/operationsStyles";
import { useI18n } from "../../../../i18n";
import { formatTripListDay } from "../../vehicle-trips/utils/formatTripListDay";
import { formatVehicleNumber } from "../../../../utils/format";
import { approveManualExpense, createManualExpense, deleteManualExpense, listManualExpenses, listTripExpenses, updateManualExpense, type ExpenseDetail, type ManualExpense, type TripExpenseRow } from "../services/tripExpensesService";
import { ManualExpenseForm } from "../components/ManualExpenseForm";
import { usePendingDelete } from "../../../../hooks/usePendingDelete";
import { PendingDeleteNotification } from "../../../../components/common/PendingDeleteNotification";
import { exportOperationExpensesPdf } from "../utils/exportOperationExpenses";

const money = (value: number) => `₹${Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
type ExpenseSortKey = "tripNo" | "tripDate" | "vehicleNo" | "employeeCount" | "advanceAmount" | "meals" | "supervisorPc" | "vehicleMaintenance" | "diesel" | "others" | "totalExpense";
const AMOUNT_SORTS = new Set<ExpenseSortKey>(["employeeCount", "advanceAmount", "meals", "supervisorPc", "vehicleMaintenance", "diesel", "others", "totalExpense"]);
const SORT_KEYS = new Set<string>(["tripNo", "tripDate", "vehicleNo", "employeeCount", "advanceAmount", "meals", "supervisorPc", "vehicleMaintenance", "diesel", "others", "totalExpense"]);

const thClass = "px-2 py-3 text-xs font-bold uppercase tracking-wide text-slate-600 whitespace-nowrap";
const tdClass = "px-2 py-4 text-[13px] font-medium text-slate-600 text-center align-middle";

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
        {active && <span className="sr-only">{sortDir === "asc" ? "sorted ascending" : "sorted descending"}</span>}
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

function ExpenseView({ expense, history, onSelect, onClose }: { expense: TripExpenseRow | null; history: TripExpenseRow[]; onSelect: (row: TripExpenseRow) => void; onClose: () => void }) {
  if (!expense) return null;
  const detailRows = [
    ["Advance", expense.advanceAmount], ["Meals", expense.meals], ["Loading", expense.loading],
    ["Tiffin", expense.tiffin], ["Supervisor PC", expense.supervisorPc], ["Vehicle Maintenance", expense.vehicleMaintenance],
    ["RTO", expense.rto], ["Diesel", expense.diesel], ["Other Expenses", expense.others],
  ] as const;
  return <AppShellModal open onClose={onClose} panelClassName="max-w-[96rem] bg-white" ariaLabelledBy="expense-view-title">
    <div className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
      <div className="flex items-center gap-3"><span className="flex h-12 w-12 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-600"><ReceiptText size={25}/></span><div><h2 id="expense-view-title" className="text-lg font-semibold text-slate-900">Expense Bill — {expense.tripNo}</h2><p className="text-xs font-normal text-slate-500"><Truck size={12} className="mr-1 inline"/>{formatVehicleNumber(expense.vehicleNo)} · {expense.supervisorName || expense.driverName || "Trip expense"}</p></div></div>
      <div className="flex items-center gap-3"><span className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-700"><CheckCircle2 size={14} className="mr-1 inline"/>Approved (Trip Completion)</span><button type="button" onClick={onClose} className="group rounded-full border border-slate-200 bg-white p-2.5 text-slate-500 shadow-sm transition-all duration-200 hover:bg-slate-100 active:scale-90" aria-label="Close"><span className={`inline-flex ${uiActionIconMotionClass.close}`}><X size={18}/></span></button></div>
    </div>
    <div className="grid min-h-[600px] grid-cols-1 md:grid-cols-[360px_1fr]">
      <aside className="border-b border-slate-200 bg-slate-50/80 p-4 md:border-b-0 md:border-r">
        <div className="mb-3 flex items-center justify-between px-2"><span className="text-xs font-bold uppercase tracking-wider text-slate-500"><Truck size={14} className="mr-1 inline"/>Trip Expense History</span><span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-600">{history.length}</span></div>
        <div className="max-h-[545px] space-y-2 overflow-y-auto pr-1">{history.map((row) => <button key={row.id} type="button" onClick={() => onSelect(row)} className={`w-full rounded-xl border p-3 text-left transition-all ${row.id === expense.id ? "border-emerald-400 bg-emerald-50 shadow-sm ring-2 ring-emerald-500/20" : "border-slate-200 bg-white hover:border-emerald-200"}`}>
          <div className="flex items-center justify-between gap-2"><span className="text-sm font-medium text-slate-800">{formatTripListDay(row.tripDate)}</span><span className="rounded-lg bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700">{row.tripNo}</span></div>
          <div className="mt-2 flex items-center justify-between text-xs"><span className="font-normal text-slate-500">{formatVehicleNumber(row.vehicleNo)}</span><span className="font-semibold text-emerald-700">{money(row.totalExpense)}</span></div>
        </button>)}</div>
      </aside>
      <section key={expense.id} className="flex min-w-0 flex-col overflow-y-auto p-5 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-right-1 motion-safe:duration-200 sm:p-6">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="overflow-hidden rounded-xl border border-slate-200">{[["Trip Number", expense.tripNo], ["Date", formatTripListDay(expense.tripDate)], ["Vehicle", formatVehicleNumber(expense.vehicleNo)], ["Supervisor", expense.supervisorName || "—"], ["Driver", expense.driverName || "—"], ["Employees", String(expense.employeeCount)]].map(([label,value]) => <div key={label} className="flex items-center justify-between gap-4 border-b border-slate-100 px-4 py-3 last:border-0"><span className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</span><span className="text-sm font-medium text-slate-800">{value}</span></div>)}</div>
          <div className="overflow-hidden rounded-xl border border-slate-200">{detailRows.map(([label,value]) => <div key={label} className="flex items-center justify-between gap-4 border-b border-slate-100 px-4 py-3 last:border-0"><span className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</span><span className={`text-sm font-semibold ${value > 0 ? "text-emerald-700" : "text-slate-600"}`}>{money(value)}</span></div>)}</div>
        </div>
        {expense.dieselBreakdown.length > 0 && <div className="mt-4 rounded-xl border border-slate-200 p-4"><div className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">Diesel Bill Details</div><div className="grid gap-2 sm:grid-cols-2">{expense.dieselBreakdown.map((bill,index) => <div key={`${bill.bunk}-${index}`} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs"><span className="font-semibold text-slate-700">{bill.bunk || `Diesel ${index+1}`} · {bill.litres.toFixed(2)} L</span><span className="font-bold text-emerald-700">{money(bill.amount)}</span></div>)}</div></div>}
        <div className="mt-4 rounded-xl border border-slate-200 p-4"><div className="text-xs font-bold uppercase tracking-wide text-slate-400">Remarks / Operator Notes</div><div className="mt-2 text-sm font-semibold text-slate-700">{expense.remarks || "No remarks"}</div></div>
        <div className="my-4 flex items-center justify-between rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-white px-5 py-4"><span className="text-sm font-semibold uppercase tracking-wide text-emerald-700">Total Trip Expense</span><span className="text-xl font-semibold text-emerald-700">{money(expense.totalExpense)}</span></div>
        <div className="mt-auto flex justify-end border-t border-slate-100 pt-4"><button type="button" onClick={onClose} className="group inline-flex h-10 items-center gap-2 rounded-xl bg-slate-100 px-5 text-sm font-semibold text-slate-700 transition-all duration-200 hover:bg-slate-200 active:scale-95"><span className={`inline-flex ${uiActionIconMotionClass.close}`}><X size={15}/></span>Close</button></div>
      </section>
    </div>
  </AppShellModal>;
}

function ManualExpenseView({ expense, history, editable, onSelect, onEdit, onApprove, onDelete, onClose }: {
  expense: ManualExpense | null;
  history: ManualExpense[];
  editable: (row: ManualExpense) => boolean;
  onSelect: (row: ManualExpense) => void;
  onEdit: (row: ManualExpense) => void;
  onApprove: (row: ManualExpense) => void;
  onDelete: (row: ManualExpense) => void;
  onClose: () => void;
}) {
  if (!expense) return null;
  const canChange = editable(expense);
  const pending = expense.status === "Pending";
  return <AppShellModal open onClose={onClose} panelClassName="max-w-[96rem] bg-white" ariaLabelledBy="manual-expense-view-title">
    <div className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
      <div className="flex items-center gap-3"><span className="flex h-12 w-12 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-600"><ReceiptText size={25}/></span><div><h2 id="manual-expense-view-title" className="text-lg font-semibold text-slate-900">Expense Bill — {expense.expenseNo}</h2><p className="text-xs font-normal text-slate-500">{expense.expenseType} · {formatTripListDay(expense.expenseDate)}</p></div></div>
      <div className="flex items-center gap-3"><span className={`rounded-full border px-4 py-2 text-xs font-semibold ${pending ? "border-amber-200 bg-amber-50 text-amber-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>{pending ? "Pending Approval" : "Approved"}</span>
      <button type="button" onClick={onClose} className="group rounded-full border border-slate-200 bg-white p-2.5 text-slate-500 shadow-sm transition-all duration-200 hover:bg-slate-100 active:scale-90" aria-label="Close"><span className={`inline-flex ${uiActionIconMotionClass.close}`}><X size={17}/></span></button>
      </div>
    </div>
    <div className="grid min-h-[560px] grid-cols-1 md:grid-cols-[360px_1fr]">
      <aside className="border-b border-slate-200 bg-slate-50/80 p-3 md:border-b-0 md:border-r">
        <div className="mb-3 flex items-center justify-between px-2"><span className="text-xs font-bold uppercase tracking-wider text-slate-500">Expense History</span><span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-600">{history.length}</span></div>
        <div className="max-h-[510px] space-y-2 overflow-y-auto pr-1">
          {history.map((row) => <button key={row.id} type="button" onClick={() => onSelect(row)} className={`w-full rounded-xl border p-3 text-left transition-all ${row.id === expense.id ? "border-violet-300 bg-violet-50 shadow-sm" : "border-slate-200 bg-white hover:border-emerald-200 hover:bg-emerald-50/40"}`}>
            <div className="flex items-center justify-between gap-2"><span className="text-xs font-bold text-violet-700">{row.expenseNo}</span><span className="text-xs font-bold text-emerald-700">{money(row.amount)}</span></div>
            <div className="mt-1 text-xs font-semibold text-slate-700">{row.expenseType}</div>
            <div className="mt-0.5 truncate text-[11px] text-slate-500">{formatTripListDay(row.expenseDate)} · {row.description}</div>
          </button>)}
        </div>
      </aside>
      <section key={expense.id} className="flex flex-col p-5 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-right-1 motion-safe:duration-200 sm:p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div><div className="text-xs font-medium uppercase tracking-wider text-slate-400">Expense number</div><div className="mt-1 text-lg font-semibold text-violet-700">{expense.expenseNo}</div></div>
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${canChange ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{canChange ? "Editable for 14 days" : "Record frozen"}</span>
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {[
            ["Date", formatTripListDay(expense.expenseDate)],
            ["Expense type", expense.expenseType],
            ["Amount", money(expense.amount)],
            ["Created by", expense.createdBy || "—"],
            ["Status", pending ? "Pending Approval" : "Approved"],
            ["Approved by", expense.approvedBy || "—"],
          ].map(([label, value]) => <div key={label} className="rounded-xl border border-slate-200 bg-slate-50/60 p-4"><div className="text-[11px] font-medium uppercase tracking-wider text-slate-400">{label}</div><div className="mt-1 text-sm font-medium text-slate-800">{value}</div></div>)}
        </div>
        <div className="mt-4 rounded-xl border border-slate-200 p-4"><div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Expense details</div><div className="mt-1 text-sm font-semibold text-slate-800">{expense.description}</div></div>
        <div className="mt-3 rounded-xl border border-slate-200 p-4"><div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Remarks</div><div className="mt-1 text-sm text-slate-700">{expense.remarks || "No remarks"}</div></div>
        <div className="my-4 flex items-center justify-between rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-white px-5 py-4"><span className="text-sm font-semibold uppercase tracking-wide text-emerald-700">Total Expense</span><span className="text-xl font-semibold text-emerald-700">{money(expense.amount)}</span></div>
        <div className="mt-auto flex justify-end gap-2 border-t border-slate-100 pt-4">
          <button type="button" disabled={!canChange} onClick={() => onDelete(expense)} className="group inline-flex h-9 items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 text-xs font-semibold text-rose-600 transition-all duration-200 hover:bg-rose-100 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"><span className={`inline-flex ${uiActionIconMotionClass.delete}`}><Trash2 size={14}/></span>Delete</button>
          {pending && <button type="button" onClick={() => onApprove(expense)} className="group inline-flex h-9 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-xs font-semibold text-white transition-all duration-200 hover:bg-emerald-700 active:scale-95"><span className={`inline-flex ${uiActionIconMotionClass.approve}`}><CheckCircle2 size={14}/></span>Approve</button>}
          <button type="button" disabled={!canChange} onClick={() => onEdit(expense)} className="group inline-flex h-9 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-xs font-semibold text-white transition-all duration-200 hover:bg-emerald-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"><span className={`inline-flex ${uiActionIconMotionClass.edit}`}><Pencil size={14}/></span>Edit expense</button>
        </div>
      </section>
    </div>
  </AppShellModal>;
}

export default function TripExpensesPage() {
  const { t } = useI18n();
  const { showNotification } = useSafeNotification();
  const { employees } = useEmployees();
  const [rows, setRows] = useState<TripExpenseRow[]>([]);
  const [summaryRows, setSummaryRows] = useState<TripExpenseRow[]>([]);
  const [manualRows, setManualRows] = useState<ManualExpense[]>([]);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualSaving, setManualSaving] = useState(false);
  const [editingManual, setEditingManual] = useState<ManualExpense | null>(null);
  const [viewingManual, setViewingManual] = useState<ManualExpense | null>(null);
  const [selectedManualId, setSelectedManualId] = useState<number | null>(null);
  const [manualWindowNow] = useState(() => Date.now());
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGINATION_DEFAULT_PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [supervisorId, setSupervisorId] = useState("");
  const [expenseSource, setExpenseSource] = useState<"ALL" | "TRIP" | "MANUAL">("ALL");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("tripDate:desc");
  const [includeMasterBunks, setIncludeMasterBunks] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [viewTrip, setViewTrip] = useState<TripExpenseRow | null>(null);
  const [exporting, setExporting] = useState(false);
  const hasRowsRef = useRef(false);
  const loadSeqRef = useRef(0);
  const loadAbortRef = useRef<AbortController | null>(null);
  const exportBusyRef = useRef(false);
  const deferredSearch = useDeferredValue(search.trim());

  const supervisorOptions = useMemo(() => employees.filter((e) => `${e.department} ${e.secondaryDepartment ?? ""}`.toLowerCase().includes("supervisor")).map((e) => ({ value: String(e.id), label: e.employeeName })), [employees]);
  const [sortByRaw, sortDirRaw] = sort.split(":");
  const sortBy = SORT_KEYS.has(sortByRaw) ? sortByRaw : "tripDate";
  const sortDir: "asc" | "desc" = sortDirRaw === "asc" ? "asc" : "desc";
  const activeFilterCount = countActiveFilters(Boolean(fromDate || toDate), Boolean(supervisorId), expenseSource !== "ALL", Boolean(search.trim()), sort !== "tripDate:desc");
  const canExportPdf = Boolean(fromDate || toDate || supervisorId || expenseSource !== "ALL");
  const showFilteredTotal = Boolean(fromDate || toDate || supervisorId || expenseSource !== "ALL");

  const queryBase = useMemo(() => ({
    fromDate: fromDate || undefined,
    toDate: toDate || undefined,
    supervisorId: supervisorId || undefined,
    search: deferredSearch || undefined,
    sortBy,
    sortDir,
    includeMasterBunks,
  }), [fromDate, toDate, supervisorId, deferredSearch, sortBy, sortDir, includeMasterBunks]);

  const load = useCallback(async (quiet = false) => {
    const requestSeq = loadSeqRef.current + 1;
    loadSeqRef.current = requestSeq;
    loadAbortRef.current?.abort();
    const controller = new AbortController();
    loadAbortRef.current = controller;
    if (quiet) setRefreshing(true);
    else setLoading(true);
    try {
      const [result, allRows, manuals] = await Promise.all([
        listTripExpenses({ ...queryBase, page, limit: pageSize }, controller.signal),
        showFilteredTotal ? listTripExpenses({ ...queryBase, export: true }, controller.signal) : Promise.resolve({ data: [] as TripExpenseRow[], meta: { total: 0, page: 1, limit: 1, totalPages: 1 } }),
        supervisorId || expenseSource === "TRIP" ? Promise.resolve([] as ManualExpense[]) : listManualExpenses(queryBase, controller.signal),
      ]);
      if (requestSeq !== loadSeqRef.current) return false;
      setRows(expenseSource === "MANUAL" ? [] : result.data);
      setSummaryRows(allRows.data);
      setManualRows(manuals);
      setTotal(expenseSource === "MANUAL" ? 0 : result.meta.total);
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
  }, [queryBase, page, pageSize, showNotification, showFilteredTotal, supervisorId, expenseSource]);

  const filteredTotals = useMemo(() => {
    const totals = summaryRows.reduce((acc, row) => ({
      advance: acc.advance + row.advanceAmount, meals: acc.meals + row.meals, supervisor: acc.supervisor + row.supervisorPc,
      maintenance: acc.maintenance + row.vehicleMaintenance, diesel: acc.diesel + row.diesel, others: acc.others + row.others,
      total: acc.total + row.totalExpense,
    }), { advance: 0, meals: 0, supervisor: 0, maintenance: 0, diesel: 0, others: 0, total: 0 });
    totals.others += manualRows.reduce((sum, row) => sum + row.amount, 0);
    totals.total += manualRows.reduce((sum, row) => sum + row.amount, 0);
    return totals;
  }, [summaryRows, manualRows]);
  const { requestDelete: requestManualDelete, cancel: cancelManualDelete, pendingItems: pendingManualDeletes } = usePendingDelete<number>(async (id) => {
    await deleteManualExpense(id);
    await load(true);
    showNotification("Expense deleted.", "success");
  }, 10);
  const manualEditable = (row: ManualExpense) => row.status === "Pending" && Boolean(row.createdAt) && manualWindowNow - new Date(row.createdAt!).getTime() <= 14 * 24 * 60 * 60 * 1000;
  const selectedManual = manualRows.find((row) => row.id === selectedManualId) ?? null;
  const selectedTrip = rows.find((row) => row.id === selectedId) ?? null;
  const approveManual = async (row: ManualExpense) => {
    try {
      await approveManualExpense(row.id);
      setViewingManual(null);
      setSelectedManualId(null);
      await load(true);
      showNotification(`${row.expenseNo} approved successfully.`, "success");
    } catch {
      showNotification("Unable to approve expense.", "error");
    }
  };

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
    setSupervisorId("");
    setExpenseSource("ALL");
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
  const openTrip = (tripId: number | null) => {
    if (!tripId) return showNotification("Select a trip to view its Expenses Sheet.", "info");
    const expense = rows.find((row) => row.id === tripId);
    if (!expense) return showNotification("This trip is not available on the current page.", "info");
    setViewTrip(expense);
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
  const visibleManualRows = page === 1 ? manualRows : [];
  const selectableRows = [
    ...visibleManualRows.map((row) => ({ kind: "manual" as const, id: row.id })),
    ...rows.map((row) => ({ kind: "trip" as const, id: row.id })),
  ];
  const selectExpenseRow = (kind: "manual" | "trip", id: number) => {
    if (kind === "manual") {
      setSelectedId(null);
      setSelectedManualId(id);
      return;
    }
    setSelectedManualId(null);
    setSelectedId(id);
  };
  const handleRowKeyDown = (event: KeyboardEvent<HTMLTableRowElement>, kind: "manual" | "trip", id: number, rowIndex: number) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const nextIndex = Math.max(0, Math.min(selectableRows.length - 1, rowIndex + (event.key === "ArrowDown" ? 1 : -1)));
      const next = selectableRows[nextIndex];
      if (!next) return;
      selectExpenseRow(next.kind, next.id);
      requestAnimationFrame(() => document.querySelector<HTMLTableRowElement>(`[data-expense-row-index="${nextIndex}"]`)?.focus());
      return;
    }
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      selectExpenseRow(kind, id);
      if (event.key === "Enter") {
        if (kind === "manual") {
          const manual = visibleManualRows.find((row) => row.id === id);
          if (manual) setViewingManual(manual);
        } else {
          openTrip(id);
        }
      }
    }
  };
  const canView = Boolean(selectedId);

  return <div className="w-full space-y-5">
    <div className={opsFilterCardClass}>
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <div><label className={opsFilterLabelClass}><Calendar size={16} className="text-emerald-500"/>From</label><DatePicker value={fromDate} onChange={(v) => { setFromDate(v); setPage(1); }} className="w-full text-xs" /></div>
        <div><label className={opsFilterLabelClass}><Calendar size={16} className="text-emerald-500"/>To</label><DatePicker value={toDate} onChange={(v) => { setToDate(v); setPage(1); }} className="w-full text-xs" /></div>
        <div><label className={opsFilterLabelClass}><ReceiptText size={16} className="text-blue-500"/>Expense Source</label><MasterDropdown hideLabel label="Expense Source" value={expenseSource} options={[{value:"ALL",label:"All expenses"},{value:"TRIP",label:"Vehicle / trip expenses"},{value:"MANUAL",label:"Manual expenses"}]} onChange={(value) => { setExpenseSource(value as "ALL"|"TRIP"|"MANUAL"); setPage(1); }} placeholder="All expenses" /></div>
        <div><label className={opsFilterLabelClass}><UserCog size={16} className="text-violet-500"/>Supervisor</label><MasterDropdown hideLabel label="Supervisor" value={supervisorId} options={supervisorOptions} onChange={(v) => { setSupervisorId(v); setPage(1); }} placeholder="All Supervisors" searchable allowClear /></div>
      </div>
      <div className="mt-4 flex flex-wrap items-end gap-2">
        <div className="w-full sm:w-[22rem] lg:w-[26rem]"><label className={opsFilterLabelClass}><Search size={16} className="text-slate-400"/>Search</label><div className="relative"><Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/><input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className={`${opsInputClass} pl-9`} placeholder="Trip, vehicle or supervisor"/></div></div>
        <div className="hidden flex-1 lg:block" aria-hidden="true" />
        <button
          type="button"
          onClick={() => {
            if (manualOpen) {
              setManualOpen(false);
              setEditingManual(null);
              return;
            }
            setEditingManual(null);
            setManualOpen(true);
          }}
          className={`group relative ${opsPrimaryButtonClass} active:scale-95 transition-transform duration-150`}
          aria-label={manualOpen ? "Hide expense form" : "Add Expense"}
        >
          <span className="inline-flex transition-transform duration-200 motion-safe:group-hover:rotate-90"><Plus size={16} /></span>
          <span>{manualOpen ? "Hide form" : "Add Expense"}</span>
        </button>
        <button type="button" onClick={() => void exportPdf()} disabled={!canExportPdf || !total || exporting} title={canExportPdf ? "Export the filtered expenses as PDF" : "Choose a date, vehicle or supervisor to export PDF"} className={`${opsPdfButtonClass} disabled:cursor-not-allowed disabled:opacity-40`} aria-label="Export Operation Expenses PDF"><FileDown size={15}/>PDF</button>
        <button type="button" onClick={() => openTrip(selectedId)} disabled={!canView} className={`group ${opsViewButtonClass} disabled:cursor-not-allowed disabled:opacity-40`} aria-label="View expenses sheet">
          <span className={`inline-flex ${canView ? uiActionIconMotionClass.view : ""}`}><Eye size={14} /></span>
          View
        </button>
        <FilterResetButton count={activeFilterCount} onClick={reset}/><BrandRefreshButton onClick={handleRefresh} loading={loading || refreshing} size="md"/>
      </div>
    </div>

    {manualOpen && (
      <ManualExpenseForm
        key={editingManual?.id ?? "new"}
        saving={manualSaving}
        initialData={editingManual}
        onClose={() => { setManualOpen(false); setEditingManual(null); }}
        onSave={async (draft) => {
          const wasEditing = Boolean(editingManual);
          setManualSaving(true);
          try {
            if (editingManual) await updateManualExpense(editingManual.id, draft);
            else await createManualExpense(draft);
            setManualOpen(false);
            setEditingManual(null);
            showNotification(wasEditing ? "Expense updated successfully." : "Expense added successfully.", "success");
            await load(true);
          } catch {
            showNotification("Unable to save expense.", "error");
          } finally {
            setManualSaving(false);
          }
        }}
      />
    )}

    <div className={opsTableCardClass}>
      <div className="flex flex-col gap-3 border-b border-slate-100 bg-gradient-to-r from-blue-50/60 via-white to-blue-50/40 px-6 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-blue-100 bg-blue-50/70 text-blue-500 shadow-inner"><ReceiptText size={20}/></span>
          <h3 className="text-base font-bold tracking-tight text-slate-800">Operation Expenses</h3>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <DieselBunkToggle includeMasterBunks={includeMasterBunks} onChange={setBunkMode} />
          {(selectedManual || selectedTrip) && <div className="flex items-center gap-2">
            <button type="button" onClick={() => selectedManual ? setViewingManual(selectedManual) : openTrip(selectedTrip?.id ?? null)} className="group inline-flex h-9 items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 text-xs font-semibold text-emerald-700 shadow-sm transition-all hover:bg-emerald-100 active:scale-95"><span className={`inline-flex ${uiActionIconMotionClass.view}`}><Eye size={14}/></span>View</button>
            {selectedManual?.status === "Pending" && <button type="button" onClick={() => void approveManual(selectedManual)} className="group inline-flex h-9 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-xs font-semibold text-white shadow-sm transition-all hover:bg-emerald-700 active:scale-95"><span className={`inline-flex ${uiActionIconMotionClass.approve}`}><CheckCircle2 size={14}/></span>Approve</button>}
            {selectedManual && <button type="button" disabled={!manualEditable(selectedManual)} onClick={() => requestManualDelete(selectedManual.id, { label: `Deleting expense ${selectedManual.expenseNo}` })} className="group inline-flex h-9 items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 text-xs font-semibold text-rose-600 shadow-sm transition-all hover:bg-rose-100 active:scale-95 disabled:cursor-not-allowed disabled:opacity-35"><span className={`inline-flex ${uiActionIconMotionClass.delete}`}><Trash2 size={14}/></span>Delete</button>}
            {selectedManual && <button type="button" disabled={!manualEditable(selectedManual)} onClick={() => { setEditingManual(selectedManual); setManualOpen(true); }} className="group inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-slate-100 px-4 text-xs font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-200 active:scale-95 disabled:cursor-not-allowed disabled:opacity-35"><span className={`inline-flex ${uiActionIconMotionClass.edit}`}><Pencil size={14}/></span>Edit</button>}
          </div>}
        </div>
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
            <col className="w-[6%]" />
            <col className="w-[6%]" />
            <col className="w-[8%]" />
            <col className="w-[7%]" />
            <col className="w-[8%]" />
            <col className="w-[9%]" />
            <col className="w-[7%]" />
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
            {loading && !rows.length ? <tr><td colSpan={13} className="py-16 text-center text-sm text-slate-400">Loading completed trip expenses…</td></tr> : rows.length === 0 && manualRows.length === 0 ? <tr><td colSpan={13} className="py-16 text-center text-sm text-slate-400">No completed trip expenses found.</td></tr> : <>
            {page === 1 && manualRows.map((row, index) => {
              const viewManual = () => setViewingManual(row);
              const selected = selectedManualId === row.id;
              return <tr key={`manual-${row.id}`} tabIndex={0} data-expense-row-index={index} className={`${opsTableRowClass} cursor-pointer outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-400 ${selected ? "bg-emerald-50/80 shadow-[inset_4px_0_0_0_#10b981] hover:bg-emerald-50" : "hover:bg-slate-50/80"}`} aria-selected={selected} onClick={() => { setSelectedId(null); setSelectedManualId(selected ? null : row.id); }} onDoubleClick={viewManual} onKeyDown={(event) => handleRowKeyDown(event, "manual", row.id, index)}>
                <td className={`${tdClass} text-slate-500`}>{selected ? <CheckCircle2 size={16} className="mx-auto text-emerald-600" /> : index + 1}</td>
                <td className="px-2 py-4 text-center align-middle">
                  <button type="button" onClick={viewManual} className="text-[13px] font-bold text-violet-600 hover:underline" title="View expense details">{row.expenseNo}</button>
                </td>
                <td className={tdClass}>{formatTripListDay(row.expenseDate)}</td>
                <td className={tdClass}><span className="rounded-full bg-violet-50 px-2 py-1 text-[11px] font-bold text-violet-700">Manual</span></td>
                <td className={tdClass}>—</td><td className={tdClass}>—</td><td className={tdClass}>—</td><td className={tdClass}>—</td><td className={tdClass}>—</td><td className={tdClass}>—</td>
                <td className={tdClass}><BreakdownTooltip title={row.expenseType} trigger={money(row.amount)} rows={[{ label: row.description, value: money(row.amount) }]}/></td>
                <td className={tdClass}>{money(row.amount)}</td>
                <td className={`${tdClass} truncate`} title={row.remarks || row.description}>{row.remarks || row.description}</td>
              </tr>;
            })}
            {rows.map((row, index) => {
              const dieselDetails = row.dieselBreakdown.map((item, dieselIndex) => ({ name: `${item.bunk || `Diesel ${dieselIndex + 1}`} · ${Number(item.litres || 0).toFixed(2)} L`, amount: item.amount }));
              const vehicleDetails = row.vehicleMaintenance > 0 ? [{ name: row.vehicleMaintenanceNote || "Vehicle Maintenance", amount: row.vehicleMaintenance }] : [];
              const employeeDetails = [{ name: row.supervisorName, role: "Supervisor" }, { name: row.driverName, role: "Driver" }, ...row.employees].filter((employee) => employee.name);
              const selected = selectedId === row.id;
              return <tr
                key={row.id}
                tabIndex={0}
                data-expense-row-index={visibleManualRows.length + index}
                aria-selected={selected}
                onClick={() => { setSelectedManualId(null); setSelectedId(row.id === selectedId ? null : row.id); }}
                onDoubleClick={() => { setSelectedId(row.id); openTrip(row.id); }}
                onKeyDown={(event) => handleRowKeyDown(event, "trip", row.id, visibleManualRows.length + index)}
                className={`${opsTableRowClass} cursor-pointer outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-400 ${selected ? "bg-emerald-50/80 shadow-[inset_4px_0_0_0_#10b981] hover:bg-emerald-50" : "hover:bg-slate-50/80"}`}
              >
                <td className={`${tdClass} text-slate-500`}>{selected ? <CheckCircle2 size={16} className="mx-auto text-emerald-600" /> : manualRows.length + (page - 1) * pageSize + index + 1}</td>
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
            })}</>}
          </tbody>
          {showFilteredTotal && (summaryRows.length > 0 || manualRows.length > 0) && <tfoot className="border-t-2 border-slate-200 bg-slate-50/90"><tr><td className={tdClass}>Σ</td><td colSpan={3} className="px-3 py-4 text-left text-sm font-semibold text-emerald-700"><div>Overall Total</div><div className="text-[11px] font-medium text-slate-500">All filtered records · not just this page</div></td><td className={tdClass}>—</td><td className={`${tdClass} font-semibold`}>{money(filteredTotals.advance)}</td><td className={`${tdClass} font-semibold`}>{money(filteredTotals.meals)}</td><td className={`${tdClass} font-semibold`}>{money(filteredTotals.supervisor)}</td><td className={`${tdClass} font-semibold`}>{money(filteredTotals.maintenance)}</td><td className={`${tdClass} font-semibold`}>{money(filteredTotals.diesel)}</td><td className={`${tdClass} font-semibold`}>{money(filteredTotals.others)}</td><td className={`${tdClass} font-semibold text-emerald-700`}>{money(filteredTotals.total)}</td><td className={tdClass}>—</td></tr></tfoot>}
        </table>
      </div>
      {total > 0 && <Pagination page={page} pageSize={pageSize} totalItems={total} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}/>}
    </div>
    <ExpenseView expense={viewTrip} history={rows} onSelect={setViewTrip} onClose={() => setViewTrip(null)}/>
    <ManualExpenseView
      expense={viewingManual}
      history={manualRows}
      editable={manualEditable}
      onSelect={setViewingManual}
      onEdit={(row) => { setViewingManual(null); setEditingManual(row); setManualOpen(true); }}
      onApprove={(row) => void approveManual(row)}
      onDelete={(row) => {
        setViewingManual(null);
        requestManualDelete(row.id, { label: `Deleting expense ${row.expenseNo}` });
      }}
      onClose={() => setViewingManual(null)}
    />
    <PendingDeleteNotification items={pendingManualDeletes} onCancel={cancelManualDelete}/>
  </div>;
}
