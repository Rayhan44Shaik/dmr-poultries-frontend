// src/modules/staff/components/salary/salaryTable.tsx
//
// The Salary Register master table, laid out in the SAME visual language as
// the Trip List (`TripMasterTable`) and the Rate Entry masters:
//   - one rounded-2xl card with a gradient header band and a 2D icon tile,
//   - icon-led, colour-coded uppercase column headers,
//   - 13px zebra rows with colour-coded money columns,
//   - hover-animated row-action logos (view / email / WhatsApp).
// Behaviour (row click → payslip view, selection, totals footer, pagination)
// is unchanged.

import type { ReactNode } from "react";
import {
  Calendar,
  CheckCircle2,
  CircleMinus,
  Clock,
  IndianRupee,
  Lock,
  Mail,
  ShieldCheck,
  User,
  UserCheck,
  Wallet,
} from "lucide-react";
import { Pagination } from "../../../../ui";
import { WhatsAppBrandIcon } from "../../../../ui/WhatsAppBrandIcon";
import { useI18n, type Language } from "../../../../i18n";
import { salaryDisplayText, salaryLocale } from "../../utils/salaryDisplay";
import type { SalaryRecord } from "../../types/staffDashboard";
import { uiBadgeClass, uiCheckClass } from "../../../../shared/ui/uiTokens";
import { isSalaryPaid } from "./payslipModel";

/** Render "YYYY-MM-DD" (or ISO) as a readable "28 Sep 2026" string — Telugu
 *  month words when asked, but always Latin digits. */
function formatDisplayDate(raw: string, language: Language): string {
  if (!raw) return raw;
  const opts = { day: "2-digit", month: "short", year: "numeric" } as const;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw.trim());
  if (iso) {
    const d = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    return d.toLocaleDateString(salaryLocale(language), opts);
  }
  const d = new Date(raw);
  if (!Number.isNaN(d.getTime())) {
    return d.toLocaleDateString(salaryLocale(language), opts);
  }
  return raw;
}

type SalaryTableProps = {
  records: SalaryRecord[];
  currentPage: number;
  setCurrentPage?: (page: number) => void;
  itemsPerPage: number;
  /** Rows-per-page change — renders the global Rows-per-page select (Trip List style). */
  onPageSizeChange?: (pageSize: number) => void;
  formatCurrency?: (amount: number) => string;
  saving?: boolean;
  selectedIds?: ReadonlySet<string>;
  onToggleSelect?: (id: string) => void;
  onToggleSelectAll?: (ids: string[]) => void;
  onView: (record: SalaryRecord) => void;
  /** Optional per-row quick actions to email / WhatsApp an employee's payslip. */
  onEmail?: (record: SalaryRecord) => void;
  onWhatsApp?: (record: SalaryRecord) => void;
  /** Month label shown beside the title, e.g. "September 2026". */
  monthLabel?: string;
  /** When set, the whole month is paid — the title shows "Paid on {date}". */
  paidOnDate?: string | null;
};

function StatusBadge({ record }: { record: SalaryRecord }) {
  const { t } = useI18n();
  const windowOpen =
    isSalaryPaid(record) &&
    record.correctionWindowDaysRemaining != null &&
    record.correctionWindowDaysRemaining > 0;

  if (!isSalaryPaid(record)) {
    return (
      <span className={uiBadgeClass("warning")}>
        {t("common.pending")}
      </span>
    );
  }
  // Paid
  return (
    <span className={uiBadgeClass(record.monthClosed || !windowOpen ? "neutral" : "success")}>
      <CheckCircle2 size={11} />
      {t("common.paid")}
      {(record.monthClosed || !windowOpen) && <Lock size={10} />}
    </span>
  );
}

