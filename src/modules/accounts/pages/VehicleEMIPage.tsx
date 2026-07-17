import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { getVehicleLoans, getEMIPayments, updateEMIPayment, addEMIPayment } from '../services/storage';
import { usePagination } from '../hooks';
import { SearchInput, Pagination, ErrorBoundary } from '../components/common';
import { EMITable } from '../components/vehicle-emi';
import { formatCurrency } from '../utils/formatters';

// Helpers to get data from localStorage
const getVehicles = (): any[] => {
  try {
    return JSON.parse(localStorage.getItem('dmr-vehicles') || '[]');
  } catch {
    return [];
  }
};

const getBanks = (): any[] => {
  try {
    return JSON.parse(localStorage.getItem('dmr-banks') || '[]');
  } catch {
    return [];
  }
};

const VehicleEMIPage = () => {
  const [month, setMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [bankFilter, setBankFilter] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const loans = getVehicleLoans();
  const emis = getEMIPayments();
  const vehicles = getVehicles();
  const banks = getBanks();

  const filteredLoans = useMemo(() => {
    return loans.filter((l: any) => {
      const bankMatch = bankFilter ? l.bankId === bankFilter : true;
      const vehicle = vehicles.find((v: any) => v.id === l.vehicleId);
      const searchMatch = vehicle?.vehicleNumber?.toLowerCase().includes(searchTerm.toLowerCase());
      return bankMatch && (searchTerm ? searchMatch : true);
    });
  }, [loans, bankFilter, searchTerm, vehicles]);

  // Build EMI map for current month
  const emiMap = useMemo(() => {
    const map: Record<string, any> = {};
    filteredLoans.forEach((loan: any) => {
      const emi = emis.find((e: any) => e.loanId === loan.id && e.dueDate.startsWith(month));
      map[loan.id] = emi;
    });
    return map;
  }, [filteredLoans, emis, month]);

  // Summary
  const totalMonthlyEMI = filteredLoans.reduce((sum: number, l: any) => sum + l.emiAmount, 0);
  const paidThisMonth = Object.values(emiMap).filter((e: any) => e?.status === 'Paid').reduce((sum: number, e: any) => sum + e.amount, 0);
  const pendingThisMonth = Object.values(emiMap).filter((e: any) => e?.status === 'Pending').reduce((sum: number, e: any) => sum + e.amount, 0);
  const totalVehicles = filteredLoans.length;

  const { paginated, currentPage, totalPages, goTo } = usePagination(filteredLoans, 10);

  const handlePay = (loanId: string, dueDate: string) => {
    // Find existing pending EMI for this loan and dueDate
    const existing = emis.find((e: any) => e.loanId === loanId && e.dueDate === dueDate && e.status === 'Pending');
    if (existing) {
      updateEMIPayment(existing.id, { status: 'Paid', paidDate: format(new Date(), 'yyyy-MM-dd') });
      alert('EMI marked as Paid');
    } else {
      // If no pending, create new paid entry
      const loan = loans.find((l: any) => l.id === loanId);
      if (loan) {
        addEMIPayment({
          loanId,
          dueDate,
          paidDate: format(new Date(), 'yyyy-MM-dd'),
          amount: loan.emiAmount,
          status: 'Paid',
        });
        alert('EMI paid');
      }
    }
    // Refresh page
    window.location.reload();
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Vehicle EMI</h1>
        <button className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700">
          Pay EMI (Bulk)
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded shadow border">
          <div className="text-sm text-gray-500">Total Monthly EMI</div>
          <div className="text-xl font-bold">{formatCurrency(totalMonthlyEMI)}</div>
        </div>
        <div className="bg-white p-4 rounded shadow border">
          <div className="text-sm text-gray-500">Paid This Month</div>
          <div className="text-xl font-bold text-green-600">{formatCurrency(paidThisMonth)}</div>
        </div>
        <div className="bg-white p-4 rounded shadow border">
          <div className="text-sm text-gray-500">Pending</div>
          <div className="text-xl font-bold text-red-600">{formatCurrency(pendingThisMonth)}</div>
        </div>
        <div className="bg-white p-4 rounded shadow border">
          <div className="text-sm text-gray-500">Total Vehicles</div>
          <div className="text-xl font-bold">{totalVehicles}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-4 bg-white p-4 rounded shadow">
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="border rounded px-3 py-1"
        />
        <select
          value={bankFilter || ''}
          onChange={(e) => setBankFilter(e.target.value || null)}
          className="border rounded px-3 py-1"
        >
          <option value="">All Banks</option>
          {banks.map((b: any) => (
            <option key={b.id} value={b.id}>{b.bankName}</option>
          ))}
        </select>
        <SearchInput value={searchTerm} onChange={setSearchTerm} placeholder="Search Vehicle" />
      </div>

      {/* Table */}
      <ErrorBoundary>
        <EMITable loans={paginated} emiMap={emiMap} onPay={handlePay} />
      </ErrorBoundary>

      <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={goTo} />
    </div>
  );
};

export default VehicleEMIPage;