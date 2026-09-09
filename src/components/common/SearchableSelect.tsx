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
  value: string;
  placeholder: string;
  options: Array<string | SearchableSelectOption>;
  onChange: (value: string) => void;
  searchable?: boolean;
  allowClear?: boolean;
  widthClass?: string;
  searchPlaceholder?: string;
}

/** How many option rows are visible before the list scrolls. */
const VISIBLE_ITEMS = 5;
/** Fixed row height so VISIBLE_ITEMS maps to an exact pixel height. */
const ITEM_HEIGHT = 36; // h-9
const LIST_MAX_HEIGHT = VISIBLE_ITEMS * ITEM_HEIGHT;

const SearchableSelect = ({
  label,
  value,
  placeholder,
  options,
  onChange,
  searchable = false,
  allowClear = true,
  widthClass = 'w-56',
  searchPlaceholder = 'Search...',
}: SearchableSelectProps) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

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
  const display = selectedLabel || placeholder;

  const pick = (next: string) => {
    onChange(next);
    setOpen(false);
    setQuery('');
  };

  return (
    <div className="relative" ref={ref}>
      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
        {label}
      </label>
      <button
        type="button"
        onClick={() => {
          if (!open) setQuery('');
          setOpen((o) => !o);
        }}
        className={`h-9 px-3 ${widthClass} rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none bg-white text-slate-700 flex items-center justify-between gap-2 hover:border-slate-300 transition font-medium ${open ? 'ring-2 ring-blue-500/20 border-blue-500' : ''}`}
      >
        <span className={`truncate ${value ? 'text-slate-700' : 'text-slate-400'}`}>
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
              onClick={() => pick('')}
              className={`w-full flex items-center gap-2 px-3 h-9 text-xs font-medium text-left border-b border-slate-100 hover:bg-slate-50 transition ${
                !value ? 'text-blue-600 bg-blue-50/70' : 'text-slate-600'
              }`}
            >
              <span className="w-3.5 shrink-0">
                {!value && <Check size={13} className="text-blue-600" />}
              </span>
              <span className="truncate">{placeholder}</span>
            </button>
          )}

          <ul
            className="overflow-y-auto overscroll-contain scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent"
            style={{ maxHeight: `${LIST_MAX_HEIGHT}px` }}
          >
            {filtered.map((opt) => {
              const isSelected = value === opt.value;
              return (
                <li key={opt.value}>
                  <button
                    type="button"
                    onClick={() => pick(opt.value)}
                    className={`w-full flex items-center gap-2 px-3 h-9 text-xs font-medium text-left truncate hover:bg-slate-50 transition ${
                      isSelected ? 'text-blue-600 bg-blue-50/70' : 'text-slate-700'
                    }`}
                  >
                    <span className="w-3.5 shrink-0">
                      {isSelected && <Check size={13} className="text-blue-600" />}
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
