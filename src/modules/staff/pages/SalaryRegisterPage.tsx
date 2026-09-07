// src/modules/staff/pages/SalaryRegisterPage.tsx

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useSalaryRegister } from "../hooks/useSalaryRegister";
import { useSafeNotification } from "../../../hooks/useSafeNotification";
import { loadEmployees } from "../../masters/employees/services/employeeService";
import { getSalaryMonthSummary, downloadPayslipPdf, submitSalaryMonth } from "../services/salaryService";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  LayoutGrid,
  RefreshCw,
  Users,
  Wallet,
  TrendingUp,
  TrendingDown,
  CheckCircle,
  Send,
  Plus,
  FileText,
  X,
  CheckCheck,
  Undo2,
  Lock,
} from "lucide-react";
import { SalaryTable } from "../components/salary/salaryTable";
import { SalaryView } from "../components/salary/SalaryView";
import { BulkPayModal } from "../components/salary/BulkPayModal";
import { SubmitMonthModal } from "../components/salary/SubmitMonthModal";
import type { SalaryMonthSummary, SalaryRecord } from "../types/staffDashboard";

function formatMonthName(monthStr: string): string {
  if (!monthStr) return "";
  const [year, m] = monthStr.split("-");
  const date = new Date(Number(year), Number(m) - 1, 1);
  return date.toLocaleString("default", { month: "long", year: "numeric" });
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(amount || 0);

function Kpi({
  label,
  value,
  sub,
  icon,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  tone: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-3.5 flex items-start justify-between">
      <div className="min-w-0">
        <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">{label}</div>
        <div className="text-lg font-extrabold text-slate-800 mt-1 leading-tight">{value}</div>
        {sub && <div className="text-[11px] text-slate-400 mt-0.5">{sub}</div>}
      </div>
      <div className={`p-2 rounded-lg shrink-0 ${tone}`}>{icon}</div>
    </div>
  );
}

const MONTHS = [
  { name: "Jan", value: "01" },
  { name: "Feb", value: "02" },
  { name: "Mar", value: "03" },
  { name: "Apr", value: "04" },
  { name: "May", value: "05" },
  { name: "Jun", value: "06" },
  { name: "Jul", value: "07" },
  { name: "Aug", value: "08" },
  { name: "Sep", value: "09" },
  { name: "Oct", value: "10" },
  { name: "Nov", value: "11" },
  { name: "Dec", value: "12" },
];

function SalaryRegisterPage() {
  const { showNotification } = useSafeNotification();

  const getCurrentYearMonth = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    return `${year}-${month}`;
  };

  const [month, setMonth] = useState(getCurrentYearMonth());
  const [department, setDepartment] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [masterEmployees, setMasterEmployees] = useState<Array<{ department?: string; employeeName?: string }>>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkPayOpen, setBulkPayOpen] = useState(false);
  const [submitMonthOpen, setSubmitMonthOpen] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);
  const [monthSummary, setMonthSummary] = useState<SalaryMonthSummary | null>(null);

  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState<number>(() => Number(getCurrentYearMonth().split("-")[0]));
  const [currentPage, setCurrentPage] = useState(1);
  const monthPickerRef = useRef<HTMLDivElement>(null);

  const {
    records,
    allRecords,
    totals,
    filter,
    setFilter,
    loading,
    refreshing,
    saving,
    error,
    usingSampleData,
    refresh,
    markPaidBulk,
    markUnpaidBulk,
    generate,
    hasRecords,
  } = useSalaryRegister(month, department);

  const handleMonthChange = useCallback((value: string) => {
    setMonth(value);
    setCurrentPage(1);
    setSelectedIds(new Set());
  }, []);

  const handleDepartmentChange = useCallback((value: string) => {
    setDepartment(value);
    setCurrentPage(1);
    setSelectedIds(new Set());
  }, []);

  const handleFilterChange = useCallback((value: 'All' | 'Pending' | 'Submitted' | 'Paid') => {
    setFilter(value);
    setCurrentPage(1);
    setSelectedIds(new Set());
  }, [setFilter]);

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (monthPickerRef.current && !monthPickerRef.current.contains(e.target as Node)) {
        setIsMonthPickerOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    let mounted = true;
    loadEmployees()
      .then((data) => {
        if (mounted) setMasterEmployees(data as Array<{ department?: string; employeeName?: string }>);
      })
      .catch(() => {
        if (mounted) setMasterEmployees([]);
      });
    return () => {
      mounted = false;
    };
  }, []);

  // Month-level lifecycle status comes only from the backend.
  useEffect(() => {
    let cancelled = false;
    getSalaryMonthSummary(month)
      .then((summary) => {
        if (!cancelled) setMonthSummary(summary);
      })
      .catch(() => {
        if (!cancelled) setMonthSummary(null);
      });
    return () => {
      cancelled = true;
    };
  }, [month, records]);

  const departments = useMemo(() => {
    const set = new Set<string>();
    for (const e of masterEmployees) {
      if (e.department) set.add(e.department);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [masterEmployees]);

  const visibleRecords = useMemo(() => {
    if (!searchQuery.trim()) return records;
    const q = searchQuery.toLowerCase();
    return records.filter((r) => (r.employeeName || "").toLowerCase().includes(q));
  }, [records, searchQuery]);

  const handleRefresh = useCallback(() => {
    void refresh();
  }, [refresh]);

  // ---- Bulk selection -----------------------------------------------------
  const selectedRows = useMemo(
    () => allRecords.filter((r) => selectedIds.has(r.id)),
    [allRecords, selectedIds]
  );
  const selectedTotalNet = useMemo(
    () => selectedRows.reduce((sum, r) => sum + r.netSalary, 0),
    [selectedRows]
  );

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback((ids: string[]) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      const allSelected = ids.length > 0 && ids.every((id) => next.has(id));
      if (allSelected) ids.forEach((id) => next.delete(id));
      else ids.forEach((id) => next.add(id));
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  // ---- Actions -----------------------------------------------------------
  const [viewTarget, setViewTarget] = useState<SalaryRecord | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const confirm = useCallback((title: string, message: string, onConfirm: () => void) => {
    setConfirmConfig({ title, message, onConfirm });
  }, []);

  const runConfirm = useCallback(
    async (result: Promise<{ ok: boolean; message: string }>) => {
      const res = await result;
      showNotification(res.message, res.ok ? "success" : "error");
    },
    [showNotification]
  );

  const handleGenerate = useCallback(() => {
    confirm(
      "Generate Salary Register",
      `Generate salary records for ${formatMonthName(month)} for all employees without one?`,
      () => {
        setConfirmConfig(null);
        void runConfirm(generate());
      }
    );
  }, [confirm, generate, month, runConfirm]);

  const handleSubmitMonth = useCallback(async () => {
    setSubmitMonthOpen(false);
    try {
      const result = await submitSalaryMonth(month);
      await refresh();
      let message = `${formatMonthName(month)} salary submitted successfully.`;
      if (result.emailQueuedCount > 0 && result.emailFailedCount === 0) {
        message = `${formatMonthName(month)} salary submitted. Payslip emails queued for ${result.emailQueuedCount} employees.`;
      } else if (result.emailQueuedCount > 0) {
        message = `${formatMonthName(month)} salary submitted. ${result.emailSentCount} payslips sent, ${result.emailFailedCount} email deliveries need attention.`;
      } else if (result.submittedCount === 0) {
        message = `${formatMonthName(month)} salary already submitted. No duplicate emails queued.`;
      }
      showNotification(message, "success");
    } catch (error) {
      showNotification((error as Error)?.message || "Unable to submit month.", "error");
    }
  }, [showNotification, month, refresh]);

  const handleBulkPay = useCallback(
    (input: { paymentDate: string; paymentMode: string }) => {
      const ids = [...selectedIds];
      setBulkPayOpen(false);
      void runConfirm(markPaidBulk(ids, input)).then(() => clearSelection());
    },
    [selectedIds, markPaidBulk, runConfirm, clearSelection]
  );

  const handleBulkUnpaid = useCallback(() => {
    const ids = [...selectedIds];
    confirm(
      "Mark Unpaid",
      `Revert ${ids.length} selected salary record${ids.length === 1 ? "" : "s"} to Pending? Paid records revert only inside the correction window; the whole batch is rejected if any record cannot be updated.`,
      () => {
        setConfirmConfig(null);
        void runConfirm(markUnpaidBulk(ids)).then(() => clearSelection());
      }
    );
  }, [confirm, selectedIds, markUnpaidBulk, runConfirm, clearSelection]);

  const handleDownload = useCallback(
    async (record: SalaryRecord) => {
      setDownloadingId(record.id);
      try {
        await downloadPayslipPdf(record.id);
      } catch {
        showNotification("Unable to download payslip.", "error");
      } finally {
        setDownloadingId(null);
      }
    },
    [showNotification]
  );

  const monthStatus = useMemo(() => {
    if (!monthSummary) return null;
    if (monthSummary.closed) return { label: "Closed", tone: "bg-slate-100 text-slate-600 border-slate-200" };
    if (monthSummary.employees === 0) return { label: "Draft", tone: "bg-slate-50 text-slate-500 border-slate-200" };
    if (monthSummary.paid === monthSummary.employees) return { label: "Paid", tone: "bg-emerald-50 text-emerald-700 border-emerald-200" };
    if (monthSummary.paid > 0) return { label: "Partially Paid", tone: "bg-indigo-50 text-indigo-700 border-indigo-200" };
    if (monthSummary.submitted > 0 && monthSummary.pending === 0) return { label: "Submitted", tone: "bg-blue-50 text-blue-700 border-blue-200" };
    if (monthSummary.submitted > 0) return { label: "Partially Submitted", tone: "bg-blue-50 text-blue-700 border-blue-200" };
    return { label: "Pending", tone: "bg-amber-50 text-amber-700 border-amber-200" };
  }, [monthSummary]);

  const statusTab = (key: 'All' | 'Pending' | 'Submitted' | 'Paid', label: string, icon: React.ReactNode) => (
    <button
      type="button"
      onClick={() => handleFilterChange(key)}
      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
        filter === key ? "bg-white text-blue-600 shadow-sm" : "text-slate-600 hover:text-slate-900"
      }`}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <div className="space-y-4 w-full">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-slate-900">Salary Register</h1>
            {monthStatus && (
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${monthStatus.tone}`}>
                {monthStatus.label === "Closed" || monthStatus.label === "Paid" ? <Lock size={11} /> : null}
                {monthStatus.label}
              </span>
            )}
            {usingSampleData && (
              <span
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border bg-amber-50 text-amber-700 border-amber-200"
                title="Backend unavailable — showing local sample data (attendance derived from sample duty assignments)"
              >
                Sample data
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">Monthly payroll, attendance and payment status</p>
        </div>
        <div className="flex items-center gap-2">
          {!hasRecords && !loading && (
            <button
              type="button"
              onClick={handleGenerate}
              disabled={saving}
              className="h-9 px-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition flex items-center gap-1.5 shadow-sm disabled:opacity-50"
            >
              <Plus size={14} /> Generate Register
            </button>
          )}
          <button
            type="button"
            onClick={() => setSubmitMonthOpen(true)}
            disabled={saving || refreshing || totals.pendingCount === 0}
            className="h-9 px-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition flex items-center gap-1.5 shadow-sm disabled:opacity-50"
          >
            <Send size={14} /> Submit Month
          </button>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing || saving}
            className="h-9 px-3 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold transition flex items-center gap-1.5 disabled:opacity-50"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} /> Refresh
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="relative" ref={monthPickerRef}>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Month</label>
            <button
              type="button"
              onClick={() => {
                const [y] = month.split("-");
                if (y) setPickerYear(Number(y));
                setIsMonthPickerOpen((o) => !o);
              }}
              className="h-9 px-3 w-44 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none bg-white text-slate-700 flex items-center justify-between hover:border-slate-300 transition font-medium"
            >
              <span>{formatMonthName(month)}</span>
              <Calendar size={14} className="text-blue-500" />
            </button>

            {isMonthPickerOpen && (
              <div className="absolute top-full left-0 mt-2 w-72 bg-white rounded-2xl shadow-lg border border-slate-200 p-4 z-50 space-y-4">
                <div className="flex items-center justify-between bg-slate-50 px-3 py-2 rounded-xl border border-slate-200/60">
                  <button type="button" onClick={() => setPickerYear((p) => p - 1)} className="p-1.5 hover:bg-white rounded-lg text-slate-600 transition">
                    <ChevronLeft size={16} />
                  </button>
                  <span className="text-sm font-bold text-slate-800">{pickerYear}</span>
                  <button type="button" onClick={() => setPickerYear((p) => p + 1)} className="p-1.5 hover:bg-white rounded-lg text-slate-600 transition">
                    <ChevronRight size={16} />
                  </button>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {MONTHS.map((m) => {
                    const isSelected = month === `${pickerYear}-${m.value}`;
                    return (
                      <button
                        key={m.value}
                        type="button"
                        onClick={() => {
                          handleMonthChange(`${pickerYear}-${m.value}`);
                          setIsMonthPickerOpen(false);
                        }}
                        className={`py-2.5 rounded-xl text-xs font-semibold transition ${
                          isSelected
                            ? "bg-blue-600 text-white shadow-sm"
                            : "bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-100"
                        }`}
                      >
                        {m.name}
                      </button>
                    );
                  })}
                </div>
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      const cur = getCurrentYearMonth();
                      handleMonthChange(cur);
                      setPickerYear(Number(cur.split("-")[0]));
                      setIsMonthPickerOpen(false);
                    }}
                    className="text-blue-600 font-semibold hover:underline"
                  >
                    This Month
                  </button>
                  <button type="button" onClick={() => setIsMonthPickerOpen(false)} className="text-slate-400 hover:text-slate-600 font-medium">
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Department</label>
            <select
              value={department}
              onChange={(e) => handleDepartmentChange(e.target.value)}
              className="h-9 px-3 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none bg-white text-slate-700 hover:border-slate-300 transition font-medium"
            >
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          <div className="flex-1 min-w-[200px] max-w-sm">
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Search Employee</label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search by employee name..."
              className="h-9 w-full px-3 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none bg-white text-slate-700"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Status</label>
            <div className="inline-flex bg-slate-100/80 p-0.5 rounded-xl border border-slate-200 h-9 items-center">
              {statusTab("All", "All", <LayoutGrid size={12} className="text-slate-400" />)}
              {statusTab("Pending", "Pending", <Clock size={12} className="text-slate-400" />)}
              {statusTab("Submitted", "Submitted", <Send size={12} className="text-slate-400" />)}
              {statusTab("Paid", "Paid", <CheckCircle size={12} className="text-slate-400" />)}
            </div>
          </div>
        </div>
      </div>

      {/* Payroll summary — 7 compact cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-2.5">
        <Kpi label="Employees" value={String(totals.totalEmployees)} sub="Monthly staff" icon={<Users size={15} />} tone="bg-slate-100 text-slate-600" />
        <Kpi label="Gross Payroll" value={formatCurrency(totals.totalGross)} icon={<TrendingUp size={15} />} tone="bg-emerald-50 text-emerald-600" />
        <Kpi label="Deductions" value={formatCurrency(totals.totalDeductions)} icon={<TrendingDown size={15} />} tone="bg-rose-50 text-rose-600" />
        <Kpi label="Net Payroll" value={formatCurrency(totals.netPayroll)} icon={<Wallet size={15} />} tone="bg-indigo-50 text-indigo-600" />
        <Kpi label="Pending" value={String(totals.pendingCount)} icon={<Clock size={15} />} tone="bg-amber-50 text-amber-600" />
        <Kpi label="Submitted" value={String(totals.submittedCount)} icon={<Send size={15} />} tone="bg-blue-50 text-blue-600" />
        <Kpi label="Paid" value={String(totals.paidCount)} icon={<CheckCircle size={15} />} tone="bg-emerald-50 text-emerald-600" />
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-700">
          {error}
        </div>
      )}

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-blue-800">
            <CheckCheck size={15} className="text-blue-600" />
            {selectedIds.size} selected · Total {formatCurrency(selectedTotalNet)}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => setBulkPayOpen(true)}
              disabled={saving}
              className="h-9 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition flex items-center gap-1.5 shadow-sm disabled:opacity-50"
            >
              <Wallet size={14} /> Mark as Paid
            </button>
            <button
              type="button"
              onClick={handleBulkUnpaid}
              disabled={saving}
              className="h-9 px-3.5 rounded-xl border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 text-xs font-semibold transition flex items-center gap-1.5 disabled:opacity-50"
            >
              <Undo2 size={14} /> Mark as Unpaid
            </button>
            <button
              type="button"
              onClick={clearSelection}
              disabled={saving}
              className="h-9 px-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition flex items-center gap-1 text-xs font-semibold disabled:opacity-50"
              title="Clear selection"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Table / states — data remains visible during refresh */}
      {loading ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500 flex flex-col items-center justify-center space-y-2">
          <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs font-medium">Loading salary register for {formatMonthName(month)}...</span>
        </div>
      ) : !hasRecords ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500 text-sm space-y-3">
          <div className="mx-auto w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400">
            <FileText size={18} />
          </div>
          <p>No salary records for {formatMonthName(month)}.</p>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition disabled:opacity-50"
          >
            <Plus size={14} /> Generate Register for this Month
          </button>
        </div>
      ) : visibleRecords.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500 text-sm">
          No records match the current filters.
        </div>
      ) : (
        <SalaryTable
          records={visibleRecords}
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
          itemsPerPage={10}
          formatCurrency={formatCurrency}
          saving={saving}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onToggleSelectAll={toggleSelectAll}
          onView={setViewTarget}
        />
      )}

      {/* Modals */}
      {viewTarget && (
        <SalaryView
          record={viewTarget}
          onClose={() => setViewTarget(null)}
          formatCurrency={formatCurrency}
          onDownload={() => void handleDownload(viewTarget)}
          downloading={downloadingId === viewTarget.id}
        />
      )}

      {bulkPayOpen && (
        <BulkPayModal
          count={selectedIds.size}
          totalNet={selectedTotalNet}
          month={formatMonthName(month)}
          saving={saving}
          onCancel={() => setBulkPayOpen(false)}
          onConfirm={handleBulkPay}
          formatCurrency={formatCurrency}
        />
      )}

      {submitMonthOpen && (
        <SubmitMonthModal
          monthLabel={formatMonthName(month)}
          pendingCount={totals.pendingCount}
          saving={saving}
          onCancel={() => setSubmitMonthOpen(false)}
          onConfirm={() => void handleSubmitMonth()}
        />
      )}

      {confirmConfig && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 shadow-xl border border-slate-200 space-y-4">
            <h3 className="text-base font-bold text-slate-900">{confirmConfig.title}</h3>
            <p className="text-xs text-slate-600">{confirmConfig.message}</p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmConfig(null)}
                disabled={saving}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmConfig.onConfirm}
                disabled={saving}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition shadow-sm disabled:opacity-50"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SalaryRegisterPage;