import { useState, useMemo, useCallback } from 'react';
import { format } from 'date-fns';
import { getFarmerPurchases, getFarmerPayments } from '../services/storage';
import { usePagination, useDebounce } from '../hooks';
import { SearchInput, DateRangePicker, Pagination, ErrorBoundary } from '../components/common';
import { FarmerPaymentTable, PaymentModal } from '../components/farmer-payments';
import type { FarmerPurchase } from '../types';
import { formatCurrency } from '../utils/formatters';

// Helper to get farms from localStorage
const getFarms = (): any[] => {
  try {
    return JSON.parse(localStorage.getItem('dmr-farms') || '[]');
  } catch {
    return [];
  }
};

const FarmerPaymentsPage = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFrom, setDateFrom] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedFarmId, setSelectedFarmId] = useState<string | null>(null);
  const [selectedPurchase, setSelectedPurchase] = useState<FarmerPurchase | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const farms = getFarms();
  const purchases = getFarmerPurchases();
  const payments = getFarmerPayments();

  const debouncedSearch = useDebounce(searchTerm, 300);

  // Compute summary
  const totalPurchase = purchases.reduce((sum, p) => sum + p.amount, 0);
  const totalPaid = purchases.reduce((sum, p) => sum + p.paidAmount, 0);
  const pendingAmount = totalPurchase - totalPaid;
  const todayPayments = payments.filter(p => p.date === format(new Date(), 'yyyy-MM-dd'));
  const todayPaymentTotal = todayPayments.reduce((sum, p) => sum + p.amount, 0);

  // Filter purchases
  const filtered = useMemo(() => {
    return purchases.filter(p => {
      const inDate = p.date >= dateFrom && p.date <= dateTo;
      const farmMatch = selectedFarmId ? p.farmId === selectedFarmId : true;
      const farm = farms.find((f: any) => f.id === p.farmId);
      const searchMatch = farm?.farmName?.toLowerCase().includes(debouncedSearch.toLowerCase());
      return inDate && farmMatch && (debouncedSearch ? searchMatch : true);
    });
  }, [purchases, dateFrom, dateTo, selectedFarmId, debouncedSearch, farms]);

  const { paginated, currentPage, totalPages, goTo } = usePagination(filtered, 15);

  const getFarmName = useCallback((farmId: string) => {
    const farm = farms.find((f: any) => f.id === farmId);
    return farm?.farmName || 'Unknown';
  }, [farms]);

  const handlePay = useCallback((purchase: FarmerPurchase) => {
    setSelectedPurchase(purchase);
    setShowPaymentModal(true);
  }, []);

  const handlePaymentSuccess = useCallback(() => {
    // Refresh data (component will re-render with updated storage)
  }, []);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Farmer Payments</h1>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded shadow border">
          <div className="text-sm text-gray-500">Total Purchase</div>
          <div className="text-xl font-bold">{formatCurrency(totalPurchase)}</div>
        </div>
        <div className="bg-white p-4 rounded shadow border">
          <div className="text-sm text-gray-500">Total Paid</div>
          <div className="text-xl font-bold text-green-600">{formatCurrency(totalPaid)}</div>
        </div>
        <div className="bg-white p-4 rounded shadow border">
          <div className="text-sm text-gray-500">Pending Amount</div>
          <div className="text-xl font-bold text-red-600">{formatCurrency(pendingAmount)}</div>
        </div>
        <div className="bg-white p-4 rounded shadow border">
          <div className="text-sm text-gray-500">Today's Payment</div>
          <div className="text-xl font-bold">{formatCurrency(todayPaymentTotal)}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-4 bg-white p-4 rounded shadow">
        <SearchInput value={searchTerm} onChange={setSearchTerm} placeholder="Search Farm Name" />
        <DateRangePicker
          from={dateFrom}
          to={dateTo}
          onFromChange={setDateFrom}
          onToChange={setDateTo}
        />
        <select
          value={selectedFarmId || ''}
          onChange={(e) => setSelectedFarmId(e.target.value || null)}
          className="border rounded px-3 py-1"
        >
          <option value="">All Farms</option>
          {farms.map((f: any) => (
            <option key={f.id} value={f.id}>{f.farmName}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <ErrorBoundary>
        <FarmerPaymentTable purchases={paginated} onPay={handlePay} getFarmName={getFarmName} />
      </ErrorBoundary>

      <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={goTo} />

      {/* Payment Modal */}
      <PaymentModal
        isOpen={showPaymentModal}
        purchase={selectedPurchase}
        onClose={() => setShowPaymentModal(false)}
        onSuccess={handlePaymentSuccess}
      />
    </div>
  );
};

export default FarmerPaymentsPage;