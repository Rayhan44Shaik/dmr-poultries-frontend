import { memo } from 'react';
import type { FarmerPurchase } from '../../types';
import { formatDate, formatCurrency } from '../../utils/formatters';
import { Eye, Printer } from 'lucide-react';

interface FarmerPaymentTableProps {
  purchases: FarmerPurchase[];
  onPay: (purchase: FarmerPurchase) => void;
  getFarmName: (farmId: string) => string;
}

export const FarmerPaymentTable = memo(({ purchases, onPay, getFarmName }: FarmerPaymentTableProps) => {
  if (purchases.length === 0) {
    return <div className="text-center text-gray-400 py-4">No purchases found</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Farm</th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Purchase</th>
            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Paid</th>
            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Balance</th>
            <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
            <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {purchases.map((purchase) => {
            const balance = purchase.amount - purchase.paidAmount;
            return (
              <tr key={purchase.id}>
                <td className="px-4 py-2 text-sm">{getFarmName(purchase.farmId)}</td>
                <td className="px-4 py-2 text-sm">{formatDate(purchase.date)}</td>
                <td className="px-4 py-2 text-sm text-right">{formatCurrency(purchase.amount)}</td>
                <td className="px-4 py-2 text-sm text-right text-green-600">{formatCurrency(purchase.paidAmount)}</td>
                <td className="px-4 py-2 text-sm text-right text-red-600">{formatCurrency(balance)}</td>
                <td className="px-4 py-2 text-sm text-center">
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    purchase.status === 'Paid' ? 'bg-green-100 text-green-800' :
                    purchase.status === 'Partial' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {purchase.status}
                  </span>
                </td>
                <td className="px-4 py-2 text-center space-x-1">
                  <button className="text-blue-600 hover:text-blue-800" title="View">
                    <Eye className="w-4 h-4" />
                  </button>
                  <button className="text-gray-600 hover:text-gray-800" title="Receipt">
                    <Printer className="w-4 h-4" />
                  </button>
                  {balance > 0 && (
                    <button
                      onClick={() => onPay(purchase)}
                      className="text-green-600 hover:text-green-800 text-sm"
                    >
                      Pay
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
});
FarmerPaymentTable.displayName = 'FarmerPaymentTable';