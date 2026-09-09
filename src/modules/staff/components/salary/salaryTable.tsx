// src/modules/staff/components/salary/salaryTable.tsx

import { CheckCircle2, Lock, Mail } from "lucide-react";
import { WhatsAppBrandIcon } from "../../../../ui/WhatsAppBrandIcon";
import type { SalaryRecord } from "../../types/staffDashboard";
import {
  uiBadgeClass,
  uiCheckClass,
  uiTableWrapClass,
} from "../../../../shared/ui/uiTokens";
import {
  paginationBarClass,
  paginationNavBtnClass,
  paginationPageBtnClass,
  shouldShowPagination,
} from "../../../../shared/ui/paginationStyles";

type SalaryTableProps = {
  records: SalaryRecord[];
  currentPage: number;
  setCurrentPage?: (page: number) => void;
  itemsPerPage: number;
  formatCurrency?: (amount: number) => string;
  saving?: boolean;
  selectedIds?: ReadonlySet<string>;
  onToggleSelect?: (id: string) => void;
  onToggleSelectAll?: (ids: string[]) => void;
  onView: (record: SalaryRecord) => void;
  /** Optional per-row quick actions to email / WhatsApp an employee's payslip. */
  onEmail?: (record: SalaryRecord) => void;
  onWhatsApp?: (record: SalaryRecord) => void;
};

function StatusBadge({ record }: { record: SalaryRecord }) {
  const windowOpen =
    record.status === "Paid" &&
    record.correctionWindowDaysRemaining != null &&
    record.correctionWindowDaysRemaining > 0;

  if (record.status === "Pending" || record.status === "Submitted") {
    return (
      <span className={uiBadgeClass("warning")}>
        Pending
      </span>
    );
  }
  // Paid
  return (
    <span className={uiBadgeClass(record.monthClosed || !windowOpen ? "neutral" : "success")}>
      <CheckCircle2 size={11} />
      Paid
      {(record.monthClosed || !windowOpen) && <Lock size={10} />}
    </span>
  );
}

