// src/modules/accounts/payment-book/PaymentBookPage.tsx

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSafeNotification } from '../../../hooks/useSafeNotification';
import { PaymentTable } from '../components/payment-book/PaymentTable';
import { PaymentModal } from '../components/payment-book/PaymentModal';
import { PaymentService } from '../services/PaymentService';
import type { Payment } from '../types/payment.types';
import { DatePicker } from '../../../components/common/DatePicker';
import {
  Download,
  RefreshCw,
  Plus,
  FileText,
  Wallet,
  Banknote,
  TrendingUp,
  X,
  Eye,
  Pencil,
  Trash2,
} from 'lucide-react';

type PaymentBookPageProps = { embedded?: boolean };

export function PaymentBookPage({ embedded = false }: PaymentBookPageProps) {
  const { showNotification } = useSafeNotification();

  // ----- state -----
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // filters
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [paymentType, setPaymentType] = useState('');
  const [paymentMode, setPaymentMode] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [viewingPayment, setViewingPayment] = useState<Payment | null>(null);

  const tableContainerRef = useRef<HTMLDivElement>(null);

  // ----- load data -----
  const loadPayments = () => {
    setLoading(true);
    const filters: any = { search: searchQuery };
    if (dateFrom) filters.dateFrom = dateFrom;
    if (dateTo) filters.dateTo = dateTo;
    if (paymentType) filters.paymentType = paymentType;
    if (paymentMode) filters.paymentMode = paymentMode;

    const data = PaymentService.getPayments(filters);
    setPayments(data);
    setLoading(false);
  };

  // Initial load (no seeding)
  useEffect(() => {
    loadPayments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // reload when filters change
  useEffect(() => {
    loadPayments();
  }, [dateFrom, dateTo, paymentType, paymentMode, searchQuery]);

  // Clear selection when payments change
  useEffect(() => {
    setSelectedId(null);
  }, [payments]);

  // ----- KPIs -----
  const kpis = useMemo(() => {
    const filters: any = {};
    if (dateFrom) filters.dateFrom = dateFrom;
    if (dateTo) filters.dateTo = dateTo;
    return PaymentService.getKPIs(filters);
  }, [dateFrom, dateTo]);

  // ----- handlers -----
  const handleNewPayment = () => {
    setEditingPayment(null);
    setIsModalOpen(true);
  };

  const handleModalSave = (saved: Payment) => {
    showNotification(
      saved.id ? 'Payment updated successfully' : 'Payment created successfully',
      'success'
    );
    loadPayments();
  };

  // ----- Selection actions -----
  const selectedPayment = useMemo(
    () => payments.find((p) => p.id === selectedId) || null,
    [payments, selectedId]
  );

  const handleView = () => {
    if (selectedPayment) setViewingPayment(selectedPayment);
  };

  const handleEdit = () => {
    if (selectedPayment) {
      setEditingPayment(selectedPayment);
      setIsModalOpen(true);
    }
  };

  const handleDelete = () => {
    if (!selectedPayment) return;
    if (window.confirm(`Delete payment #${selectedPayment.paymentNo}?`)) {
      const success = PaymentService.deletePayment(selectedPayment.id);
      if (success) {
        showNotification('Payment deleted', 'success');
        setSelectedId(null);
        loadPayments();
      } else {
        showNotification('Failed to delete', 'error');
      }
    }
  };

  // ----- click outside table to deselect -----
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (tableContainerRef.current && !tableContainerRef.current.contains(e.target as Node)) {
        setSelectedId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // filter options
  const paymentTypes = useMemo(() => {
    const types = new Set(PaymentService.getPayments().map((p) => p.paymentType));
    return Array.from(types);
  }, [payments]);

  const paymentModes = useMemo(() => {
    const modes = new Set(PaymentService.getPayments().map((p) => p.paymentMode));
    return Array.from(modes);
  }, [payments]);

  // Reset all filters
  const clearFilters = () => {
    setDateFrom('');
    setDateTo('');
    setPaymentType('');
    setPaymentMode('');
    setSearchQuery('');
  };

  // ----- render -----
  const content = (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto bg-slate-50 min-h-screen">
      {/* Header */}
      <h1 className="text-2xl font-bold text-slate-800">Payment Book</h1>

      {/* Filter Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-4">
        {/* Row 1: Main filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <DatePicker
            label="Date From"
            value={dateFrom}
            onChange={setDateFrom}
            placeholder="From"
            className="w-full"
          />
          <DatePicker
            label="Date To"
            value={dateTo}
            onChange={setDateTo}
            placeholder="To"
            className="w-full"
          />
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Payment Type</label>
            <select
              value={paymentType}
              onChange={(e) => setPaymentType(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-400 outline-none bg-white"
            >
              <option value="">All</option>
              {paymentTypes.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Payment Mode</label>
            <select
              value={paymentMode}
              onChange={(e) => setPaymentMode(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-400 outline-none bg-white"
            >
              <option value="">All</option>
              {paymentModes.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>

        {/* Row 2: Search + Action Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by reference, paid to, amount..."
              className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-400 outline-none bg-white"
            />
          </div>
          <button
            onClick={clearFilters}
            className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition bg-white whitespace-nowrap"
          >
            Clear Filters
          </button>
          <button
            onClick={() => showNotification('Export coming soon', 'info')}
            className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition bg-white flex items-center gap-2 whitespace-nowrap"
          >
            <Download size={16} /> Export
          </button>
          <button
            onClick={() => { loadPayments(); showNotification('Refreshed', 'info'); }}
            className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition bg-white flex items-center gap-2 whitespace-nowrap"
          >
            <RefreshCw size={16} /> Refresh
          </button>
          <button
            onClick={handleNewPayment}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition flex items-center gap-2 shadow-sm whitespace-nowrap"
          >
            <Plus size={18} /> New Payment
          </button>
        </div>
      </div>

      {/* KPI Cards – 4 cards only */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><FileText size={20} /></div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Total Payments</p>
              <p className="text-xl font-bold text-slate-800">₹{kpis.totalPayments.toLocaleString('en-IN')}</p>
              <p className="text-[10px] text-slate-400">This Week</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><Wallet size={20} /></div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Cash Payments</p>
              <p className="text-xl font-bold text-slate-800">₹{kpis.cashPayments.toLocaleString('en-IN')}</p>
              <p className="text-[10px] text-slate-400">This Week</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-50 text-purple-600 rounded-lg"><Banknote size={20} /></div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Bank Payments</p>
              <p className="text-xl font-bold text-slate-800">₹{kpis.bankPayments.toLocaleString('en-IN')}</p>
              <p className="text-[10px] text-slate-400">This Week</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-50 text-amber-600 rounded-lg"><TrendingUp size={20} /></div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Total Transactions</p>
              <p className="text-xl font-bold text-slate-800">{kpis.totalTransactions}</p>
              <p className="text-[10px] text-slate-400">This Week</p>
            </div>
          </div>
        </div>
      </div>

      {/* Table Card */}
      <div ref={tableContainerRef} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-slate-50/80 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-800">Payments</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleView}
              disabled={!selectedPayment}
              className={`p-2 rounded-lg transition ${
                selectedPayment
                  ? 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              }`}
              title="View selected payment"
            >
              <Eye size={18} />
            </button>
            <button
              onClick={handleEdit}
              disabled={!selectedPayment}
              className={`p-2 rounded-lg transition ${
                selectedPayment
                  ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              }`}
              title="Edit selected payment"
            >
              <Pencil size={18} />
            </button>
            <button
              onClick={handleDelete}
              disabled={!selectedPayment}
              className={`p-2 rounded-lg transition ${
                selectedPayment
                  ? 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              }`}
              title="Delete selected payment"
            >
              <Trash2 size={18} />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-500">Loading payments...</div>
        ) : (
          <PaymentTable
            payments={payments}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        )}
      </div>

      {/* Modals */}
      <PaymentModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingPayment(null);
        }}
        onSave={handleModalSave}
        editPayment={editingPayment}
      />

      {viewingPayment && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-800">Payment Details</h3>
              <button onClick={() => setViewingPayment(null)} className="p-1 hover:bg-slate-100 rounded-lg">
                <X size={20} className="text-slate-500" />
              </button>
            </div>
            <div className="space-y-2 text-sm">
              <div><span className="font-semibold">Payment No:</span> {viewingPayment.paymentNo}</div>
              <div><span className="font-semibold">Date:</span> {viewingPayment.paymentDate}</div>
              <div><span className="font-semibold">Type:</span> {viewingPayment.paymentType}</div>
              <div><span className="font-semibold">Mode:</span> {viewingPayment.paymentMode}</div>
              <div><span className="font-semibold">Paid To:</span> {viewingPayment.paidTo}</div>
              <div><span className="font-semibold">Amount:</span> ₹{viewingPayment.amount.toLocaleString('en-IN')}</div>
              <div><span className="font-semibold">Reference:</span> {viewingPayment.referenceNo}</div>
              <div><span className="font-semibold">Category:</span> {viewingPayment.category}</div>
              <div><span className="font-semibold">Status:</span> {viewingPayment.status}</div>
              <div><span className="font-semibold">Remarks:</span> {viewingPayment.remarks || '-'}</div>
            </div>
            <div className="flex justify-end pt-3 border-t border-slate-200">
              <button onClick={() => setViewingPayment(null)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-medium transition">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return embedded ? content : content;
}