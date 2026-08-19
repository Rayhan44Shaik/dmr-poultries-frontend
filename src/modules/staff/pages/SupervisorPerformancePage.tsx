// src/modules/staff/pages/SupervisorPerformancePage.tsx

import { memo, useMemo } from 'react';
import {
  AlertCircle,
  Bird,
  ClipboardCheck,
  Loader2,
  RefreshCw,
  Scale,
  Store,
  TrendingUp,
  Users,
  Weight,
  X,
} from 'lucide-react';
import { useStaffPerformance } from '../hooks/useStaffPerformance';
import WeeklyActivityChart from '../components/performance/WeeklyActivityChart';
import RecentTripsTable from '../components/performance/RecentTripsTable';
import SearchInput from '../../fleet-operations/components/common/SearchInput';
import DateRangePicker from '../../fleet-operations/components/common/DateRangePicker';
import type { SupervisorPerformanceResponse } from '../types/performance';

const number = (value: number, digits = 0) =>
  Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: digits });

function Kpi({
  label,
  value,
  sub,
  icon,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  tone: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-start justify-between shadow-sm">
      <div>
        <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">{label}</div>
        <div className="text-xl font-extrabold text-slate-800 mt-1">{value}</div>
        {sub && <div className="text-[11px] text-slate-400 mt-0.5">{sub}</div>}
      </div>
      <div className={`p-2 rounded-lg ${tone}`}>{icon}</div>
    </div>
  );
}

