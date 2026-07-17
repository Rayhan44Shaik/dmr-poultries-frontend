import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { getCashBook, deleteCashEntry } from '../services/storage';
import { usePagination } from '../hooks';
import { SearchInput, Pagination, ErrorBoundary } from '../components/common';
import { CashBookTable, CashEntryForm } from '../components/cash-book';
import { formatCurrency } from '../utils/formatters';
import { Plus } from 'lucide-react';

const CashBookPage = () => {
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [search, setSearch] = useState('');
  const [modeFilter, setModeFilter] = useState('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const entries = useMemo(() => getCashBook().filter(e => e.date === date), [date, refreshKey]);
  const filtered = useMemo(() => {
    return entries.filter(e => {
      const matchSearch = e.particulars.toLowerCase().includes(search.toLowerCase());
      const matchMode = modeFilter === 'all' || e.mode === modeFilter;
      return matchSearch && matchMode;
    });
  }, [entries, search, modeFilter]);

  // Compute opening and running balance
  const allBefore = useMemo(() => getCashBook().filter(e => e.date < date), [date, refreshKey]);
  const opening = allBefore.reduce((acc, e) => acc + e.receipt - e.payment, 0);
  let running = opening;
  const rows = filtered.map(e => {
    const balance = running + e.receipt - e.payment;
    running = balance;
    return { ...e, balance };
  });

  const { paginated, currentPage, totalPages, goTo } = usePagination(rows, 20);

  const handleDelete = (id: string) => {
    if (window.confirm('Delete this entry?')) {
      deleteCashEntry(id);
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
        <h1 className="text-2xl font-bold">Cash Book</h1>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="bg-blue-600 text-white px-3 py-1 rounded flex items-center hover:bg-blue-700"
        >
          <Plus className="w-4 h-4 mr-1" /> Add Entry
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div className="bg-white p-3 rounded shadow border">
          <div className="text-sm text-gray-500">Opening Cash</div>
          <div className="text-lg font-bold">{formatCurrency(opening)}</div>
        </div>
        <div className="bg-white p-3 rounded shadow border">
          <div className="text-sm text-gray-500">Receipts</div>
          <div className="text-lg font-bold text-green-600">{formatCurrency(filtered.reduce((s, e) => s + e.receipt, 0))}</div>
        </div>
        <div className="bg-white p-3 rounded shadow border">
          <div className="text-sm text-gray-500">Payments</div>
          <div className="text-lg font-bold text-red-600">{formatCurrency(filtered.reduce((s, e) => s + e.payment, 0))}</div>
        </div>
        <div className="bg-white p-3 rounded shadow border">
          <div className="text-sm text-gray-500">Closing Cash</div>
          <div className="text-lg font-bold">{formatCurrency(running)}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-4 bg-white p-4 rounded shadow">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="border rounded px-3 py-1"
        />
        <SearchInput value={search} onChange={setSearch} placeholder="Search particulars" />
        <select
          value={modeFilter}
          onChange={(e) => setModeFilter(e.target.value)}
          className="border rounded px-3 py-1"
        >
          <option value="all">All Modes</option>
          <option value="cash">Cash</option>
          <option value="bank">Bank</option>
          <option value="upi">UPI</option>
          <option value="card">Card</option>
        </select>
      </div>

      {/* Add form */}
      {showAddForm && (
        <CashEntryForm date={date} onSuccess={handleAddSuccess} onCancel={() => setShowAddForm(false)} />
      )}

      {/* Table */}
      <ErrorBoundary>
        <CashBookTable entries={paginated} onDelete={handleDelete} />
      </ErrorBoundary>

      <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={goTo} />
    </div>
  );
};

export default CashBookPage;