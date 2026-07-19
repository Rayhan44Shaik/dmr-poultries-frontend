import { memo } from 'react';
import { FileText, Users, Calendar, Clock, DollarSign, CreditCard, BarChart3, ClipboardList } from 'lucide-react';

interface ReportTilesProps {
  reportType: string;
  onSelect: (type: string) => void;
}

const tiles = [
  { id: 'employees', label: 'Employee List', icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
  { id: 'attendance', label: 'Attendance Report', icon: Calendar, color: 'text-green-600', bg: 'bg-green-50' },
  { id: 'duty-planner', label: 'Duty Planner', icon: ClipboardList, color: 'text-indigo-600', bg: 'bg-indigo-50' },
  { id: 'leave', label: 'Leave Report', icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
  { id: 'salary', label: 'Salary Report', icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  { id: 'salary-register', label: 'Salary Register', icon: CreditCard, color: 'text-purple-600', bg: 'bg-purple-50' },
  { id: 'advance-loan', label: 'Advance & Loan', icon: FileText, color: 'text-rose-600', bg: 'bg-rose-50' },
  { id: 'performance', label: 'Performance Report', icon: BarChart3, color: 'text-cyan-600', bg: 'bg-cyan-50' },
];

function ReportTiles({ reportType, onSelect }: ReportTilesProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
      {tiles.map((tile) => {
        const Icon = tile.icon;
        const isActive = reportType === tile.id;
        return (
          <button
            key={tile.id}
            onClick={() => onSelect(tile.id)}
            className={`p-4 rounded-xl border transition-all duration-200 text-left ${
              isActive
                ? `${tile.bg} border-${tile.color.replace('text-', 'border-')} shadow-md`
                : 'bg-white border-slate-200 hover:shadow-md hover:border-slate-300'
            }`}
          >
            <div className={`${tile.bg} p-2 rounded-lg inline-block ${isActive ? '' : 'bg-slate-50'}`}>
              <Icon className={`w-5 h-5 ${isActive ? tile.color : 'text-slate-500'}`} />
            </div>
            <p className={`mt-2 text-sm font-medium ${isActive ? 'text-slate-800' : 'text-slate-600'}`}>
              {tile.label}
            </p>
          </button>
        );
      })}
    </div>
  );
}

export default memo(ReportTiles);