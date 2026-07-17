import { memo, useMemo } from 'react';
import { getOtherExpenses } from '../../services/storage';
import { formatDate, formatCurrency } from '../../utils/formatters';

export const RecentExpenses = memo(() => {
  const expenses = useMemo(() => {
    return getOtherExpenses()
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 5);
  }, []);

  return (
    <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
      <h3 className="text-sm font-semibold mb-3">Recent Expenses</h3>
      <div className="space-y-2">
        {expenses.map((exp) => (
          <div key={exp.id} className="flex justify-between text-sm border-b border-gray-100 py-1">
            <span>
              {exp.description} <span className="text-gray-400 text-xs">({exp.category})</span>
              <span className="ml-2 text-gray-400 text-xs">{formatDate(exp.date)}</span>
            </span>
            <span className="font-medium">{formatCurrency(exp.amount)}</span>
          </div>
        ))}
        {expenses.length === 0 && <div className="text-gray-400 text-sm">No recent expenses</div>}
      </div>
    </div>
  );
});
RecentExpenses.displayName = 'RecentExpenses';