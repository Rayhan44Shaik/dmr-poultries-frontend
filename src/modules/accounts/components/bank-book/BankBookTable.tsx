import { memo } from 'react';
import type { BankBookEntry } from '../../types';
import { formatDate, formatCurrency } from '../../utils/formatters';
import { Trash } from 'lucide-react';

interface BankBookTableProps {
  entries: (BankBookEntry & { balance: number })[];
  onDelete: (id: string) => void;
}

export const BankBookTable = memo(({ entries, onDelete }: BankBookTableProps) => {
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
            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Deposit</th>
            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Withdrawal</th>
            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Balance</th>
            <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {entries.map((entry) => (
            <tr key={entry.id}>
              <td className="px-4 py-2 text-sm">{formatDate(entry.date)}</td>
              <td className="px-4 py-2 text-sm">{entry.particulars}</td>
              <td className="px-4 py-2 text-sm text-right text-green-600">
                {entry.deposit > 0 ? formatCurrency(entry.deposit) : '-'}
              </td>
              <td className="px-4 py-2 text-sm text-right text-red-600">
                {entry.withdrawal > 0 ? formatCurrency(entry.withdrawal) : '-'}
              </td>
              <td className="px-4 py-2 text-sm text-right font-medium">{formatCurrency(entry.balance)}</td>
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
BankBookTable.displayName = 'BankBookTable';