const SupervisorPerformancePage = () => {
  const perf = useStaffPerformance('supervisors');
  const data = perf.data as SupervisorPerformanceResponse;

  const kpis = data.kpis;
  const weekly = useMemo(
    () =>
      (data.weekly || []).map((point) => ({
        week: point.week,
        trips: point.trips,
        birds: point.birds,
      })),
    [data.weekly]
  );

  const selectedRow = useMemo(
    () =>
      perf.selectedId != null
        ? data.rows.find((r) => r.supervisorId === perf.selectedId) ?? null
        : null,
    [data.rows, perf.selectedId]
  );

  return (
    <div className="w-full space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-black tracking-tight text-slate-900">SUPERVISOR PERFORMANCE</h2>
          <p className="mt-0.5 text-xs font-medium text-slate-500">
            Trip, shop, bird, weight and mortality aggregates per supervisor — read only
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
          {perf.refreshing && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 font-semibold text-slate-500">
              <Loader2 className="h-3 w-3 animate-spin text-emerald-600" /> Updating…
            </span>
          )}
          {perf.lastRefreshed && (
            <span className="hidden sm:inline">
              Last updated {new Date(perf.lastRefreshed).toLocaleTimeString('en-IN')}
            </span>
          )}
          <button
            type="button"
            onClick={perf.refresh}
            disabled={perf.loading || perf.refreshing}
            className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 shadow-xs transition-colors hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw size={13} className={perf.refreshing ? 'animate-spin text-emerald-600' : 'text-slate-400'} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-xs">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Date range</span>
          <DateRangePicker
            fromDate={perf.fromDate}
            toDate={perf.toDate}
            onFromDateChange={perf.setFromDate}
            onToDateChange={perf.setToDate}
            className="w-72"
          />
        </div>
        <div className="w-full min-w-[200px] sm:max-w-xs">
          <SearchInput
            value={perf.searchInput}
            onChange={perf.setSearchInput}
            placeholder="Search supervisor name…"
          />
        </div>
        {(perf.searchInput.trim() || perf.selectedId != null) && (
          <button
            type="button"
            onClick={perf.clearFilters}
            className="ml-auto flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 shadow-xs transition-colors hover:bg-slate-50"
          >
            <X size={13} className="text-slate-400" /> Clear
          </button>
        )}
      </div>

      {perf.error && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <span className="flex items-center gap-2"><AlertCircle size={16} />{perf.error}</span>
          <button type="button" onClick={perf.refresh} className="font-bold underline">Retry</button>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <Kpi label="Supervisors" value={perf.loading ? '—' : number(kpis.supervisors)} icon={<Users size={16} />} tone="bg-blue-50 text-blue-600" />
        <Kpi label="Trips" value={perf.loading ? '—' : number(kpis.trips)} icon={<ClipboardCheck size={16} />} tone="bg-indigo-50 text-indigo-600" />
        <Kpi label="Shops" value={perf.loading ? '—' : number(kpis.shops)} icon={<Store size={16} />} tone="bg-cyan-50 text-cyan-600" />
        <Kpi label="Birds" value={perf.loading ? '—' : number(kpis.birds)} icon={<Bird size={16} />} tone="bg-emerald-50 text-emerald-600" />
        <Kpi label="Weight" value={perf.loading ? '—' : `${number(kpis.weight)} kg`} icon={<Weight size={16} />} tone="bg-violet-50 text-violet-600" />
        <Kpi label="Mortality Rate" value={perf.loading ? '—' : `${number(kpis.mortalityRate, 2)}%`} icon={<Scale size={16} />} tone="bg-rose-50 text-rose-600" />
      </div>

      {/* Weekly chart */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
        <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Weekly Activity</h3>
        <p className="mb-3 mt-0.5 text-sm font-bold text-slate-800">Trips and birds by week</p>
        <WeeklyActivityChart
          data={weekly}
          bars={[
            { key: 'trips', label: 'Trips', color: '#2563eb' },
            { key: 'birds', label: 'Birds', color: '#10b981' },
          ]}
          emptyText="No weekly activity for the selected filters."
        />
      </div>

      {/* Rows table */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
        <div>
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Supervisors</h3>
          <p className="mt-0.5 text-sm font-bold text-slate-800">
            Delivery volume and mortality per supervisor — click a row for trip detail
          </p>
        </div>

        {perf.loading && !selectedRow ? (
          <div className="mt-3 space-y-2">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-11 animate-pulse rounded-lg bg-slate-100" />
            ))}
          </div>
        ) : data.rows.length === 0 ? (
          <div className="flex flex-col items-center py-14 text-center">
            <ClipboardCheck className="mx-auto mb-3 text-slate-300" size={42} />
            <p className="font-bold text-slate-700">No supervisor activity</p>
            <p className="mt-1 text-sm text-slate-400">
              No completed trips found for the selected period.
            </p>
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50/80">
                <tr>
                  <th className="px-3 py-2.5 text-left text-[10px] font-black uppercase tracking-wider text-slate-500">Supervisor</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-black uppercase tracking-wider text-slate-500">Status</th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-black uppercase tracking-wider text-slate-500">Trips</th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-black uppercase tracking-wider text-slate-500">Shops</th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-black uppercase tracking-wider text-slate-500">Birds</th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-black uppercase tracking-wider text-slate-500">Weight (kg)</th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-black uppercase tracking-wider text-slate-500">Mortality</th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-black uppercase tracking-wider text-slate-500">Mortality %</th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-black uppercase tracking-wider text-slate-500">Weight Loss</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {data.rows.map((row) => {
                  const selected = row.supervisorId === perf.selectedId;
                  return (
                    <tr
                      key={row.supervisorId}
                      onClick={() => perf.selectRow(selected ? null : row.supervisorId)}
                      className={`cursor-pointer transition-colors ${selected ? 'bg-emerald-50/70' : 'hover:bg-slate-50/70'}`}
                    >
                      <td className="whitespace-nowrap px-3 py-2.5 text-xs font-bold text-slate-900">{row.supervisorName}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-xs text-slate-600">{row.employeeStatus}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right text-xs tabular-nums text-slate-600">{number(row.trips)}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right text-xs tabular-nums text-slate-600">{number(row.shops)}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right text-xs tabular-nums text-slate-600">{number(row.birds)}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right text-xs tabular-nums text-slate-700">{number(row.weight)}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right text-xs tabular-nums text-slate-600">{number(row.mortality)}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right text-xs tabular-nums text-slate-600">{number(row.mortalityRate, 2)}%</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right text-xs tabular-nums text-slate-600">{number(row.weightLoss, 1)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail panel */}
      {perf.selectedId != null && (
        <div className="rounded-xl border border-emerald-200 bg-white p-5 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600"><TrendingUp size={16} /></div>
              <div>
                <h3 className="text-sm font-black text-slate-900">{selectedRow?.supervisorName ?? 'Supervisor detail'}</h3>
                <p className="text-[11px] font-medium text-slate-500">
                  {selectedRow
                    ? `${number(selectedRow.shops)} shops · ${number(selectedRow.birds)} birds · ${number(selectedRow.mortalityRate, 2)}% mortality`
                    : 'Loading detail…'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => perf.selectRow(null)}
              className="flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50"
            >
              <X size={13} /> Close
            </button>
          </div>

          {perf.loading ? (
            <div className="mt-4 space-y-2">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="h-10 animate-pulse rounded-lg bg-slate-100" />
              ))}
            </div>
          ) : data.detail ? (
            <div className="mt-4">
              <h4 className="mb-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400">
                <ClipboardCheck size={12} /> Recent Trips
              </h4>
              <RecentTripsTable trips={data.detail.recentTrips} />
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 py-6 text-center text-sm font-medium text-slate-400">
              No detail available for the selected period.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default memo(SupervisorPerformancePage);