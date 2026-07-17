import { memo } from 'react';
import { formatCurrency } from '../../utils/formatters';

interface EMITableProps {
  loans: any[];
  emiMap: Record<string, any>;
  onPay: (loanId: string, dueDate: string) => void;
}

export const EMITable = memo(({ loans, emiMap, onPay }: EMITableProps) => {
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

  const vehicles = getVehicles();
  const banks = getBanks();

  if (loans.length === 0) {
    return <div className="text-center text-gray-400 py-4">No loans</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Vehicle</th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Bank</th>
            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">EMI Amount</th>
            <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Due Date</th>
            <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
            <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {loans.map((loan: any) => {
            const vehicle = vehicles.find((v: any) => v.id === loan.vehicleId);
            const bank = banks.find((b: any) => b.id === loan.bankId);
            const emi = emiMap[loan.id];
            const status = emi?.status || 'Upcoming';
            const dueDate = emi?.dueDate || loan.nextDueDate;
            return (
              <tr key={loan.id}>
                <td className="px-4 py-2 text-sm">{vehicle?.vehicleNumber || 'Unknown'}</td>
                <td className="px-4 py-2 text-sm">{bank?.bankName || 'N/A'}</td>
                <td className="px-4 py-2 text-sm text-right">{formatCurrency(loan.emiAmount)}</td>
                <td className="px-4 py-2 text-sm text-center">{dueDate}</td>
                <td className="px-4 py-2 text-sm text-center">
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    status === 'Paid' ? 'bg-green-100 text-green-800' :
                    status === 'Pending' ? 'bg-red-100 text-red-800' :
                    'bg-blue-100 text-blue-800'
                  }`}>
                    {status}
                  </span>
                </td>
                <td className="px-4 py-2 text-center">
                  {status !== 'Paid' && (
                    <button
                      onClick={() => onPay(loan.id, dueDate)}
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
EMITable.displayName = 'EMITable';