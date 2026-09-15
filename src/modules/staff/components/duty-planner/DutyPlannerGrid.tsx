import { memo, useState } from 'react';
import { getShiftConfigsForRole } from '../../services/staffService';
import { getCoreDutyRole } from '../../services/dutyRules';
import { isDateLocked } from '../../hooks/useDutyPlanner';
import TableLoading from '../common/TableLoading';
import { useDutyPlannerText } from '../../hooks/useDutyPlannerText';
import { dutyDisplayValue } from '../../i18n/dutyPlannerCopy';
import { countDutyCells, dutyDisplayName, formatDutyWeekday, getDutyLabel, todayStr, type DutyReportCell, type DutyReportEmployee } from '../../services/dutyReport';

interface Props {
  employees: DutyReportEmployee[];
  /** Date columns to render (may be date-filtered). */
  weekDays: string[];
  getDutyCell: (employeeId: number, date: string) => DutyReportCell | undefined;
  onCellClick: (employeeId: number, date: string) => void;
  loading: boolean;
  weekLocked?: boolean;
  /** Days counted in the Duty Count column — defaults to `weekDays`. Kept at
   *  the full week so the count stays correct while columns are filtered. */
  countDays?: string[];
  /** `employeeId:date` keys of cells with no duty, leave or automatic duty —
   *  rendered amber so the gaps are visible while scrolling. */
  pendingDates?: Set<string>;
  /** Drag & drop: move a duty cell to another day/employee (swaps when the
   *  target already holds a duty). */
  onDropDuty?: (source: { employeeId: number; date: string }, target: { employeeId: number; date: string }) => void;
}

function DutyPlannerGrid({ employees, weekDays, getDutyCell, onCellClick, loading, weekLocked = false, countDays, pendingDates, onDropDuty }: Props) {
  const { language, t } = useDutyPlannerText();
  const asOf = todayStr();
  // Drag & drop state: the cell being dragged and the cell under the pointer.
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [overKey, setOverKey] = useState<string | null>(null);
  if (loading) return <TableLoading label={t('loading')} />;
  if (!employees.length) return <div className="p-10 text-center text-sm text-slate-500">{t('noEmployees')}</div>;
  return (
    <div className="overflow-x-auto">
      <table aria-label={t('weekTable')} className="min-w-full divide-y divide-slate-200 text-xs">
        <thead className="bg-slate-50 text-slate-500">
          <tr>
            <th scope="col" className="sticky left-0 z-20 min-w-[180px] border-r border-slate-200 bg-slate-50 px-4 py-3 text-left font-semibold">{t('employee')}</th>
            {weekDays.map((date) => (
              <th key={date} scope="col" className="min-w-[100px] px-2 py-3 text-center font-medium">
                <div>{formatDutyWeekday(date, language)}</div>
                <div className="mt-0.5 text-sm font-semibold text-slate-700">{date.slice(-2)}</div>
              </th>
            ))}
            <th scope="col" className="sticky right-0 z-20 min-w-[85px] border-l border-emerald-100 bg-emerald-50 px-3 py-3 font-semibold text-emerald-800">{t('dutyCount')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {employees.map((employee) => {
            const cells = (countDays ?? weekDays).map((date) => getDutyCell(employee.id, date)).filter((cell): cell is DutyReportCell => !!cell);
            return (
              <tr key={employee.id}>
                <td className="sticky left-0 z-10 min-w-[180px] border-r border-slate-200 bg-white px-4 py-3 text-left">
                  <div className="flex flex-col gap-0.5"><span className="text-[13px] font-semibold text-slate-900">{dutyDisplayName(employee, language)}</span><span className="text-[11px] text-slate-400">{dutyDisplayValue(employee.role, language)}</span></div>
                </td>
                {weekDays.map((date) => {
                  const cell = getDutyCell(employee.id, date);
                  const future = date > asOf;
                  const empty = future || !cell?.dutyType;
                  const pending = empty && (pendingDates?.has(`${employee.id}:${date}`) ?? false);
                  const config = getShiftConfigsForRole(getCoreDutyRole(employee.role) ?? undefined).find((item) => item.type === cell?.dutyType);
                  const colors = pending ? 'border-dashed border-amber-300 bg-amber-50/70 text-amber-600'
                    : empty ? 'border-dotted border-slate-300 bg-slate-50/40 text-transparent'
                    : config ? `${config.bgColor} ${config.borderColor} ${config.textColor}` : 'border-violet-200 bg-violet-50 text-violet-700';
                  const locked = future || weekLocked || isDateLocked(date) || !!cell?.isLeave;
                  const label = future ? t('future') : cell?.isLeave ? t('approvedLeave') : getDutyLabel(cell?.dutyType ?? null, language);
                  const key = `${employee.id}:${date}`;
                  const draggable = !!onDropDuty && !locked && !!cell?.dutyType;
                  return (
                    <td key={date} data-date={date} data-empty={empty} data-pending={pending || undefined} className="min-w-[100px] px-1.5 py-1.5 text-center">
                      <button
                        type="button"
                        onClick={() => onCellClick(employee.id, date)}
                        disabled={locked}
                        draggable={draggable || undefined}
                        onDragStart={draggable ? (event) => {
                          event.dataTransfer.effectAllowed = 'move';
                          event.dataTransfer.setData('text/plain', key);
                          setDragKey(key);
                        } : undefined}
                        onDragEnd={() => { setDragKey(null); setOverKey(null); }}
                        onDragOver={(event) => {
                          if (!onDropDuty || locked || !dragKey) return;
                          event.preventDefault();
                          event.dataTransfer.dropEffect = 'move';
                          if (overKey !== key) setOverKey(key);
                        }}
                        onDragLeave={() => { if (overKey === key) setOverKey(null); }}
                        onDrop={(event) => {
                          event.preventDefault();
                          const sourceKey = event.dataTransfer.getData('text/plain') || dragKey;
                          setDragKey(null);
                          setOverKey(null);
                          if (!onDropDuty || !sourceKey || sourceKey === key) return;
                          const [employeeId, ...rest] = sourceKey.split(':');
                          onDropDuty({ employeeId: Number(employeeId), date: rest.join(':') }, { employeeId: employee.id, date });
                        }}
                        aria-label={`${dutyDisplayName(employee, language)} · ${date} · ${label}${pending ? ` · ${t('pendingCell')}` : ''}`}
                        className={`min-h-10 w-full rounded-lg border px-2 py-1 text-xs font-medium transition-colors ${colors} ${locked ? 'cursor-default' : 'hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300'} ${draggable ? 'cursor-grab active:cursor-grabbing' : ''} ${dragKey === key ? 'opacity-40' : ''} ${overKey === key ? 'ring-2 ring-emerald-400 ring-offset-1' : ''}`}
                      >{empty ? (pending ? '—' : null) : getDutyLabel(cell?.dutyType ?? null, language)}</button>
                    </td>
                  );
                })}
                <td className="sticky right-0 z-10 border-l border-emerald-100 bg-emerald-50 px-3 py-3 text-center text-sm font-semibold tabular-nums text-emerald-800">{countDutyCells(cells, asOf).duty}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
export default memo(DutyPlannerGrid);
