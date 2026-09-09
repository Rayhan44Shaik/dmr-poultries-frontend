// src/modules/staff/pages/SalaryRegisterPage.tsx
//
// Salary Register — standardised on the GLOBAL UI kit so the page shares the
// exact same typography, control chrome and rhythm as every other module:
//
//   • Filter bar   → `uiFilterBarClass` surface + the shared `MasterDropdown`
//                    (the app-wide dropdown: 36px control, 12px corners,
//                    keyboard nav, portalled menu) + the global `SearchInput`
//                    (40px, 13px type, leading icon, clear button).
//   • Buttons      → the global `Button` system (one height/radius/font scale).
//   • Month status → `uiBadgeClass` tones — the one badge system project-wide.
//   • Confirm      → the global `ConfirmDialog` (replaces the local modal).
//   • Empty states → the global `EmptyState` component.

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useSalaryRegister } from "../hooks/useSalaryRegister";
import { useSafeNotification } from "../../../hooks/useSafeNotification";
import { loadEmployees } from "../../masters/employees/services/employeeService";
import { getSalaryMonthSummary, downloadPayslipPdf, updateSalary, emailSalaryPayslips, whatsappSalaryPayslips, bulkUpdateSalaryStatus } from "../services/salaryService";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  LayoutGrid,
  RefreshCw,
  CheckCircle,
  ClipboardCheck,
  Plus,
  FileText,
  Lock,
} from "lucide-react";
import { Button, ConfirmDialog, EmptyState, SearchInput } from "../../../ui";
import MasterDropdown from "../../masters/components/MasterDropdown";
import { uiBadgeClass, uiFilterBarClass, type StatusTone } from "../../../shared/ui/uiTokens";
import { SalaryTable } from "../components/salary/salaryTable";
import { SalaryView } from "../components/salary/SalaryView";
import { SalaryReviewModal } from "../components/salary/SalaryReviewModal";
import { EmailPayslipsModal } from "../components/salary/EmailPayslipsModal";
import { WhatsAppPayslipsModal } from "../components/salary/WhatsAppPayslipsModal";
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

/** Filter micro-label — identical to `MasterDropdown`'s own filter label so
 *  every label in one filter row renders on the same type scale. */
