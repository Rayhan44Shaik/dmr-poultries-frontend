import { forwardRef } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { Calendar } from "lucide-react";

interface Props {
  selected: Date | null;
  onChange: (date: Date | null) => void;
  placeholder?: string;
  label?: string;
  className?: string;
  id?: string;
}

const CustomInput = forwardRef<HTMLInputElement, any>(({ value, onClick, placeholder, className, id }, ref) => (
  <div className="relative">
    <input
      ref={ref}
      id={id}
      value={value}
      onClick={onClick}
      placeholder={placeholder}
      readOnly
      className={`h-10 w-full rounded-lg border border-slate-200 pl-3 pr-10 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none cursor-pointer ${className || ""}`}
    />
    <Calendar size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
  </div>
));

// Custom header – shows only dropdowns and arrows, no duplicate text
const CustomHeader = ({
  date,
  changeYear,
  changeMonth,
  decreaseMonth,
  increaseMonth,
  prevMonthButtonDisabled,
  nextMonthButtonDisabled,
}: any) => {
  const years = Array.from({ length: 30 }, (_, i) => new Date().getFullYear() - 15 + i);
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  return (
    <div className="flex items-center justify-between px-3 py-2 bg-white border-b border-slate-200">
      <button
        onClick={decreaseMonth}
        disabled={prevMonthButtonDisabled}
        className="p-1 hover:bg-slate-100 rounded disabled:opacity-40"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      <div className="flex items-center gap-2">
        <select
          value={date.getMonth()}
          onChange={({ target: { value } }) => changeMonth(Number(value))}
          className="rounded border border-slate-300 px-2 py-1 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
          size={1}
        >
          {months.map((month, i) => (
            <option key={i} value={i}>
              {month}
            </option>
          ))}
        </select>
        <select
          value={date.getFullYear()}
          onChange={({ target: { value } }) => changeYear(Number(value))}
          className="rounded border border-slate-300 px-2 py-1 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
          size={1}
        >
          {years.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
      </div>

      <button
        onClick={increaseMonth}
        disabled={nextMonthButtonDisabled}
        className="p-1 hover:bg-slate-100 rounded disabled:opacity-40"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );
};

export function ModernDatePicker({ selected, onChange, placeholder, label, className, id }: Props) {
  return (
    <div className={className}>
      {label && <label className="text-xs font-medium text-slate-500 block mb-1">{label}</label>}
      <DatePicker
        key={id}
        selected={selected}
        onChange={onChange}
        placeholderText={placeholder}
        dateFormat="dd-MM-yyyy"
        customInput={<CustomInput id={id} />}
        popperClassName="!z-50"
        popperPlacement="bottom-start"
        className="w-full"
        showMonthDropdown
        showYearDropdown
        dropdownMode="select"
        scrollableYearDropdown
        yearDropdownItemNumber={5} // 👈 use custom header to avoid duplication
      />
    </div>
  );
}