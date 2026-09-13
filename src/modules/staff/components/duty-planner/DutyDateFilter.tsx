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
 * table level. A single neat trips-style dropdown (searchable, clearable):
 * "All dates" shows every column, picking a date shows only that day.
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
      searchable
      allowClear
      className="w-full sm:w-60"
    />
  );
}
export default memo(DutyDateFilter);
