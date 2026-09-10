import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, Search, Truck } from 'lucide-react';
import { useI18n, translateStatus } from '../../../i18n';
import ErrorBoundary from '../components/common/ErrorBoundary';
import EmiFilterBar from '../components/emi/EmiFilterBar';
import EmiPagination from '../components/emi/EmiPagination';
import EmiRefreshToast from '../components/emi/EmiRefreshToast';
import EmiVehicleMark from '../components/emi/EmiVehicleMark';
import { useEmiData } from '../hooks/useEmiData';
import { EMI_TIME_ZONE, normalizeEmiSearch, sortEmiOverview, type EmiSortKey, type EmiSortDirection } from '../services/emiModel';
import type { EmiOverview } from '../types';

interface EmiLoansPageProps {
  embedded?: boolean;
  active?: boolean;
}

const PAGE_SIZE = 10;
const currencyFormatter = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
const money = (value: number | null) => value != null && Number.isFinite(value) ? `₹${currencyFormatter.format(value)}` : '—';
const COLUMNS: { key: EmiSortKey; label: string; align: 'left' | 'right' | 'center'; width?: string }[] = [
  { key: 'vehicleNumber', label: 'fleet.emi.col_vehicle_no', align: 'left', width: '160px' },
  { key: 'purchaseAmount', label: 'fleet.emi.col_purchase_amount', align: 'center', width: '180px' },
  { key: 'totalEMIs', label: 'fleet.emi.col_total_emi', align: 'center' },
  { key: 'completedEMIs', label: 'fleet.emi.col_completed', align: 'center' },
  { key: 'pendingEMIs', label: 'fleet.emi.col_pending', align: 'center' },
  { key: 'emiStartDate', label: 'fleet.emi.col_emi_date', align: 'center' },
  { key: 'status', label: 'common.status', align: 'center' },
];

