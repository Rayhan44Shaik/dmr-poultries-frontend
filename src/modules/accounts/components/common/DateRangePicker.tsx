import { memo } from 'react';

interface DateRangePickerProps {
  from: string;
  to: string;
  onFromChange: (date: string) => void;
  onToChange: (date: string) => void;
}

export const DateRangePicker = memo(({ from, to, onFromChange, onToChange }: DateRangePickerProps) => (
  <div className="flex items-center space-x-2">
    <input
      type="date"
      value={from}
      onChange={(e) => onFromChange(e.target.value)}
      className="border rounded px-3 py-1"
    />
    <span className="text-gray-400">to</span>
    <input
      type="date"
      value={to}
      onChange={(e) => onToChange(e.target.value)}
      className="border rounded px-3 py-1"
    />
  </div>
));
DateRangePicker.displayName = 'DateRangePicker';