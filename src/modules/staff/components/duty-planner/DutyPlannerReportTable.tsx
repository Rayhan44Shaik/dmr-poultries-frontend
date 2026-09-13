import { useMemo } from 'react';
import { getShiftConfigsForRole } from '../../services/staffService';
import { getCoreDutyRole } from '../../services/dutyRules';
import { useDutyPlannerText } from '../../hooks/useDutyPlannerText';
import { dutyDisplayValue } from '../../i18n/dutyPlannerCopy';
import { DUTY_COUNT_COLUMNS, formatDutyDate, formatDutyWeekday, getDutyCountLabel, getDutyLabel, summarizeDutyReport, type DutyReportData, type DutyReportEmployee } from '../../services/dutyReport';

interface Props {
  data: DutyReportData;
  employees: DutyReportEmployee[];
  asOf: string;
  /** Date columns to render; defaults to every day in `data`. Summary count
   *  columns always reflect the full range, even when columns are filtered. */
  dates?: string[];
}

export default function DutyPlannerReportTable({ data, employees, asOf, dates }: Props) {
  const { language, t } = useDutyPlannerText();
  const summary = useMemo(() => summarizeDutyReport(data, employees, asOf), [data, employees, asOf]);
  const visibleSet = useMemo(() => (dates ? new Set(dates) : undefined), [dates]);
  const days = useMemo(
    () => (visibleSet ? data.days.filter((day) => visibleSet.has(day.date)) : data.days),
    [data.days, visibleSet],
  );
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs" aria-label={t('dateTable')}>
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th scope="col" className="sticky left-0 z-20 min-w-[190px] border-r border-slate-200 bg-slate-50 px-4 py-3 text-left text-[11px] font-semibold text-slate-500">{t('employee')}</th>
              {days.map((day) => (
                <th key={day.date} scope="col" className="min-w-[106px] px-2 py-2 text-center">
                  <div className="text-[10px] font-medium text-slate-400">{formatDutyWeekday(day.date, language)}</div>
                  <div className="whitespace-nowrap text-[11px] font-semibold text-slate-600">{formatDutyDate(day.date, language)}</div>
                </th>
              ))}
              {DUTY_COUNT_COLUMNS.map(({ key }) => (
                <th key={key} scope="col" className={`min-w-[85px] px-3 py-3 text-center text-[11px] font-semibold ${key === 'duty' ? 'sticky right-0 z-20 border-l border-emerald-200 bg-emerald-50 text-emerald-800' : 'text-slate-500'}`}>{getDutyCountLabel(key, language)}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {!employees.length && <tr><td colSpan={days.length + DUTY_COUNT_COLUMNS.length + 1} className="px-4 py-10 text-center text-sm text-slate-500">{t('noEmployees')}</td></tr>}
            {employees.map((employee) => (
              <tr key={employee.id}>
                <th scope="row" className="sticky left-0 z-10 border-r border-slate-200 bg-white px-4 py-3 text-left">
                  <div className="max-w-[240px] font-semibold text-slate-800">{employee.employeeName}</div>
                  <div className="mt-0.5 text-[10px] font-normal text-slate-400">{employee.employeeNo != null ? `#${employee.employeeNo} · ` : ''}{dutyDisplayValue(employee.role, language)}</div>
                </th>
                {(visibleSet ? data.byEmployee[employee.id].filter((cell) => visibleSet.has(cell.date)) : data.byEmployee[employee.id]).map((cell) => {
                  const future = cell.date > asOf;
                  const empty = future || !cell.dutyType;
                  const config = getShiftConfigsForRole(getCoreDutyRole(employee.role) ?? undefined).find((shift) => shift.type === cell.dutyType);
                  const colors = empty ? 'border-dotted border-slate-300 bg-slate-50/40 text-transparent'
                    : config ? `${config.bgColor} ${config.borderColor} ${config.textColor}` : 'border-violet-200 bg-violet-50 text-violet-700';
                  const label = future ? t('future') : cell.isLeave ? t('approvedLeave') : getDutyLabel(cell.dutyType, language);
                  return (
                    <td key={cell.date} data-date={cell.date} data-empty={empty} className="px-1 py-1.5">
                      <div title={`${employee.employeeName} · ${cell.date} · ${label}${cell.automatic && !future ? ` · ${t('automaticHint')}` : ''}`} aria-label={`${employee.employeeName} · ${cell.date} · ${label}`} className={`flex min-h-9 items-center justify-center rounded-md border px-2 py-1 text-center font-medium ${language === 'te' ? 'text-xs' : 'text-[11px]'} ${colors}`}>
                        {empty ? null : getDutyLabel(cell.dutyType, language)}
                      </div>
                    </td>
                  );
                })}
                {DUTY_COUNT_COLUMNS.map(({ key }) => <td key={key} className={`px-3 py-3 text-center font-semibold tabular-nums ${key === 'duty' ? 'sticky right-0 z-10 border-l border-emerald-100 bg-emerald-50 text-sm text-emerald-800' : 'text-slate-600'}`}>{summary.byEmployee[employee.id][key]}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
  );
}
