import { memo } from 'react';
import type { CashBookEntry } from '../../types';
import { formatDate, formatCurrency } from '../../utils/formatters';
import { Trash } from 'lucide-react';

interface CashBookTableProps {
  entries: (CashBookEntry & { balance: number })[];
  onDelete: (id: string) => void;
}

export const CashBookTable = memo(({ entries, onDelete }: CashBookTableProps) => {
  if (entries.length === 0) {
    return <div className="text-center text-gray-400 py-4">No entries</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Particulars</th>
            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Receipt</th>
            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Payment</th>
            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Balance</th>
            <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Mode</th>
            <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {entries.map((entry) => (
            <tr key={entry.id}>
              <td className="px-4 py-2 text-sm">{formatDate(entry.date)}</td>
              <td className="px-4 py-2 text-sm">{entry.particulars}</td>
              <td className="px-4 py-2 text-sm text-right text-green-600">
                {entry.receipt > 0 ? formatCurrency(entry.receipt) : '-'}
              </td>
              <td className="px-4 py-2 text-sm text-right text-red-600">
                {entry.payment > 0 ? formatCurrency(entry.payment) : '-'}
              </td>
              <td className="px-4 py-2 text-sm text-right font-medium">{formatCurrency(entry.balance)}</td>
              <td className="px-4 py-2 text-sm text-center capitalize">{entry.mode}</td>
              <td className="px-4 py-2 text-center">
                <button onClick={() => onDelete(entry.id)} className="text-red-500 hover:text-red-700">
                  <Trash className="w-4 h-4" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
});
CashBookTable.displayName = 'CashBookTable';