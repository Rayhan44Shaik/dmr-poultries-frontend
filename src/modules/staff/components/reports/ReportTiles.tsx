// src/modules/staff/components/reports/ReportTiles.tsx

import { 
  Users, 
  CalendarDays, 
  Clock, 
  FileSpreadsheet, 
  BarChart3 
} from 'lucide-react';

type ReportTilesProps = {
  reportType: string;
  onSelect: (type: string) => void;
};

export default function ReportTiles({ reportType, onSelect }: ReportTilesProps) {
  const reports = [
    {
      id: 'employee',
      title: 'Employee List',
      description: 'Employee services & active records',
      icon: Users,
      color: 'text-blue-600 bg-blue-50 border-blue-200',
    },
    {
      id: 'duty-planner',
      title: 'Duty Planner',
      description: 'Staff schedules from duty planner',
      icon: CalendarDays,
      color: 'text-indigo-600 bg-indigo-50 border-indigo-200',
    },
    {
      id: 'leave-report',
      title: 'Leave Report',
      description: 'Leave maintenance tracking',
      icon: Clock,
      color: 'text-amber-600 bg-amber-50 border-amber-200',
    },
    {
      id: 'salary-register',
      title: 'Salary Register',
      description: 'Payroll & salary register records',
      icon: FileSpreadsheet,
      color: 'text-emerald-600 bg-emerald-50 border-emerald-200',
    },
    {
      id: 'performance-report',
      title: 'Performance Report',
      description: 'Performance metrics from trips list',
      icon: BarChart3,
      color: 'text-purple-600 bg-purple-50 border-purple-200',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      {reports.map((report) => {
        const Icon = report.icon;
        const isSelected = reportType === report.id;
        return (
          <button
            key={report.id}
            onClick={() => onSelect(report.id)}
            className={`flex items-start gap-3.5 p-4 rounded-xl border text-left transition-all ${
              isSelected
                ? 'bg-blue-50/80 border-blue-500 shadow-sm ring-1 ring-blue-500'
                : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50 shadow-sm'
            }`}
          >
            <div className={`p-2.5 rounded-lg border ${report.color} flex items-center justify-center shrink-0`}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-800 leading-tight">{report.title}</h3>
              <p className="text-xs text-slate-500 mt-1">{report.description}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}