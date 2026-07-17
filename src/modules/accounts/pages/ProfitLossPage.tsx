import { useState, useMemo } from 'react';
import { format, parseISO, subMonths } from 'date-fns';
import { getFarmerPurchases, getOtherExpenses } from '../services/storage';
import { ProfitTrendChart, ExpenseBreakdownDonut, SalesVsPurchaseBar } from '../components/profit-loss';
import { formatCurrency } from '../utils/formatters';

// Helpers
const getFuelExpenses = (): any[] => {
  try {
    return JSON.parse(localStorage.getItem('dmr-fuel-expenses') || '[]');
  } catch {
    return [];
  }
};

const getShopSales = (): any[] => {
  try {
    return JSON.parse(localStorage.getItem('shopSales') || '[]');
  } catch {
    return [];
  }
};

const ProfitLossPage = () => {
  const [month, setMonth] = useState(format(new Date(), 'yyyy-MM'));

  // Fetch data for selected month
  const purchases = getFarmerPurchases().filter(p => p.date.startsWith(month));
  const fuelExpenses = getFuelExpenses().filter((e: any) => e.date?.startsWith(month) && e.status === 'Approved');
  const otherExpenses = getOtherExpenses().filter(e => e.date.startsWith(month));
  const sales = getShopSales().filter((s: any) => s.tripDate?.startsWith(month) || s.date?.startsWith(month));

  const totalPurchase = purchases.reduce((sum, p) => sum + p.amount, 0);
  const totalFuel = fuelExpenses.reduce((sum: number, e: any) => sum + (e.amount || 0), 0);
  const totalOther = otherExpenses.reduce((sum, e) => sum + e.amount, 0);
  const totalExpenses = totalFuel + totalOther;
  const totalSales = sales.reduce((sum: number, s: any) => sum + (s.amount || 0), 0);
  const grossProfit = totalSales - totalPurchase;
  const netProfit = grossProfit - totalExpenses;
  const netProfitMargin = totalSales > 0 ? (netProfit / totalSales) * 100 : 0;

  // Monthly trend (last 6 months)
  const trendData = useMemo(() => {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const m = subMonths(parseISO(month + '-01'), i);
      const key = format(m, 'yyyy-MM');
      const salesMonth = getShopSales().filter((s: any) => s.tripDate?.startsWith(key) || s.date?.startsWith(key));
      const purchaseMonth = getFarmerPurchases().filter(p => p.date.startsWith(key));
      const fuelMonth = getFuelExpenses().filter((e: any) => e.date?.startsWith(key) && e.status === 'Approved');
      const otherMonth = getOtherExpenses().filter(e => e.date.startsWith(key));
      const totalSales = salesMonth.reduce((sum: number, s: any) => sum + (s.amount || 0), 0);
      const totalPurchase = purchaseMonth.reduce((sum, p) => sum + p.amount, 0);
      const totalExp = fuelMonth.reduce((sum: number, e: any) => sum + (e.amount || 0), 0) + otherMonth.reduce((sum, e) => sum + e.amount, 0);
      const profit = totalSales - totalPurchase - totalExp;
      months.push({
        month: format(parseISO(key + '-01'), 'MMM'),
        sales: totalSales,
        purchase: totalPurchase,
        expenses: totalExp,
        profit,
      });
    }
    return months;
  }, [month]);

  // Expense breakdown for donut
  const expenseCategories = useMemo(() => {
    const categories: Record<string, number> = {};
    otherExpenses.forEach(e => {
      categories[e.category] = (categories[e.category] || 0) + e.amount;
    });
    categories['Fuel'] = totalFuel;
    return Object.entries(categories).map(([name, value]) => ({ name, value }));
  }, [otherExpenses, totalFuel]);

  // Top expense categories
  const topExpenses = expenseCategories.sort((a, b) => b.value - a.value).slice(0, 5);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Profit & Loss</h1>
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="border rounded px-3 py-1"
        />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded shadow border">
          <div className="text-sm text-gray-500">Total Purchase</div>
          <div className="text-xl font-bold text-red-600">{formatCurrency(totalPurchase)}</div>
        </div>
        <div className="bg-white p-4 rounded shadow border">
          <div className="text-sm text-gray-500">Total Expenses</div>
          <div className="text-xl font-bold text-red-600">{formatCurrency(totalExpenses)}</div>
        </div>
        <div className="bg-white p-4 rounded shadow border">
          <div className="text-sm text-gray-500">Gross Profit</div>
          <div className="text-xl font-bold text-green-600">{formatCurrency(grossProfit)}</div>
        </div>
        <div className="bg-white p-4 rounded shadow border">
          <div className="text-sm text-gray-500">Net Profit</div>
          <div className={`text-xl font-bold ${netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatCurrency(netProfit)}
          </div>
          <div className="text-xs text-gray-400">Margin: {netProfitMargin.toFixed(2)}%</div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ProfitTrendChart data={trendData.map(d => ({ month: d.month, profit: d.profit }))} />
        <ExpenseBreakdownDonut data={expenseCategories} />
      </div>

      <div className="mt-6">
        <SalesVsPurchaseBar data={trendData.map(d => ({ month: d.month, sales: d.sales, purchase: d.purchase }))} />
      </div>

      {/* Top Expense Categories Table */}
      <div className="mt-6 bg-white rounded shadow border p-4">
        <h3 className="text-sm font-semibold mb-2">Top Expense Categories</h3>
        <table className="min-w-full">
          <thead>
            <tr className="border-b">
              <th className="text-left py-1 text-xs font-medium text-gray-500">Category</th>
              <th className="text-right py-1 text-xs font-medium text-gray-500">Amount</th>
            </tr>
          </thead>
          <tbody>
            {topExpenses.map((item, idx) => (
              <tr key={idx} className="border-b border-gray-100">
                <td className="py-1 text-sm">{item.name}</td>
                <td className="py-1 text-sm text-right">{formatCurrency(item.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ProfitLossPage;