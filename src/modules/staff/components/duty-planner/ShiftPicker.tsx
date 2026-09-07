import { memo, useId, useState } from 'react';
import { PenLine, Trash2, X } from 'lucide-react';
import { getShiftConfigsForRole } from '../../services/staffService';
import { getCoreDutyRole, getDutyPickerTypes, isManualDutyRole } from '../../services/dutyRules';
import { getDutyLabel, formatDutyDate, formatDutyWeekday } from '../../services/dutyReport';
import { useDutyPlannerText } from '../../hooks/useDutyPlannerText';
import { dutyDisplayValue } from '../../i18n/dutyPlannerCopy';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (dutyType: string) => void;
  onRemove?: () => void;
  currentDuty?: string;
  date: string;
  employeeName?: string;
  employeeRole?: string;
  employeeDepartment?: string;
}
function ShiftPicker({ isOpen, onClose, onSelect, onRemove, currentDuty, date, employeeName, employeeRole = '', employeeDepartment = '' }: Props) {
  const { language, t } = useDutyPlannerText();
  const [otherOpen, setOtherOpen] = useState(false);
  const [otherText, setOtherText] = useState('');
  const titleId = useId();
  if (!isOpen) return null;
  const types = getDutyPickerTypes({ role: employeeRole, department: employeeDepartment });
  const configs = getShiftConfigsForRole(getCoreDutyRole(employeeRole) ?? undefined);
  const submitOther = () => { if (otherText.trim()) onSelect(otherText.trim()); };
  return (
    <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-100 bg-white p-5 shadow-xl">
        <div className="mb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-slate-400">{t('selectDuty')}</p>
              <h3 id={titleId} className="mt-1 text-[15px] font-semibold text-slate-900">{employeeName || t('employee')}</h3>
              <p className="mt-0.5 text-xs text-slate-500">{dutyDisplayValue(employeeRole, language)}</p>
            </div>
            <button type="button" onClick={onClose} aria-label={t('close')} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
          </div>
          <p className="mt-2 text-xs text-slate-500">{formatDutyWeekday(date, language)} · {formatDutyDate(date, language)}</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {types.map((type) => {
            const style = configs.find((config) => config.type === type);
            return <button key={type} type="button" onClick={() => onSelect(type)} className={`min-h-10 rounded-xl border px-3 py-2 text-sm font-semibold ${style?.bgColor ?? 'bg-violet-50'} ${style?.borderColor ?? 'border-violet-200'} ${style?.textColor ?? 'text-violet-700'} ${currentDuty === type ? 'ring-2 ring-emerald-500 ring-offset-2' : ''}`}>{getDutyLabel(type, language)}</button>;
          })}
          <button type="button" onClick={() => setOtherOpen((open) => !open)} className="flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-semibold text-violet-700"><PenLine size={14} />{t('other')}</button>
        </div>
        {otherOpen && <div className="mt-3 space-y-2">
          <input value={otherText} onChange={(event) => setOtherText(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') submitOther(); }} placeholder={t('customPlaceholder')} aria-label={t('customPlaceholder')} autoFocus className="w-full rounded-xl border border-violet-200 bg-violet-50/50 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-300" />
          <button type="button" onClick={submitOther} disabled={!otherText.trim()} className="w-full rounded-xl bg-violet-600 py-2 text-sm font-semibold text-white disabled:opacity-40">{t('setDuty')}</button>
        </div>}
        {currentDuty && onRemove && <div className="mt-4 border-t border-slate-100 pt-3">
          <button type="button" onClick={onRemove} className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 py-2 text-sm font-semibold text-rose-600"><Trash2 size={14} />{t(isManualDutyRole(employeeRole) ? 'removeDuty' : 'restoreDefault')}</button>
        </div>}
      </div>
    </div>
  );
}
export default memo(ShiftPicker);
