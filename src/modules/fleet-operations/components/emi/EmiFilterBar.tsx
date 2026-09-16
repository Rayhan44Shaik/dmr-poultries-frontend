import { memo, useId, useMemo } from 'react';
import { cn } from "../../../../utils/cn";
import { uiSearchInputClass } from "../../../../shared/ui/uiTokens";
import Select, {
  components,
  type DropdownIndicatorProps,
  type OptionProps,
  type StylesConfig,
} from 'react-select';
import { Check, ChevronDown, FilterX, RefreshCw, Search, X } from 'lucide-react';
import { translateStatus, useI18n } from '../../../../i18n';
import type { EmiOverview } from '../../types';

type StatusValue = EmiOverview['status'] | 'all';
type StatusOption = { value: StatusValue; label: string };

interface EmiFilterBarProps {
  search: string;
  status: StatusValue;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: StatusValue) => void;
  onReset: () => void;
  onRefresh: () => void;
  loading: boolean;
  refreshing: boolean;
  hasSnapshot: boolean;
  kpis: {
    totalVehicles: number;
    completedEmiVehicles: number;
    pendingEmiVehicles: number;
  };
}

// Match Salary Register's Department dropdown: 36px control, 12px corners,
// slate borders, a white floating menu and a soft blue selected option.
const statusStyles: StylesConfig<StatusOption, false> = {
  control: (base, state) => ({
    ...base,
    height: '2.25rem',
    minHeight: '2.25rem',
    borderRadius: '0.75rem',
    borderColor: state.isFocused ? '#3b82f6' : '#e2e8f0',
    backgroundColor: '#ffffff',
    boxShadow: state.isFocused ? '0 0 0 2px rgb(59 130 246 / 0.2)' : 'none',
    fontSize: '0.75rem',
    fontWeight: 500,
    cursor: 'pointer',
    '&:hover': { borderColor: state.isFocused ? '#3b82f6' : '#cbd5e1' },
  }),
  valueContainer: (base) => ({ ...base, padding: '0 0.75rem' }),
  singleValue: (base, state) => ({
    ...base,
    margin: 0,
    color: state.data.value === 'all' ? '#64748b' : '#334155',
  }),
  indicatorSeparator: () => ({ display: 'none' }),
  dropdownIndicator: (base) => ({
    ...base,
    padding: '0 0.75rem 0 0',
    color: '#94a3b8',
    '&:hover': { color: '#64748b' },
  }),
  menu: (base) => ({
    ...base,
    marginTop: '0.25rem',
    borderRadius: '0.75rem',
    border: '1px solid #e2e8f0',
    backgroundColor: '#ffffff',
    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
    overflow: 'hidden',
  }),
  menuList: (base) => ({ ...base, padding: 0 }),
  menuPortal: (base) => ({ ...base, zIndex: 80 }),
  option: (base, state) => ({
    ...base,
    minHeight: '2.25rem',
    padding: '0.5625rem 0.75rem',
    fontSize: '0.75rem',
    lineHeight: '1.125rem',
    fontWeight: 500,
    cursor: 'pointer',
    color: state.isSelected ? '#2563eb' : '#334155',
    backgroundColor: state.isSelected ? '#eff6ff' : state.isFocused ? '#f8fafc' : '#ffffff',
    ':active': { backgroundColor: '#eff6ff' },
  }),
};

function StatusChevron(props: DropdownIndicatorProps<StatusOption, false>) {
  return (
    <components.DropdownIndicator {...props}>
      <ChevronDown size={14} aria-hidden="true" className={`transition-transform ${props.selectProps.menuIsOpen ? 'rotate-180' : ''}`} />
    </components.DropdownIndicator>
  );
}

function StatusMenuOption(props: OptionProps<StatusOption, false>) {
  return (
    <components.Option {...props}>
      <span className="flex items-center justify-between gap-2">
        <span>{props.children}</span>
        {props.isSelected && <Check size={14} aria-hidden="true" className="shrink-0" />}
      </span>
    </components.Option>
  );
}

const statusComponents = { DropdownIndicator: StatusChevron, Option: StatusMenuOption };

const labelClass = 'mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500';
const actionClass = 'flex h-9 shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-600 shadow-xs transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50';

