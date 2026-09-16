// src/modules/staff/pages/SalaryRegisterPage.tsx
//
// Salary Register — standardised on the GLOBAL UI kit so the page shares the
// exact same typography, control chrome and rhythm as every other module:
//
//   • Filter bar   → the Trip List filter treatment (`opsFilterCardClass` +
//                    icon-led `opsFilterLabelClass` labels + the shared
//                    `MasterDropdown`), with the same action row: animated
//                    Reset, the DMR hen `BrandRefreshButton`, and the page's
//                    primary action (Review and Submit) — a 1:1 match with
//                    Operations → Trip List so every filter section in the
//                    app reads identically.
//   • Buttons      → the global `Button` system (one height/radius/font scale).
//   • Month status → `uiBadgeClass` tones — the one badge system project-wide.
//   • Confirm      → the global `ConfirmDialog` (replaces the local modal).
//   • Empty states → the global `EmptyState` component.

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useSalaryRegister } from "../hooks/useSalaryRegister";
import { useSafeNotification } from "../../../hooks/useSafeNotification";
import { todayBusinessDate } from "../../../utils/businessDate";
import { loadEmployees } from "../../masters/employees/services/employeeService";
import { downloadPayslipPdf, updateSalary, emailSalaryPayslips, whatsappSalaryPayslips, bulkUpdateSalaryStatus } from "../services/salaryService";
import { generateCombinedPayslipPdf } from "../services/payslipPdf";
import {
  ArrowUpDown,
  Building2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  LayoutGrid,
  ListFilter,
  CheckCircle,
  ClipboardCheck,
  FileText,
  Plus,
  RotateCcw,
  Search,
  Send,
  UserRound,
} from "lucide-react";
import { BrandRefreshButton, Button, ConfirmDialog, EmptyState } from "../../../ui";
import MasterDropdown from "../../masters/components/MasterDropdown";
import { uiButton } from "../../../shared/ui/uiTokens";
import {
  opsFilterCardClass,
  opsFilterLabelClass,
  opsInputClass,
  opsSecondaryButtonClass,
} from "../../../shared/ui/operationsStyles";
import TableLoading from "../components/common/TableLoading";
import { useI18n, type Language } from "../../../i18n";
import { salaryDisplayText, salaryLocale, salaryMatchesQuery } from "../utils/salaryDisplay";
import { SalaryTable } from "../components/salary/salaryTable";
import { SalaryView } from "../components/salary/SalaryView";
import { SalaryReviewModal } from "../components/salary/SalaryReviewModal";
import { isSalaryPaid } from "../components/salary/payslipModel";
import { SendPayslipsModal } from "../components/salary/SendPayslipsModal";
import { EMAIL_TEMPLATES } from "../components/salary/payslipMessages";
import { SAMPLE_EMPLOYEE_LIST } from "../services/staffSampleData";
import type { SalaryRecord } from "../types/staffDashboard";

function formatMonthName(monthStr: string, language: Language = "en"): string {
  if (!monthStr) return "";
  const [year, m] = monthStr.split("-");
  const date = new Date(Number(year), Number(m) - 1, 1);
  return date.toLocaleString(salaryLocale(language), { month: "long", year: "numeric" });
}

// Short month names for the picker grid — Telugu words, Latin digits elsewhere.
const MONTHS_TE = ["జన", "ఫిబ్ర", "మార్చి", "ఏప్రి", "మే", "జూన్", "జులై", "ఆగ", "సెప్టెం", "అక్టో", "నవం", "డిసెం"];

