import { memo, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import * as XLSX from 'xlsx';
import autoTable from 'jspdf-autotable';
import type { jsPDF } from 'jspdf';
import { useI18n } from '../../../i18n';
import { useAnalyticsData } from '../hooks/useAnalyticsData';
import ErrorBoundary from '../components/common/ErrorBoundary';
import ExpenseBreakdownDonut from '../components/analytics/ExpenseBreakdownDonut';
import VehiclePerformanceChart from '../components/analytics/VehiclePerformanceChart';
import {
  METRICS as PERFORMANCE_METRICS,
  type VehicleMetricKey,
} from '../components/analytics/vehiclePerformanceMetrics';
import WeeklyTrendChart from '../components/analytics/WeeklyTrendChart';
import VehiclePerformanceTable from '../components/analytics/VehiclePerformanceTable';
import AttentionSection from '../components/analytics/AttentionSection';
import { DatePicker } from '../../../components/common/DatePicker';
import {
  Activity,
  BarChart3,
  Calendar,
  CalendarRange,
  FileSpreadsheet,
  FileText,
  Fuel,
  IndianRupee,
  Lightbulb,
  PieChart,
  RotateCcw,
  Search,
  Table,
  Truck,
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

interface KpiSubMetric {
  label: string;
  value: string;
  /** Plain-language tooltip — what this figure counts. */
  tip?: string;
}

interface KpiGroup {
  id: string;
  title: string;
  headline: string;
  icon: typeof Truck;
  tone: KpiTone;
  /** Plain-language tooltip for the headline figure. */
  tip: string;
  subs: KpiSubMetric[];
}

/** Per-tone chrome for the grouped KPI cards — matches the shared KPI palette. */
const groupToneClasses: Record<KpiTone, { icon: string; value: string; glow: string; accent: string }> = {
  blue: { icon: 'border-blue-100 bg-blue-50 text-blue-500', value: 'text-blue-600', glow: 'bg-blue-50', accent: 'bg-blue-300' },
  amber: { icon: 'border-amber-100 bg-amber-50 text-amber-500', value: 'text-amber-600', glow: 'bg-amber-50', accent: 'bg-amber-300' },
  emerald: { icon: 'border-emerald-100 bg-emerald-50 text-emerald-500', value: 'text-emerald-600', glow: 'bg-emerald-50', accent: 'bg-emerald-300' },
  violet: { icon: 'border-violet-100 bg-violet-50 text-violet-500', value: 'text-violet-600', glow: 'bg-violet-50', accent: 'bg-violet-300' },
  rose: { icon: 'border-rose-100 bg-rose-50 text-rose-500', value: 'text-rose-600', glow: 'bg-rose-50', accent: 'bg-rose-300' },
  cyan: { icon: 'border-cyan-100 bg-cyan-50 text-cyan-500', value: 'text-cyan-600', glow: 'bg-cyan-50', accent: 'bg-cyan-300' },
};

/** A single grouped KPI card: headline metric on top, related figures nested. */
function KpiGroupCard({ group, className = '' }: { group: KpiGroup; className?: string }) {
  const tone = groupToneClasses[group.tone];
  const Icon = group.icon;
  return (
    <div
      title={group.tip}
      className={`group relative isolate flex flex-col overflow-hidden rounded-xl border border-slate-200/80 bg-white p-3 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md ${className}`}
    >
      <span className={`pointer-events-none absolute -right-5 -top-5 h-16 w-16 rounded-full ${tone.glow}`} aria-hidden="true" />
      <span className={`absolute inset-x-0 bottom-0 h-[0.1875rem] ${tone.accent}`} aria-hidden="true" />
      <div className="relative mb-2 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{group.title}</p>
          <p className={`mt-0.5 text-lg font-extrabold leading-none tracking-tight tabular-nums ${tone.value}`}>
            {group.headline}
          </p>
        </div>
        <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border shadow-sm transition-transform duration-200 group-hover:scale-105 ${tone.icon}`} aria-hidden="true">
          <Icon size={16} strokeWidth={2.25} />
        </span>
      </div>
      {group.subs.length > 0 && (
        /* Detail metrics as small crisp mini-tiles in the same visual language
           as the KPI itself: tone dot + tiny uppercase label on top, the
           tone-coloured bold tabular value beneath — side-by-side, wrapping
           when the card is narrow. */
        <dl className="relative mt-auto flex flex-wrap gap-2 border-t border-slate-100 pt-2">
          {group.subs.map((sub) => (
            <div
              key={sub.label}
              title={sub.tip}
              className="flex min-w-[5.75rem] flex-1 flex-col gap-1 rounded-lg border border-slate-200/70 bg-slate-50/60 px-2.5 py-1.5"
            >
              <dt className="flex items-center gap-1 truncate text-[9px] font-extrabold uppercase tracking-[0.08em] text-slate-400">
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${tone.accent}`} aria-hidden="true" />
                {sub.label}
              </dt>
              <dd className={`text-[13px] font-extrabold leading-none tabular-nums ${tone.value}`}>
                {sub.value}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

/** Trip-List-style header for every analytics card: gradient bar, logo tile,
 * bold title — the same chrome the registers use. */
function ChartHeader({
  icon,
  title,
  tile,
  actions,
}: {
  icon: ReactNode;
  title: string;
  tile: string;
  /** Optional controls (e.g. the metric switch) on the right of the bar. */
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-gradient-to-r from-slate-50 via-white to-slate-50 px-4 py-3">
      <div className="flex items-center gap-2.5">
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg border shadow-inner ${tile}`}>
          {icon}
        </div>
        <h3 className="text-sm font-bold tracking-tight text-slate-800">{title}</h3>
      </div>
      {actions}
    </div>
  );
}

const SkeletonKpis = () => (
  /* Same silhouette as the live layout: three cards top-and-down on the left,
     one tall Fleet Cost card on the right. */
  <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:col-span-2">
      {Array.from({ length: 3 }).map((_, index) => (
        <div
          key={index}
          className={`animate-pulse rounded-xl border border-slate-200 bg-white p-3 ${index === 2 ? 'sm:col-span-2' : ''}`}
        >
          <div className="flex items-center justify-between">
            <div className="w-2/3">
              <div className="h-2.5 w-3/4 rounded bg-slate-100" />
              <div className="mt-2 h-5 w-1/2 rounded bg-slate-100" />
            </div>
            <div className="h-8 w-8 rounded-lg bg-slate-100" />
          </div>
          <div className="mt-3 flex gap-2 border-t border-slate-100 pt-2">
            <div className="h-9 flex-1 rounded-lg bg-slate-100" />
            <div className="h-9 flex-1 rounded-lg bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
    <div className="animate-pulse rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex items-center justify-between">
        <div className="w-2/3">
          <div className="h-2.5 w-3/4 rounded bg-slate-100" />
          <div className="mt-2 h-5 w-1/2 rounded bg-slate-100" />
        </div>
        <div className="h-8 w-8 rounded-lg bg-slate-100" />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-100 pt-2">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="h-9 rounded-lg bg-slate-100" />
        ))}
      </div>
    </div>
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
    if (total === 0) return { pct: 0, active: 0, idle: 0, total: 0 };
    const active = vehicleStats.filter((row) => row.trips > 0 || row.distance > 0).length;
    return { pct: Math.round((active / total) * 100), active, idle: total - active, total };
  }, [vehicleStats]);

  // Grouped KPI summary: each card leads with a headline figure and nests the
  // related metrics beneath it —
  //   • Trips        → distance covered
  //   • Fuel         → mileage + fuel cost
  //   • Fleet Cost   → maintenance, fuel, FASTag/toll, EMI, other
  //   • Utilization  → active vs idle vehicles + cost / km
  const kpiGroups = useMemo<KpiGroup[]>(() => {
    const costPerKm = stats.costPerKm > 0 ? `₹${stats.costPerKm.toFixed(2)}` : '—';
    return [
      {
        id: 'trips',
        title: t('fleet.analytics.group_operations'),
        headline: formatNumberCompact(stats.totalTrips),
        icon: Truck,
        tone: 'blue',
        tip: t('fleet.analytics.tip.operations'),
        subs: [
          { label: t('fleet.analytics.vehicles'), value: String(utilization.active), tip: t('fleet.analytics.tip.util_active') },
          { label: t('fleet.analytics.total_distance'), value: `${formatNumberCompact(stats.totalDistance)} km`, tip: t('fleet.analytics.tip.total_distance') },
        ],
      },
      {
        id: 'fuel',
        title: t('fleet.analytics.group_fuel'),
        headline: `${formatNumberCompact(stats.totalFuelLitres)} L`,
        icon: Fuel,
        tone: 'amber',
        tip: t('fleet.analytics.tip.fuel'),
        /* Litres lead the card (headline), then cost, then mileage — the order
           the reader asked for. */
        subs: [
          { label: t('fleet.analytics.fuel_cost'), value: formatCurrencyCompact(stats.fuelCost), tip: t('fleet.analytics.tip.fuel_cost') },
          { label: t('fleet.analytics.avg_mileage'), value: stats.averageMileage > 0 ? `${stats.averageMileage.toFixed(2)} km/l` : '—', tip: t('fleet.analytics.tip.avg_mileage') },
        ],
      },
      {
        id: 'fleet-cost',
        title: t('fleet.analytics.group_fleet_cost'),
        headline: formatCurrencyCompact(stats.totalExpense),
        icon: IndianRupee,
        tone: 'rose',
        tip: t('fleet.analytics.tip.fleet_cost'),
        subs: [
          { label: t('fleet.analytics.maint_cost'), value: formatCurrencyCompact(stats.maintenanceCost), tip: t('fleet.analytics.tip.maint_cost') },
          { label: t('fleet.analytics.fuel_cost'), value: formatCurrencyCompact(stats.fuelCost), tip: t('fleet.analytics.tip.fuel_cost') },
          { label: t('fleet.analytics.toll_cost'), value: formatCurrencyCompact(stats.tollCost), tip: t('fleet.analytics.tip.toll_cost') },
          { label: t('fleet.analytics.emi_cost'), value: formatCurrencyCompact(stats.emiDue), tip: t('fleet.analytics.tip.emi_cost') },
          { label: t('fleet.analytics.other_cost'), value: formatCurrencyCompact(stats.otherCost), tip: t('fleet.analytics.tip.other_cost') },
        ],
      },
      {
        id: 'utilization',
        title: t('fleet.analytics.vehicle_utilization'),
        headline: `${utilization.pct}%`,
        icon: Activity,
        tone: 'cyan',
        tip: t('fleet.analytics.tip.utilization'),
        subs: [
          { label: t('fleet.analytics.util_active'), value: `${utilization.active} / ${utilization.total}`, tip: t('fleet.analytics.tip.util_active') },
          { label: t('fleet.analytics.util_idle'), value: String(utilization.idle), tip: t('fleet.analytics.tip.util_idle') },
          { label: t('fleet.analytics.cost_per_km'), value: costPerKm, tip: t('fleet.analytics.tip.cost_per_km') },
        ],
      },
    ];
  }, [stats, utilization, t]);

  // Layout: Trips / Fuel / Utilization flow top-and-down on the left, while
  // Fleet Cost owns the right side at the full height of the KPI block.
  const fleetCostGroup = kpiGroups.find((group) => group.id === 'fleet-cost');
  const sideGroups = kpiGroups.filter((group) => group.id !== 'fleet-cost');

  // Flat list retained for the PDF/Excel exports (one row per metric).
  const kpis = useMemo<{ label: string; value: string }[]>(
    () =>
      kpiGroups.flatMap((group) => [
        { label: group.title, value: group.headline },
        ...group.subs.map((sub) => ({ label: sub.label, value: sub.value })),
      ]),
    [kpiGroups]
  );

  const hasAnyData = stats.totalTrips > 0 || stats.totalDistance > 0 || stats.totalExpense > 0;

  const { showNotification } = useSafeNotification();

  // The performance chart's metric switch sits on the card heading.
  const [perfMetric, setPerfMetric] = useState<VehicleMetricKey>('distance');

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
            {/* Grouped KPI summary — Trips, Fuel and Utilization flow
                top-and-down on the left; Fleet Cost owns the right side at the
                full height of the block, its five splits filling the taller
                card. */}
            <section
              className="grid grid-cols-1 gap-3 lg:grid-cols-3"
              aria-label={t('fleet.analytics.vehicle_performance')}
              aria-live="polite"
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:col-span-2">
                {sideGroups.map((group) => (
                  <KpiGroupCard
                    key={group.id}
                    group={group}
                    className={group.id === 'utilization' ? 'sm:col-span-2' : ''}
                  />
                ))}
              </div>
              {fleetCostGroup && (
                <KpiGroupCard group={fleetCostGroup} className="h-full" />
              )}
            </section>

            {/* Analytics Section — every card wears the Trip-List chrome:
                gradient bar + logo tile + bold title. */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              {/* Vehicle Performance */}
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs lg:col-span-2">
                <ChartHeader
                  icon={<BarChart3 className="h-4 w-4" />}
                  title={t('fleet.analytics.vehicle_performance')}
                  tile="border-blue-100 bg-blue-50 text-blue-500"
                  actions={
                    /* Metric switch rides the heading row, Recent-Trip-Activity
                       chrome, instead of eating chart space below it. */
                    <div className="flex items-center overflow-hidden rounded-lg border border-slate-200/80 bg-slate-50 p-0.5 shadow-sm">
                      {PERFORMANCE_METRICS.map((m) => (
                        <button
                          key={m.key}
                          type="button"
                          onClick={() => setPerfMetric(m.key)}
                          aria-pressed={perfMetric === m.key}
                          className={`inline-flex items-center rounded-md px-3 py-1.5 text-[11px] font-semibold transition-all ${
                            perfMetric === m.key
                              ? 'bg-emerald-50/80 text-emerald-600 shadow-sm'
                              : 'bg-transparent text-slate-500 hover:bg-slate-200/50 hover:text-slate-800'
                          }`}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                  }
                />
                <div className="p-4">
                  <VehiclePerformanceChart stats={vehicleStats} metricKey={perfMetric} />
                </div>
              </div>

              {/* Cost Analysis */}
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
                <ChartHeader
                  icon={<PieChart className="h-4 w-4" />}
                  title={t('fleet.analytics.cost_analysis')}
                  tile="border-rose-100 bg-rose-50 text-rose-500"
                />
                <div className="p-4">
                  <ExpenseBreakdownDonut data={expenseBreakdown} height={320} />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              {/* Weekly Activity */}
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs lg:col-span-2">
                <ChartHeader
                  icon={<CalendarRange className="h-4 w-4" />}
                  title={t('fleet.analytics.weekly_activity')}
                  tile="border-amber-100 bg-amber-50 text-amber-500"
                />
                <div className="p-4">
                  <WeeklyTrendChart data={weeklyData} />
                </div>
              </div>

              {/* Fleet Insights */}
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
                <ChartHeader
                  icon={<Lightbulb className="h-4 w-4" />}
                  title={t('fleet.analytics.fleet_insights')}
                  tile="border-violet-100 bg-violet-50 text-violet-500"
                />
                <div className="p-4">
                  <AttentionSection stats={vehicleStats} />
                </div>
              </div>
            </div>

            {/* Vehicle performance table */}
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
              <ChartHeader
                icon={<Table className="h-4 w-4" />}
                title={t('fleet.analytics.vehicle_details')}
                tile="border-emerald-100 bg-emerald-50 text-emerald-600"
              />
              <div className="p-4">
                <VehiclePerformanceTable stats={filteredVehicleStats} statusById={vehicleStatusById} />
              </div>
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
};

export default memo(VehicleAnalyticsPage);
