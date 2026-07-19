import { memo } from 'react';
import StatusBadge from './StatusBadge';

interface AttendanceMatrixProps {
  employees: any[];
  dayNumbers: number[];
  getEmployeeRecord: (employeeId: number) => any;
  updateDayStatus: (employeeId: number, day: string, status: 'P' | 'A' | 'H' | 'L' | 'WO') => void;
  loading: boolean; // ✅ removed getStatusColor
}

function AttendanceMatrix({
  employees,
  dayNumbers,
  getEmployeeRecord,
  updateDayStatus,
  loading,
}: AttendanceMatrixProps) {
  if (loading) {
    return <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500">Loading...</div>;
  }

  if (employees.length === 0) {
    return <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500">No employees match filters.</div>;
  }

  const statusOptions: ('P' | 'A' | 'H' | 'L' | 'WO')[] = ['P', 'A', 'H', 'L', 'WO'];

  // Handle cell click: cycle through statuses
  const handleCellClick = (employeeId: number, day: string) => {
    const record = getEmployeeRecord(employeeId);
    const currentStatus = record[day] || '';
    const currentIndex = statusOptions.indexOf(currentStatus as any);
    const nextIndex = (currentIndex + 1) % statusOptions.length;
    const nextStatus = statusOptions[nextIndex];
    updateDayStatus(employeeId, day, nextStatus);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="sticky left-0 bg-slate-50 px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase z-10 min-w-[120px]">
                Employee
              </th>
              {dayNumbers.map((day) => (
                <th key={day} className="px-1 py-3 text-center text-xs font-medium text-slate-500 w-10">
                  {day}
                </th>
              ))}
              <th className="px-2 py-3 text-center text-xs font-medium text-slate-500">P</th>
              <th className="px-2 py-3 text-center text-xs font-medium text-slate-500">A</th>
              <th className="px-2 py-3 text-center text-xs font-medium text-slate-500">L</th>
              <th className="px-2 py-3 text-center text-xs font-medium text-slate-500">H</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {employees.map((emp) => {
              const record = getEmployeeRecord(emp.id);
              return (
                <tr key={emp.id} className="hover:bg-slate-50 transition-colors">
                  <td className="sticky left-0 bg-white px-4 py-2 text-sm font-medium text-slate-800 whitespace-nowrap z-10">
                    {emp.employeeName}
                    <span className="block text-xs text-slate-400">{emp.role}</span>
                  </td>
                  {dayNumbers.map((day) => {
                    const status = record[day] || '';
                    return (
                      <td key={day} className="px-1 py-1 text-center">
                        <StatusBadge
                          status={status}
                          onClick={() => handleCellClick(emp.id, String(day))}
                          size="sm"
                        />
                      </td>
                    );
                  })}
                  <td className="px-2 py-2 text-center text-sm font-medium text-green-600">
                    {record.presentCount || 0}
                  </td>
                  <td className="px-2 py-2 text-center text-sm font-medium text-red-600">
                    {record.absentCount || 0}
                  </td>
                  <td className="px-2 py-2 text-center text-sm font-medium text-blue-600">
                    {record.leaveCount || 0}
                  </td>
                  <td className="px-2 py-2 text-center text-sm font-medium text-amber-600">
                    {record.halfDayCount || 0}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-2 border-t border-slate-200 text-xs text-slate-500 flex items-center gap-4">
        <span>Click a cell to cycle: <span className="inline-block w-3 h-3 rounded-full bg-green-500 align-middle"></span> P</span>
        <span><span className="inline-block w-3 h-3 rounded-full bg-red-500 align-middle"></span> A</span>
        <span><span className="inline-block w-3 h-3 rounded-full bg-amber-500 align-middle"></span> H</span>
        <span><span className="inline-block w-3 h-3 rounded-full bg-blue-500 align-middle"></span> L</span>
        <span><span className="inline-block w-3 h-3 rounded-full bg-slate-300 align-middle"></span> WO</span>
      </div>
    </div>
  );
}

export default memo(AttendanceMatrix);