// Whole-rupee format for the register table — the paise (".00") added no
// information and made the Basic / Deductions / Net columns overflow their
// width. The formal payslip document keeps its own 2-decimal format.
const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount || 0);

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
  const { t, language } = useI18n();
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
    | "status-pending-first"
    | "status-paid-first"
    | "salary-asc"
    | "salary-desc"
    | "deduction-asc"
    | "deduction-desc"
    | "working-asc"
    | "working-desc"
    | "leave-asc"
    | "leave-desc"
  >("name-asc");
  const [masterEmployees, setMasterEmployees] = useState<Array<{ department?: string; employeeName?: string; status?: string }>>([]);
  const [submitMonthOpen, setSubmitMonthOpen] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState<number>(() => Number(getCurrentYearMonth().split("-")[0]));
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const monthPickerRef = useRef<HTMLDivElement>(null);

  const {
    records,
    allRecords,
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

  const handlePageSizeChange = useCallback((next: number) => {
    setPageSize(next);
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
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape closes the month popover (the page has no other overlay open
      // at this layer).
      if (e.key === "Escape") setIsMonthPickerOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    loadEmployees()
      .then((data) => {
        if (mounted) setMasterEmployees(data as Array<{ department?: string; employeeName?: string; status?: string }>);
      })
      .catch(() => {
        if (mounted) setMasterEmployees(SAMPLE_EMPLOYEE_LIST);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const departments = useMemo(() => {
    const set = new Set<string>();
    for (const e of masterEmployees) {
      if (e.status === "Inactive") continue;
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
      if (e.status === "Inactive") continue;
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
    const q = searchQuery.trim();
    const filtered = records.filter((r) => {
      if (department && (r.department || "") !== department) return false;
      if (employeeName && (r.employeeName || "") !== employeeName) return false;
      if (!q) return true;
      if (salaryMatchesQuery(r.employeeName || "", q)) return true;
      if (salaryMatchesQuery(r.department || "", q)) return true;
      const id = String(r.employeeId ?? "").toLowerCase();
      return id.includes(q.toLowerCase());
    });

    const num = (v: number | undefined | null) => Number(v ?? 0);
    // Single status model — legacy "Submitted" ranks as Paid (isSalaryPaid).
    const statusRank = (r: Pick<SalaryRecord, "status">) => (isSalaryPaid(r) ? 2 : 0);
    const sorted = [...filtered].sort((a, b) => {
      switch (sortKey) {
        case "name-desc":
          return (b.employeeName || "").localeCompare(a.employeeName || "");
        case "status-pending-first":
          return statusRank(a) - statusRank(b) || (a.employeeName || "").localeCompare(b.employeeName || "");
        case "status-paid-first":
          return statusRank(b) - statusRank(a) || (a.employeeName || "").localeCompare(b.employeeName || "");
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
  }, [records, searchQuery, employeeName, department, sortKey, language]);

  const handleRefresh = useCallback(() => {
    void refresh();
  }, [refresh]);

  // ---- Actions -----------------------------------------------------------
  const [viewTarget, setViewTarget] = useState<SalaryRecord | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // Unified Send Payslips popup — submit-first: it only ever receives
  // submitted (Paid/Submitted) records, from Review & Submit or one table row.
  const [sendOpen, setSendOpen] = useState(false);
  const [sendTarget, setSendTarget] = useState<SalaryRecord[]>([]);
  const [sendChannel, setSendChannel] = useState<"email" | "whatsapp">("email");

  const openSendFor = useCallback((targets: SalaryRecord[], channel: "email" | "whatsapp" = "email") => {
    setSendTarget(targets);
    setSendChannel(channel);
    setSendOpen(true);
  }, []);

  // Reset every active filter back to its default: the current month (i.e.
  // the current/Sep register), all departments & employees, no text search,
  // default sort, and the "All" status view.
  const handleClearFilters = useCallback(() => {
    setMonth(getCurrentYearMonth());
    setPickerYear(Number(getCurrentYearMonth().split("-")[0]));
    setDepartment("");
    setEmployeeName("");
    setSearchQuery("");
    setSortKey("name-asc");
    setFilter("All");
    setCurrentPage(1);
    setIsMonthPickerOpen(false);
  }, [setFilter]);

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
      t("staff.register.generate_confirm_title"),
      t("staff.register.generate_confirm_msg", { month: formatMonthName(month, language) }),
      () => {
        setConfirmConfig(null);
        void runConfirm(generate());
      }
    );
  }, [confirm, generate, month, runConfirm, t, language]);

  const handleSubmitSelected = useCallback(
    async (ids: string[]) => {
      // ONE-TIME SUBMIT: only PENDING rows of the selection move to Paid.
      // Already Submitted/Paid rows are skipped — selecting "All" can never
      // submit (or pay) anyone twice.
      const byId = new Map(allRecords.map((r) => [r.id, r]));
      const pendingIds = ids.filter((id) => byId.get(id)?.status === "Pending");
      if (pendingIds.length === 0) {
        setSubmitMonthOpen(false);
        showNotification(t("staff.register.submit_none_pending"), "info");
        return;
      }
      try {
        const result = await bulkUpdateSalaryStatus(pendingIds, {
          status: "Paid",
          paymentDate: todayBusinessDate(),
          paymentMode: "Bank Transfer",
        });
        await refresh();
        // Payslip emails go out automatically — and ONLY for the rows that
        // were submitted now (never for the rest of the register).
        const submittedIds = result.updated.map((r) => r.id);
        let queued = 0;
        try {
          const sent = await emailSalaryPayslips(submittedIds, {
            language,
            subject: EMAIL_TEMPLATES[language].subject.replace("{month}", formatMonthName(month, language)),
            body: EMAIL_TEMPLATES[language].body("{name}", formatMonthName(month, language)),
          });
          queued = sent.sent;
        } catch {
          /* payslip service unreachable — the submit itself still stands */
        }
        await refresh();
        setSubmitMonthOpen(false);
        showNotification(
          queued > 0
            ? `${t("staff.register.submitted_ok", { count: result.updated.length })} ${t("staff.register.payslips_queued", { count: queued })}`
            : t("staff.register.submitted_ok", { count: result.updated.length }),
          "success"
        );
      } catch (error) {
        showNotification(
          (error as Error)?.message || t("staff.register.submit_failed"),
          "error"
        );
      }
    },
    [allRecords, refresh, showNotification, t, language, month]
  );

  const handleDownload = useCallback(
    async (record: SalaryRecord) => {
      setDownloadingId(record.id);
      try {
        await downloadPayslipPdf(record);
      } catch {
        showNotification(t("staff.register.download_failed"), "error");
      } finally {
        setDownloadingId(null);
      }
    },
    [showNotification, t]
  );

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback((ids: string[]) => {
    setSelectedIds((prev) => {
      const allSelected =
        ids.length > 0 && ids.every((id) => prev.has(id));
      return allSelected ? new Set<string>() : new Set(ids);
    });
  }, []);

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
      showNotification(t("staff.register.downloaded_ok", { count: downloaded }), "success");
    } else {
      showNotification(t("staff.register.download_failed"), "error");
    }
  }, [allRecords, showNotification, t]);

  /** Download payslips as ONE combined PDF — every employee on their own page. */
  const handleDownloadCombined = useCallback(async (list: SalaryRecord[]) => {
    if (list.length === 0) return;
    try {
      await generateCombinedPayslipPdf(list, "download");
      showNotification(t("staff.register.download_single_ok", { count: list.length }), "success");
    } catch {
      showNotification(t("staff.register.download_failed"), "error");
    }
  }, [showNotification, t]);

  /** Combined PDF for an id selection (Review & Submit popup). */
  const handleDownloadSelectedCombined = useCallback(
    async (ids: string[]) => {
      const byId = new Map(allRecords.map((r) => [r.id, r]));
      const list = ids
        .map((id) => byId.get(id))
        .filter((r): r is SalaryRecord => Boolean(r));
      await handleDownloadCombined(list);
    },
    [allRecords, handleDownloadCombined]
  );

  const handleSaveRecord = useCallback(
    async (record: SalaryRecord) => {
      // Optimistically update the register table so the change is visible
      // immediately (and works even when the backend is offline).
      updateRecord(record);
      try {
        await updateSalary(record);
        showNotification(t("staff.register.save_ok"), "success");
      } catch {
        // Backend unavailable — the edit is still applied locally to the table.
        showNotification(t("staff.register.save_offline"), "info");
      }
    },
    [updateRecord, showNotification, t]
  );

  // The payment date for the register heading. Shown only when the ENTIRE
  // month's register is Paid AND every paid record shares one payment date.
  // Individual payment dates still appear in each employee's payslip view.
  const monthPaidOnDate = useMemo(() => {
    if (allRecords.length === 0) return null;
    const paid = allRecords.filter((r) => isSalaryPaid(r));
    if (paid.length !== allRecords.length) return null;
    const dates = paid
      .map((r) => r.paymentDate ?? null)
      .filter((d): d is string => Boolean(d));
    if (dates.length === 0) return null;
    const distinct = new Set(dates);
    return distinct.size === 1 ? dates[0] : null;
  }, [allRecords]);

  // Send-once: submitted (Paid/Submitted) employees whose payslip has NOT
  // been sent yet on either channel. One successful mail OR WhatsApp send
  // drops them from this list, so the button count only ever goes down and
  // the per-row Sent column stays the source of truth for history.
  const submittedRecords = useMemo(
    () =>
      allRecords.filter(
        (r) =>
          isSalaryPaid(r) &&
          (r.emailsSent ?? 0) === 0 &&
          (r.whatsappsSent ?? 0) === 0
      ),
    [allRecords]
  );

  // Status segmented control — same treatment as the Leave page's status tabs
  // (active = white chip + brand text, inactive = quiet slate).
  const statusTab = (key: 'All' | 'Pending' | 'Paid', label: string, icon: React.ReactNode) => (
    <button
      type="button"
      onClick={() => handleFilterChange(key)}
      aria-pressed={filter === key}
      className={`flex flex-1 items-center justify-center gap-1 px-2.5 py-1 h-full rounded-md text-xs font-semibold transition whitespace-nowrap ${
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
      {/* Filter bar — the Trip List filter treatment: `opsFilterCardClass`
          surface, icon-led `opsFilterLabelClass` labels, shared dropdowns,
          then a Sort / Search / actions row with the animated Reset and the
          DMR hen refresh — a 1:1 match with Operations → Trip List. */}
      <div className={`${opsFilterCardClass} overflow-visible relative z-10`}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div className="relative" ref={monthPickerRef}>
            <label className={opsFilterLabelClass}>
              <Calendar size={17} className="text-emerald-500 flex-shrink-0" />
              <span>{t("staff.register.month")}</span>
            </label>
            <button
              type="button"
              onClick={() => {
                const [y] = month.split("-");
                if (y) setPickerYear(Number(y));
                setIsMonthPickerOpen((o) => !o);
              }}
              aria-haspopup="dialog"
              aria-expanded={isMonthPickerOpen}
              aria-label={t("staff.register.select_month", { month: formatMonthName(month, language) })}
              className={`${opsInputClass} flex items-center justify-between gap-2 text-left`}
            >
              <span>{formatMonthName(month, language)}</span>
              <Calendar size={15} className="text-emerald-500 flex-shrink-0" />
            </button>

            {isMonthPickerOpen && (
              <div
                role="dialog"
                aria-label={t("staff.register.choose_month")}
                className="absolute top-full left-0 mt-2 w-72 bg-white rounded-2xl shadow-lg border border-slate-200 p-4 z-50 space-y-4"
              >
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
                  {MONTHS.map((m, mi) => {
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
                            ? "bg-emerald-600 text-white shadow-sm"
                            : "bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-100"
                        }`}
                      >
                        {language === "te" ? MONTHS_TE[mi] : m.name}
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
                    className="text-emerald-600 font-semibold hover:underline"
                  >
                    {t("staff.register.this_month")}
                  </button>
                  <button type="button" onClick={() => setIsMonthPickerOpen(false)} className="text-slate-400 hover:text-slate-600 font-medium">
                    {t("common.close")}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className={opsFilterLabelClass}>
              <Building2 size={17} className="text-emerald-500 flex-shrink-0" />
              <span>{t("staff.register.department")}</span>
            </label>
            <MasterDropdown
              hideLabel
              label={t("staff.register.department")}
              value={department}
              placeholder={t("staff.register.all_departments")}
              options={departments.map((d) => ({ value: d, label: salaryDisplayText(d, language) }))}
              onChange={handleDepartmentChange}
              allowClear
              disabled={loading}
              className="w-full"
            />
          </div>

          <div>
            <label className={opsFilterLabelClass}>
              <UserRound size={17} className="text-emerald-500 flex-shrink-0" />
              <span>{t("staff.register.employee")}</span>
            </label>
            <MasterDropdown
              hideLabel
              label={t("staff.register.employee")}
              value={employeeName}
              placeholder={t("staff.register.all_employees")}
              options={employeeNames.map((n) => ({ value: n, label: salaryDisplayText(n, language) }))}
              onChange={handleEmployeeNameChange}
              searchable
              allowClear
              disabled={loading}
              className="w-full"
            />
          </div>

          <div>
            <label className={opsFilterLabelClass}>
              <ListFilter size={17} className="text-amber-500 flex-shrink-0" />
              <span>{t("staff.register.status")}</span>
            </label>
            <div
              role="group"
              aria-label={t("staff.register.filter_by_status")}
              className="inline-flex h-10 w-full items-center bg-slate-100/80 p-1 rounded-lg border border-slate-200/60"
            >
              {statusTab("All", t("common.all"), <LayoutGrid size={12} className="text-slate-400" />)}
              {statusTab("Pending", t("common.pending"), <Clock size={12} className="text-slate-400" />)}
              {statusTab("Paid", t("common.paid"), <CheckCircle size={12} className="text-slate-400" />)}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-12 gap-3.5 items-end pt-1">
          <div className="xl:col-span-2">
            <label className={opsFilterLabelClass}>
              <ArrowUpDown size={17} className="text-violet-500 flex-shrink-0" />
              <span>{t("staff.register.sort_by")}</span>
            </label>
            <MasterDropdown
              hideLabel
              label={t("staff.register.sort_by")}
              value={sortKey}
              placeholder={t("staff.register.sort_name_az")}
              searchable
              allowClear={false}
              options={[
                { value: "name-asc", label: t("staff.register.sort_name_az") },
                { value: "name-desc", label: t("staff.register.sort_name_za") },
                { value: "status-pending-first", label: t("staff.register.sort_status_pending") },
                { value: "status-paid-first", label: t("staff.register.sort_status_paid") },
                { value: "salary-desc", label: t("staff.register.sort_salary_high") },
                { value: "salary-asc", label: t("staff.register.sort_salary_low") },
              ]}
              onChange={(value) => {
                setSortKey(value as typeof sortKey);
                setCurrentPage(1);
              }}
              className="w-full"
            />
          </div>

          <div className="min-w-0 xl:col-span-3">
            <label htmlFor="salary-register-search" className={opsFilterLabelClass}>
              <Search size={17} className="text-slate-400 flex-shrink-0" />
              <span>{t("common.search")}</span>
            </label>
            <div className="relative">
              <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                id="salary-register-search"
                value={searchQuery}
                onChange={(event) => handleSearchChange(event.target.value)}
                placeholder={t("staff.register.search_placeholder")}
                disabled={loading}
                className={`${opsInputClass} pl-10`}
              />
            </div>
          </div>

          <div className="md:col-span-2 xl:col-span-7 flex items-center gap-1.5 justify-end flex-nowrap">
            <button
              type="button"
              onClick={handleClearFilters}
              disabled={loading}
              className={`group relative shrink-0 ${opsSecondaryButtonClass}`}
              aria-label={t("common.reset")}
            >
              <span className="inline-flex motion-safe:group-hover:animate-[var(--animate-action-reset)]"><RotateCcw size={14} /></span>
              {t("common.reset")}
            </button>
            <BrandRefreshButton onClick={handleRefresh} loading={refreshing} disabled={saving} className="shrink-0" />
            <button
              type="button"
              onClick={() => setSubmitMonthOpen(true)}
              disabled={saving || refreshing || allRecords.length === 0}
              className={`group relative shrink-0 whitespace-nowrap ${uiButton("success", "md")}`}
            >
              <span className="inline-flex motion-safe:group-hover:animate-[var(--animate-action-approve)]"><ClipboardCheck size={15} /></span>
              {t("staff.register.review_submit")}
            </button>
            {/* Send Payslips — the bulk-send entry point. Opens the Send
                Payslips popup (Mail / WhatsApp) for the submitted employees
                whose payslip has not gone out yet. Downloads live inside
                Review & Submit, not on the filter bar. */}
            <button
              type="button"
              onClick={() => openSendFor(submittedRecords, "email")}
              disabled={saving || refreshing || submittedRecords.length === 0}
              aria-label={t("staff.register.send_payslips")}
              className={`group relative shrink-0 whitespace-nowrap ${uiButton("primary", "md")}`}
            >
              <span className="inline-flex motion-safe:group-hover:animate-[var(--animate-action-mail)]"><Send size={15} /></span>
              {t("staff.register.send_payslips")} ({submittedRecords.length})
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
        /* In-table loading, the same treatment as Shop Sales. */
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <TableLoading label={t('staff.table.loading.salary')} />
        </div>
      ) : !hasRecords ? (
        <div className="bg-white rounded-xl border border-slate-200">
          <EmptyState
            variant="no-data"
            icon={<FileText />}
            title={t("staff.register.no_records_title", { month: formatMonthName(month, language) })}
            description={t("staff.register.no_records_desc")}
            action={
              <Button
                variant="primary"
                size="md"
                onClick={handleGenerate}
                loading={saving}
                icon={<Plus size={14} />}
              >
                {t("staff.register.generate_action")}
              </Button>
            }
          />
        </div>
      ) : visibleRecords.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200">
          <EmptyState
            variant="no-filters"
            title={t("staff.register.no_match_title")}
            description={t("staff.register.no_match_desc")}
          />
        </div>
      ) : (
        <SalaryTable
          records={visibleRecords}
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
          itemsPerPage={pageSize}
          onPageSizeChange={handlePageSizeChange}
          formatCurrency={formatCurrency}
          saving={saving}
          onView={setViewTarget}
          onEmail={(record) => openSendFor([record], "email")}
          onWhatsApp={(record) => openSendFor([record], "whatsapp")}
          monthLabel={formatMonthName(month, language)}
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
          monthLabel={formatMonthName(month, language)}
          records={allRecords}
          onClose={() => setSubmitMonthOpen(false)}
          onSubmitSelected={(ids) => void handleSubmitSelected(ids)}
          onSaveRecord={(record) => handleSaveRecord(record)}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onToggleSelectAll={toggleSelectAll}
          onDownloadSelected={(ids) => void handleDownloadSelected(ids)}
          onDownloadSelectedCombined={(ids) => void handleDownloadSelectedCombined(ids)}
        />
      )}

      {sendOpen && (
        <SendPayslipsModal
          monthLabel={formatMonthName(month, language)}
          records={sendTarget}
          initialChannel={sendChannel}
          saving={saving}
          onClose={() => {
            setSendOpen(false);
            setSendTarget([]);
          }}
          onSent={(sentChannel, sent, failed) => {
            // Submit-first: counts refresh so the Sent column stays truthful.
            // Failures keep the popup open for retry.
            void refresh();
            if (failed === 0 && sent > 0) {
              setSendOpen(false);
              setSendTarget([]);
              showNotification(
                t("staff.register.send_ok", {
                  sent,
                  channel: t(
                    sentChannel === "email"
                      ? "staff.register.channel_email"
                      : "staff.register.channel_whatsapp"
                  ),
                }),
                "success"
              );
            } else {
              showNotification(
                t("staff.register.send_partial", { sent, failed }),
                "warning"
              );
            }
          }}
          onSendEmail={async (ids, payload) => emailSalaryPayslips(ids, payload)}
          onSendWhatsApp={async (ids, payload) => whatsappSalaryPayslips(ids, payload)}
        />
      )}

      <ConfirmDialog
        isOpen={Boolean(confirmConfig)}
        title={confirmConfig?.title ?? ""}
        message={confirmConfig?.message}
        tone="primary"
        confirmLabel={t("common.confirm")}
        cancelLabel={t("common.cancel")}
        loading={saving}
        onConfirm={confirmConfig ? confirmConfig.onConfirm : () => setConfirmConfig(null)}
        onCancel={() => setConfirmConfig(null)}
      />
    </div>
  );
}

export default SalaryRegisterPage;
