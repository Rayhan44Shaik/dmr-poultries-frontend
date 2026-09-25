import { useRef, useState, type ComponentProps } from "react";
import { IndianRupee, LoaderCircle, Store } from "lucide-react";
import useCompletedTrips from "../hooks/useCompletedTrips";
import CompletedTripsFilters from "../components/CompletedTripsFilters";
import CompletedTripsTable from "../components/CompletedTripsTable";
import EnterRateModal from "../components/EnterRateModal";
import { Pagination } from "../../../../ui/Pagination";
import { shouldShowPagination } from "../../../../shared/ui/paginationStyles";
import { useSafeNotification } from "../../../../hooks/useSafeNotification";
import { useI18n } from "../../../../i18n";
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
  const { t } = useI18n();
  const { showNotification } = useSafeNotification();
  const tableContainerRef = useRef<HTMLDivElement>(null);
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
    setDraftFilter({ ...EMPTY_RATE_FILTER });
    resetFilters();
    setSelectedRowId(null);
    void loadTrips().then((ok) => {
      if (ok) showNotification(t("notification.data_refreshed"), "success");
    });
  };

  return (
    <div className={`w-full space-y-5 ${embedded ? "" : "px-3 md:px-6 py-4 bg-slate-50/50 min-h-screen text-slate-800"}`}>
      {/* Filter — separate card like trip list */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 sm:p-5">
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
          onRateEntry={() => {
            const trip = filteredTrips.find((row) => row.id === selectedRowId);
            if (trip) openRateEntry(trip);
          }}
          rateEntryEnabled={selectedRowId !== null}
        />
      </div>

      {loadError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{loadError}</div>
      )}

      {/* Table — separate card like trip list, Rate Entry on top of table */}
      <div ref={tableContainerRef} className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        {/* Rate Entry table title: intentionally static; other page animations are unchanged. */}
        <div className="flex items-center px-6 py-3 border-b border-slate-100 bg-gradient-to-r from-emerald-50/60 via-white to-emerald-50/40">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shadow-inner">
              <IndianRupee className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-800 tracking-tight">{t("ops.rate.title")}</h3>
          </div>
        </div>

        {isLoading ? (
          <div className="py-16 text-center text-sm font-medium text-slate-400">
            <span className="inline-flex items-center gap-2">
              <LoaderCircle size={16} className="animate-spin text-emerald-600" aria-hidden="true" />
              {t("ops.rate.loading_table")}
            </span>
          </div>
        ) : filteredTrips.length === 0 && !loadError ? (
          <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
              <Store size={20} />
            </span>
            <p className="font-semibold text-slate-700">{t("ops.rate.no_trips")}</p>
          </div>
        ) : (
          <>
            <CompletedTripsTable
              trips={paginatedTrips}
              onEnterRate={openRateEntry}
              onModifyRate={openModifyRate}
              startIndex={startIndex}
              selectedRowId={selectedRowId}
              onRowClick={(trip) => setSelectedRowId((current) => (current === trip.id ? null : trip.id))}
              onRowSelect={(trip) => setSelectedRowId(trip.id)}
              sortBy={sortBy}
              sortDir={sortDir}
              onSortChange={handleSortChange}
            />
            {shouldShowPagination(filteredTrips.length) && (
              <div className="border-t border-slate-200 bg-slate-50/50 px-3 py-2">
                <Pagination
                  page={safeCurrentPage}
                  pageSize={pageSize}
                  totalItems={filteredTrips.length}
                  onPageChange={setCurrentPage}
                  onPageSizeChange={setPageSize}
                  disabled={isLoading}
                />
              </div>
            )}
          </>
        )}
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
