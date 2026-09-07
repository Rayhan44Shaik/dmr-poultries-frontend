import { useMemo } from 'react';
import { getShiftConfigsForRole } from '../../services/staffService';
import {
  DUTY_COUNT_COLUMNS, formatDutyDate, getDutyLabel, summarizeDutyReport,
  type DutyReportData, type DutyReportEmployee,
} from '../../services/dutyReport';

interface Props {
  data: DutyReportData;
  employees: DutyReportEmployee[];
  asOf: string;
}

/** Read-only month/custom-range matrix. Its rows and counts are exactly the
 * ones sent to Excel; date columns never reset at month or year boundaries. */
export default function DutyPlannerReportTable({ data, employees, asOf }: Props) {
  const summary = useMemo(() => summarizeDutyReport(data, employees, asOf), [data, employees, asOf]);
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-xs" aria-label="Duty Planner date matrix">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th scope="col" className="sticky left-0 z-20 min-w-[190px] border-r border-slate-200 bg-slate-50 px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Employee
              </th>
              {data.days.map((day) => (
                <th key={day.date} scope="col" className="min-w-[106px] px-2 py-2 text-center">
                  <div className="text-[10px] font-medium text-slate-400">{day.weekday}</div>
                  <div className="whitespace-nowrap text-[11px] font-semibold text-slate-600">{formatDutyDate(day.date)}</div>
                </th>
              ))}
              {DUTY_COUNT_COLUMNS.map(({ key, label }) => (
                <th key={key} scope="col" className={`min-w-[85px] whitespace-nowrap px-3 py-3 text-center text-[11px] font-semibold uppercase tracking-wide ${key === 'duty' ? 'sticky right-0 z-20 border-l border-emerald-200 bg-emerald-50 text-emerald-800' : 'text-slate-500'}`}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {!employees.length && (
              <tr><td colSpan={data.days.length + DUTY_COUNT_COLUMNS.length + 1} className="px-4 py-12 text-center text-sm text-slate-500">No employees match the selected filters.</td></tr>
            )}
            {employees.map((employee) => (
              <tr key={employee.id}>
                <th scope="row" className="sticky left-0 z-10 border-r border-slate-200 bg-white px-4 py-3 text-left">
                  <div className="max-w-[240px] font-semibold text-slate-800">{employee.employeeName}</div>
                  <div className="mt-0.5 text-[10px] font-normal text-slate-400">{employee.employeeNo != null ? `#${employee.employeeNo} · ` : ''}{employee.role}</div>
                </th>
                {data.byEmployee[employee.id].map((cell) => {
                  const future = cell.date > asOf;
                  const config = getShiftConfigsForRole(employee.role).find((shift) => shift.type === cell.dutyType);
                  const colors = future ? 'border-dashed border-slate-200 bg-slate-50 text-slate-400'
                    : config ? `${config.bgColor} ${config.borderColor} ${config.textColor}`
                      : cell.dutyType ? 'border-violet-200 bg-violet-50 text-violet-700'
                        : 'border-slate-100 bg-white text-slate-400';
                  return (
                    <td key={cell.date} className="px-1 py-1.5">
                      <div
                        title={`${employee.employeeName} — ${cell.date}: ${cell.dutyType ? getDutyLabel(cell.dutyType) : future ? 'Not yet completed' : 'No Entry'}${cell.isLeave ? ' (approved leave; any assignment takes precedence)' : ''}${future ? ' — not counted yet' : ''}`}
                        className={`flex min-h-9 flex-col items-center justify-center rounded border px-2 py-1 text-center text-[11px] font-medium ${colors}`}
                      >
                        {future && !cell.dutyType ? '—' : getDutyLabel(cell.dutyType)}
                        {future && cell.dutyType && <span className="text-[9px] font-normal">Planned</span>}
                      </div>
                    </td>
                  );
                })}
                {DUTY_COUNT_COLUMNS.map(({ key }) => (
                  <td key={key} className={`px-3 py-3 text-center font-semibold tabular-nums ${key === 'duty' ? 'sticky right-0 z-10 border-l border-emerald-100 bg-emerald-50 text-sm text-emerald-800' : 'text-slate-600'}`}>
                    {summary.byEmployee[employee.id][key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {employees.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-emerald-200 bg-emerald-50 font-semibold text-emerald-900">
                <th scope="row" className="sticky left-0 z-10 border-r border-emerald-200 bg-emerald-50 px-4 py-3 text-left text-[11px] uppercase">Grand total / daily duty</th>
                {data.days.map(({ date }) => <td key={date} className="px-2 py-3 text-center tabular-nums">{date <= asOf ? summary.dailyDuty[date] : '—'}</td>)}
                {DUTY_COUNT_COLUMNS.map(({ key }) => (
                  <td key={key} className={`px-3 py-3 text-center tabular-nums ${key === 'duty' ? 'sticky right-0 z-10 border-l border-emerald-200 bg-emerald-100 text-sm' : ''}`}>
                    {summary.totals[key]}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <p className="border-t border-slate-100 px-4 py-3 text-[11px] leading-relaxed text-slate-500">
        <strong className="font-semibold text-slate-700">Duty Count</strong> includes duty, driver, repair, office, collection and custom work duties through {formatDutyDate(asOf)}.
        {' '}Leave, off and weekly off are counted separately. Future days are not counted. An assigned duty overrides an approved leave.
      </p>
    </div>
  );
}
