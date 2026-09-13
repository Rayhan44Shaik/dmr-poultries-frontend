import { memo, useMemo } from 'react';
import MasterDropdown, { type MasterDropdownOption } from '../../../masters/components/MasterDropdown';
import { formatDutyDate, formatDutyWeekday } from '../../services/dutyReport';
import { useDutyPlannerText } from '../../hooks/useDutyPlannerText';

interface Props {
  /** Every date in the current range. */
  dates: string[];
  /** The single date shown in the table, or null for every date. */
  value: string | null;
  onChange: (date: string | null) => void;
}

/**
 * Date-wise table filter, rendered inside the Duty Assign table header at
 * table level. Small and simple — a compact single dropdown pinned to the
 * right of the header row: "All dates" shows every column, picking a date
 * shows only that day. No search box (a week has at most 7 options).
 */
function DutyDateFilter({ dates, value, onChange }: Props) {
  const { language, t } = useDutyPlannerText();
  const options = useMemo<MasterDropdownOption[]>(
    () => dates.map((date) => ({ value: date, label: `${formatDutyWeekday(date, language)} · ${formatDutyDate(date, language)}` })),
    [dates, language],
  );
  return (
    <MasterDropdown
      hideLabel
      label={t('dates')}
      value={value ?? ''}
      options={options}
      onChange={(next) => onChange(next || null)}
      placeholder={t('allDatesLabel')}
      allowClear
      className="ml-auto w-44 shrink-0 sm:w-48"
      triggerClassName="!h-8 px-2.5"
    />
  );
}
export default memo(DutyDateFilter);
