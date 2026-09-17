// src/modules/fleet-operations/components/emi/EmiFilterBar.tsx
//
// The EMI filter card — the SAME visual contract the Trip List and Farm
// Payments use: the shared ops filter card, icon-labelled Search and Status
// fields, the vehicle totals, then Reset with the canonical spin motion and
// the brand hen Refresh. The Status control is the app-wide MasterDropdown
// (36px, 12px corners, emerald selection), with the `emi-status__control`
// hook kept on its trigger for the E2E suite.

import { memo, useId, useMemo } from 'react';
import { cn } from '../../../../utils/cn';
import { BadgeCheck, Search, X } from 'lucide-react';
import { translateStatus, useI18n } from '../../../../i18n';
import {
  opsFilterCardClass,
  opsFilterLabelClass,
  opsInputClass,
} from '../../../../shared/ui/operationsStyles';
import { BrandRefreshButton, FilterResetButton, countActiveFilters } from '../../../../ui';
import MasterDropdown from '../../../masters/components/MasterDropdown';
import '../../../masters/styles/masters.css';
import type { EmiOverview } from '../../types';

type StatusValue = EmiOverview['status'] | 'all';

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

function EmiFilterBar({
  search, status, onSearchChange, onStatusChange, onReset, onRefresh,
  loading, refreshing, hasSnapshot, kpis,
}: EmiFilterBarProps) {
  const { t } = useI18n();
  const id = useId();

  // "All statuses" is the empty value, so it renders as the placeholder and
  // as the dropdown's clear row — the Trip List filter convention.
  const statusOptions = useMemo(() => [
    { value: 'PENDING', label: translateStatus(t, 'PENDING') },
    { value: 'COMPLETED', label: translateStatus(t, 'COMPLETED') },
  ], [t]);

  const totals = [
    { key: 'total', label: t('fleet.emi.total_vehicles'), value: kpis.totalVehicles, tone: 'bg-slate-100 text-slate-900' },
    { key: 'completed', label: t('fleet.emi.completed_emi_vehicles'), value: kpis.completedEmiVehicles, tone: 'bg-emerald-50 text-emerald-700' },
    { key: 'pending', label: t('fleet.emi.pending_emi_vehicles'), value: kpis.pendingEmiVehicles, tone: 'bg-amber-50 text-amber-700' },
  ];

  return (
    <section aria-label={t('fleet.emi.filters_label')} className={opsFilterCardClass}>
      {/* Row 1 — Search and Status with their icon labels, then Reset and the
          brand hen Refresh right-aligned: the Trip List / Farm Payments row. */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-end">
        <div className="lg:col-span-5">
          <label htmlFor={`${id}-search`} className={opsFilterLabelClass}>
            <Search size={17} className="text-slate-400 flex-shrink-0" />
            <span>{t('common.search')}</span>
          </label>
          <div className="relative">
            <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              id={`${id}-search`}
              type="text"
              autoComplete="off"
              spellCheck={false}
              maxLength={80}
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder={t('fleet.emi.search_placeholder')}
              className={cn(opsInputClass, 'pl-10 pr-9')}
            />
            {search && (
              <button
                type="button"
                aria-label={t('fleet.emi.clear_search')}
                onClick={() => onSearchChange('')}
                className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30"
              >
                <X size={13} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        <div className="lg:col-span-3">
          <label htmlFor={`${id}-status`} className={opsFilterLabelClass}>
            <BadgeCheck size={17} className="text-emerald-500 flex-shrink-0" />
            <span>{t('common.status')}</span>
          </label>
          <MasterDropdown
            hideLabel
            label={t('common.status')}
            triggerId={`${id}-status`}
            triggerClassName="emi-status__control"
            value={status === 'all' ? '' : status}
            options={statusOptions}
            onChange={(next) => onStatusChange((next || 'all') as StatusValue)}
            placeholder={t('fleet.emi.all_statuses')}
            allowClear
            className="w-full"
          />
        </div>

        {/* Reset (the app-wide FilterResetButton with its active-filter count
            badge) and the brand hen Refresh — the exact action cluster the
            Trip List and Farm Payments carry. */}
        <div className="lg:col-span-4 flex items-center gap-2 justify-end flex-wrap">
          <FilterResetButton
            count={countActiveFilters(search.trim() !== '', status !== 'all')}
            onClick={onReset}
            title={t('fleet.emi.clear_filters')}
          />
          <BrandRefreshButton
            loading={refreshing}
            disabled={loading}
            onClick={onRefresh}
            title={t('fleet.emi.refresh_from_master')}
          />
        </div>
      </div>

      {/* Row 2 — the vehicle totals strip. One line always; narrow screens
          scroll this strip only (the dropdown menu is portalled, so it never
          gets clipped by this scroll container). */}
      <div className="-m-1 overflow-x-auto overscroll-x-contain p-1 border-t border-slate-100 pt-3" data-emi-toolbar-scroll>
        <div className="flex min-w-max items-center gap-2" data-emi-toolbar-row>
          <dl aria-label={t('fleet.emi.vehicle_totals')} className="flex items-center divide-x divide-slate-200">
            {totals.map((total) => (
              <div key={total.key} className="flex items-center gap-1.5 whitespace-nowrap px-3 first:pl-1">
                <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{total.label}</dt>
                <dd className={`inline-flex h-6 min-w-8 items-center justify-center rounded-md px-1.5 text-sm font-bold tabular-nums ${total.tone}`}>
                  {hasSnapshot ? total.value : '—'}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}

export default memo(EmiFilterBar);
