// src/modules/staff/pages/DriverPerformancePage.tsx

import { memo, useMemo } from 'react';
import {
  AlertCircle,
  Fuel,
  Gauge,
  Loader2,
  MapPin,
  RefreshCw,
  Route,
  TrendingUp,
  Truck,
  Wallet,
  X,
} from 'lucide-react';
import { useStaffPerformance } from '../hooks/useStaffPerformance';
import WeeklyActivityChart from '../components/performance/WeeklyActivityChart';
import RecentTripsTable from '../components/performance/RecentTripsTable';
import SearchInput from '../../fleet-operations/components/common/SearchInput';
import DateRangePicker from '../../fleet-operations/components/common/DateRangePicker';
import type { DriverPerformanceResponse } from '../types/performance';

const money = (value: number, digits = 0) =>
  `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: digits })}`;
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

const DriverPerformancePage = () => {
  const perf = useStaffPerformance('drivers');
  const data = perf.data as DriverPerformanceResponse;

  const kpis = data.kpis;
  const weekly = useMemo(
    () =>
      (data.weekly || []).map((point) => ({
        week: point.week,
        distance: point.distance,
        fuelLitres: point.fuelLitres,
      })),
    [data.weekly]
  );

  const selectedRow = useMemo(
    () => (perf.selectedId != null ? data.rows.find((r) => r.driverId === perf.selectedId) ?? null : null),
    [data.rows, perf.selectedId]
  );

  return (
    <div className="w-full space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-black tracking-tight text-slate-900">DRIVER PERFORMANCE</h2>
          <p className="mt-0.5 text-xs font-medium text-slate-500">
            Trip, fuel, maintenance and cost aggregates per driver — read only
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
            placeholder="Search driver name…"
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
        <Kpi label="Drivers" value={perf.loading ? '—' : number(kpis.drivers)} icon={<Truck size={16} />} tone="bg-blue-50 text-blue-600" />
        <Kpi label="Trips" value={perf.loading ? '—' : number(kpis.trips)} icon={<Route size={16} />} tone="bg-indigo-50 text-indigo-600" />
        <Kpi label="Distance" value={perf.loading ? '—' : `${number(kpis.distance)} km`} icon={<MapPin size={16} />} tone="bg-cyan-50 text-cyan-600" />
        <Kpi label="Mileage" value={perf.loading ? '—' : `${number(kpis.mileage, 1)} km/L`} icon={<Gauge size={16} />} tone="bg-emerald-50 text-emerald-600" />
        <Kpi label="Total Cost" value={perf.loading ? '—' : money(kpis.totalCost)} icon={<Wallet size={16} />} tone="bg-rose-50 text-rose-600" />
        <Kpi label="Cost / Km" value={perf.loading ? '—' : money(kpis.costPerKm, 1)} icon={<TrendingUp size={16} />} tone="bg-violet-50 text-violet-600" />
      </div>

      {/* Weekly chart */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
        <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Weekly Activity</h3>
        <p className="mb-3 mt-0.5 text-sm font-bold text-slate-800">Distance and fuel by week</p>
        <WeeklyActivityChart
          data={weekly}
          bars={[
            { key: 'distance', label: 'Distance (km)', color: '#2563eb' },
            { key: 'fuelLitres', label: 'Fuel (L)', color: '#f59e0b' },
          ]}
          emptyText="No weekly activity for the selected filters."
        />
      </div>

      {/* Rows table */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Drivers</h3>
            <p className="mt-0.5 text-sm font-bold text-slate-800">
              Cost and mileage per driver — click a row for vehicle and trip detail
            </p>
          </div>
        </div>

        {perf.loading && !selectedRow ? (
          <div className="mt-3 space-y-2">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-11 animate-pulse rounded-lg bg-slate-100" />
            ))}
          </div>
        ) : data.rows.length === 0 ? (
          <div className="flex flex-col items-center py-14 text-center">
            <Route className="mx-auto mb-3 text-slate-300" size={42} />
            <p className="font-bold text-slate-700">No driver activity</p>
            <p className="mt-1 text-sm text-slate-400">
              No completed trips found for the selected period.
            </p>
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50/80">
                <tr>
                  <th className="px-3 py-2.5 text-left text-[10px] font-black uppercase tracking-wider text-slate-500">Driver</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-black uppercase tracking-wider text-slate-500">Status</th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-black uppercase tracking-wider text-slate-500">Trips</th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-black uppercase tracking-wider text-slate-500">KM</th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-black uppercase tracking-wider text-slate-500">Avg/Trip</th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-black uppercase tracking-wider text-slate-500">Vehicles</th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-black uppercase tracking-wider text-slate-500">Fuel (L)</th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-black uppercase tracking-wider text-slate-500">Fuel Cost</th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-black uppercase tracking-wider text-slate-500">Maint</th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-black uppercase tracking-wider text-slate-500">Toll</th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-black uppercase tracking-wider text-slate-500">Other</th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-black uppercase tracking-wider text-slate-500">Total Cost</th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-black uppercase tracking-wider text-slate-500">₹/km</th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-black uppercase tracking-wider text-slate-500">Mileage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {data.rows.map((row) => {
                  const selected = row.driverId === perf.selectedId;
                  return (
                    <tr
                      key={row.driverId}
                      onClick={() => perf.selectRow(selected ? null : row.driverId)}
                      className={`cursor-pointer transition-colors ${selected ? 'bg-emerald-50/70' : 'hover:bg-slate-50/70'}`}
                    >
                      <td className="whitespace-nowrap px-3 py-2.5 text-xs font-bold text-slate-900">{row.driverName}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-xs text-slate-600">{row.employeeStatus}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right text-xs tabular-nums text-slate-600">{number(row.trips)}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right text-xs tabular-nums text-slate-700">{number(row.distance)}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right text-xs tabular-nums text-slate-600">{number(row.avgDistancePerTrip, 1)}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right text-xs tabular-nums text-slate-600">{number(row.vehicles)}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right text-xs tabular-nums text-slate-600">{number(row.fuelLitres, 1)}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right text-xs tabular-nums text-slate-700">{money(row.fuelCost)}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right text-xs tabular-nums text-slate-700">{money(row.maintenanceCost)}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right text-xs tabular-nums text-slate-700">{money(row.tollCost)}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right text-xs tabular-nums text-slate-700">{money(row.otherCost)}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right text-xs font-bold tabular-nums text-slate-800">{money(row.totalCost)}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right text-xs tabular-nums text-slate-600">{number(row.costPerKm, 1)}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right text-xs tabular-nums text-slate-600">{number(row.mileage, 1)}</td>
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
                <h3 className="text-sm font-black text-slate-900">{selectedRow?.driverName ?? 'Driver detail'}</h3>
                <p className="text-[11px] font-medium text-slate-500">
                  {selectedRow ? `${selectedRow.vehicleNos.join(', ') || 'No vehicles'} · avg ${number(selectedRow.avgDistancePerTrip, 1)} km/trip` : 'Loading detail…'}
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
            <div className="mt-4 space-y-5">
              <div>
                <h4 className="mb-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  <MapPin size={12} /> Vehicles
                </h4>
                {data.detail.vehicles.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 py-6 text-center text-sm font-medium text-slate-400">
                    No vehicle detail for the selected period.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="min-w-full divide-y divide-slate-100">
                      <thead className="bg-slate-50/80">
                        <tr>
                          <th className="px-3 py-2.5 text-left text-[10px] font-black uppercase tracking-wider text-slate-500">Vehicle No</th>
                          <th className="px-3 py-2.5 text-right text-[10px] font-black uppercase tracking-wider text-slate-500">Trips</th>
                          <th className="px-3 py-2.5 text-right text-[10px] font-black uppercase tracking-wider text-slate-500">KM</th>
                          <th className="px-3 py-2.5 text-right text-[10px] font-black uppercase tracking-wider text-slate-500">Avg/Trip</th>
                          <th className="px-3 py-2.5 text-right text-[10px] font-black uppercase tracking-wider text-slate-500">Fuel (L)</th>
                          <th className="px-3 py-2.5 text-right text-[10px] font-black uppercase tracking-wider text-slate-500">Fuel Cost</th>
                          <th className="px-3 py-2.5 text-right text-[10px] font-black uppercase tracking-wider text-slate-500">Maint</th>
                          <th className="px-3 py-2.5 text-right text-[10px] font-black uppercase tracking-wider text-slate-500">Total Cost</th>
                          <th className="px-3 py-2.5 text-right text-[10px] font-black uppercase tracking-wider text-slate-500">Mileage</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {data.detail.vehicles.map((vehicle) => (
                          <tr key={vehicle.vehicleNo} className="transition-colors hover:bg-slate-50/70">
                            <td className="whitespace-nowrap px-3 py-2.5 text-xs font-bold text-slate-800">{vehicle.vehicleNo}</td>
                            <td className="whitespace-nowrap px-3 py-2.5 text-right text-xs tabular-nums text-slate-600">{number(vehicle.trips)}</td>
                            <td className="whitespace-nowrap px-3 py-2.5 text-right text-xs tabular-nums text-slate-700">{number(vehicle.distance)}</td>
                            <td className="whitespace-nowrap px-3 py-2.5 text-right text-xs tabular-nums text-slate-600">{number(vehicle.avgDistancePerTrip, 1)}</td>
                            <td className="whitespace-nowrap px-3 py-2.5 text-right text-xs tabular-nums text-slate-600">{number(vehicle.fuelLitres, 1)}</td>
                            <td className="whitespace-nowrap px-3 py-2.5 text-right text-xs tabular-nums text-slate-700">{money(vehicle.fuelCost)}</td>
                            <td className="whitespace-nowrap px-3 py-2.5 text-right text-xs tabular-nums text-slate-700">{money(vehicle.maintenanceCost)}</td>
                            <td className="whitespace-nowrap px-3 py-2.5 text-right text-xs font-bold tabular-nums text-slate-800">{money(vehicle.totalCost)}</td>
                            <td className="whitespace-nowrap px-3 py-2.5 text-right text-xs tabular-nums text-slate-600">{number(vehicle.mileage, 1)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div>
                <h4 className="mb-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  <Fuel size={12} /> Recent Trips
                </h4>
                <RecentTripsTable trips={data.detail.recentTrips} />
              </div>
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

export default memo(DriverPerformancePage);