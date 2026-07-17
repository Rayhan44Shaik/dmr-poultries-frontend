import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { getBankBook, deleteBankEntry } from '../services/storage';
import { usePagination } from '../hooks';
import { SearchInput, Pagination, ErrorBoundary } from '../components/common';
import { BankBookTable, BankEntryForm } from '../components/bank-book';
import { formatCurrency } from '../utils/formatters';
import { Plus } from 'lucide-react';

// Helper to get banks from localStorage
const getBanks = (): any[] => {
  try {
    return JSON.parse(localStorage.getItem('dmr-banks') || '[]');
  } catch {
    return [];
  }
};

const BankBookPage = () => {
  const banks = getBanks();
  const [selectedBankId, setSelectedBankId] = useState<string>(banks.length > 0 ? banks[0].id : '');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [search, setSearch] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const entries = useMemo(
    () => getBankBook().filter(e => e.bankAccountId === selectedBankId && e.date === date),
    [selectedBankId, date, refreshKey]
  );
  const filtered = entries.filter(e => e.particulars.toLowerCase().includes(search.toLowerCase()));

  const allBefore = useMemo(
    () => getBankBook().filter(e => e.bankAccountId === selectedBankId && e.date < date),
    [selectedBankId, date, refreshKey]
  );
  const opening = allBefore.reduce((acc, e) => acc + e.deposit - e.withdrawal, 0);
  let running = opening;
  const rows = filtered.map(e => {
    const balance = running + e.deposit - e.withdrawal;
    running = balance;
    return { ...e, balance };
  });

  const { paginated, currentPage, totalPages, goTo } = usePagination(rows, 20);

  const handleDelete = (id: string) => {
    if (window.confirm('Delete this entry?')) {
      deleteBankEntry(id);
      setRefreshKey(prev => prev + 1);
    }
  };

  const handleAddSuccess = () => {
    setShowAddForm(false);
    setRefreshKey(prev => prev + 1);
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Bank Book</h1>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="bg-blue-600 text-white px-3 py-1 rounded flex items-center hover:bg-blue-700"
        >
          <Plus className="w-4 h-4 mr-1" /> Add Entry
        </button>
      </div>

      {/* Account selector & filters */}
      <div className="flex flex-wrap gap-4 mb-4 bg-white p-4 rounded shadow">
        <select
          value={selectedBankId}
          onChange={(e) => setSelectedBankId(e.target.value)}
          className="border rounded px-3 py-1"
        >
          {banks.map((b: any) => (
            <option key={b.id} value={b.id}>{b.bankName}</option>
          ))}
        </select>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="border rounded px-3 py-1"
        />
        <SearchInput value={search} onChange={setSearch} placeholder="Search particulars" />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="bg-white p-3 rounded shadow border">
          <div className="text-sm text-gray-500">Opening Balance</div>
          <div className="text-lg font-bold">{formatCurrency(opening)}</div>
        </div>
        <div className="bg-white p-3 rounded shadow border">
          <div className="text-sm text-gray-500">Deposits</div>
          <div className="text-lg font-bold text-green-600">{formatCurrency(filtered.reduce((s, e) => s + e.deposit, 0))}</div>
        </div>
        <div className="bg-white p-3 rounded shadow border">
          <div className="text-sm text-gray-500">Withdrawals</div>
          <div className="text-lg font-bold text-red-600">{formatCurrency(filtered.reduce((s, e) => s + e.withdrawal, 0))}</div>
        </div>
      </div>

      {/* Add form */}
      {showAddForm && (
        <BankEntryForm
          date={date}
          bankAccountId={selectedBankId}
          onSuccess={handleAddSuccess}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      {/* Table */}
      <ErrorBoundary>
        <BankBookTable entries={paginated} onDelete={handleDelete} />
      </ErrorBoundary>

      <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={goTo} />
    </div>
  );
};

export default BankBookPage;