import { useMemo, useRef, useState, type ComponentProps } from "react";
import { IndianRupee, Store, History } from "lucide-react";
import useCompletedTrips from "../hooks/useCompletedTrips";
import CompletedTripsFilters from "../components/CompletedTripsFilters";
import CompletedTripsTable from "../components/CompletedTripsTable";
import EnterRateModal from "../components/EnterRateModal";
import { Pagination } from "../../../../ui/Pagination";
import { shouldShowPagination } from "../../../../shared/ui/paginationStyles";
import { useSafeNotification } from "../../../../hooks/useSafeNotification";
import { exportToPDF, exportToExcel } from "../../../../utils/exportUtils";
import { useI18n } from "../../../../i18n";
import { displayRateEntryName, formatRateEntryDay } from "../utils/rateEntryDisplay";
import { formatVehicleNumber } from "../../../../utils/format";
import { useShops } from "../../../masters/shops/hooks/useShops";

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

export default function RatesEntryPage({ embedded = false }: Props) {
  void embedded;
  const { t, language } = useI18n();
  const { showNotification } = useSafeNotification();
  const exportBusyRef = useRef<"pdf" | "excel" | null>(null);
  const [selectedRowId, setSelectedRowId] = useState<number | null>(null);

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

  const hasFilters =
    filter.fromDate !== "" ||
    filter.toDate !== "" ||
    filter.search !== "" ||
    filter.vehicle !== "" ||
    filter.supervisor !== "";

  const safeCurrentPage = Math.min(currentPage, Math.max(totalPages, 1));
  const startIndex = (safeCurrentPage - 1) * pageSize;

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

  // Reference: Recent Trip Activity header style
  return (
    <div className="space-y-6">
      {/* Header — perfect logo same font and size like Recent Trip Activity */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xl shadow-slate-100 overflow-hidden transition-all duration-300">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 px-6 py-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 via-white to-slate-50">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-blue-50/70 border border-blue-100 flex items-center justify-center text-blue-500 shadow-inner">
                <IndianRupee className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-800 tracking-tight">Rate Entry</h3>
            </div>
            <span className="inline-flex items-center justify-center px-2.5 py-0.5 text-xs font-semibold text-slate-600 bg-slate-100 border border-slate-200/80 rounded-full shadow-sm tabular-nums">
              {filteredTrips.length}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium text-slate-500">
            <span className="hidden sm:inline">Perfect & neat • same as Recent Trip Activity</span>
          </div>
        </div>

        <div className="p-4 sm:p-5 space-y-4">
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
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{loadError}</div>
          )}

          {filteredTrips.length === 0 && !loadError ? (
            <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                <Store size={20} />
              </span>
              <p className="font-semibold text-slate-700">{t("ops.rate.no_trips")}</p>
              <p className="text-xs font-medium text-slate-500 max-w-md">No pending trips awaiting rates</p>
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
        </div>
      </div>

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
}
