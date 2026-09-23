// src/components/common/SearchableSelect.tsx
//
// Reusable searchable dropdown — mirrors the Salary Register filter control so
// every list page (Salary Register, Maintenance, …) shares one filter UX:
// a labelled trigger, an optional in-panel search box, an optional "clear"
// option and a scrollable result list that shows exactly VISIBLE_ITEMS rows
// at a time (the rest are reached by scrolling or searching).

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';

export interface SearchableSelectOption {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  label: string;
  ariaLabel?: string;
  value: string;
  placeholder: string;
  options: Array<string | SearchableSelectOption>;
  onChange: (value: string) => void;
  searchable?: boolean;
  allowClear?: boolean;
  widthClass?: string;
  searchPlaceholder?: string;
  /** Multi-select mode: rows toggle their check, the menu stays open. */
  multi?: boolean;
  /** Checked values in multi mode. */
  selectedValues?: string[];
  /** Toggle one value in multi mode. */
  onToggleValue?: (value: string) => void;
  /** Clear every selection in multi mode. */
  onClearValues?: () => void;
  /** Colour used for the selected row; blue remains the application default. */
  selectionTone?: 'blue' | 'green';
}

/** Five 36px-at-default rows; rem keeps the visible window in scale. */
const LIST_MAX_HEIGHT = "11.25rem";