function EmiFilterBar({
  search, status, onSearchChange, onStatusChange, onReset, onRefresh,
  loading, refreshing, hasSnapshot, kpis,
}: EmiFilterBarProps) {
  const { t } = useI18n();
  const id = useId();
  const hasFilters = search.trim() !== '' || status !== 'all';
  const statusOptions = useMemo<StatusOption[]>(() => [
    { value: 'all', label: t('fleet.emi.all_statuses') },
    { value: 'PENDING', label: translateStatus(t, 'PENDING') },
    { value: 'COMPLETED', label: translateStatus(t, 'COMPLETED') },
  ], [t]);
  const totals = [
    { key: 'total', label: t('fleet.emi.total_vehicles'), value: kpis.totalVehicles, tone: 'bg-slate-100 text-slate-900' },
    { key: 'completed', label: t('fleet.emi.completed_emi_vehicles'), value: kpis.completedEmiVehicles, tone: 'bg-emerald-50 text-emerald-700' },
    { key: 'pending', label: t('fleet.emi.pending_emi_vehicles'), value: kpis.pendingEmiVehicles, tone: 'bg-amber-50 text-amber-700' },
  ];

  return (
    <section aria-label={t('fleet.emi.filters_label')} className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
      {/* Keep Status and all totals on one line. Small screens scroll this
          toolbar only; the portalled dropdown remains visible outside it. */}
      <div className="-m-1 overflow-x-auto overscroll-x-contain p-1" data-emi-toolbar-scroll>
        <div className="flex min-w-max items-end gap-2" data-emi-toolbar-row>
          <div className="w-56 shrink-0">
            <label htmlFor={`${id}-search`} className={labelClass}>{t('common.search')}</label>
            <div className="relative">
              <Search size={14} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                id={`${id}-search`}
                type="text"
                autoComplete="off"
                spellCheck={false}
                maxLength={80}
                value={search}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder={t('fleet.emi.search_placeholder')}
                className={cn(uiSearchInputClass, "pl-9 pr-8")}
              />
              {search && (
                <button
                  type="button"
                  aria-label={t('fleet.emi.clear_search')}
                  onClick={() => onSearchChange('')}
                  className="absolute right-1 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/20"
                >
                  <X size={13} aria-hidden="true" />
                </button>
              )}
            </div>
          </div>

          <div className="w-56 shrink-0">
            <label htmlFor={`${id}-status`} className={labelClass}>{t('common.status')}</label>
            <Select<StatusOption, false>
              inputId={`${id}-status`}
              instanceId={`${id}-status`}
              aria-label={t('common.status')}
              value={statusOptions.find((option) => option.value === status)}
              options={statusOptions}
              onChange={(option) => { if (option) onStatusChange(option.value); }}
              isSearchable={false}
              isClearable={false}
              components={statusComponents}
              styles={statusStyles}
              classNamePrefix="emi-status"
              menuPortalTarget={typeof document !== 'undefined' ? document.body : undefined}
              menuPosition="fixed"
              menuPlacement="auto"
              menuShouldScrollIntoView={false}
              maxMenuHeight={180}
            />
          </div>

          <dl aria-label={t('fleet.emi.vehicle_totals')} className="flex h-10 shrink-0 items-center divide-x divide-slate-200 border-l border-slate-200">
            {totals.map((total) => (
              <div key={total.key} className="flex items-center gap-1.5 whitespace-nowrap px-2">
                <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{total.label}</dt>
                <dd className={`inline-flex h-6 min-w-8 items-center justify-center rounded-md px-1 text-sm font-bold tabular-nums ${total.tone}`}>
                  {hasSnapshot ? total.value : '—'}
                </dd>
              </div>
            ))}
          </dl>

          {/* 40px so this row shares one control height with the search field. */}
        <div className="ml-auto flex h-10 shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={onReset}
              disabled={!hasFilters}
              className={`${actionClass} w-9 justify-center`}
              aria-label={t('fleet.emi.clear_filters')}
              title={t('fleet.emi.clear_filters')}
            >
              <FilterX size={15} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading || refreshing}
              className={`${actionClass} min-w-[88px] justify-center px-2.5`}
              aria-label={t('common.refresh')}
              title={t('fleet.emi.refresh_from_master')}
            >
              <RefreshCw size={13} aria-hidden="true" className={refreshing ? 'motion-safe:animate-spin text-emerald-600' : 'text-slate-400'} />
              {t('common.refresh')}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

export default memo(EmiFilterBar);