export function SalaryTable({
  records,
  currentPage,
  setCurrentPage = () => {},
  itemsPerPage,
  formatCurrency,
  saving = false,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onView,
  onEmail,
  onWhatsApp,
}: SalaryTableProps) {
  const selectable = Boolean(selectedIds && onToggleSelect && onToggleSelectAll);
  const hasRowActions = Boolean(onEmail || onWhatsApp);
  const formatVal = formatCurrency || ((amount: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2 }).format(amount || 0));

  const sortedRecords = records;

  const totalPages = Math.ceil(sortedRecords.length / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentRecords = sortedRecords.slice(startIndex, startIndex + itemsPerPage);

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
    pending: records.filter((r) => r.status === "Pending").length,
    submitted: records.filter((r) => r.status === "Submitted").length,
    paid: records.filter((r) => r.status === "Paid").length,
  };

  if (records.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500 text-sm">
        No salary records for the selected month.
      </div>
    );
  }

  return (
    <div className={uiTableWrapClass}>
      <div className="overflow-x-auto">
        <table className="w-max min-w-full border-separate border-spacing-0">
          <thead className="bg-slate-50">
            <tr>
              {selectable && (
              <th className="sticky top-0 bg-slate-50 px-3 py-2.5 text-left">
                <input
                  type="checkbox"
                  aria-label="Select all visible salaries"
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
              <th className="sticky top-0 bg-slate-50 px-3 py-2.5 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Employee</th>
              <th className="sticky top-0 bg-slate-50 px-3 py-2.5 text-right text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Working</th>
              <th className="sticky top-0 bg-slate-50 px-3 py-2.5 text-right text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Present</th>
              <th className="sticky top-0 bg-slate-50 px-3 py-2.5 text-right text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Leave</th>
              <th className="sticky top-0 bg-slate-50 px-3 py-2.5 text-right text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Basic</th>
              <th className="sticky top-0 bg-slate-50 px-3 py-2.5 text-right text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Deductions</th>
              <th className="sticky top-0 bg-slate-50 px-3 py-2.5 text-right text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Net</th>
              <th className="sticky top-0 bg-slate-50 px-3 py-2.5 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Status</th>
              <th className="sticky top-0 bg-slate-50 px-3 py-2.5 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Payment date</th>
              {hasRowActions && (
                <th className="sticky top-0 bg-slate-50 px-3 py-2.5 text-center text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Send</th>
              )}
            </tr>
          </thead>
          <tbody>
            {currentRecords.map((record) => {
              const windowOpen =
                record.status === "Paid" &&
                record.correctionWindowDaysRemaining != null &&
                record.correctionWindowDaysRemaining > 0;

              return (
                <tr
                  key={record.id}
                  onClick={() => onView(record)}
                  className="border-t border-slate-100 hover:bg-slate-50/80 transition-colors cursor-pointer"
                >
                  {selectable && (
                  <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      aria-label={`Select ${record.employeeName}`}
                      checked={selectedIds!.has(record.id)}
                      disabled={saving}
                      onChange={() => onToggleSelect?.(record.id)}
                      className={uiCheckClass + " disabled:opacity-50"}
                    />
                  </td>
                  )}
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <div className="text-sm font-semibold text-slate-800">{record.employeeName}</div>
                    {record.department ? (
                      <div className="text-[11px] text-slate-500 mt-0.5">{record.department}</div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2.5 text-right text-sm tabular-nums text-slate-700 whitespace-nowrap">{record.workingDays ?? "—"}</td>
                  <td className="px-3 py-2.5 text-right text-sm tabular-nums text-slate-700 whitespace-nowrap">{record.presentDays ?? "—"}</td>
                  <td className="px-3 py-2.5 text-right text-sm tabular-nums text-slate-700 whitespace-nowrap">{record.leaveDays ?? "—"}</td>
                  <td className="px-3 py-2.5 text-right text-sm tabular-nums text-slate-700 whitespace-nowrap">{formatVal(record.basicSalary)}</td>
                  <td className="px-3 py-2.5 text-right text-sm tabular-nums text-rose-600 whitespace-nowrap">{formatVal(record.totalDeductions)}</td>
                  <td className="px-3 py-2.5 text-right text-sm tabular-nums font-semibold text-slate-900 whitespace-nowrap">{formatVal(record.netSalary)}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <StatusBadge record={record} />
                    {record.status === "Paid" && windowOpen && (
                      <span className="ml-1 text-[10px] text-amber-600">
                        {record.correctionWindowDaysRemaining}d
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-sm tabular-nums text-slate-600 whitespace-nowrap">{record.paymentDate ?? "—"}</td>
                  {hasRowActions && (
                    <td
                      className="px-3 py-2.5 whitespace-nowrap text-center"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-center gap-1">
                        {onEmail && (
                          <button
                            type="button"
                            title={`Email payslip to ${record.employeeName}`}
                            aria-label={`Email payslip to ${record.employeeName}`}
                            onClick={() => onEmail(record)}
                            disabled={saving}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600 disabled:opacity-40"
                          >
                            <Mail size={14} />
                          </button>
                        )}
                        {onWhatsApp && (
                          <button
                            type="button"
                            title={`WhatsApp payslip to ${record.employeeName}`}
                            aria-label={`WhatsApp payslip to ${record.employeeName}`}
                            onClick={() => onWhatsApp(record)}
                            disabled={saving}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[#25D366]/15 text-[#1DA851] transition hover:bg-[#25D366] hover:text-white disabled:opacity-40"
                          >
                            <WhatsAppBrandIcon size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-200 bg-slate-50">
              {selectable && <td className="px-3 py-2.5" />}
              <td className="px-3 py-2.5 text-sm font-bold text-slate-800 whitespace-nowrap">Total ({footer.count})</td>
              <td className="px-3 py-2.5 text-right text-sm tabular-nums font-semibold text-slate-800 whitespace-nowrap">{footer.workingDays}</td>
              <td className="px-3 py-2.5 text-right text-sm tabular-nums font-semibold text-slate-800 whitespace-nowrap">{footer.presentDays}</td>
              <td className="px-3 py-2.5 text-right text-sm tabular-nums font-semibold text-slate-800 whitespace-nowrap">{footer.leaveDays}</td>
              <td className="px-3 py-2.5 text-right text-sm tabular-nums font-semibold text-slate-800 whitespace-nowrap">{formatVal(footer.basicSalary)}</td>
              <td className="px-3 py-2.5 text-right text-sm tabular-nums font-semibold text-rose-700 whitespace-nowrap">{formatVal(footer.totalDeductions)}</td>
              <td className="px-3 py-2.5 text-right text-sm tabular-nums font-bold text-slate-900 whitespace-nowrap">{formatVal(footer.netSalary)}</td>
              <td className="px-3 py-2.5 text-sm tabular-nums text-slate-600 whitespace-nowrap">{footer.pending}P · {footer.submitted}S · {footer.paid}Paid</td>
              <td className="px-3 py-2.5 text-sm text-slate-400 whitespace-nowrap">—</td>
              {hasRowActions && <td className="px-3 py-2.5" />}
            </tr>
          </tfoot>
        </table>
      </div>

      {shouldShowPagination(sortedRecords.length) && (
        <div className={paginationBarClass}>
          <button
            type="button"
            onClick={() => setCurrentPage(Math.max(currentPage - 1, 1))}
            disabled={currentPage === 1}
            className={paginationNavBtnClass}
          >
            Previous
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
            <button
              key={page}
              type="button"
              onClick={() => setCurrentPage(page)}
              className={paginationPageBtnClass(currentPage === page)}
            >
              {page}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setCurrentPage(Math.min(currentPage + 1, totalPages))}
            disabled={currentPage === totalPages}
            className={paginationNavBtnClass}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}