// src/modules/staff/components/salary/salaryTable.tsx

import React, { useMemo, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

type SalaryTableProps = {
  records: any[];
  selectedIds: string[];
  toggleSelectOne: (id: string) => void;
  toggleSelectAll: () => void;
  isSelectDropdownOpen?: boolean;
  setIsSelectDropdownOpen?: (open: boolean) => void;
  dropdownRef?: React.RefObject<HTMLDivElement | null>;
  formatCurrency?: (amount: number) => string;
  currentPage: number;
  setCurrentPage?: (page: number) => void;
  itemsPerPage: number;
  currentMonth?: string;
  onClearSelection?: () => void;
  onView?: (record: any) => void;
  onEdit?: (record: any) => void;
  onMarkPaid?: (id: string) => void;
};

export function SalaryTable({
  records,
  selectedIds,
  toggleSelectOne,
  toggleSelectAll,
  isSelectDropdownOpen = false,
  setIsSelectDropdownOpen = () => {},
  dropdownRef,
  formatCurrency,
  currentPage,
  setCurrentPage = () => {},
  itemsPerPage,
  currentMonth = '',
  onClearSelection,
}: SalaryTableProps) {
  const tableContainerRef = useRef<HTMLDivElement>(null);

  // Fallback currency formatter
  const formatVal = formatCurrency || ((amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    }).format(amount || 0);
  });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tableContainerRef.current && !tableContainerRef.current.contains(event.target as Node)) {
        const target = event.target as HTMLElement;
        const text = target.textContent || '';
        const isBatchOrAction = 
          target.closest('button') && 
          (text.includes('Mark Paid') || 
           text.includes('Mark Pending') || 
           text.includes('Clear Selection') ||
           text.includes('View') || 
           text.includes('Edit') || 
           text.includes('Delete') ||
           text.includes('Download PDF'));

        if (!isBatchOrAction && selectedIds.length > 0) {
          onClearSelection?.();
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [selectedIds, onClearSelection]);

  const sortedRecords = useMemo(() => {
    const priorityMap: Record<string, number> = {
      'supervisor': 1,
      'driver': 2,
      'helper': 3,
      'accounts': 99,
      'accountant': 99,
    };

    return [...records].sort((a, b) => {
      const deptA = (a.department || a.role || '').toLowerCase();
      const deptB = (b.department || b.role || '').toLowerCase();
      
      const scoreA = priorityMap[deptA] ?? 50;
      const scoreB = priorityMap[deptB] ?? 50;

      if (scoreA !== scoreB) {
        return scoreA - scoreB;
      }
      return (a.employeeName || a.name || '').localeCompare(b.employeeName || b.name || '');
    });
  }, [records]);

  const totalPages = Math.ceil(sortedRecords.length / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentRecords = sortedRecords.slice(startIndex, startIndex + itemsPerPage);

  const isAllSortedSelected = sortedRecords.length > 0 && selectedIds.length >= sortedRecords.length;

  return (
    <div ref={tableContainerRef} className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase relative">
                <div className="inline-block" ref={dropdownRef}>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsSelectDropdownOpen(!isSelectDropdownOpen);
                    }}
                    className="flex items-center gap-1.5 px-2 py-1 bg-white border border-slate-300 rounded-md text-xs font-bold text-slate-700 hover:bg-slate-100 transition shadow-2xs"
                  >
                    <span>#</span>
                    {selectedIds.length > 0 && (
                      <span className="bg-blue-600 text-white px-1.5 py-0.2 rounded-full text-[10px]">
                        {selectedIds.length}
                      </span>
                    )}
                    <ChevronDown size={12} />
                  </button>

                  {isSelectDropdownOpen && (
                    <div 
                      onClick={(e) => e.stopPropagation()} 
                      className="absolute left-0 mt-2 w-64 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-2 space-y-1 animate-in fade-in zoom-in-95 duration-150"
                    >
                      <div className="flex items-center justify-between px-2 py-1.5 border-b border-slate-100 mb-1">
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Select Records</span>
                        <button
                          type="button"
                          onClick={() => toggleSelectAll()}
                          className="text-[11px] text-blue-600 hover:underline font-semibold"
                        >
                          {isAllSortedSelected ? 'Deselect All' : `Select All (${sortedRecords.length})`}
                        </button>
                      </div>
                      <div className="max-h-60 overflow-y-auto space-y-0.5">
                        {sortedRecords.map((record: any, idx: number) => {
                          const isChecked = selectedIds.includes(record.id);
                          return (
                            <label
                              key={record.id}
                              className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 rounded-lg cursor-pointer text-xs text-slate-700 select-none"
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleSelectOne(record.id)}
                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                              />
                              <span className="font-semibold text-slate-500 w-6">#{idx + 1}</span>
                              <span className="truncate flex-1 font-medium">{record.employeeName || record.name}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Employee Name</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Department / Role</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Month</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Base Salary</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Deduction</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Penalty</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Advance Given</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Net Salary</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {currentRecords.map((record: any, index: number) => {
              const absoluteIndex = startIndex + index + 1;
              const isSelected = selectedIds.includes(record.id);
              
              const statusVal = String(record.status || '').trim().toLowerCase();
              const isPaid = statusVal === 'paid' || statusVal === 'approved';

              return (
                <tr
                  key={record.id}
                  onClick={() => toggleSelectOne(record.id)}
                  className={`transition-colors cursor-pointer ${
                    isSelected ? 'bg-blue-50/70 border-blue-200' : 'hover:bg-slate-50'
                  }`}
                >
                  <td className="px-4 py-3 text-sm text-slate-600 font-medium">
                    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-md text-xs ${
                      isSelected ? 'bg-blue-600 text-white font-bold' : 'bg-slate-100 text-slate-700'
                    }`}>
                      {absoluteIndex}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-slate-800">{record.employeeName || record.name}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    <div className="font-medium text-slate-800">{record.department || record.role}</div>
                    <div className="text-xs text-slate-400">{record.role}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600 font-medium">
                    <span className="px-2 py-0.5 bg-slate-100 rounded text-xs text-slate-700 font-mono">
                      {record.month || currentMonth}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-semibold text-slate-700">
                    {formatVal(record.baseSalary || record.grossSalary || 0)}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-rose-600">
                    {formatVal(record.totalDeductions || record.leaveDeduction || record.deduction || 0)}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-amber-600">
                    {formatVal(record.latePenalty || record.penalty || 0)}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-blue-600">
                    {formatVal(record.advanceRecovery || record.advanceGiven || 0)}
                  </td>
                  <td className={`px-4 py-3 text-sm text-right font-bold ${isPaid ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {formatVal(record.netSalary)}
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
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'border border-slate-300 text-slate-700 bg-white hover:bg-slate-100'
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