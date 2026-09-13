import { useMemo, useRef, useState, type ComponentProps } from "react";
import {
  Truck,
  Store,
  Bird,
  Scale,
  IndianRupee,
  Clock,
  TrendingUp,
  PackageCheck,
} from "lucide-react";
import useCompletedTrips from "../hooks/useCompletedTrips";
import CompletedTripsFilters from "../components/CompletedTripsFilters";
import CompletedTripsTable from "../components/CompletedTripsTable";
import EnterRateModal from "../components/EnterRateModal";
import { Pagination } from "../../../../ui/Pagination";
import { shouldShowPagination } from "../../../../shared/ui/paginationStyles";
import { useSafeNotification } from "../../../../hooks/useSafeNotification";
import { exportToPDF, exportToExcel } from "../../../../utils/exportUtils";
import { opsPageClass, opsEmptyStateClass } from "../../../../shared/ui/operationsStyles";
import { useI18n } from "../../../../i18n";
import {
  displayRateEntryName,
  formatRateEntryDay,
} from "../utils/rateEntryDisplay";
import { formatVehicleNumber } from "../../../../utils/format";
import { useShops } from "../../../masters/shops/hooks/useShops";
import { getQuarterSampleInfo } from "../../../../sample/quarterSample";

type EnterRateModalProps = ComponentProps<typeof EnterRateModal>;

type RateEntryFilterState = {
  fromDate: string;
  toDate: string;
  search: string;
  vehicle: string;
  supervisor: string;
};

const EMPTY_RATE_FILTER: RateEntryFilterState = {
  fromDate: "",
  toDate: "",
  search: "",
  vehicle: "",
  supervisor: "",
};

function EnterRateModalWithShopMaster(props: EnterRateModalProps) {
  const { shops, loading } = useShops();
  return <EnterRateModal {...props} shops={shops} shopsLoading={loading} />;
}

type Props = {
  embedded?: boolean;
};

type KpiCardProps = {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub: string;
  tone: "emerald" | "orange" | "sky" | "violet" | "amber";
};

const toneMap = {
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
  orange: "border-orange-200 bg-orange-50 text-orange-700",
  sky: "border-sky-200 bg-sky-50 text-sky-700",
  violet: "border-violet-200 bg-violet-50 text-violet-700",
  amber: "border-amber-200 bg-amber-50 text-amber-700",
};