const SearchableSelect = ({
  label,
  ariaLabel,
  value,
  placeholder,
  options,
  onChange,
  searchable = false,
  allowClear = true,
  widthClass = 'w-56',
  searchPlaceholder = 'Search...',
  multi = false,
  selectedValues = [],
  onToggleValue,
  onClearValues,
  selectionTone = 'blue',
}: SearchableSelectProps) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const items = useMemo(
    () =>
      options.map((opt) =>
        typeof opt === 'string' ? { value: opt, label: opt } : opt
      ),
    [options]
  );

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  useEffect(() => {
    if (open && searchable) {
      requestAnimationFrame(() => searchRef.current?.focus());
    }
  }, [open, searchable]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((opt) => opt.label.toLowerCase().includes(q));
  }, [items, query]);

  const selectedLabel = items.find((opt) => opt.value === value)?.label;

  const visibleActiveIndex = Math.min(activeIndex, Math.max(0, filtered.length - 1));

  const moveActive = (direction: 1 | -1) => {
    if (filtered.length === 0) return;
    setActiveIndex((current) => {
      const next = (current + direction + filtered.length) % filtered.length;
      requestAnimationFrame(() => optionRefs.current[next]?.scrollIntoView({ block: 'nearest' }));
      return next;
    });
  };

  const handleMenuKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        setActiveIndex(0);
      } else {
        moveActive(event.key === 'ArrowDown' ? 1 : -1);
      }
      return;
    }
    if (event.key === 'Enter' && open && filtered[visibleActiveIndex]) {
      event.preventDefault();
      pickRow(filtered[visibleActiveIndex].value);
      return;
    }
    if (event.key === 'Escape' && open) {
      event.preventDefault();
      setOpen(false);
      setQuery('');
    }
  };
  // Multi trigger: the first pick's label, then a numeric "+N" (digits read
  // the same in Telugu and English).
  const multiCount = selectedValues.length;
  const multiFirst = multiCount > 0 ? items.find((opt) => selectedValues.includes(opt.value))?.label : undefined;
  const display = multi
    ? (multiCount === 0 ? placeholder : multiCount === 1 ? multiFirst ?? placeholder : `${multiFirst ?? ''} +${multiCount - 1}`)
    : selectedLabel || placeholder;
  const selectedTextClass = selectionTone === 'green' ? 'text-emerald-700' : 'text-blue-600';
  const selectedBgClass = selectionTone === 'green' ? 'bg-emerald-50' : 'bg-blue-50/70';
  const selectedCheckClass = selectionTone === 'green' ? 'text-emerald-600' : 'text-blue-600';

  const pick = (next: string) => {
    onChange(next);
    setOpen(false);
    setQuery('');
  };

  const pickRow = (next: string) => {
    if (multi && onToggleValue) {
      onToggleValue(next);
      setQuery('');
      return;
    }
    pick(next);
  };

  return (
    <div className="relative" ref={ref}>
      {label ? <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">{label}</label> : null}
      <button
        type="button"
        aria-label={ariaLabel || label || placeholder}
        aria-haspopup="listbox"
        aria-expanded={open}
        onKeyDown={handleMenuKeyDown}
        onClick={() => {
          if (!open) setQuery('');
          setOpen((o) => !o);
        }}
        className={`h-9 px-3 ${widthClass} rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none bg-white text-slate-700 flex items-center justify-between gap-2 hover:border-slate-300 transition font-medium ${open ? 'ring-2 ring-blue-500/20 border-blue-500' : ''}`}
      >
        <span className={`truncate ${(multi ? multiCount > 0 : value) ? 'text-slate-700' : 'text-slate-400'}`}>
          {display}
        </span>
        <ChevronDown
          size={14}
          className={`text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className={`absolute top-full left-0 mt-1 z-[80] ${widthClass} bg-white rounded-xl shadow-xl shadow-slate-200/70 border border-slate-200 overflow-hidden`}>
          {searchable && (
            <div className="p-1.5 border-b border-slate-100 bg-slate-50/60">
              <div className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg bg-white border border-slate-200">
                <Search size={12} className="text-slate-400 shrink-0" />
                <input
                  ref={searchRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleMenuKeyDown}
                  placeholder={searchPlaceholder}
                  className="w-full bg-transparent text-xs text-slate-700 outline-none placeholder:text-slate-400"
                />
              </div>
            </div>
          )}

          {/* "All / clear" row is pinned above the scroll area so the option list
              itself always shows a full window of VISIBLE_ITEMS rows. */}
          {allowClear && (
            <button
              type="button"
              onClick={() => {
                if (multi && onClearValues) {
                  onClearValues();
                  setQuery('');
                  return;
                }
                pick('');
              }}
              className={`w-full flex items-center gap-2 px-3 h-9 text-xs font-medium text-left border-b border-slate-100 hover:bg-slate-50 transition ${
                (multi ? multiCount === 0 : !value) ? `${selectedTextClass} ${selectedBgClass}` : 'text-slate-600'
              }`}
            >
              <span className="w-3.5 shrink-0">
                {(multi ? multiCount === 0 : !value) && <Check size={13} className={selectedCheckClass} />}
              </span>
              <span className="truncate">{placeholder}</span>
            </button>
          )}

          <ul
            role="listbox"
            className="overflow-y-auto overscroll-contain scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent"
            style={{ maxHeight: LIST_MAX_HEIGHT }}
          >
            {filtered.map((opt, index) => {
              const isSelected = multi ? selectedValues.includes(opt.value) : value === opt.value;
              return (
                <li key={opt.value}>
                  <button
                    ref={(element) => { optionRefs.current[index] = element; }}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => pickRow(opt.value)}
                    onMouseEnter={() => setActiveIndex(index)}
                    className={`w-full flex items-center gap-2 px-3 h-9 text-xs font-medium text-left truncate hover:bg-slate-50 transition ${
                      isSelected ? `${selectedTextClass} ${selectedBgClass}` : index === visibleActiveIndex ? 'text-slate-800 bg-slate-100' : 'text-slate-700'
                    }`}
                  >
                    <span className="w-3.5 shrink-0">
                      {isSelected && <Check size={13} className={selectedCheckClass} />}
                    </span>
                    <span className="truncate">{opt.label}</span>
                  </button>
                </li>
              );
            })}
            {filtered.length === 0 && (
              <li className="px-3 h-9 flex items-center text-xs text-slate-400">
                No matches
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
};

export default SearchableSelect;