const filterLabelClass =
  "mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500";

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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [emailsSent, setEmailsSent] = useState(false);
  const [emailsSentCount, setEmailsSentCount] = useState(0);
  const [whatsappSent, setWhatsappSent] = useState(false);
  const [whatsappSentCount, setWhatsappSentCount] = useState(0);
  const [emailOpen, setEmailOpen] = useState(false);
  const [whatsappOpen, setWhatsappOpen] = useState(false);
  // Which records the send modals act on. Populated either from the Review
  // & Submit selection or from a single employee's row in the salary table.
  const [emailTarget, setEmailTarget] = useState<SalaryRecord[]>([]);
  const [whatsappTarget, setWhatsappTarget] = useState<SalaryRecord[]>([]);

  // A successful payslip send (email OR WhatsApp) is required before the month
  // can be submitted. The flags reset directly in the selection handlers (not
  // an effect) so a changed selection can never leave a stale "sent" state.
  const resetEmailsSent = useCallback(() => {
    setEmailsSent(false);
    setEmailsSentCount(0);
  }, []);

  // Open the email / WhatsApp composer for a chosen set of employees (either
  // the current selection in Review & Submit, or a single table row).
  const openEmailFor = useCallback((records: SalaryRecord[]) => {
    setEmailTarget(records);
    setEmailOpen(true);
  }, []);
  const openWhatsAppFor = useCallback((records: SalaryRecord[]) => {
    setWhatsappTarget(records);
    setWhatsappOpen(true);
  }, []);
  const resetWhatsappSent = useCallback(() => {
    setWhatsappSent(false);
    setWhatsappSentCount(0);
  }, []);

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

  const handleSubmitSelected = useCallback(
    async (ids: string[]) => {
      if (ids.length === 0) return;
      try {
        const result = await bulkUpdateSalaryStatus(ids, {
          status: "Paid",
          paymentDate: new Date().toISOString().slice(0, 10),
          paymentMode: "Bank Transfer",
        });
        await refresh();
        setSubmitMonthOpen(false);
        showNotification(
          `Submitted ${result.updated.length} salary record(s) successfully.`,
          "success"
        );
      } catch (error) {
        showNotification(
          (error as Error)?.message || "Unable to submit selected salaries.",
          "error"
        );
      }
    },
    [refresh, showNotification]
  );

  const handleDownload = useCallback(
    async (record: SalaryRecord) => {
      setDownloadingId(record.id);
      try {
        await downloadPayslipPdf(record);
      } catch {
        showNotification("Unable to download payslip.", "error");
      } finally {
        setDownloadingId(null);
      }
    },
    [showNotification]
  );

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    resetEmailsSent();
    resetWhatsappSent();
  }, [resetEmailsSent, resetWhatsappSent]);

  const toggleSelectAll = useCallback((ids: string[]) => {
    setSelectedIds((prev) => {
      const allSelected =
        ids.length > 0 && ids.every((id) => prev.has(id));
      return allSelected ? new Set<string>() : new Set(ids);
    });
    resetEmailsSent();
    resetWhatsappSent();
  }, [resetEmailsSent, resetWhatsappSent]);

  const handleDownloadSelected = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return;
    // Resolve ids to full records — the payslip PDF is generated from the
    // record when the backend endpoint is unavailable.
    const byId = new Map(allRecords.map((r) => [r.id, r]));
    let downloaded = 0;
    for (const id of ids) {
      const record = byId.get(id);
      if (!record) continue;
      try {
        await downloadPayslipPdf(record);
        downloaded += 1;
        // Small stagger so browsers accept multiple sequential downloads.
        if (ids.length > 1) await new Promise((r) => setTimeout(r, 350));
      } catch {
        /* best-effort; backend may be offline */
      }
    }
    if (downloaded > 0) {
      showNotification(`Downloaded ${downloaded} payslip PDF(s).`, "success");
    } else {
      showNotification("Unable to download payslips.", "error");
    }
  }, [allRecords, showNotification]);

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

  // Month lifecycle badge — rendered with the global badge tokens so the
  // tone vocabulary (success / warning / info / neutral) matches every other
  // status pill in the application.
  const monthStatus = useMemo(() => {
    if (!monthSummary) return null;
    if (monthSummary.closed) return { label: "Closed", tone: "neutral" as StatusTone };
    if (monthSummary.employees === 0) return { label: "Draft", tone: "neutral" as StatusTone };
    if (monthSummary.paid === monthSummary.employees) return { label: "Paid", tone: "success" as StatusTone };
    if (monthSummary.paid > 0) return { label: "Partially Paid", tone: "warning" as StatusTone };
    if (monthSummary.submitted > 0 && monthSummary.pending === 0) return { label: "Submitted", tone: "info" as StatusTone };
    if (monthSummary.submitted > 0) return { label: "Partially Submitted", tone: "info" as StatusTone };
    return { label: "Pending", tone: "warning" as StatusTone };
  }, [monthSummary]);

  // The payment date for the register heading. Shown only when the ENTIRE
  // month's register is Paid AND every paid record shares one payment date.
  // Individual payment dates still appear in each employee's payslip view.
  const monthPaidOnDate = useMemo(() => {
    if (allRecords.length === 0) return null;
    const paid = allRecords.filter((r) => r.status === "Paid");
    if (paid.length !== allRecords.length) return null;
    const dates = paid
      .map((r) => r.paymentDate ?? null)
      .filter((d): d is string => Boolean(d));
    if (dates.length === 0) return null;
    const distinct = new Set(dates);
    return distinct.size === 1 ? dates[0] : null;
  }, [allRecords]);

  // Status segmented control — same treatment as the Leave page's status tabs
  // (active = white chip + brand text, inactive = quiet slate).
  const statusTab = (key: 'All' | 'Pending' | 'Paid', label: string, icon: React.ReactNode) => (
    <button
      type="button"
      onClick={() => handleFilterChange(key)}
      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
        filter === key
          ? "bg-white text-brand-700 shadow-sm border border-slate-200/60"
          : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
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
          <span className={uiBadgeClass(monthStatus.tone)}>
            {monthStatus.label === "Closed" || monthStatus.label === "Paid" ? <Lock size={11} /> : null}
            {monthStatus.label}
          </span>
        )}
        <div className="flex items-center gap-2 ml-auto">
          {!hasRecords && !loading && (
            <Button
              variant="primary"
              size="md"
              onClick={handleGenerate}
              loading={saving}
              icon={<Plus size={14} />}
            >
              Generate Register
            </Button>
          )}
        </div>
      </div>

      {/* Filter bar — the global filter-bar surface + shared dropdown/search */}
      <div className={`${uiFilterBarClass} space-y-3 overflow-visible relative z-10`}>
        <div className="flex flex-wrap items-end gap-3">
          <div className="relative w-full sm:w-44" ref={monthPickerRef}>
            <label className={filterLabelClass}>Month</label>
            <button
              type="button"
              onClick={() => {
                const [y] = month.split("-");
                if (y) setPickerYear(Number(y));
                setIsMonthPickerOpen((o) => !o);
              }}
              className="flex h-9 w-full items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 outline-none transition hover:border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
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

          <MasterDropdown
            label="Department"
            value={department}
            placeholder="All Departments"
            options={departments}
            onChange={handleDepartmentChange}
            allowClear
            disabled={loading}
            className="w-full sm:w-56"
          />

          <MasterDropdown
            label="Employee"
            value={employeeName}
            placeholder="All Employees"
            options={employeeNames}
            onChange={handleEmployeeNameChange}
            searchable
            allowClear
            disabled={loading}
            className="w-full sm:w-56"
          />

          <div>
            <span className={filterLabelClass}>Status</span>
            <div className="inline-flex bg-slate-100/80 p-1 rounded-xl border border-slate-200/60 h-9 items-center">
              {statusTab("All", "All", <LayoutGrid size={12} className="text-slate-400" />)}
              {statusTab("Pending", "Pending", <Clock size={12} className="text-slate-400" />)}
              {statusTab("Paid", "Paid", <CheckCircle size={12} className="text-slate-400" />)}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px] max-w-sm">
            <label htmlFor="salary-register-search" className={filterLabelClass}>
              Search Employee
            </label>
            <SearchInput
              id="salary-register-search"
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder="Search by employee name..."
              disabled={loading}
            />
          </div>
          <MasterDropdown
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
            className="w-full sm:w-56"
          />
          <div className="ml-auto flex items-end gap-2">
            <Button
              variant="success"
              size="md"
              onClick={() => setSubmitMonthOpen(true)}
              disabled={saving || refreshing || allRecords.length === 0}
              icon={<ClipboardCheck size={15} />}
            >
              Review and Submit
            </Button>
            <Button
              variant="secondary"
              size="md"
              iconOnly
              onClick={handleRefresh}
              disabled={refreshing || saving}
              title="Refresh"
              aria-label="Refresh"
              icon={<RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />}
            />
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
        <div className="bg-white rounded-xl border border-slate-200">
          <EmptyState
            variant="no-data"
            icon={<FileText />}
            title={`No salary records for ${formatMonthName(month)}`}
            description="Generate the register for this month to create salary records for all employees."
            action={
              <Button
                variant="primary"
                size="md"
                onClick={handleGenerate}
                loading={saving}
                icon={<Plus size={14} />}
              >
                Generate Register for this Month
              </Button>
            }
          />
        </div>
      ) : visibleRecords.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200">
          <EmptyState
            variant="no-filters"
            title="No records match the current filters"
            description="No salary records match the selected month, department, employee or search. Adjust the filters to see more."
          />
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
          onEmail={(record) => openEmailFor([record])}
          onWhatsApp={(record) => openWhatsAppFor([record])}
          monthLabel={formatMonthName(month)}
          paidOnDate={monthPaidOnDate}
        />
      )}

      {/* Modals */}
      {viewTarget && (
        <SalaryView
          record={viewTarget}
          onClose={() => setViewTarget(null)}
          onDownload={() => void handleDownload(viewTarget)}
          downloading={downloadingId === viewTarget.id}
        />
      )}

      {submitMonthOpen && (
        <SalaryReviewModal
          monthLabel={formatMonthName(month)}
          records={allRecords}
          pendingCount={totals.pendingCount}
          onClose={() => setSubmitMonthOpen(false)}
          onSubmitSelected={(ids) => void handleSubmitSelected(ids)}
          onSaveRecord={(record) => handleSaveRecord(record)}
          submitDisabled={!emailsSent && !whatsappSent}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onToggleSelectAll={toggleSelectAll}
          onDownloadSelected={(ids) => void handleDownloadSelected(ids)}
          onEmailSelected={() => {
            openEmailFor(allRecords.filter((r) => selectedIds.has(r.id)));
          }}
          onWhatsAppSelected={() => {
            openWhatsAppFor(allRecords.filter((r) => selectedIds.has(r.id)));
          }}
          emailsSentCount={emailsSentCount}
          whatsappSentCount={whatsappSentCount}
        />
      )}

      {emailOpen && (
        <EmailPayslipsModal
          monthLabel={formatMonthName(month)}
          records={emailTarget}
          saving={saving}
          onClose={() => {
            setEmailOpen(false);
            setEmailTarget([]);
          }}
          onSent={(sent, failed) => {
            // Submit unlocks only once EVERY selected payslip was emailed
            // successfully. Any failure keeps the modal open for retry.
            if (failed === 0 && sent > 0) {
              setEmailsSentCount(sent);
              setEmailsSent(true);
              setEmailOpen(false);
              setEmailTarget([]);
              showNotification("All selected payslips emailed. You can now submit the month.", "success");
            } else {
              showNotification(
                `Email incomplete — ${sent} sent, ${failed} failed. All selected employees must receive their payslip before submitting.`,
                "warning"
              );
            }
          }}
          onSend={async (ids, payload) => emailSalaryPayslips(ids, payload)}
        />
      )}

      {whatsappOpen && (
        <WhatsAppPayslipsModal
          monthLabel={formatMonthName(month)}
          records={whatsappTarget}
          saving={saving}
          onClose={() => {
            setWhatsappOpen(false);
            setWhatsappTarget([]);
          }}
          onSent={(sent, failed) => {
            // Submit unlocks only once EVERY selected payslip was sent on
            // WhatsApp. Any failure keeps the modal open for retry.
            if (failed === 0 && sent > 0) {
              setWhatsappSentCount(sent);
              setWhatsappSent(true);
              setWhatsappOpen(false);
              setWhatsappTarget([]);
              showNotification("All selected payslips sent on WhatsApp. You can now submit the month.", "success");
            } else {
              showNotification(
                `WhatsApp incomplete — ${sent} sent, ${failed} failed. All selected employees must receive their payslip before submitting.`,
                "warning"
              );
            }
          }}
          onSend={async (ids, payload) => whatsappSalaryPayslips(ids, payload)}
        />
      )}

      <ConfirmDialog
        isOpen={Boolean(confirmConfig)}
        title={confirmConfig?.title ?? ""}
        message={confirmConfig?.message}
        tone="primary"
        confirmLabel="Confirm"
        cancelLabel="Cancel"
        loading={saving}
        onConfirm={confirmConfig ? confirmConfig.onConfirm : () => setConfirmConfig(null)}
        onCancel={() => setConfirmConfig(null)}
      />
    </div>
  );
}

export default SalaryRegisterPage;