const StatusBadge = memo(function StatusBadge({ status }: { status: EmiOverview['status'] }) {
  const { t } = useI18n();
  const completed = status === 'COMPLETED';
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${
      completed ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'
    }`}>
      {translateStatus(t, status)}
    </span>
  );
});

const CompletedCell = ({ completed, total }: { completed: number; total: number | null }) => (
  <div className="flex min-w-0 items-center justify-center gap-1.5 overflow-hidden">
    <span className="min-w-0 truncate text-[13px] font-semibold tabular-nums text-slate-700" title={String(completed)}>{completed}</span>
    {total != null && total > 0 && <span className="min-w-0 truncate text-[11px] text-slate-500" title={String(total)}>/ {total}</span>}
  </div>
);

const EmiLoansPage = ({ embedded = false, active = true }: EmiLoansPageProps) => {
  const { t, language } = useI18n();
  const { allRecords, kpis, loading, refreshing, error, hasSnapshot, refresh, refreshStatus, refreshEventId, clearRefreshStatus, lastRefreshed } = useEmiData(active);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<EmiOverview['status'] | 'all'>('all');
  const [sortKey, setSortKey] = useState<EmiSortKey>('vehicleNumber');
  const [sortDir, setSortDir] = useState<EmiSortDirection>('asc');
  const [page, setPage] = useState(1);

  const reset = useCallback(() => { setSearch(''); setStatusFilter('all'); setPage(1); }, []);
  const handleSearchChange = useCallback((value: string) => { setSearch(value); setPage(1); }, []);
  const handleStatusChange = useCallback((value: EmiOverview['status'] | 'all') => { setStatusFilter(value); setPage(1); }, []);

  // Sorting and indexing happen only for new data / a new sort. Keystrokes do
  // one inexpensive filter pass, not a new sort or an API request.
  const orderedRecords = useMemo(() => sortEmiOverview(allRecords, sortKey, sortDir), [allRecords, sortKey, sortDir]);
  const searchIndex = useMemo(() => new Map(allRecords.map((row) => [row.vehicleId, normalizeEmiSearch(row.vehicleNumber)])), [allRecords]);
  const query = normalizeEmiSearch(search);
  const filtered = useMemo(() => orderedRecords.filter((row) =>
    (statusFilter === 'all' || row.status === statusFilter) && (!query || searchIndex.get(row.vehicleId)!.includes(query)),
  ), [orderedRecords, statusFilter, query, searchIndex]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = useMemo(() => filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE), [filtered, safePage]);
  useEffect(() => {
    // The displayed page is already clamped. Reconcile the stored page too so
    // a later refresh that grows the dataset cannot jump back to an old page.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const nextSortDirection = (key: EmiSortKey): EmiSortDirection =>
    key === sortKey ? (sortDir === 'asc' ? 'desc' : 'asc') : key === 'status' ? 'asc' : 'desc';
  const toggleSort = (key: EmiSortKey) => {
    if (key === 'vehicleNumber') return;
    setSortDir(nextSortDirection(key));
    setSortKey(key);
    setPage(1);
  };

  const formatters = useMemo(() => ({
    date: new Intl.DateTimeFormat(language === 'te' ? 'te-IN' : 'en-IN', { timeZone: 'UTC', day: '2-digit', month: 'short', year: 'numeric' }),
    updated: new Intl.DateTimeFormat(language === 'te' ? 'te-IN' : 'en-IN', { timeZone: EMI_TIME_ZONE, day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }),
  }), [language]);
  const formatDate = (value: string | null) => value ? formatters.date.format(new Date(`${value}T00:00:00Z`)) : '—';
  const updated = lastRefreshed ? t('fleet.emi.updated_at', { time: formatters.updated.format(new Date(lastRefreshed)) }) : '';
  const info = loading ? t('fleet.emi.loading_records')
    : refreshing ? t('fleet.emi.refreshing_records')
    : error === 'access' ? t('fleet.emi.access_denied')
    : error === 'load' ? t('fleet.emi.load_failed')
    : error === 'refresh' ? `${t('fleet.emi.stale_after_error')} ${updated}`
    : `${updated} · ${t('fleet.emi.due_date_note')}`;

  return (
    <ErrorBoundary>
      <div className={`w-full space-y-5 ${embedded ? '' : 'px-4 py-6 md:px-8 md:py-8'}`}>
        <EmiRefreshToast show={refreshStatus === 'success'} active={active} eventId={refreshEventId} onDismiss={clearRefreshStatus} />
        <EmiFilterBar
          search={search}
          status={statusFilter}
          onSearchChange={handleSearchChange}
          onStatusChange={handleStatusChange}
          onReset={reset}
          onRefresh={refresh}
          loading={loading}
          refreshing={refreshing}
          hasSnapshot={hasSnapshot}
          kpis={kpis}
        />

        <div className="rounded-xl border border-slate-200 bg-white shadow-xs">
          <div className="border-b border-slate-200 px-4 py-3">
            <div className="flex h-10 items-center justify-between gap-3">
              <div className="flex shrink-0 items-center gap-2.5">
                <EmiVehicleMark />
                <h3 className="text-base font-semibold tracking-tight text-slate-800">{t('fleet.emi.schedule_title')}</h3>
                <span className="hidden rounded-md bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-500 sm:inline">{t('fleet.emi.read_only')}</span>
              </div>
            </div>
            <div className="mt-1 flex h-6 items-center gap-2">
              <p role="status" aria-label={t('fleet.emi.data_status')} aria-live={refreshStatus === 'success' ? 'off' : 'polite'} aria-atomic="true" title={info} className={`min-w-0 flex-1 truncate text-xs ${error ? 'text-amber-700' : 'text-slate-500'}`}>
                {info}
              </p>
            </div>
          </div>

          {/* Fixed columns and a reserved ten-row viewport prevent loading,
              shorter pages and refreshes from moving the toolbar/footer. */}
          <div className="min-h-[530px] overflow-x-auto" data-emi-table-frame>
            <table aria-label={t('fleet.emi.schedule_title')} aria-busy={loading || refreshing} className="w-full min-w-[1040px] table-fixed divide-y divide-slate-100">
              <colgroup>{COLUMNS.map((column) => <col key={column.key} style={{ width: column.width }} />)}</colgroup>
              <thead className="sticky top-0 z-10 bg-slate-50">
                <tr className="h-12">
                  {COLUMNS.map((column) => (
                    <th
                      key={column.key}
                      scope="col"
                      aria-sort={column.key !== 'vehicleNumber' && sortKey === column.key ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined}
                      className={`px-3 py-2 ${column.align === 'right' ? 'text-right' : column.align === 'center' ? 'text-center' : 'text-left'}`}
                    >
                      {column.key === 'vehicleNumber' ? (
                        <span className="text-xs font-bold uppercase tracking-wide text-slate-600">{t(column.label)}</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => toggleSort(column.key)}
                          title={`${t(column.label)} · ${t(nextSortDirection(column.key) === 'asc' ? 'common.ascending' : 'common.descending')}`}
                          className={`inline-flex min-h-6 items-center gap-1.5 whitespace-nowrap rounded-md px-1.5 py-1 text-xs font-bold uppercase tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 ${sortKey === column.key ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'}`}
                        >
                          <span>{t(column.label)}</span>
                          {sortKey === column.key ? (
                            sortDir === 'asc' ? <ArrowUp size={13} aria-hidden="true" className="shrink-0" /> : <ArrowDown size={13} aria-hidden="true" className="shrink-0" />
                          ) : <ArrowUpDown size={13} aria-hidden="true" className="shrink-0 text-slate-400" />}
                        </button>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {loading ? Array.from({ length: PAGE_SIZE }, (_, index) => (
                  <tr key={`loading-${index}`} className="h-12" aria-hidden="true">
                    {COLUMNS.map((column) => <td key={column.key} className="px-3"><div className="h-3 w-3/4 rounded bg-slate-100" /></td>)}
                  </tr>
                )) : !hasSnapshot && error ? (
                  <tr><td colSpan={COLUMNS.length} className="h-[480px] px-6 text-center">
                    <AlertTriangle size={32} aria-hidden="true" className="mx-auto mb-3 text-amber-400" />
                    <p className="text-sm font-semibold text-slate-700">{t(error === 'access' ? 'fleet.emi.access_denied' : 'fleet.emi.load_failed')}</p>
                    <p className="mt-1 text-xs text-slate-400">{t(error === 'access' ? 'fleet.emi.access_hint' : 'fleet.emi.load_error_hint')}</p>
                  </td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={COLUMNS.length} className="h-[480px] px-6 text-center">
                    {allRecords.length === 0 ? <Truck size={32} aria-hidden="true" className="mx-auto mb-3 text-slate-300" /> : <Search size={32} aria-hidden="true" className="mx-auto mb-3 text-slate-300" />}
                    <p className="text-sm font-semibold text-slate-700">{t(allRecords.length === 0 ? 'fleet.emi.no_records' : 'fleet.emi.no_vehicles_match')}</p>
                    {allRecords.length === 0 ? <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-slate-400">{t('fleet.emi.no_records_hint')}</p> : (
                      <button type="button" onClick={reset} className="mt-3 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30">{t('fleet.emi.clear_filters')}</button>
                    )}
                  </td></tr>
                ) : paged.map((record) => (
                  <tr key={record.vehicleId} data-vehicle-id={record.vehicleId} className="h-12 transition-colors hover:bg-slate-50/70">
                    <td className="px-3 text-[13px] font-semibold text-slate-900">
                      <span className="block truncate" title={record.vehicleNumber}>{record.vehicleNumber || '—'}</span>
                    </td>
                    <td title={money(record.purchaseAmount)} className="truncate px-3 text-center text-[13px] tabular-nums text-slate-700">{money(record.purchaseAmount)}</td>
                    <td title={String(record.totalEMIs ?? '—')} className="truncate px-3 text-center text-[13px] tabular-nums text-slate-700">{record.totalEMIs ?? '—'}</td>
                    <td className="whitespace-nowrap px-3 text-center"><CompletedCell completed={record.completedEMIs} total={record.totalEMIs} /></td>
                    <td title={String(record.pendingEMIs)} className="truncate px-3 text-center text-[13px] font-semibold tabular-nums text-slate-700">{record.pendingEMIs}</td>
                    <td className="whitespace-nowrap px-3 text-center text-[13px] tabular-nums text-slate-600">{formatDate(record.emiStartDate)}</td>
                    <td className="whitespace-nowrap px-3 text-center"><StatusBadge status={record.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <EmiPagination page={safePage} totalPages={totalPages} totalItems={filtered.length} pageSize={PAGE_SIZE} ready={hasSnapshot && !loading} onChange={setPage} />
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default memo(EmiLoansPage);
