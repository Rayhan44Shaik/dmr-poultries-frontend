// src/modules/staff/pages/SalaryRegisterPage.tsx

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { uiInputClass } from '../../../shared/ui/uiTokens';
import { useSalaryRegister } from "../hooks/useSalaryRegister";
import { useSafeNotification } from "../../../hooks/useSafeNotification";
import { loadEmployees } from "../../masters/employees/services/employeeService";
import { getSalaryMonthSummary, downloadPayslipPdf, submitSalaryMonth, updateSalary } from "../services/salaryService";
import {
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  LayoutGrid,
  RefreshCw,
  Search,
  CheckCircle,
  ClipboardCheck,
  Plus,
  FileText,
  Lock,
} from "lucide-react";
import { SalaryTable } from "../components/salary/salaryTable";
import { SalaryView } from "../components/salary/SalaryView";
import { SalaryReviewModal } from "../components/salary/SalaryReviewModal";
import { SAMPLE_EMPLOYEE_LIST } from "../services/staffSampleData";
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

function FilterDropdown({
  label,
  value,
  placeholder,
  options,
  onChange,
  searchable = false,
  allowClear = true,
}: {
  label: string;
  value: string;
  placeholder: string;
  options: Array<string | { value: string; label: string }>;
  onChange: (value: string) => void;
  searchable?: boolean;
  allowClear?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const items = useMemo(
    () =>
      options.map((opt) =>
        typeof opt === "string" ? { value: opt, label: opt } : opt
      ),
    [options]
  );

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  useEffect(() => {
    if (open && searchable) {
      requestAnimationFrame(() => searchRef.current?.focus());
    }
  }, [open, searchable]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((opt) => opt.label.toLowerCase().includes(q));
  }, [items, query]);

  const selectedLabel = items.find((opt) => opt.value === value)?.label;
  const display = selectedLabel || placeholder;

  const pick = (next: string) => {
    onChange(next);
    setOpen(false);
    setQuery("");
  };

  return (
    <div className="relative" ref={ref}>
      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">{label}</label>
      <button
        type="button"
        onClick={() => {
          if (!open) setQuery("");
          setOpen((o) => !o);
        }}
        className="h-9 px-3 w-56 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none bg-white text-slate-700 flex items-center justify-between gap-2 hover:border-slate-300 transition font-medium"
      >
        <span className={`truncate ${value ? "text-slate-700" : "text-slate-400"}`}>{display}</span>
        <ChevronDown size={14} className={`text-slate-400 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-[80] w-56 bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
          {searchable && (
            <div className="p-1.5 border-b border-slate-100">
              <div className="flex items-center gap-1.5 h-8 px-2 rounded-lg bg-slate-50 border border-slate-200">
                <Search size={12} className="text-slate-400 shrink-0" />
                <input
                  ref={searchRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search..."
                  className="w-full bg-transparent text-xs text-slate-700 outline-none"
                />
              </div>
            </div>
          )}
          <ul className="overflow-y-auto overscroll-contain" style={{ maxHeight: "11.25rem" }}>
            {allowClear && (
              <li>
                <button
                  type="button"
                  onClick={() => pick("")}
                  className={`w-full text-left px-3 h-9 text-xs font-medium truncate hover:bg-slate-50 ${
                    !value ? "text-blue-600 bg-blue-50" : "text-slate-600"
                  }`}
                >
                  {placeholder}
                </button>
              </li>
            )}
            {filtered.map((opt) => (
              <li key={opt.value}>
                <button
                  type="button"
                  onClick={() => pick(opt.value)}
                  className={`w-full text-left px-3 h-9 text-xs font-medium truncate hover:bg-slate-50 ${
                    value === opt.value ? "text-blue-600 bg-blue-50" : "text-slate-700"
                  }`}
                >
                  {opt.label}
                </button>
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="px-3 h-9 flex items-center text-xs text-slate-400">No matches</li>
            )}
          </ul>
        </div>
      )}
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
  const [employeeName, setEmployeeName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<
    | "name-asc"
    | "name-desc"
    | "salary-asc"
    | "salary-desc"
    | "deduction-asc"
    | "deduction-desc"
    | "working-asc"
    | "working-desc"
    | "leave-asc"
    | "leave-desc"
  >("name-asc");
  const [masterEmployees, setMasterEmployees] = useState<Array<{ department?: string; employeeName?: string }>>([]);
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
    refresh,
    updateRecord,
    generate,
    hasRecords,
  } = useSalaryRegister(month, department);

  const handleMonthChange = useCallback((value: string) => {
    setMonth(value);
    setCurrentPage(1);
  }, []);

  const handleDepartmentChange = useCallback((value: string) => {
    setDepartment(value);
    setEmployeeName("");
    setCurrentPage(1);
  }, []);

  const handleEmployeeNameChange = useCallback((value: string) => {
    setEmployeeName(value);
    setCurrentPage(1);
  }, []);

  const handleFilterChange = useCallback((value: 'All' | 'Pending' | 'Paid') => {
    setFilter(value);
    setCurrentPage(1);
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
        if (mounted) setMasterEmployees(SAMPLE_EMPLOYEE_LIST);
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
    for (const r of allRecords) {
      if (r.department) set.add(r.department);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [masterEmployees, allRecords]);

  const employeeNames = useMemo(() => {
    const set = new Set<string>();
    for (const e of masterEmployees) {
      if (e.employeeName && (!department || e.department === department)) {
        set.add(e.employeeName);
      }
    }
    for (const r of allRecords) {
      if (r.employeeName && (!department || r.department === department)) {
        set.add(r.employeeName);
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [masterEmployees, allRecords, department]);

  const visibleRecords = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = records.filter((r) => {
      if (department && (r.department || "") !== department) return false;
      if (employeeName && (r.employeeName || "") !== employeeName) return false;
      if (!q) return true;
      const name = (r.employeeName || "").toLowerCase();
      const id = String(r.employeeId ?? "").toLowerCase();
      return name.includes(q) || id.includes(q);
    });

    const num = (v: number | undefined | null) => Number(v ?? 0);
    const sorted = [...filtered].sort((a, b) => {
      switch (sortKey) {
        case "name-desc":
          return (b.employeeName || "").localeCompare(a.employeeName || "");
        case "salary-asc":
          return num(a.netSalary) - num(b.netSalary);
        case "salary-desc":
          return num(b.netSalary) - num(a.netSalary);
        case "deduction-asc":
          return num(a.totalDeductions) - num(b.totalDeductions);
        case "deduction-desc":
          return num(b.totalDeductions) - num(a.totalDeductions);
        case "working-asc":
          return num(a.workingDays) - num(b.workingDays);
        case "working-desc":
          return num(b.workingDays) - num(a.workingDays);
        case "leave-asc":
          return num(a.leaveDays) - num(b.leaveDays);
        case "leave-desc":
          return num(b.leaveDays) - num(a.leaveDays);
        case "name-asc":
        default:
          return (a.employeeName || "").localeCompare(b.employeeName || "");
      }
    });
    return sorted;
  }, [records, searchQuery, employeeName, department, sortKey]);

  const handleRefresh = useCallback(() => {
    void refresh();
  }, [refresh]);

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

  const handleSaveRecord = useCallback(
    async (record: SalaryRecord) => {
      // Optimistically update the register table so the change is visible
      // immediately (and works even when the backend is offline).
      updateRecord(record);
      try {
        await updateSalary(record);
        showNotification(`Saved payslip changes for ${record.employeeName}.`, "success");
      } catch {
        // Backend unavailable — the edit is still applied locally to the table.
        showNotification(
          `Saved locally (backend offline): ${record.employeeName}.`,
          "info"
        );
      }
    },
    [updateRecord, showNotification]
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

  const statusTab = (key: 'All' | 'Pending' | 'Paid', label: string, icon: React.ReactNode) => (
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
        {monthStatus && (
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${monthStatus.tone}`}>
            {monthStatus.label === "Closed" || monthStatus.label === "Paid" ? <Lock size={11} /> : null}
            {monthStatus.label}
          </span>
        )}
        <div className="flex items-center gap-2 ml-auto">
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
        </div>
      </div>

      {/* Filter bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 overflow-visible relative z-10">
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

          <FilterDropdown
            label="Department"
            value={department}
            placeholder="All Departments"
            options={departments}
            onChange={handleDepartmentChange}
          />

          <FilterDropdown
            label="Employee"
            value={employeeName}
            placeholder="All Employees"
            options={employeeNames}
            onChange={handleEmployeeNameChange}
            searchable
          />

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Status</label>
            <div className="inline-flex bg-slate-100/80 p-0.5 rounded-xl border border-slate-200 h-9 items-center">
              {statusTab("All", "All", <LayoutGrid size={12} className="text-slate-400" />)}
              {statusTab("Pending", "Pending", <Clock size={12} className="text-slate-400" />)}
              {statusTab("Paid", "Paid", <CheckCircle size={12} className="text-slate-400" />)}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px] max-w-sm">
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Search Employee</label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search by employee name..."
              className={uiInputClass}
            />
          </div>
          <FilterDropdown
            label="Sort"
            value={sortKey}
            placeholder="Name A–Z"
            searchable
            allowClear={false}
            options={[
              { value: "name-asc", label: "Name A–Z" },
              { value: "name-desc", label: "Name Z–A" },
              { value: "salary-asc", label: "Salary: Low to High" },
              { value: "salary-desc", label: "Salary: High to Low" },
              { value: "deduction-asc", label: "Deductions: Low to High" },
              { value: "deduction-desc", label: "Deductions: High to Low" },
              { value: "working-asc", label: "Working days: Low to High" },
              { value: "working-desc", label: "Working days: High to Low" },
              { value: "leave-asc", label: "Leaves: Low to High" },
              { value: "leave-desc", label: "Leaves: High to Low" },
            ]}
            onChange={(value) => {
              setSortKey(value as typeof sortKey);
              setCurrentPage(1);
            }}
          />
          <div className="ml-auto flex items-end gap-2">
            <button
              type="button"
              onClick={() => setSubmitMonthOpen(true)}
              disabled={saving || refreshing || allRecords.length === 0}
              className="h-9 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition flex items-center gap-1.5 shadow-sm disabled:opacity-50"
            >
              <ClipboardCheck size={15} /> Review and Submit
            </button>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing || saving}
              title="Refresh"
              aria-label="Refresh"
              className="h-9 w-9 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition flex items-center justify-center disabled:opacity-50"
            >
              <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-700">
          {error}
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

      {submitMonthOpen && (
        <SalaryReviewModal
          monthLabel={formatMonthName(month)}
          records={allRecords}
          pendingCount={totals.pendingCount}
          saving={saving}
          formatCurrency={formatCurrency}
          onClose={() => setSubmitMonthOpen(false)}
          onSubmitMonth={() => void handleSubmitMonth()}
          onDownload={(record) => void handleDownload(record)}
          downloadingId={downloadingId}
          onSaveRecord={(record) => handleSaveRecord(record)}
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