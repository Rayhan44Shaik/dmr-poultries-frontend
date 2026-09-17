import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import autoTable from 'jspdf-autotable';
import type { jsPDF } from 'jspdf';
import { useI18n } from '../../../i18n';
import { useAnalyticsData } from '../hooks/useAnalyticsData';
import ErrorBoundary from '../components/common/ErrorBoundary';
import ExpenseBreakdownDonut from '../components/analytics/ExpenseBreakdownDonut';
import VehiclePerformanceChart from '../components/analytics/VehiclePerformanceChart';
import WeeklyTrendChart from '../components/analytics/WeeklyTrendChart';
import VehiclePerformanceTable from '../components/analytics/VehiclePerformanceTable';
import AttentionSection from '../components/analytics/AttentionSection';
import { DatePicker } from '../../../components/common/DatePicker';
import {
  Activity,
  Banknote,
  Calendar,
  FileSpreadsheet,
  FileText,
  Fuel,
  Gauge,
  IndianRupee,
  RotateCcw,
  Search,
  TrendingUp,
  Truck,
  Wrench,
} from 'lucide-react';
import { formatCurrencyCompact, formatNumberCompact } from '../utils/formatters';
import {
  opsFilterCardClass,
  opsFilterLabelClass,
  opsInputClass,
  opsSecondaryButtonClass,
  opsPdfButtonClass,
  opsExcelButtonClass,
} from '../../../shared/ui/operationsStyles';
import {
  BrandRefreshButton,
  KpiCardGrid,
  type KpiCardItem,
  type KpiTone,
} from '../../../ui';
import MasterDropdown from '../../masters/components/MasterDropdown';
import { createDmrPoultryPdf, drawDmrPoultryHeader } from '../../../utils/drawDmrPoultryHeader';
import henImage from '../../../assets/dmr-hen.jpg';
import { useSafeNotification } from '../../../hooks/useSafeNotification';

interface VehicleAnalyticsPageProps {
  embedded?: boolean;
  active?: boolean;
}

interface KpiDef {
  label: string;
  value: string;
  icon: typeof Truck;
  tone: KpiTone;
}

const SkeletonKpis = () => (
  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
    {Array.from({ length: 9 }).map((_, index) => (
      <div key={index} className="min-h-[6.75rem] animate-pulse rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex items-start justify-between">
          <div className="w-2/3">
            <div className="h-3 w-3/4 rounded bg-slate-100" />
            <div className="mt-3 h-6 w-1/2 rounded bg-slate-100" />
          </div>
          <div className="h-11 w-11 rounded-xl bg-slate-100" />
        </div>
      </div>
    ))}
  </div>
);

const SkeletonCharts = () => (
  <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
    <div className="animate-pulse rounded-xl border border-slate-200 bg-white p-4 lg:col-span-2">
      <div className="h-4 w-40 rounded bg-slate-100" />
      <div className="mt-3 h-64 rounded-xl bg-slate-50" />
    </div>
    <div className="animate-pulse rounded-xl border border-slate-200 bg-white p-4">
      <div className="h-4 w-32 rounded bg-slate-100" />
      <div className="mt-3 h-64 rounded-xl bg-slate-50" />
    </div>
    <div className="animate-pulse rounded-xl border border-slate-200 bg-white p-4 lg:col-span-2">
      <div className="h-4 w-40 rounded bg-slate-100" />
      <div className="mt-3 h-60 rounded-xl bg-slate-50" />
    </div>
    <div className="animate-pulse rounded-xl border border-slate-200 bg-white p-4">
      <div className="h-4 w-32 rounded bg-slate-100" />
      <div className="mt-3 h-60 rounded-xl bg-slate-50" />
    </div>
    <div className="animate-pulse rounded-xl border border-slate-200 bg-white p-4">
      <div className="h-4 w-40 rounded bg-slate-100" />
      <div className="mt-3 h-40 rounded-xl bg-slate-50" />
    </div>
  </div>
);

