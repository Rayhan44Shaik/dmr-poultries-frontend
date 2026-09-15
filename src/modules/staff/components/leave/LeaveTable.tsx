// src/modules/staff/components/leave/LeaveTable.tsx

import { memo, useRef, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import {
  Check,
  Calendar,
  Hash,
  User,
  Building2,
  CalendarOff,
  CalendarRange,
  Sun,
  MessageSquareText,
  Activity,
} from 'lucide-react';
import type { LeaveRequest } from '../../types/staffDashboard';
import { useI18n } from '../../../../i18n';
import {
  departmentLabel,
  leaveReasonLabel,
  leaveStatusLabel,
  leaveTypeBadge,
  personNameLabel,
} from '../../utils/leaveDisplay';

interface LeaveTableProps {
  leaves: LeaveRequest[];
  /** Currently selected row (single selection), or null. */
  selectedId: string | null;
  /**
   * Row selection is owned by the page, because the action buttons that belong
   * to the selected row live in the filter bar beside Reset — not in a trailing
   * Action column. `null` clears the selection.
   */
  onSelectRow: (leave: LeaveRequest | null) => void;
  /** Enter / double-click on a row — opens that employee's leave history. */
  onOpenRow: (leave: LeaveRequest) => void;
  /** Serial-number offset for the "#" column (page-aware). */
  startIndex?: number;
}

/**
 * Leave request grid — rows only.
 *
 * Deliberately has NO per-row action column: selecting a row lights it up
 * (blue tint + a check glyph in place of the serial number, the Trip List
 * treatment) and the actions for that one row appear in the filter bar next to
 * Reset. One row in focus instead of twenty repeated button clusters.
 *
 * Keyboard model, identical to clicking:
 *   • Tab          — walks into the grid; every row is a tab stop
 *   • ↑ / ↓        — move the selection row by row (Home / End jump to the ends)
 *   • Enter        — open the selected row's history
 *   • Space        — toggle the selection
 *   • Escape       — clear the selection
 */
function LeaveTable({
  leaves,
  selectedId,
  onSelectRow,
  onOpenRow,
  startIndex = 0,
}: LeaveTableProps) {
  const { t, language } = useI18n();
  /** Row elements by leave id — lets ↑/↓ move real DOM focus with the selection. */
  const rowRefs = useRef(new Map<string, HTMLTableRowElement>());

  /** Leave number in the trip-number format: LEV-YYYYMMDD-NNN. */
  const leaveNumber = (leave: LeaveRequest) => {
    if (leave.leaveNo) return leave.leaveNo;
    const month = leave.createdAt.slice(0, 7).replace('-', '') || 'UNKNOWN';
    const compactId = leave.id.replace(/-/g, '');
    return `LEV-${month}-${compactId.slice(-12).toUpperCase()}`;
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      Pending: 'bg-amber-100 text-amber-700 border-amber-200',
      Approved: 'bg-emerald-100 text-emerald-700 border-emerald-200',
      Rejected: 'bg-rose-100 text-rose-700 border-rose-200',
      Cancelled: 'bg-slate-100 text-slate-600 border-slate-200',
    };
    return styles[status] || 'bg-slate-100 text-slate-700 border-slate-200';
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      Casual: 'text-blue-600 bg-blue-50',
      Sick: 'text-rose-600 bg-rose-50',
      Emergency: 'text-orange-600 bg-orange-50',
      Annual: 'text-purple-600 bg-purple-50',
    };
    return colors[type] || '';
  };

  /** Move the selection AND the caret so ↑/↓ keep working from the new row. */
  const moveSelection = (leave: LeaveRequest) => {
    onSelectRow(leave);
    rowRefs.current.get(leave.id)?.focus();
  };

  const handleRowKeyDown = (
    event: ReactKeyboardEvent<HTMLTableRowElement>,
    index: number,
    leave: LeaveRequest,
    isSelected: boolean,
  ) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        moveSelection(leaves[Math.min(index + 1, leaves.length - 1)]);
        break;
      case 'ArrowUp':
        event.preventDefault();
        moveSelection(leaves[Math.max(index - 1, 0)]);
        break;
      case 'Home':
        event.preventDefault();
        moveSelection(leaves[0]);
        break;
      case 'End':
        event.preventDefault();
        moveSelection(leaves[leaves.length - 1]);
        break;
      case 'Enter':
        event.preventDefault();
        onOpenRow(leave);
        break;
      case ' ':
        event.preventDefault();
        onSelectRow(isSelected ? null : leave);
        break;
      case 'Escape':
        event.preventDefault();
        onSelectRow(null);
        break;
      default:
        break;
    }
  };

  if (leaves.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
        <p className="text-sm font-medium text-slate-500">{t('staff.leave.empty_title')}</p>
      </div>
    );
  }

  const th = 'px-4 py-3 text-[11px] font-bold uppercase tracking-wider';

  return (
    /* No card chrome here — the page wrapper (border + LeaveTableHeader)
       provides it; this only scrolls the grid. */
    <div className="overflow-x-auto">
      <table
        className="min-w-full text-left text-sm border-collapse"
        aria-label={t('staff.leave.header_title')}
      >
        <thead className="border-b border-slate-200 bg-slate-50/80 text-slate-600">
          <tr className="whitespace-nowrap">
            <th className={`${th} w-10 text-center`}>#</th>
            <th className={`${th} text-left`}>
              <span className="flex items-center gap-1.5">
                <Hash size={13} className="shrink-0 text-slate-400" />
                <span>{t('staff.leave.col_no')}</span>
              </span>
            </th>
            <th className={`${th} text-left`}>
              <span className="flex items-center gap-1.5">
                <User size={13} className="shrink-0 text-emerald-500" />
                <span>{t('common.employee')}</span>
              </span>
            </th>
            <th className={`${th} text-left`}>
              <span className="flex items-center gap-1.5">
                <Building2 size={13} className="shrink-0 text-indigo-500" />
                <span>{t('staff.department')}</span>
              </span>
            </th>
            <th className={`${th} text-left`}>
              <span className="flex items-center gap-1.5">
                <CalendarOff size={13} className="shrink-0 text-purple-500" />
                <span>{t('staff.leave_type')}</span>
              </span>
            </th>
            <th className={`${th} text-left`}>
              <span className="flex items-center gap-1.5">
                <Calendar size={13} className="shrink-0 text-blue-500" />
                <span>{t('common.from')}</span>
              </span>
            </th>
            <th className={`${th} text-left`}>
              <span className="flex items-center gap-1.5">
                <CalendarRange size={13} className="shrink-0 text-cyan-500" />
                <span>{t('common.to')}</span>
              </span>
            </th>
            <th className={`${th} text-center`}>
              <span className="flex items-center justify-center gap-1.5">
                <Sun size={13} className="shrink-0 text-amber-500" />
                <span>{t('common.days')}</span>
              </span>
            </th>
            <th className={`${th} text-left`}>
              <span className="flex items-center gap-1.5">
                <MessageSquareText size={13} className="shrink-0 text-slate-400" />
                <span>{t('staff.leave_reason')}</span>
              </span>
            </th>
            <th className={`${th} text-center`}>
              <span className="flex items-center justify-center gap-1.5">
                <Activity size={13} className="shrink-0 text-sky-500" />
                <span>{t('common.status')}</span>
              </span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {leaves.map((leave, index) => {
            const isSelected = leave.id === selectedId;
            return (
              <tr
                key={leave.id}
                ref={(element) => {
                  if (element) rowRefs.current.set(leave.id, element);
                  else rowRefs.current.delete(leave.id);
                }}
                tabIndex={0}
                aria-selected={isSelected}
                aria-label={t('staff.leave.row_aria', {
                  no: leaveNumber(leave),
                  name: personNameLabel(t, language, leave.employeeName),
                  status: leaveStatusLabel(t, leave.status),
                })}
                onClick={(event) => {
                  // Focus follows the click so ↑/↓ work immediately after a mouse pick.
                  event.currentTarget.focus({ preventScroll: true });
                  onSelectRow(isSelected ? null : leave);
                }}
                onDoubleClick={() => onOpenRow(leave)}
                onKeyDown={(event) => handleRowKeyDown(event, index, leave, isSelected)}
                className={`cursor-pointer outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-300 ${
                  isSelected
                    ? // Trip List treatment, as an inset bar so the row does not shift.
                      'bg-blue-50/70 shadow-[inset_3px_0_0_0_#93c5fd] ring-1 ring-inset ring-blue-200 hover:bg-blue-50'
                    : `hover:bg-slate-50/60 ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/20'}`
                }`}
              >
                <td className="w-10 px-4 py-3 text-center text-xs font-medium text-slate-500">
                  {isSelected ? (
                    <Check size={15} className="mx-auto text-blue-600" aria-hidden="true" />
                  ) : (
                    startIndex + index + 1
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-xs font-bold text-slate-900 tabular-nums">
                  {leaveNumber(leave)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-xs font-medium text-slate-700">
                  {personNameLabel(t, language, leave.employeeName)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600">{leave.department ? departmentLabel(t, leave.department) : t('staff.leave.no_reason')}</td>
                <td className="px-4 py-3">
                  <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${getTypeColor(leave.type)}`}>
                    {leaveTypeBadge(t, leave.type)}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-xs font-medium text-slate-600">{leave.fromDate}</td>
                <td className="whitespace-nowrap px-4 py-3 text-xs font-medium text-slate-600">{leave.toDate}</td>
                <td className="px-4 py-3 text-center text-xs font-bold text-slate-700">{leave.days}</td>
                <td
                  className="max-w-[160px] truncate px-4 py-3 text-xs text-slate-500"
                  title={leave.reason ? leaveReasonLabel(t, language, leave.reason) : undefined}
                >
                  {leave.reason ? leaveReasonLabel(t, language, leave.reason) : t('staff.leave.no_reason')}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-block whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${getStatusBadge(leave.status)}`}>
                    {leaveStatusLabel(t, leave.status)}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default memo(LeaveTable);
