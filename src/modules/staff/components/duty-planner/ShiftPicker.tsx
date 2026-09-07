// src/modules/staff/components/duty-planner/ShiftPicker.tsx

import { memo, useState } from 'react';
import { PenLine, Trash2, X } from 'lucide-react';
import { getShiftConfigsForRole } from '../../services/staffService';

interface ShiftPickerProps {
  isOpen: boolean;
  onClose: () => void;
  /**
   * Apply a duty type. `nextDayDutyType` is only set when the user
   * confirmed the two-day trip flow (Trip Start → also On Trip next day).
   */
  onSelect: (dutyType: string, nextDayDutyType?: string) => void;
  onRemove?: () => void;
  currentDuty?: string;
  date: string;
  employeeName?: string;
  employeeRole?: string;
}

function ShiftPicker({ isOpen, onClose, onSelect, onRemove, currentDuty, date, employeeName, employeeRole }: ShiftPickerProps) {
  const [otherOpen, setOtherOpen] = useState(false);
  const [otherText, setOtherText] = useState('');
  // "Trip Start" first asks whether to also mark the next day as On Trip.
  const [confirmTrip, setConfirmTrip] = useState(false);

  // Reset the transient panels whenever the picker transitions to closed
  // (render-phase state adjustment — the picker can stay mounted after an
  // X/outside-click close and must reopen clean for the next cell).
  const [prevOpen, setPrevOpen] = useState(isOpen);
  if (isOpen !== prevOpen) {
    setPrevOpen(isOpen);
    if (!isOpen) {
      setOtherOpen(false);
      setOtherText('');
      setConfirmTrip(false);
    }
  }

  if (!isOpen) return null;

  // Role-aware options:
  //   Supervisor → Duty, Office, Leave, Weekly Off
  //   Driver/Helper/Loader → Duty, Repair, Office, Leave, Weekly Off
  //   other roles → full list. "Other" (free text) is available to all.
  const shifts = getShiftConfigsForRole(employeeRole);
  const dateObj = new Date(date);
  const isSaturday = dateObj.getDay() === 6;

  const formattedDate = !isNaN(dateObj.getTime())
    ? dateObj.toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' })
    : date;

  const submitOther = () => {
    const value = otherText.trim();
    if (!value) return;
    onSelect(value);
    setOtherOpen(false);
    setOtherText('');
  };

  // Weekday name of the following day (for the two-day trip question).
  const nextDateObj = new Date(date);
  nextDateObj.setDate(nextDateObj.getDate() + 1);
  const nextDayName = !isNaN(nextDateObj.getTime())
    ? nextDateObj.toLocaleDateString('en-IN', { weekday: 'long' })
    : 'next day';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-5 animate-fadeIn border border-slate-100">
        {/* Header — always a single, tidy line: small label + name + role chip */}
        <div className="mb-4">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.09em] text-slate-400">
                Select duty for
              </p>
              <h3 className="mt-0.5 flex items-center gap-2 text-[15px] font-bold leading-snug text-slate-900">
                <span className="truncate">{employeeName || 'Employee'}</span>
                {employeeRole && (
                  <span className="shrink-0 rounded-full bg-slate-100 px-2 py-[3px] text-[10.5px] font-semibold text-slate-500">
                    {employeeRole}
                  </span>
                )}
              </h3>
            </div>
            <button onClick={onClose} className="-mr-1 -mt-1 shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700" aria-label="Close">
              <X size={17} />
            </button>
          </div>
          <p className="mt-1.5 truncate text-xs font-medium text-slate-400">{formattedDate}</p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {shifts.map((shift) => {
            const disabled = isSaturday && (shift.type === 'Rest' || shift.type === 'WeeklyOff');
            return (
              <button
                key={shift.type}
                onClick={() => {
                  if (disabled) return;
                  // Two-day trips: ask about the return day first.
                  if (shift.type === 'TripStart') {
                    setOtherOpen(false);
                    setConfirmTrip(true);
                    return;
                  }
                  onSelect(shift.type);
                }}
                disabled={disabled}
                className={`py-2.5 px-3 rounded-xl border text-sm font-semibold transition hover:shadow-md active:scale-95 ${
                  currentDuty === shift.type ? 'ring-2 ring-blue-500 ring-offset-2' : ''
                } ${shift.bgColor} ${shift.textColor} ${shift.borderColor} ${
                  disabled ? 'opacity-40 cursor-not-allowed' : ''
                }`}
              >
                {shift.label}
                {disabled && <span className="block text-[10px] text-rose-500 font-normal">(Saturday)</span>}
              </button>
            );
          })}

          {/* Other — free-text duty type, available for every role.
              Highlighted when the cell currently holds a custom (non-listed) type. */}
          {(() => {
            const isCustom = Boolean(currentDuty) && !shifts.some((s) => s.type === currentDuty);
            return (
              <button
                onClick={() => setOtherOpen((v) => !v)}
                className={`py-2.5 px-3 rounded-xl border text-sm font-semibold transition hover:shadow-md active:scale-95 flex items-center justify-center gap-1.5 ${
                  isCustom
                    ? 'ring-2 ring-blue-500 ring-offset-2 bg-violet-100 text-violet-700 border-violet-300'
                    : 'bg-violet-50 text-violet-700 border-violet-200'
                }`}
              >
                <PenLine size={14} />
                Other
              </button>
            );
          })()}
        </div>

        {confirmTrip && (
          <div className="mt-3 rounded-xl border border-sky-200 bg-sky-50/60 p-3">
            <p className="text-xs font-bold text-sky-900">Trips usually return the next day</p>
            <p className="mt-1 text-xs leading-relaxed text-sky-800">
              Leaves today (~12 PM) and comes back around 9 AM–4 PM.
              Also mark <span className="font-semibold">{nextDayName}</span> as{' '}
              <span className="font-semibold">On Trip</span>?
            </p>
            <div className="mt-2.5 flex gap-2">
              <button
                onClick={() => onSelect('TripStart', 'OnTrip')}
                className="flex-1 rounded-lg bg-sky-600 px-2 py-1.5 text-xs font-semibold text-white transition hover:bg-sky-700"
              >
                Yes, mark both days
              </button>
              <button
                onClick={() => onSelect('TripStart')}
                className="flex-1 rounded-lg border border-sky-200 bg-white px-2 py-1.5 text-xs font-semibold text-sky-700 transition hover:bg-sky-100"
              >
                Just today
              </button>
            </div>
          </div>
        )}

        {otherOpen && (
          <div className="mt-3 space-y-2">
            <input
              type="text"
              value={otherText}
              onChange={(e) => setOtherText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitOther();
              }}
              placeholder="Type a custom duty (e.g. Farm Visit)"
              autoFocus
              className="w-full rounded-xl border border-violet-200 bg-violet-50/50 px-3 py-2 text-sm text-slate-800 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-500/20"
            />
            <button
              onClick={submitOther}
              disabled={!otherText.trim()}
              className="w-full py-2 rounded-xl bg-violet-600 text-white text-sm font-semibold transition hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Set as Duty
            </button>
          </div>
        )}

        <div className="mt-4 text-xs text-slate-400 text-center">
          {isSaturday && <span className="text-rose-500 font-medium">Saturday: Compulsory duty (cannot be Leave or Weekly Off)</span>}
        </div>

        {currentDuty && onRemove && (
          <div className="mt-4 pt-3 border-t border-slate-100">
            <button
              onClick={onRemove}
              className="w-full py-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-600 text-sm font-semibold transition hover:bg-rose-100 flex items-center justify-center gap-2"
            >
              <Trash2 size={15} />
              Remove Duty
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(ShiftPicker);
