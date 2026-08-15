// src/modules/staff/components/salary/salaryTable.tsx

import { useMemo } from "react";
import { CheckCircle2, Eye, Lock, Pencil, Trash2, Undo2, Send, Wallet } from "lucide-react";
import type { SalaryRecord } from "../../types/staffDashboard";

type Action = "view" | "edit" | "submit" | "pay" | "markUnpaid" | "unsubmit" | "delete";

type SalaryTableProps = {
  records: SalaryRecord[];
  currentPage: number;
  setCurrentPage?: (page: number) => void;
  itemsPerPage: number;
  formatCurrency?: (amount: number) => string;
  saving?: boolean;
  onAction: (action: Action, record: SalaryRecord) => void;
};

function StatusBadge({ record }: { record: SalaryRecord }) {
  const windowOpen =
    record.status === "Paid" &&
    record.correctionWindowDaysRemaining != null &&
    record.correctionWindowDaysRemaining > 0;

  if (record.status === "Pending") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
        Pending
      </span>
    );
  }
  if (record.status === "Submitted") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
        <Lock size={11} /> Submitted
      </span>
    );
  }
  // Paid
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
        record.monthClosed || !windowOpen
          ? "bg-slate-100 text-slate-600 border-slate-200"
          : "bg-emerald-50 text-emerald-700 border-emerald-200"
      }`}
    >
      <CheckCircle2 size={11} />
      Paid
      {(record.monthClosed || !windowOpen) && <Lock size={10} />}
    </span>
  );
}

function actionStatus(record: SalaryRecord): string {
  if (record.monthClosed) return "This payroll month is closed.";
  if (record.status === "Paid") {
    if (record.correctionWindowDaysRemaining == null || record.correctionWindowDaysRemaining <= 0) {
      return "Correction window expired — paid salary is locked.";
    }
    return "";
  }
  return "";
}

export function SalaryTable({
  records,
  currentPage,
  setCurrentPage = () => {},
  itemsPerPage,
  formatCurrency,
  saving = false,
  onAction,
}: SalaryTableProps) {
  const formatVal = formatCurrency || ((amount: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2 }).format(amount || 0));

  const sortedRecords = useMemo(
    () =>
      [...records].sort((a, b) =>
        (a.employeeName || "").localeCompare(b.employeeName || "")
      ),
    [records]
  );

  const totalPages = Math.ceil(sortedRecords.length / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentRecords = sortedRecords.slice(startIndex, startIndex + itemsPerPage);

  if (records.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500 text-sm">
        No salary records for the selected month.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Employee</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Department</th>
              <th className="px-3 py-3 text-center text-xs font-semibold text-slate-600 uppercase">Working</th>
              <th className="px-3 py-3 text-center text-xs font-semibold text-slate-600 uppercase">Present</th>
              <th className="px-3 py-3 text-center text-xs font-semibold text-slate-600 uppercase">Leave</th>
              <th className="px-3 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Basic</th>
              <th className="px-3 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Gross</th>
              <th className="px-3 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Deductions</th>
              <th className="px-3 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Net</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Status</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Payment Date</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {currentRecords.map((record) => {
              const note = actionStatus(record);
              const windowOpen =
                record.status === "Paid" &&
                record.correctionWindowDaysRemaining != null &&
                record.correctionWindowDaysRemaining > 0;

              return (
                <tr key={record.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 text-sm font-semibold text-slate-800 whitespace-nowrap">{record.employeeName}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{record.department}</td>
                  <td className="px-3 py-3 text-center text-sm text-slate-700">{record.workingDays ?? "—"}</td>
                  <td className="px-3 py-3 text-center text-sm text-slate-700">{record.presentDays ?? "—"}</td>
                  <td className="px-3 py-3 text-center text-sm text-slate-700">{record.leaveDays ?? "—"}</td>
                  <td className="px-3 py-3 text-right text-sm text-slate-700">{formatVal(record.basicSalary)}</td>
                  <td className="px-3 py-3 text-right text-sm text-slate-700">{formatVal(record.totalGross)}</td>
                  <td className="px-3 py-3 text-right text-sm text-rose-600">{formatVal(record.totalDeductions)}</td>
                  <td className="px-3 py-3 text-right text-sm font-bold text-slate-800">{formatVal(record.netSalary)}</td>
                  <td className="px-3 py-3">
                    <StatusBadge record={record} />
                    {record.status === "Paid" && windowOpen && (
                      <span className="block text-[10px] text-amber-600 mt-0.5">
                        window {record.correctionWindowDaysRemaining}d
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-sm text-slate-600">{record.paymentDate ?? "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      <ActionButtons
                        record={record}
                        saving={saving}
                        onAction={onAction}
                      />
                    </div>
                    {note && <div className="text-[10px] text-slate-400 text-right mt-1">{note}</div>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-t border-slate-200">
          <span className="text-xs text-slate-500">
            Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, sortedRecords.length)} of {sortedRecords.length} records
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setCurrentPage(Math.max(currentPage - 1, 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              Previous
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                type="button"
                onClick={() => setCurrentPage(page)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  currentPage === page
                    ? "bg-blue-600 text-white shadow-xs"
                    : "border border-slate-300 text-slate-700 bg-white hover:bg-slate-100"
                }`}
              >
                {page}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setCurrentPage(Math.min(currentPage + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ActionButtons({
  record,
  saving,
  onAction,
}: {
  record: SalaryRecord;
  saving: boolean;
  onAction: (action: Action, record: SalaryRecord) => void;
}) {
  const btn =
    "p-1.5 rounded-lg border transition disabled:opacity-40 disabled:cursor-not-allowed";
  const view = `${btn} border-slate-200 text-slate-600 hover:bg-slate-100`;
  const blue = `${btn} border-blue-200 text-blue-700 hover:bg-blue-50`;
  const emerald = `${btn} border-emerald-200 text-emerald-700 hover:bg-emerald-50`;
  const amber = `${btn} border-amber-200 text-amber-700 hover:bg-amber-50`;
  const rose = `${btn} border-rose-200 text-rose-700 hover:bg-rose-50`;

  const windowOpen =
    record.status === "Paid" &&
    record.correctionWindowDaysRemaining != null &&
    record.correctionWindowDaysRemaining > 0;

  return (
    <>
      <button type="button" className={view} title="View" onClick={() => onAction("view", record)}>
        <Eye size={14} />
      </button>

      {record.status === "Pending" && !record.monthClosed && (
        <>
          <button type="button" className={blue} title="Submit" disabled={saving} onClick={() => onAction("submit", record)}>
            <Send size={14} />
          </button>
          <button type="button" className={amber} title="Edit" disabled={saving} onClick={() => onAction("edit", record)}>
            <Pencil size={14} />
          </button>
          <button type="button" className={emerald} title="Pay" disabled={saving} onClick={() => onAction("pay", record)}>
            <Wallet size={14} />
          </button>
          <button type="button" className={rose} title="Delete" disabled={saving} onClick={() => onAction("delete", record)}>
            <Trash2 size={14} />
          </button>
        </>
      )}

      {record.status === "Submitted" && !record.monthClosed && (
        <>
          <button type="button" className={emerald} title="Pay" disabled={saving} onClick={() => onAction("pay", record)}>
            <Wallet size={14} />
          </button>
          <button type="button" className={amber} title="Un-submit (back to Pending)" disabled={saving} onClick={() => onAction("unsubmit", record)}>
            <Undo2 size={14} />
          </button>
        </>
      )}

      {record.status === "Paid" && !record.monthClosed && windowOpen && (
        <button type="button" className={amber} title="Mark Unpaid (correction window)" disabled={saving} onClick={() => onAction("markUnpaid", record)}>
          <Undo2 size={14} />
        </button>
      )}
    </>
  );
}