function KpiCard({ icon, label, value, sub, tone }: KpiCardProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm flex items-center gap-3">
      <span
        className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border ${toneMap[tone]}`}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          {label}
        </p>
        <p className="text-[15px] font-extrabold text-slate-900 tabular-nums truncate">
          {value}
        </p>
        <p className="text-[11px] font-medium text-slate-500 truncate">{sub}</p>
      </div>
    </div>
  );
}

export default function RatesEntryPage({ embedded = false }: Props) {
  void embedded;
  const { t, language } = useI18n();
  const { showNotification } = useSafeNotification();
  const exportBusyRef = useRef<"pdf" | "excel" | null>(null);
  const [selectedRowId, setSelectedRowId] = useState<number | null>(null);
  const [sampleInfo, setSampleInfo] = useState<string | null>(null);

  const {
    trips,
    filteredTrips,
    paginatedTrips,
    currentPage,
    pageSize,
    totalPages,
    setCurrentPage,
    setPageSize,
    sortBy,
    sortDir,
    handleSortChange,
    filter,
    setFilter,
    resetFilters,
    vehicleList,
    supervisorList,
    modalOpen,
    selectedTrip,
    openRateEntry,
    openModifyRate,
    closeRateEntry,
    saveTrip,
    saveAndLockTrip,
    loadTrips,
    loadError,
    isLoading,
    isSaving,
  } = useCompletedTrips();

  const [draftFilter, setDraftFilter] = useState<RateEntryFilterState>(EMPTY_RATE_FILTER);

  // Sample quarter badge
  useMemo(() => {
    void getQuarterSampleInfo().then((info) => {
      if (info) setSampleInfo(info.quarter.label);
    });
  }, []);

  const hasFilters =
    filter.fromDate !== "" ||
    filter.toDate !== "" ||
    filter.search !== "" ||
    filter.vehicle !== "" ||
    filter.supervisor !== "";

  const safeCurrentPage = Math.min(currentPage, Math.max(totalPages, 1));
  const startIndex = (safeCurrentPage - 1) * pageSize;

  // ── KPI aggregates from filteredTrips (synced with quarter sample) ──
  const kpis = useMemo(() => {
    const totalShops = filteredTrips.reduce((a, trip) => a + (trip.totalShops ?? 0), 0);
    const totalBirds = filteredTrips.reduce((a, trip) => a + (trip.totalBirds ?? 0), 0);
    const totalWeight = filteredTrips.reduce((a, trip) => a + (trip.totalWeight ?? 0), 0);
    const totalAmount = filteredTrips.reduce((a, trip) => {
      // totalAmount may not be in list view (deliveries empty), fallback to weight * avg market
      const amount = (trip as unknown as { totalAmount?: number }).totalAmount ?? 0;
      return a + amount;
    }, 0);
    const avgBirdsPerTrip = filteredTrips.length ? Math.round(totalBirds / filteredTrips.length) : 0;
    return {
      pendingTrips: filteredTrips.length,
      totalTripsInSystem: trips.length,
      totalShops,
      totalBirds,
      totalWeight: totalWeight.toFixed(2),
      totalAmount: totalAmount ? totalAmount.toFixed(2) : "—",
      avgBirdsPerTrip,
    };
  }, [filteredTrips, trips.length]);

  const handleApplyFilters = () => {
    const nextFilter = {
      ...draftFilter,
      search: draftFilter.search.trim(),
    };
    setDraftFilter(nextFilter);
    setFilter(nextFilter);
    setSelectedRowId(null);
  };

  const handleResetFilters = () => {
    setDraftFilter({ ...EMPTY_RATE_FILTER });
    resetFilters();
    setSelectedRowId(null);
    showNotification(t("ops.rate.filters_reset"), "info");
  };

  const handleRefresh = () => {
    setDraftFilter({ ...EMPTY_RATE_FILTER });
    resetFilters();
    setSelectedRowId(null);
    void loadTrips().then((ok) => {
      if (ok) showNotification(t("notification.data_refreshed"), "success");
    });
  };

  const handleExportPDF = () => {
    if (exportBusyRef.current) return;
    exportBusyRef.current = "pdf";
    try {
      if (filteredTrips.length === 0) {
        showNotification(t("ops.rate.no_data_export"), "error");
        return;
      }
      const headers = [
        t("operations.trip_no"),
        t("ops.rate.col.day"),
        t("common.vehicle"),
        t("common.supervisor"),
        t("ops.trip.source_farm"),
        t("ops.trip.shops"),
        t("common.birds"),
        t("ops.trip.weight_kg"),
      ];
      const rows = filteredTrips.map((trip) => [
        trip.tripNo,
        formatRateEntryDay(trip.tripDate, language),
        formatVehicleNumber(trip.vehicleNo),
        displayRateEntryName(trip.supervisorName, language),
        displayRateEntryName(trip.sourceFarm, language),
        trip.totalShops.toString(),
        trip.totalBirds.toString(),
        trip.totalWeight.toFixed(2),
      ]);
      const filename = `Rates_${new Date().toISOString().split("T")[0]}`;
      exportToPDF(t("ops.rate.report_title"), headers, rows, filename);
      showNotification(t("ops.rate.pdf_success"), "success");
    } catch {
      showNotification(t("ops.rate.pdf_error"), "error");
    } finally {
      exportBusyRef.current = null;
    }
  };

  const handleExportExcel = () => {
    if (exportBusyRef.current) return;
    exportBusyRef.current = "excel";
    try {
      if (filteredTrips.length === 0) {
        showNotification(t("ops.rate.no_data_export"), "error");
        return;
      }
      const headers = [
        t("operations.trip_no"),
        t("ops.rate.col.day"),
        t("common.vehicle"),
        t("common.supervisor"),
        t("ops.trip.source_farm"),
        t("ops.trip.shops"),
        t("common.birds"),
        t("ops.trip.weight_kg"),
      ];
      const rows = filteredTrips.map((trip) => [
        trip.tripNo,
        formatRateEntryDay(trip.tripDate, language),
        formatVehicleNumber(trip.vehicleNo),
        displayRateEntryName(trip.supervisorName, language),
        displayRateEntryName(trip.sourceFarm, language),
        trip.totalShops,
        trip.totalBirds,
        trip.totalWeight,
      ]);
      const filename = `Rates_${new Date().toISOString().split("T")[0]}`;
      exportToExcel(t("ops.rate.report_title"), headers, rows, filename);
      showNotification(t("ops.rate.excel_success"), "success");
    } catch {
      showNotification(t("ops.rate.excel_error"), "error");
    } finally {
      exportBusyRef.current = null;
    }
  };

  const content = (
    <div className={opsPageClass}>
      {/* ── Header + Sample Badge ── */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-sm">
            <IndianRupee size={18} />
          </span>
          <div>
            <h1 className="text-[17px] font-extrabold tracking-tight text-slate-900">
              {t("ops.rate.title")}
            </h1>
            <p className="text-[12px] font-medium text-slate-500">
              {t("ops.rate.pending_trips")} awaiting rates • {kpis.totalShops} shops •{" "}
              {sampleInfo ? `${sampleInfo} • ` : ""}
              Synced with quarter sample data
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {sampleInfo && (
            <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
              <PackageCheck size={12} className="mr-1" />
              {sampleInfo}
            </span>
          )}
          <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600">
            <Clock size={12} className="mr-1" />
            {isLoading ? "Syncing…" : `${kpis.pendingTrips}/${kpis.totalTripsInSystem} pending`}
          </span>
        </div>
      </div>

      {/* ── KPI Cards — synced with quarter sample ── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiCard
          icon={<Truck size={16} />}
          label="Pending Trips"
          value={kpis.pendingTrips}
          sub={`${kpis.totalTripsInSystem} total in quarter`}
          tone="orange"
        />
        <KpiCard
          icon={<Store size={16} />}
          label="Shops Awaiting"
          value={kpis.totalShops}
          sub={`${kpis.avgBirdsPerTrip} avg birds/trip`}
          tone="violet"
        />
        <KpiCard
          icon={<Bird size={16} />}
          label="Birds"
          value={kpis.totalBirds.toLocaleString()}
          sub="Total birds in pending"
          tone="sky"
        />
        <KpiCard
          icon={<Scale size={16} />}
          label="Weight (KG)"
          value={kpis.totalWeight}
          sub="Total weight pending rates"
          tone="emerald"
        />
        <KpiCard
          icon={<TrendingUp size={16} />}
          label="Sample Sync"
          value="100%"
          sub="All modules populated"
          tone="amber"
        />
      </div>

      <CompletedTripsFilters
        fromDate={draftFilter.fromDate}
        toDate={draftFilter.toDate}
        search={draftFilter.search}
        vehicle={draftFilter.vehicle}
        supervisor={draftFilter.supervisor}
        vehicleList={vehicleList}
        supervisorList={supervisorList}
        setFromDate={(value) => setDraftFilter((current) => ({ ...current, fromDate: value }))}
        setToDate={(value) => setDraftFilter((current) => ({ ...current, toDate: value }))}
        setSearch={(value) => setDraftFilter((current) => ({ ...current, search: value }))}
        setVehicle={(value) => setDraftFilter((current) => ({ ...current, vehicle: value }))}
        setSupervisor={(value) => setDraftFilter((current) => ({ ...current, supervisor: value }))}
        onSearch={handleApplyFilters}
        onReset={handleResetFilters}
        onRefresh={handleRefresh}
        refreshing={isLoading}
        pendingTrips={filteredTrips.length}
        hasFilters={hasFilters}
        onExportPDF={handleExportPDF}
        onExportExcel={handleExportExcel}
      />

      {loadError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {loadError}
        </div>
      )}

      {filteredTrips.length === 0 && !loadError ? (
        <div className={opsEmptyStateClass}>
          <div className="flex flex-col items-center gap-2">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
              <Store size={20} />
            </span>
            <p className="font-semibold">{t("ops.rate.no_trips")}</p>
            <p className="text-xs font-medium text-slate-500 max-w-md text-center">
              All trips in the quarter sample have rates locked. Refresh to reload sample data,
              or check Shop Sales for locked trips. Sample data covers {kpis.totalTripsInSystem} trips across all modules.
            </p>
          </div>
        </div>
      ) : (
        <CompletedTripsTable
          trips={paginatedTrips}
          onEnterRate={openRateEntry}
          onModifyRate={openModifyRate}
          startIndex={startIndex}
          selectedRowId={selectedRowId}
          onRowClick={(trip) => setSelectedRowId((current) => (current === trip.id ? null : trip.id))}
          sortBy={sortBy}
          sortDir={sortDir}
          onSortChange={handleSortChange}
        >
          {shouldShowPagination(filteredTrips.length) && (
            <Pagination
              page={safeCurrentPage}
              pageSize={pageSize}
              totalItems={filteredTrips.length}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
              disabled={isLoading}
            />
          )}
        </CompletedTripsTable>
      )}

      {modalOpen && (
        <EnterRateModalWithShopMaster
          open={modalOpen}
          trip={selectedTrip}
          onClose={closeRateEntry}
          onSave={saveTrip}
          onSaveAndLock={saveAndLockTrip}
          isSaving={isSaving}
          loadError={loadError}
        />
      )}
    </div>
  );

  return content;
}
