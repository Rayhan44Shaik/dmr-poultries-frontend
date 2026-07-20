import { memo, useState } from 'react';
import { format } from 'date-fns';

interface EmiScheduleTableProps {
  emiRecords: any[];
  vehicles: any[];
  simplified?: boolean;
  pageSize?: number;
}

const EmiScheduleTable = ({ 
  emiRecords, 
  vehicles, 
  simplified = false,
  pageSize = 10 
}: EmiScheduleTableProps) => {
  const [currentPage, setCurrentPage] = useState(1);

  const totalRecords = emiRecords.length;
  const totalPages = Math.ceil(totalRecords / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const currentRecords = emiRecords.slice(startIndex, endIndex);

  const goToPage = (page: number) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
  };

  const getPageNumbers = () => {
    const pages: number[] = [];
    const maxVisible = 5;
    let start = Math.max(1, currentPage - 2);
    let end = Math.min(totalPages, currentPage + 2);

    if (end - start < maxVisible - 1) {
      if (start === 1) end = Math.min(totalPages, start + maxVisible - 1);
      else if (end === totalPages) start = Math.max(1, end - maxVisible + 1);
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  };

  if (!emiRecords || emiRecords.length === 0) {
    return <div className="text-center py-8 text-gray-400 text-sm">No EMI records found.</div>;
  }

  const columns = simplified
    ? ['Vehicle Number', 'Purchased Amount', 'Purchase Date', 'Next EMI Date', 'Last EMI Date', 'Tenure (Months)', 'Paid EMIs', 'Pending EMIs']
    : ['Vehicle', 'Finance Company', 'Loan Amount', 'EMI', 'Start / End', 'Next Due', 'Status'];

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {columns.map((col) => (
                <th
                  key={col}
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {currentRecords.map((emi) => {
              const vehicle = vehicles.find((v) => v.id === emi.vehicleId);
              const vehicleNumber = vehicle?.vehicleNumber || 'Unknown';
              const startDate = new Date(emi.startDate);
              const lastDate = new Date(emi.endDate);
              const tenureMonths = emi.totalEMIs || 0;
              const paid = emi.paidEMIs || 0;
              const pending = tenureMonths - paid;
              const loanAmount = emi.loanAmount || 0;
              const isPaid = emi.status === 'paid';

              return (
                <tr key={emi.id} className="hover:bg-gray-50">
                  {simplified ? (
                    <>
                      <td className="px-4 py-3 text-sm text-gray-700">{vehicleNumber}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">₹{loanAmount.toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{format(startDate, 'dd MMM yyyy')}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {isPaid ? (
                          <span className="text-green-600 font-medium">Completed</span>
                        ) : (
                          format(new Date(emi.nextEMIDate), 'dd MMM yyyy')
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{format(lastDate, 'dd MMM yyyy')}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 text-center">{tenureMonths}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 text-center">{paid}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 text-center">{pending}</td>
                    </>
                  ) : (
                    // Full view (fallback)
                    <>
                      <td className="px-4 py-3 text-sm text-gray-700">{vehicleNumber}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{emi.financeCompany}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">₹{loanAmount.toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">₹{emi.emiAmount.toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {format(startDate, 'dd/MM/yy')} - {format(lastDate, 'dd/MM/yy')}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {isPaid ? 'Completed' : format(new Date(emi.nextEMIDate), 'dd MMM yyyy')}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            emi.status === 'paid'
                              ? 'bg-green-100 text-green-800'
                              : emi.status === 'overdue'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {emi.status}
                        </span>
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-200">
          <div className="text-sm text-gray-500">
            Showing {startIndex + 1} - {Math.min(endIndex, totalRecords)} of {totalRecords}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            {getPageNumbers().map((page) => (
              <button
                key={page}
                onClick={() => goToPage(page)}
                className={`px-3 py-1 text-sm border rounded-md transition-colors ${
                  page === currentPage
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'border-gray-300 hover:bg-gray-50'
                }`}
              >
                {page}
              </button>
            ))}
            <button
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default memo(EmiScheduleTable);