/** Icon-led column header content — the Trip List column-header format. */
function ColHead({
  icon,
  label,
  center = false,
  right = false,
}: {
  icon?: ReactNode;
  label: string;
  center?: boolean;
  right?: boolean;
}) {
  return (
    <div className={`flex items-center gap-1.5 ${center ? "justify-center" : right ? "justify-end" : ""}`}>
      {icon}
      <span>{label}</span>
    </div>
  );
}

const TH_CLASS = "px-3 py-4 text-[12px] font-bold uppercase tracking-wider whitespace-nowrap";

export function SalaryTable({
  records,
  currentPage,
  setCurrentPage = () => {},
  itemsPerPage,
  onPageSizeChange,
  formatCurrency,
  saving = false,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onView,
  onEmail,
  onWhatsApp,
  monthLabel = "",
  paidOnDate,
}: SalaryTableProps) {
  const { t, language } = useI18n();
  const selectable = Boolean(selectedIds && onToggleSelect && onToggleSelectAll);
  const formatVal = formatCurrency || ((amount: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount || 0));

  const totalPages = Math.ceil(records.length / itemsPerPage) || 1;
  // Clamp the active page so a refresh or filter that shrinks the result set
  // can never strand the user on an empty page.
  const safePage = Math.max(1, Math.min(currentPage, totalPages));
  const startIndex = (safePage - 1) * itemsPerPage;
  const currentRecords = records.slice(startIndex, startIndex + itemsPerPage);

  const pageIds = currentRecords.map((r) => r.id);
  const allPageSelected = selectable && pageIds.length > 0 && pageIds.every((id) => selectedIds!.has(id));
  const somePageSelected = selectable && pageIds.some((id) => selectedIds!.has(id));

  const footer = {
    count: records.length,
    workingDays: records.reduce((s, r) => s + (r.workingDays ?? 0), 0),
    presentDays: records.reduce((s, r) => s + (r.presentDays ?? 0), 0),
    leaveDays: records.reduce((s, r) => s + (r.leaveDays ?? 0), 0),
    basicSalary: records.reduce((s, r) => s + (r.basicSalary || 0), 0),
    totalGross: records.reduce((s, r) => s + (r.totalGross || 0), 0),
    totalDeductions: records.reduce((s, r) => s + (r.totalDeductions || 0), 0),
    netSalary: records.reduce((s, r) => s + (r.netSalary || 0), 0),
    pending: records.filter((r) => !isSalaryPaid(r)).length,
    paid: records.filter((r) => isSalaryPaid(r)).length,
    emailsSent: records.reduce((s, r) => s + (r.emailsSent ?? 0), 0),
    whatsappsSent: records.reduce((s, r) => s + (r.whatsappsSent ?? 0), 0),
  };

  if (records.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500 text-sm">
        {t("staff.table.no_records")}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden text-xs md:text-sm">
      {/* Header band — icon tile + title, the Trip List card-header treatment */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-6 py-3 border-b border-slate-100 bg-gradient-to-r from-emerald-50/60 via-white to-emerald-50/40">
        <div className="flex min-w-0 items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-emerald-50/70 border border-emerald-100 flex items-center justify-center text-emerald-500 shadow-inner">
            <Wallet className="w-5 h-5" />
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
            <h3 className="text-base font-bold text-slate-800 tracking-tight whitespace-nowrap">
              {t("staff.table.title")}
              {monthLabel ? <span className="font-semibold text-slate-600"> — {monthLabel}</span> : null}
            </h3>
            {paidOnDate && (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 tabular-nums">
                <CheckCircle2 size={12} />
                {t("staff.table.paid_on", { date: formatDisplayDate(paidOnDate, language) })}
              </span>
            )}
          </div>
        </div>
        <span className="shrink-0 text-[11px] font-semibold text-slate-500 tabular-nums">
          {records.length} {records.length === 1 ? t("staff.review.employee_one") : t("staff.review.employee_other")}
        </span>
      </div>

      <div className="w-full overflow-x-auto">
        {/* table-fixed + colgroup keeps every column on an exact width so the
            header, body and totals rows all sync on the same grid lines: the
            three day-count columns share one width (data centred under the
            header), the three money columns share one width (amounts start at
            the left of the column, leaving a clean gap before Status), and
            the Mail + WhatsApp payslip counts share ONE small column AFTER
            Status — two neat mini pills side by side, each clickable to send. */}
        <table className="w-full min-w-[1060px] table-fixed text-[13px] text-left border-collapse">
          <colgroup>
            {selectable && <col className="w-10" />}
            <col className="w-11" />
            {/* Employee slims down (names are short); the freed space is
                divided EQUALLY among the three money columns so amounts get
                the room the old layout wasted. */}
            <col className="w-[15%]" />
            <col className="w-[8%]" />
            <col className="w-[8%]" />
            <col className="w-[8%]" />
            <col className="w-[13%]" />
            <col className="w-[13%]" />
            <col className="w-[13%]" />
            <col className="w-[11%]" />
            <col className="w-[11%]" />
          </colgroup>
          <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600">
            <tr className="whitespace-nowrap">
              {selectable && (
                <th className="px-3 py-4 text-left">
                  <input
                    type="checkbox"
                    aria-label={t("staff.table.select_all")}
                    checked={allPageSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = somePageSelected && !allPageSelected;
                    }}
                    disabled={saving}
                    onChange={() => onToggleSelectAll?.(pageIds)}
                    className={uiCheckClass + " disabled:opacity-50"}
                  />
                </th>
              )}
              <th className={`${TH_CLASS} text-center`}>#</th>
              <th className={`${TH_CLASS} text-left`}>
                <ColHead icon={<User size={14} className="text-emerald-500 flex-shrink-0" />} label={t("staff.table.employee")} />
              </th>
              <th className={`${TH_CLASS} text-center`}>
                <ColHead center icon={<Calendar size={14} className="text-blue-500 flex-shrink-0" />} label={t("staff.table.working")} />
              </th>
              <th className={`${TH_CLASS} text-center`}>
                <ColHead center icon={<UserCheck size={14} className="text-cyan-500 flex-shrink-0" />} label={t("staff.table.present")} />
              </th>
              <th className={`${TH_CLASS} text-center`}>
                <ColHead center icon={<Clock size={14} className="text-amber-500 flex-shrink-0" />} label={t("staff.table.leave")} />
              </th>
              <th className={`${TH_CLASS} text-left`}>
                <ColHead icon={<Wallet size={14} className="text-indigo-500 flex-shrink-0" />} label={t("staff.table.basic")} />
              </th>
              <th className={`${TH_CLASS} text-left`}>
                <ColHead icon={<CircleMinus size={14} className="text-rose-500 flex-shrink-0" />} label={t("staff.table.deductions")} />
              </th>
              <th className={`${TH_CLASS} text-left`}>
                <ColHead icon={<IndianRupee size={14} className="text-emerald-600 flex-shrink-0" />} label={t("staff.table.net")} />
              </th>
              <th className={`${TH_CLASS} text-left`}>
                <ColHead icon={<ShieldCheck size={14} className="text-purple-500 flex-shrink-0" />} label={t("staff.table.status")} />
              </th>
              <th className={`${TH_CLASS} text-center`}>
                <div className="flex items-center justify-center gap-1.5">
                  <span className="inline-flex items-center gap-1">
                    <Mail size={14} className="text-blue-500 flex-shrink-0" />
                    <WhatsAppBrandIcon size={14} className="text-[#1DA851] flex-shrink-0" />
                  </span>
                  <span>{t("staff.table.sent")}</span>
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {currentRecords.map((record, index) => {
              const windowOpen =
                isSalaryPaid(record) &&
                record.correctionWindowDaysRemaining != null &&
                record.correctionWindowDaysRemaining > 0;
              const serialNo = startIndex + index + 1;

              return (
                <tr
                  key={record.id}
                  onClick={() => onView(record)}
                  className={`cursor-pointer transition-colors duration-150 hover:bg-slate-50/60 ${
                    index % 2 === 0 ? "bg-white" : "bg-slate-50/20"
                  }`}
                >
                  {selectable && (
                    <td className="px-3 py-4" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        aria-label={t("staff.table.select_one", { name: salaryDisplayText(record.employeeName, language) })}
                        checked={selectedIds!.has(record.id)}
                        disabled={saving}
                        onChange={() => onToggleSelect?.(record.id)}
                        className={uiCheckClass + " disabled:opacity-50"}
                      />
                    </td>
                  )}
                  <td className="px-3 py-4 text-center text-[13px] text-slate-500 font-medium">{serialNo}</td>
                  <td className="px-3 py-4 min-w-0">
                    <div className="truncate text-[13px] font-bold text-slate-800">{salaryDisplayText(record.employeeName, language)}</div>
                    {record.department ? (
                      <div className="mt-0.5 truncate text-[11px] font-medium text-slate-500">{salaryDisplayText(record.department, language)}</div>
                    ) : null}
                  </td>
                  <td className="px-3 py-4 text-center text-[13px] font-medium tabular-nums text-slate-600 whitespace-nowrap">{record.workingDays ?? "—"}</td>
                  <td className="px-3 py-4 text-center text-[13px] font-medium tabular-nums text-slate-600 whitespace-nowrap">{record.presentDays ?? "—"}</td>
                  <td className="px-3 py-4 text-center text-[13px] font-medium tabular-nums text-amber-600 whitespace-nowrap">{record.leaveDays ?? "—"}</td>
                  <td className="px-3 py-4 text-left text-[13px] font-medium tabular-nums text-slate-700 whitespace-nowrap">{formatVal(record.basicSalary)}</td>
                  <td className="px-3 py-4 text-left text-[13px] font-bold tabular-nums text-rose-600 whitespace-nowrap">{formatVal(record.totalDeductions)}</td>
                  <td className="px-3 py-4 text-left text-[13px] font-bold tabular-nums text-emerald-700 whitespace-nowrap">{formatVal(record.netSalary)}</td>
                  <td className="px-3 py-4 whitespace-nowrap">
                    <StatusBadge record={record} />
                    {windowOpen && (
                      <span className="ml-1 text-[10px] text-amber-600">
                        {record.correctionWindowDaysRemaining}d
                      </span>
                    )}
                  </td>
                  {/* Payslip sent-counts — ONE small column AFTER Status holding
                      both the Mail and WhatsApp mini pills side by side. Each
                      pill is clickable (sends the payslip) when its handler is
                      wired, otherwise a plain count pill. */}
                  <td className="px-3 py-4 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    <span className="inline-flex items-center justify-center gap-1.5">
                      {onEmail ? (
                        <button
                          type="button"
                          aria-label={t("staff.table.email_to", { name: salaryDisplayText(record.employeeName, language) })}
                          onClick={() => onEmail(record)}
                          disabled={saving || !isSalaryPaid(record)}
                          className="group inline-flex items-center gap-1 rounded-full border border-blue-200/80 bg-blue-50/70 px-2 py-0.5 text-blue-700 transition hover:border-blue-300 hover:bg-blue-100/70 disabled:opacity-40"
                        >
                          <span className="inline-flex motion-safe:group-hover:animate-[var(--animate-action-mail)]"><Mail size={12} /></span>
                          <span className="text-[11px] font-bold tabular-nums">{record.emailsSent ?? 0}</span>
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full border border-blue-200/80 bg-blue-50/70 px-2 py-0.5 text-blue-700">
                          <Mail size={12} />
                          <span className="text-[11px] font-bold tabular-nums">{record.emailsSent ?? 0}</span>
                        </span>
                      )}
                      {onWhatsApp ? (
                        <button
                          type="button"
                          aria-label={t("staff.table.whatsapp_to", { name: salaryDisplayText(record.employeeName, language) })}
                          onClick={() => onWhatsApp(record)}
                          disabled={saving || !isSalaryPaid(record)}
                          className="group inline-flex items-center gap-1 rounded-full border border-emerald-200/80 bg-emerald-50/70 px-2 py-0.5 text-[#128C3E] transition hover:border-emerald-300 hover:bg-emerald-100/70 disabled:opacity-40"
                        >
                          <span className="inline-flex text-[#1DA851] motion-safe:group-hover:animate-[var(--animate-action-whatsapp)]"><WhatsAppBrandIcon size={12} /></span>
                          <span className="text-[11px] font-bold tabular-nums">{record.whatsappsSent ?? 0}</span>
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200/80 bg-emerald-50/70 px-2 py-0.5 text-[#128C3E]">
                          <WhatsAppBrandIcon size={12} className="text-[#1DA851]" />
                          <span className="text-[11px] font-bold tabular-nums">{record.whatsappsSent ?? 0}</span>
                        </span>
                      )}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-200 bg-slate-50">
              {selectable && <td className="px-3 py-4" />}
              <td className="px-3 py-4" />
              <td className="px-3 py-4 text-[13px] font-bold text-slate-800 whitespace-nowrap">{t("staff.table.total", { count: footer.count })}</td>
              <td className="px-3 py-4 text-center text-[13px] tabular-nums font-bold text-slate-700 whitespace-nowrap">{footer.workingDays}</td>
              <td className="px-3 py-4 text-center text-[13px] tabular-nums font-bold text-slate-700 whitespace-nowrap">{footer.presentDays}</td>
              <td className="px-3 py-4 text-center text-[13px] tabular-nums font-bold text-amber-700 whitespace-nowrap">{footer.leaveDays}</td>
              <td className="px-3 py-4 text-left text-[13px] tabular-nums font-bold text-slate-700 whitespace-nowrap">{formatVal(footer.basicSalary)}</td>
              <td className="px-3 py-4 text-left text-[13px] tabular-nums font-bold text-rose-700 whitespace-nowrap">{formatVal(footer.totalDeductions)}</td>
              <td className="px-3 py-4 text-left text-[13px] tabular-nums font-bold text-emerald-700 whitespace-nowrap">{formatVal(footer.netSalary)}</td>
              <td className="px-3 py-4 text-[11px] tabular-nums font-semibold text-slate-600">
                <span className="inline-flex flex-wrap items-center gap-x-1 gap-y-0.5 leading-snug">
                  <span className="whitespace-nowrap">{footer.pending} {t("common.pending")}</span>
                  <span className="text-slate-300" aria-hidden="true">·</span>
                  <span className="whitespace-nowrap">{footer.paid} {t("common.paid")}</span>
                </span>
              </td>
              <td className="px-3 py-4 text-center whitespace-nowrap">
                <span className="inline-flex items-center justify-center gap-2.5">
                  <span className="inline-flex items-center gap-1 text-[12px] tabular-nums font-bold text-blue-700">
                    <Mail size={12} className="text-blue-500" />{footer.emailsSent}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[12px] tabular-nums font-bold text-[#128C3E]">
                    <WhatsAppBrandIcon size={12} className="text-[#1DA851]" />{footer.whatsappsSent}
                  </span>
                </span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Global pagination — the Trip List bar: "Showing 1–10 of 150",
          Rows per page select, and the numbered page window. Always rendered
          while the register has rows, exactly like the Trip List. */}
      {records.length > 0 && (
        <Pagination
          page={safePage}
          pageSize={itemsPerPage}
          totalItems={records.length}
          onPageChange={setCurrentPage}
          onPageSizeChange={onPageSizeChange}
          disabled={saving}
          ariaLabel={t("staff.table.title")}
        />
      )}
    </div>
  );
}
