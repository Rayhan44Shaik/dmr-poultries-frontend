// src/modules/accounts/components/farm-payment/FarmerPaymentFilters.tsx
//
// The Farm Payment filter card — the SAME card the Trip List uses
// (opsFilterCardClass): From/To, farm, search, and actions in a single row
// on desktop (stacked below). Glyph motions come from
// the global tokens: search sways, reset spins, refresh is the brand hen.

import React from 'react';
import { Search, Calendar, Warehouse, RotateCcw } from 'lucide-react';
import { DatePicker } from '../../../../components/common/DatePicker';
import {
  opsFilterCardClass,
  opsFilterLabelClass,
  opsInputClass,
  opsSecondaryButtonClass,
} from '../../../../shared/ui/operationsStyles';
import { BrandRefreshButton } from '../../../../ui';
import MasterDropdown from '../../../masters/components/MasterDropdown';
import '../../../masters/styles/masters.css';
import { useI18n } from '../../../../i18n';
import { localizeTripViewText } from '../../../operations/vehicle-trips/utils/tripViewLocalization';

interface FarmerPaymentFiltersProps {
  dateFrom: string;
  dateTo: string;
  selectedFarm: string;
  searchQuery: string;
  farms: string[];
  /** A trips reload is in flight — the hen dances while it runs. */
  loading?: boolean;
  onRefresh: () => void;
  onDateFromChange: (val: string) => void;
  onDateToChange: (val: string) => void;
  onFarmChange: (farm: string) => void;
  onSearchChange: (val: string) => void;
  onClear: () => void;
}

export function FarmerPaymentFilters({
  dateFrom,
  dateTo,
  selectedFarm,
  searchQuery,
  farms,
  loading = false,
  onRefresh,
  onDateFromChange,
  onDateToChange,
  onFarmChange,
  onSearchChange,
  onClear,
}: FarmerPaymentFiltersProps) {
  const { t, language } = useI18n();
  const fromId = React.useId();
  const toId = React.useId();
  const farmId = React.useId();

  /* Reset feedback: the glyph spins once per click (700 ms), exactly the
     Trip List / Payment Register contract. */
  const [resetting, setResetting] = React.useState(false);
  const spinTimer = React.useRef<number | null>(null);
  const handleClear = () => {
    setResetting(true);
    if (spinTimer.current !== null) window.clearTimeout(spinTimer.current);
    spinTimer.current = window.setTimeout(() => setResetting(false), 700);
    onClear();
  };
  React.useEffect(
    () => () => {
      if (spinTimer.current !== null) window.clearTimeout(spinTimer.current);
    },
    [],
  );

  // "All" is the sentinel — represented as an empty dropdown value so the
  // placeholder shows and the clear affordance behaves correctly. Labels read
  // in the active language while the value keeps its stored form (filtering
  // compares against trip.sourceFarm, which never changes), and searchText
  // keeps the Latin name so typing either script finds the farm.
  const farmOptions = React.useMemo(
    () =>
      farms
        .filter((farm) => farm !== 'All')
        .map((farm) => ({
          value: farm,
          label: localizeTripViewText(farm, language),
          searchText: farm,
        })),
    [farms, language],
  );

  return (
    <div className={`${opsFilterCardClass} lg:grid lg:grid-cols-12 lg:gap-3.5 lg:items-end [&>div:first-child>div]:lg:col-span-2`} role="search" aria-label={t('accounts.farmpay.filters_aria')}>
      {/* Single row on desktop — dates, farm, search, and actions side by side. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:contents gap-3.5">
        <div>
          <label htmlFor={fromId} className={opsFilterLabelClass}>
            <Calendar size={17} className="text-emerald-500 flex-shrink-0" />
            <span>{t('common.from')}</span>
          </label>
          <DatePicker
            id={fromId}
            value={dateFrom}
            onChange={onDateFromChange}
            placeholder={t('placeholder.enter_date')}
            className="w-full text-xs font-medium"
            language={language}
          />
        </div>

        <div>
          <label htmlFor={toId} className={opsFilterLabelClass}>
            <Calendar size={17} className="text-emerald-500 flex-shrink-0" />
            <span>{t('common.to')}</span>
          </label>
          <DatePicker
            id={toId}
            value={dateTo}
            onChange={onDateToChange}
            placeholder={t('placeholder.enter_date')}
            className="w-full text-xs font-medium"
            language={language}
          />
        </div>

        <div>
          <label htmlFor={farmId} className={opsFilterLabelClass}>
            <Warehouse size={17} className="text-amber-500 flex-shrink-0" />
            <span>{t('ops.trip.source_farm')}</span>
          </label>
          <MasterDropdown
            hideLabel
            label={t('ops.trip.source_farm')}
            triggerId={farmId}
            value={selectedFarm === 'All' ? '' : selectedFarm}
            options={farmOptions}
            onChange={(next) => onFarmChange(next || 'All')}
            placeholder={t('accounts.farmpay.all_farms')}
            searchable
            allowClear
            className="w-full"
          />
        </div>
      </div>



      <div className="grid grid-cols-1 lg:contents gap-3.5 items-end pt-1">
        <div className="lg:col-span-4">
          <label className={opsFilterLabelClass}>
            <Search size={17} className="text-slate-400 flex-shrink-0" />
            <span>{t('common.search')}</span>
          </label>
          <div className="relative">
            <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={searchQuery}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder={t('accounts.farmpay.search_placeholder')}
              aria-label={t('common.search')}
              className={`${opsInputClass} pl-10`}
            />
          </div>
        </div>

        <div className="lg:col-span-2 flex items-center gap-2 justify-end flex-nowrap">
          <button
            type="button"
            onClick={handleClear}
            className={`group relative ${opsSecondaryButtonClass}`}
            aria-label={t('common.reset')}
          >
            <span
              className={`inline-flex motion-safe:group-hover:animate-[var(--animate-action-reset)] ${
                resetting ? 'motion-safe:animate-[var(--animate-action-reset)]' : ''
              }`}
            >
              <RotateCcw size={14} />
            </span>
            {t('common.reset')}
          </button>
          <BrandRefreshButton loading={loading} onClick={onRefresh} />
        </div>
      </div>
    </div>
  );
}
