/*
 * HISTORICAL / FUTURE FASTAG PROTOTYPE — do not mount, do not execute.
 * The live export below is a static Under Construction placeholder.
 * Restore this implementation after the client visit; do not use localStorage
 * as a production source of truth.
 *
import { memo } from 'react';
import { useVehicles } from '../../masters/vehicles/hooks/useVehicles';
import { useFleetData } from '../hooks/useFleetData';
import { useFastagData } from '../hooks/useFastagData';
import ErrorBoundary from '../components/common/ErrorBoundary';
import FastagSummaryTiles from '../components/fastag/FastagSummaryTiles';
import FastagBalanceTable from '../components/fastag/FastagBalanceTable';
import FastagTransactions from '../components/fastag/FastagTransactions';
import { Plus } from 'lucide-react';

const FastagDashboardPage = () => {
  const { vehicles } = useVehicles();
  const { fastags } = useFleetData();
  const { stats, sortedFastags, recentTransactions } = useFastagData();

  return (
    <ErrorBoundary>
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">FASTag Dashboard</h1>
          <button className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors">
            <Plus className="w-4 h-4" />
            Recharge FASTag
          </button>
        </div>
        <FastagSummaryTiles
          totalFastags={stats.totalFastags}
          lowBalanceCount={stats.lowBalanceCount}
          todayToll={stats.todayToll}
          monthToll={stats.monthToll}
          avgDailyToll={stats.avgDailyToll}
        />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">FASTag Balance Overview</h3>
            <FastagBalanceTable fastags={sortedFastags} vehicles={vehicles} />
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Recent Toll Transactions</h3>
            <FastagTransactions
              transactions={recentTransactions}
              fastags={fastags}
              vehicles={vehicles}
            />
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default memo(FastagDashboardPage);
*/

import { memo } from 'react';
import { CreditCard, ScanLine, Sparkles, Wrench } from 'lucide-react';
import { useI18n } from '../../../i18n';
import ErrorBoundary from '../components/common/ErrorBoundary';

interface FastagDashboardPageProps {
  embedded?: boolean;
}

/** UNDER CONSTRUCTION — static placeholder. Zero API, cache, storage, or polling. */
const FastagDashboardPage = ({ embedded = false }: FastagDashboardPageProps) => {
  const { t } = useI18n();
  return (
    <ErrorBoundary>
      <div
        className={`flex w-full items-center justify-center overflow-hidden ${
          embedded ? 'min-h-[60vh] bg-slate-50/60' : 'min-h-screen bg-slate-50 px-4 py-6 md:px-8 md:py-8'
        }`}
      >
        <div
          role="status"
          aria-live="polite"
          className="relative mx-4 w-full max-w-2xl overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white px-6 py-10 text-center shadow-[0_24px_70px_-28px_rgba(15,23,42,0.28)] sm:px-12 sm:py-14"
        >
          {/* Calm ambient glow — decorative only, never affects layout. */}
          <div aria-hidden="true" className="pointer-events-none absolute -left-20 -top-24 h-64 w-64 rounded-full bg-emerald-100/60 blur-3xl" />
          <div aria-hidden="true" className="pointer-events-none absolute -bottom-28 -right-20 h-72 w-72 rounded-full bg-indigo-100/60 blur-3xl" />

          <div className="relative mx-auto mb-7 flex h-28 w-28 items-center justify-center">
            <span aria-hidden="true" className="absolute inset-0 rounded-full border border-emerald-200/70 animate-[ping_2.8s_ease-out_infinite]" />
            <span aria-hidden="true" className="absolute inset-2 rounded-full border border-dashed border-indigo-200 animate-[spin_12s_linear_infinite]" />
            <span className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-emerald-50 to-indigo-50 text-emerald-600 shadow-inner ring-1 ring-inset ring-white">
              <CreditCard className="h-10 w-10 animate-[bounce_2.4s_ease-in-out_infinite]" strokeWidth={1.8} aria-hidden="true" />
              <ScanLine className="absolute -bottom-1 -right-1 h-6 w-6 text-indigo-500" strokeWidth={2} aria-hidden="true" />
            </span>
            <Sparkles className="absolute right-0 top-1 h-5 w-5 animate-pulse text-indigo-400" aria-hidden="true" />
            <Wrench className="absolute bottom-1 left-0 h-5 w-5 animate-[pulse_2s_ease-in-out_infinite] text-emerald-400" aria-hidden="true" />
          </div>

          <p className="relative mb-3 text-[11px] font-bold uppercase tracking-[0.24em] text-emerald-600">FASTAG</p>
          <div className="relative mx-auto mt-4 inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-amber-700">
            <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" aria-hidden="true" />
            {t('fleet.fastag.under_construction')}
          </div>
          <p className="relative mx-auto mt-5 max-w-md text-sm leading-7 text-slate-500 sm:text-base">
            {t('fleet.fastag.coming_soon_desc')}
          </p>

          <div className="relative mx-auto mt-8 max-w-sm">
            <div className="mb-2 flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
              <span>Building the experience</span>
              <span className="text-emerald-600">Coming soon</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100 ring-1 ring-inset ring-slate-200/70">
              <div className="h-full w-2/5 rounded-full bg-gradient-to-r from-emerald-400 via-emerald-500 to-indigo-500 animate-[pulse_2s_ease-in-out_infinite]" />
            </div>
          </div>
          <p className="relative mt-6 text-xs font-semibold text-slate-400">{t('coming_soon')}</p>
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default memo(FastagDashboardPage);
