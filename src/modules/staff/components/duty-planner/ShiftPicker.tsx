// src/modules/staff/components/duty-planner/ShiftPicker.tsx

import { memo } from 'react';
import { X } from 'lucide-react';
import { getShiftConfigs } from '../../services/staffService';

interface ShiftPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (dutyType: string) => void;
  currentDuty?: string;
  date: string;
}

function ShiftPicker({ isOpen, onClose, onSelect, currentDuty, date }: ShiftPickerProps) {
  if (!isOpen) return null;

  const shifts = getShiftConfigs();
  const dateObj = new Date(date);
  const isSaturday = dateObj.getDay() === 6;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 animate-fadeIn">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-800">Select Duty</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg transition">
            <X size={20} className="text-slate-500" />
          </button>
        </div>
        <p className="text-sm text-slate-500 mb-3">{date}</p>
        <div className="grid grid-cols-2 gap-2">
          {shifts.map((shift) => {
            const disabled = isSaturday && (shift.type === 'Rest' || shift.type === 'WeeklyOff');
            return (
              <button
                key={shift.type}
                onClick={() => {
                  if (disabled) return;
                  onSelect(shift.type);
                }}
                disabled={disabled}
                className={`py-2 px-3 rounded-lg border text-sm font-medium transition hover:shadow-md active:scale-95 ${
                  currentDuty === shift.type ? 'ring-2 ring-blue-500 ring-offset-2' : ''
                } ${shift.bgColor} ${shift.textColor} ${shift.borderColor} ${
                  disabled ? 'opacity-40 cursor-not-allowed' : ''
                }`}
              >
                {shift.label}
                {disabled && <span className="block text-[10px] text-rose-500">(Saturday)</span>}
              </button>
            );
          })}
        </div>
        <div className="mt-4 text-xs text-slate-400 text-center">
          {isSaturday && <span className="text-rose-500">Saturday: Compulsory duty (cannot be Rest or Weekly Off)</span>}
        </div>
      </div>
    </div>
  );
}

export default memo(ShiftPicker);