const VehicleAnalyticsPage = ({ embedded = false, active = true }: VehicleAnalyticsPageProps) => {
  const { t } = useI18n();
  const {
    stats,
    weeklyData,
    expenseBreakdown,
    vehicleStats,
    vehicleStatusById,
    fromDate,
    toDate,
    setFromDate,
    setToDate,
    selectedVehicleId,
    setSelectedVehicleId,
    vehicleOptions,
    vehiclesLoading,
    clearFilters,
    loading,
    refreshing,
    error,
    refresh,
    lastRefreshed,
  } = useAnalyticsData(active);

  const selectedOption = useMemo(
    () => vehicleOptions.find((option) => option.value === selectedVehicleId) ?? null,
    [vehicleOptions, selectedVehicleId]
  );

  const showSkeleton = loading && !lastRefreshed;

  const utilization = useMemo(() => {
    const total = vehicleStats.length;
    if (total === 0) return 0;
    const active = vehicleStats.filter((row) => row.trips > 0 || row.distance > 0).length;
    return Math.round((active / total) * 100);
  }, [vehicleStats]);

  const kpis = useMemo<KpiDef[]>(() => {
    const costPerKm = stats.costPerKm > 0 ? `₹${stats.costPerKm.toFixed(2)}` : '—';
    return [
      { label: t('fleet.analytics.total_trips'), value: formatNumberCompact(stats.totalTrips), icon: Truck, tone: 'blue' },
      { label: t('fleet.analytics.total_distance'), value: `${formatNumberCompact(stats.totalDistance)} km`, icon: TrendingUp, tone: 'cyan' },
      { label: t('fleet.analytics.fuel_used'), value: `${formatNumberCompact(stats.totalFuelLitres)} L`, icon: Fuel, tone: 'amber' },
      { label: t('fleet.analytics.avg_mileage'), value: stats.averageMileage > 0 ? `${stats.averageMileage.toFixed(2)} km/l` : '—', icon: Gauge, tone: 'emerald' },
      { label: t('fleet.analytics.vehicle_utilization'), value: `${utilization}%`, icon: Activity, tone: 'cyan' },
      { label: t('fleet.analytics.fuel_cost'), value: formatCurrencyCompact(stats.fuelCost), icon: Banknote, tone: 'blue' },
      { label: t('fleet.analytics.maint_cost'), value: formatCurrencyCompact(stats.maintenanceCost), icon: Wrench, tone: 'violet' },
      { label: t('fleet.analytics.total_fleet_cost'), value: formatCurrencyCompact(stats.totalExpense), icon: IndianRupee, tone: 'rose' },
      { label: t('fleet.analytics.cost_per_km'), value: costPerKm, icon: Activity, tone: 'amber' },
    ];
  }, [stats, utilization, t]);

  const kpiCards = useMemo<KpiCardItem[]>(
    () =>
      kpis.map((kpi) => ({
        id: kpi.label,
        label: kpi.label,
        value: kpi.value,
        tooltip: `${kpi.label}: ${kpi.value}`,
        Icon: kpi.icon,
        tone: kpi.tone,
      })),
    [kpis]
  );

  const hasAnyData = stats.totalTrips > 0 || stats.totalDistance > 0 || stats.totalExpense > 0;

  const { showNotification } = useSafeNotification();

  // Vehicle picker rebuilt on the shared MasterDropdown (id-backed options), so
  // Analytics uses the exact same searchable/clearable control as the Trip List
  // filter bar rather than a bespoke react-select.
  const vehicleDropdownOptions = useMemo(
    () => vehicleOptions.map((option) => ({ value: String(option.value), label: option.label })),
    [vehicleOptions]
  );

  // Free-text filter over the Vehicle Details table — mirrors the Trip List
  // search box. It narrows the rendered per-vehicle rows by vehicle number.
  const [search, setSearch] = useState('');
  const searchLower = search.trim().toLowerCase();
  const filteredVehicleStats = useMemo(
    () =>
      searchLower
        ? vehicleStats.filter((row) => (row.vehicleNumber || '').toLowerCase().includes(searchLower))
        : vehicleStats,
    [vehicleStats, searchLower]
  );

  const onReset = useCallback(() => {
    setSearch('');
    clearFilters();
  }, [clearFilters]);

  const exportFileName = useCallback(
    (ext: 'xlsx' | 'pdf') => `vehicle-analytics_${fromDate}_${toDate}.${ext}`,
    [fromDate, toDate]
  );

  const exportExcel = useCallback(() => {
    if (!hasAnyData) {
      showNotification(t('fleet.analytics.no_data'), 'error');
      return;
    }
    try {
      const inr = (v: number) => Number((v || 0).toFixed(2));
      const summaryRows = kpis.map((kpi) => ({
        [t('common.metric')]: kpi.label,
        [t('common.value')]: kpi.value,
      }));
      const detailRows = filteredVehicleStats.map((row) => ({
        [t('fleet.analytics.table_vehicle')]: row.vehicleNumber,
        [t('fleet.analytics.table_trips')]: row.trips,
        [t('fleet.analytics.table_distance')]: inr(row.distance),
        [t('fleet.analytics.table_fuel_vol')]: inr(row.fuelLitres),
        [t('fleet.analytics.table_mileage')]: inr(row.mileage),
        [t('fleet.analytics.table_fuel_cost')]: inr(row.fuelCost),
        [t('fleet.analytics.table_maint_cost')]: inr(row.maintenanceCost),
        [t('fleet.analytics.table_total_cost')]: inr(row.totalExpense),
      }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), 'Summary');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detailRows), 'Vehicles');
      XLSX.writeFile(wb, exportFileName('xlsx'));
      showNotification(t('notification.export_success'), 'success');
    } catch {
      showNotification(t('fleet.validation.failed'), 'error');
    }
  }, [hasAnyData, kpis, filteredVehicleStats, exportFileName, showNotification, t]);

  const exportPDF = useCallback(async () => {
    if (!hasAnyData) {
      showNotification(t('fleet.analytics.no_data'), 'error');
      return;
    }
    try {
      const NAVY: [number, number, number] = [52, 68, 115];
      const RED: [number, number, number] = [222, 96, 110];
      const MUTED: [number, number, number] = [110, 118, 132];
      const HEAD_BG: [number, number, number] = [52, 68, 115];
      const ZEBRA_BG: [number, number, number] = [248, 250, 252];
      const MARGIN = 12;
      const inr = (v: number) =>
        new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0);
      const num = (v: number) => new Intl.NumberFormat('en-IN').format(Math.round(v || 0));

      const doc: jsPDF = createDmrPoultryPdf('portrait');
      doc.setProperties({
        title: 'Vehicle Analytics',
        subject: 'DMR POULTRIES vehicle analytics',
        author: 'DMR POULTRIES',
        creator: 'DMR POULTRIES',
      });

      const headerBottom = await drawDmrPoultryHeader(doc, { margin: MARGIN, top: 8, henUrl: henImage });
      const pageWidth = doc.internal.pageSize.getWidth();

      let y = headerBottom + 2;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
      doc.text(t('fleet.analytics.vehicle_performance'), pageWidth / 2, y, { align: 'center' });
      y += 6;

      const metaParts = [
        `${t('common.from')}: ${fromDate || 'N/A'}`,
        `${t('common.to')}: ${toDate || 'N/A'}`,
      ];
      if (selectedOption) metaParts.push(`${t('common.vehicle')}: ${selectedOption.label}`);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
      doc.text(metaParts.join('    •    '), pageWidth / 2, y, { align: 'center' });
      y += 6;

      // ── Section 1: KPI summary ───────────────────────────────────────────
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
      doc.text(t('fleet.analytics.total_fleet_cost'), MARGIN, y);
      doc.setDrawColor(RED[0], RED[1], RED[2]);
      doc.setLineWidth(0.4);
      doc.line(MARGIN, y + 1.6, MARGIN + 46, y + 1.6);
      y += 5;

      autoTable(doc, {
        head: [[t('common.metric'), t('common.value')]],
        body: kpis.map((kpi) => [kpi.label, kpi.value]),
        startY: y,
        theme: 'grid',
        margin: { left: MARGIN, right: MARGIN },
        headStyles: { fillColor: HEAD_BG, textColor: 255, fontStyle: 'bold', fontSize: 8.5, halign: 'center', cellPadding: 2.2, lineWidth: 0.1, lineColor: [255, 255, 255] },
        bodyStyles: { fontSize: 8.5, textColor: [30, 30, 30], cellPadding: 2.2, lineWidth: 0.1, lineColor: [214, 220, 230] },
        alternateRowStyles: { fillColor: ZEBRA_BG },
        columnStyles: { 0: { halign: 'left', fontStyle: 'bold' }, 1: { halign: 'right' } },
      });
      y = (doc as typeof doc & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 9;

      // ── Section 2: Per-vehicle details ───────────────────────────────────
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
      doc.text(t('fleet.analytics.vehicle_details'), MARGIN, y);
      doc.setDrawColor(RED[0], RED[1], RED[2]);
      doc.setLineWidth(0.4);
      doc.line(MARGIN, y + 1.6, MARGIN + 40, y + 1.6);
      y += 5;

      const detailBody = filteredVehicleStats.map((row) => [
        row.vehicleNumber,
        num(row.trips),
        num(row.distance),
        num(row.fuelLitres),
        row.mileage > 0 ? row.mileage.toFixed(2) : '—',
        inr(row.fuelCost),
        inr(row.maintenanceCost),
        inr(row.totalExpense),
      ]);
      autoTable(doc, {
        head: [[
          t('fleet.analytics.table_vehicle'),
          t('fleet.analytics.table_trips'),
          t('fleet.analytics.table_distance'),
          t('fleet.analytics.table_fuel_vol'),
          t('fleet.analytics.table_mileage'),
          t('fleet.analytics.table_fuel_cost'),
          t('fleet.analytics.table_maint_cost'),
          t('fleet.analytics.table_total_cost'),
        ]],
        body: detailBody,
        startY: y,
        theme: 'grid',
        margin: { left: MARGIN, right: MARGIN },
        headStyles: { fillColor: HEAD_BG, textColor: 255, fontStyle: 'bold', fontSize: 8, halign: 'center', cellPadding: 2, lineWidth: 0.1, lineColor: [255, 255, 255] },
        bodyStyles: { fontSize: 8, textColor: [30, 30, 30], cellPadding: 2, lineWidth: 0.1, lineColor: [214, 220, 230] },
        alternateRowStyles: { fillColor: ZEBRA_BG },
        columnStyles: {
          0: { halign: 'left', fontStyle: 'bold' },
          1: { halign: 'center' },
          2: { halign: 'right' },
          3: { halign: 'right' },
          4: { halign: 'right' },
          5: { halign: 'right' },
          6: { halign: 'right' },
          7: { halign: 'right', fontStyle: 'bold' },
        },
      });

      const pageCount = doc.getNumberOfPages();
      const pageHeight = doc.internal.pageSize.getHeight();
      for (let p = 1; p <= pageCount; p++) {
        doc.setPage(p);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
        doc.text(`Page ${p} of ${pageCount}`, pageWidth - MARGIN, pageHeight - 7, { align: 'right' });
        doc.text('DMR POULTRIES — Vehicle Analytics', MARGIN, pageHeight - 7);
      }

      doc.save(exportFileName('pdf'));
      showNotification(t('notification.export_success'), 'success');
    } catch {
      showNotification(t('fleet.validation.failed'), 'error');
    }
  }, [hasAnyData, kpis, filteredVehicleStats, fromDate, toDate, selectedOption, exportFileName, showNotification, t]);

  // Toast for refresh
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 5000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (refreshing === false && lastRefreshed) {
      setToast({ type: 'success', message: t('fleet.analytics.refreshed_success') });
    }
  }, [refreshing, lastRefreshed, t]);

  return (
    <ErrorBoundary>
      <div className={`w-full space-y-5 ${embedded ? '' : 'px-4 py-6 md:px-8 md:py-8'}`}>
        {toast && (
          <div
            className={`fixed right-4 top-4 z-50 flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold shadow-lg ${
              toast.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-rose-200 bg-rose-50 text-rose-700'
            }`}
            role="status"
            aria-live="polite"
          >
            {toast.type === 'success' ? (
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            ) : (
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            )}
            {toast.message}
          </div>
        )}

        {/* Filter / toolbar — mirrors the Trip List filter bar exactly:
            same card, same 5-col + 12-col grid, same searchable dropdowns and
            the same animated Reset / Refresh / PDF / Excel action buttons. */}
        <div className={opsFilterCardClass}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            <div>
              <label className={opsFilterLabelClass}>
                <Calendar size={17} className="text-emerald-500 flex-shrink-0" />
                <span>{t('common.from')}</span>
              </label>
              <DatePicker
                value={fromDate}
                onChange={setFromDate}
                placeholder={t('fleet.analytics.from_date')}
                className="w-full text-xs font-medium"
                hideClear
              />
            </div>

            <div>
              <label className={opsFilterLabelClass}>
                <Calendar size={17} className="text-emerald-500 flex-shrink-0" />
                <span>{t('common.to')}</span>
              </label>
              <DatePicker
                value={toDate}
                onChange={setToDate}
                placeholder={t('fleet.analytics.to_date')}
                className="w-full text-xs font-medium"
                hideClear
              />
            </div>

            <div>
              <label className={opsFilterLabelClass}>
                <Truck size={17} className="text-emerald-500 flex-shrink-0" />
                <span>{t('common.vehicle')}</span>
              </label>
              <MasterDropdown
                hideLabel
                label={t('common.vehicle')}
                value={selectedVehicleId != null ? String(selectedVehicleId) : ''}
                options={vehicleDropdownOptions}
                onChange={(next) => setSelectedVehicleId(next ? Number(next) : null)}
                placeholder={vehiclesLoading ? t('fleet.analytics.loading_vehicles') : t('fleet.analytics.all_vehicles')}
                searchable
                allowClear
                className="w-full"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-end pt-1">
            <div className="lg:col-span-5">
              <label className={opsFilterLabelClass}>
                <Search size={17} className="text-slate-400 flex-shrink-0" />
                <span>{t('common.search')}</span>
              </label>
              <div className="relative">
                <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={t('common.vehicle')}
                  className={`${opsInputClass} pl-10`}
                />
              </div>
            </div>

            <div className="lg:col-span-7 flex items-center gap-2 justify-end flex-wrap">
              <button
                type="button"
                onClick={onReset}
                className={`group relative ${opsSecondaryButtonClass}`}
                aria-label={t('common.reset')}
              >
                <span className="inline-flex motion-safe:group-hover:animate-[var(--animate-action-reset)]"><RotateCcw size={14} /></span>
                {t('common.reset')}
              </button>
              <BrandRefreshButton onClick={refresh} loading={refreshing} />
              <button
                type="button"
                onClick={exportPDF}
                disabled={!hasAnyData}
                className={`group relative ${opsPdfButtonClass}`}
                aria-label={t('reports.export_pdf') || 'PDF'}
              >
                <span className={`inline-flex ${hasAnyData ? 'motion-safe:group-hover:animate-[var(--animate-action-pdf)]' : ''}`}><FileText size={15} /></span>
                PDF
              </button>
              <button
                type="button"
                onClick={exportExcel}
                disabled={!hasAnyData}
                className={`group relative ${opsExcelButtonClass}`}
                aria-label={t('reports.export_excel') || 'Excel'}
              >
                <span className={`inline-flex ${hasAnyData ? 'motion-safe:group-hover:animate-[var(--animate-action-excel)]' : ''}`}><FileSpreadsheet size={15} /></span>
                Excel
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <span className="flex items-center gap-2">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              {error}
            </span>
            <button type="button" onClick={refresh} className="font-bold underline">
              {t('common.retry')}
            </button>
          </div>
        )}

        {!hasAnyData && !loading && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-500">
            {t('fleet.analytics.no_data')}
          </div>
        )}

        {showSkeleton ? (
          <div className="space-y-5">
            <SkeletonKpis />
            <SkeletonCharts />
          </div>
        ) : (
          <div className="space-y-5">
            {/* KPI summary — rendered through the shared KPI surface, the same
                component the Trip List uses, so both pages read identically. */}
            <KpiCardGrid
              items={kpiCards}
              gridClassName="lg:grid-cols-3 xl:grid-cols-3"
              ariaLabel={t('fleet.analytics.vehicle_performance')}
            />

            {/* Analytics Section */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              {/* Vehicle Performance */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs lg:col-span-2">
                <div className="mb-3">
                  <h3 className="text-base font-semibold text-slate-900">{t('fleet.analytics.vehicle_performance')}</h3>
                </div>
                <VehiclePerformanceChart stats={vehicleStats} />
              </div>

              {/* Cost Analysis */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
                <div className="mb-3">
                  <h3 className="text-base font-semibold text-slate-900">{t('fleet.analytics.cost_analysis')}</h3>
                </div>
                <ExpenseBreakdownDonut data={expenseBreakdown} height={280} />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              {/* Weekly Activity */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs lg:col-span-2">
                <div className="mb-3">
                  <h3 className="text-base font-semibold text-slate-900">{t('fleet.analytics.weekly_activity')}</h3>
                </div>
                <WeeklyTrendChart data={weeklyData} />
              </div>

              {/* Fleet Insights */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
                <div className="mb-3">
                  <h3 className="text-base font-semibold text-slate-900">{t('fleet.analytics.fleet_insights')}</h3>
                </div>
                <AttentionSection stats={vehicleStats} />
              </div>
            </div>

            {/* Vehicle performance table */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
              <div className="mb-3">
                <h3 className="text-base font-semibold text-slate-900">{t('fleet.analytics.vehicle_details')}</h3>
              </div>
              <VehiclePerformanceTable stats={filteredVehicleStats} statusById={vehicleStatusById} />
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
};

export default memo(VehicleAnalyticsPage);
