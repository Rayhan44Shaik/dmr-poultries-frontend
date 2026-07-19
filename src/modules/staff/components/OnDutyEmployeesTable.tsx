import { memo, useState, useMemo } from 'react';
import { User, CheckCircle, Clock } from 'lucide-react'; // ✅ Removed Truck, MapPin

interface OnDutyEmployee {
  id: number;
  name: string;
  role: string;
  dutyType: string;
  vehicle: string;
  status: 'Active' | 'Delayed';
  avatar?: string;
}

interface OnDutyEmployeesTableProps {
  employees: OnDutyEmployee[];
}

const PAGE_SIZE = 5;

function OnDutyEmployeesTable({ employees }: OnDutyEmployeesTableProps) {
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.ceil(employees.length / PAGE_SIZE);
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return employees.slice(start, start + PAGE_SIZE);
  }, [employees, currentPage]);

  if (employees.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-700 mb-3 text-center">
          On Duty Employees Today
        </h3>
        <div className="text-center text-slate-500 py-6">No employees on duty today.</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-700 mb-3 text-center">
        On Duty Employees Today
      </h3>

      <div className="overflow-x-auto -mx-4 sm:mx-0">
        <div className="inline-block min-w-full align-middle">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Employee</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Role</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Duty</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Vehicle</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {paginated.map((emp) => (
                <tr key={emp.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-3 py-2 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 text-xs font-medium">
                        {emp.avatar ? (
                          <img src={emp.avatar} alt={emp.name} className="w-full h-full rounded-full object-cover" />
                        ) : (
                          <User size={14} />
                        )}
                      </div>
                      <span className="text-sm font-medium text-slate-800">{emp.name}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-sm text-slate-600">{emp.role}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-sm text-slate-600">{emp.dutyType}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-sm text-slate-600">{emp.vehicle}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                        emp.status === 'Active'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {emp.status === 'Active' ? (
                        <CheckCircle size={12} />
                      ) : (
                        <Clock size={12} />
                      )}
                      {emp.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-3 text-xs">
          <span className="text-slate-500">
            Showing {((currentPage - 1) * PAGE_SIZE) + 1}–{Math.min(currentPage * PAGE_SIZE, employees.length)} of {employees.length}
          </span>
          <div className="flex gap-1">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              className="px-2 py-1 rounded border border-slate-300 disabled:opacity-40 hover:bg-slate-100 transition"
            >
              Previous
            </button>
            <span className="px-2 py-1 text-slate-600">Page {currentPage}</span>
            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              className="px-2 py-1 rounded border border-slate-300 disabled:opacity-40 hover:bg-slate-100 transition"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(OnDutyEmployeesTable);