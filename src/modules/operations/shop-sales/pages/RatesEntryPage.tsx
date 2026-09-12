import { useRef, useState, type ComponentProps } from "react";
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
          {t("ops.rate.no_trips")}
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
