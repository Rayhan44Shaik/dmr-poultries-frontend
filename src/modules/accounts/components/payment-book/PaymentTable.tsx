// src/modules/accounts/components/payment-book/PaymentTable.tsx

import React, { useState, useMemo } from 'react';
import { Payment } from '../../types/payment.types';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaymentTableProps {
  payments: Payment[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  itemsPerPage?: number;
}

export function PaymentTable({ payments, selectedId, onSelect, itemsPerPage = 10 }: PaymentTableProps) {
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.ceil(payments.length / itemsPerPage) || 1;
  const paginatedPayments = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    return payments.slice(start, end);
  }, [payments, currentPage, itemsPerPage]);

  // Reset to first page when payments list changes (e.g., filter)
  useMemo(() => {
    if (currentPage > totalPages) setCurrentPage(1);
  }, [payments, currentPage, totalPages]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    }).format(amount || 0);
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const handleRowClick = (id: string) => {
    onSelect(selectedId === id ? null : id);
  };

  // Generate page numbers with ellipsis
  const getPageNumbers = (): (number | 'ellipsis')[] => {
    const pages: (number | 'ellipsis')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('ellipsis');
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (currentPage < totalPages - 2) pages.push('ellipsis');
      pages.push(totalPages);
    }
    return pages;
  };

  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, payments.length);

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase whitespace-nowrap">
                Date
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase whitespace-nowrap">
                Payment Type
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase whitespace-nowrap">
                Reference
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase whitespace-nowrap">
                Paid To
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase whitespace-nowrap">
                Amount
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase whitespace-nowrap">
                Mode
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase whitespace-nowrap">
                Category
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase whitespace-nowrap">
                Remarks
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {paginatedPayments.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-500 text-sm">
                  No payments found. Click <span className="font-semibold text-blue-600">"New Payment"</span> to add one.
                </td>
              </tr>
            ) : (
              paginatedPayments.map((payment) => {
                const isSelected = selectedId === payment.id;
                return (
                  <tr
                    key={payment.id}
                    onClick={() => handleRowClick(payment.id)}
                    className={`cursor-pointer transition-all duration-150 ${
                      isSelected
                        ? 'bg-blue-50/80 shadow-[inset_0_0_0_2px_#3b82f6]'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <td className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap">
                      {formatDate(payment.paymentDate)}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap">
                      {payment.paymentType}
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-slate-600 whitespace-nowrap">
                      {payment.referenceNo}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap">
                      {payment.paidTo}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-bold text-emerald-600 whitespace-nowrap">
                      {formatCurrency(payment.amount)}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">
                      {payment.paymentMode}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">
                      {payment.category}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500 max-w-[150px] truncate">
                      {payment.remarks || '-'}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 bg-slate-50 border-t border-slate-200">
          <span className="text-xs text-slate-500">
            Showing {startItem} to {endItem} of {payments.length} entries
          </span>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-1"
            >
              <ChevronLeft size={14} /> Prev
            </button>

            {getPageNumbers().map((page, idx) =>
              page === 'ellipsis' ? (
                <span key={`ellipsis-${idx}`} className="px-2 text-xs text-slate-400">…</span>
              ) : (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    currentPage === page
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'border border-slate-300 text-slate-700 bg-white hover:bg-slate-100'
                  }`}
                >
                  {page}
                </button>
              )
            )}

            <button
              onClick={() => setCurrentPage(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-1"
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}