// src/pages/sales/shop-sales/ShopSalesPage.tsx

import { useEffect, useCallback, useState } from "react";
import { useSafeNotification } from "../../../../hooks/useSafeNotification";
import { toApiError } from "../../../../api";

import useShopSales from "../hooks/useShopSales";
import { useShops } from "../../../masters/shops/hooks/useShops";
import ShopSalesFilters from "../components/ShopSalesFilters";
import ShopSalesSummary from "../components/ShopSalesSummary";
import ShopSalesTable from "../components/ShopSalesTable";
import ShopSalesPagination from "../components/ShopSalesPagination";
import type { ShopSale } from "../types/shopSale";
import type { Trip } from "../../vehicle-trips/types/trip.ts";
import { notifyTripDataChanged } from "../../../../shared/events/tripDataEvents";
import { useI18n } from "../../../../i18n";

interface ShopSalesPageProps {
  initialTrip?: Trip | null;
  embedded?: boolean;
}

function ShopSalesPage({ initialTrip, embedded = false }: ShopSalesPageProps) {
  const { t } = useI18n();
  const { showNotification } = useSafeNotification();
  const [searchInput, setSearchInput] = useState("");

  const {
    sales,
    filteredSales,
    paginatedSales,
    summary,
    filter,
    setFilter,
    shopNames: salesShopNames,
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    totalPages,
    resetFilters,
    refreshSales,
    isLoading,
    updateSale,
  } = useShopSales();

  const { shops, refreshShops } = useShops();

  // `useShopSales` owns the Shop Sales request lifecycle. This page only loads
  // its Shop-master labels; calling both here caused duplicate list requests
  // whenever a filter changed.
  useEffect(() => {
    void refreshShops();
  }, [refreshShops]);

  useEffect(() => {
    if (initialTrip && initialTrip.tripNo) {
      const tripNo = String(initialTrip.tripNo);
      setFilter((prev) => ({
        ...prev,
        search: tripNo,
      }));
      setSearchInput(tripNo);
      showNotification(t("ops.shop_sales.loaded_trip", { trip: tripNo }), "success");
    }
  }, [initialTrip, setFilter, showNotification, t]);

  const shopNames = Array.from(
    new Set([
      ...(salesShopNames || []),
      ...shops.map((s) => s.shopName),
    ])
  ).filter(Boolean);

  // The global Search field filters as the operator types; no separate Search
  // button is needed. The hook's request-sequence guard keeps only the latest
  // backend response when input changes quickly.
  const handleSearchInputChange = useCallback((value: string) => {
    setSearchInput(value);
    setFilter((prev) => ({ ...prev, search: value.trim() }));
    setCurrentPage(1);
  }, [setFilter, setCurrentPage]);

  const handleResetFilters = useCallback(() => {
    resetFilters();
    setSearchInput("");
    showNotification(t("ops.shop_sales.filters_reset"), "info");
  }, [resetFilters, showNotification, t]);

  const handleRefresh = useCallback(async () => {
    const refreshed = await refreshSales();
    if (refreshed) showNotification(t("ops.shop_sales.refreshed"), "success");
  }, [refreshSales, showNotification, t]);

  const handleUpdateSale = useCallback(
    async (updatedSale: ShopSale) => {
      try {
        const saved = await updateSale(updatedSale);
        // The server has updated the source Trip delivery/totals too. Notify
        // an already-mounted Trip List to refetch that same authoritative row.
        notifyTripDataChanged({ tripId: updatedSale.tripId, source: "shop-sales" });
        await refreshSales({ silent: true });
        if ((saved.unassignedBirds ?? 0) > 0) {
          showNotification(
            t("ops.shop_sales.reassignment_required", {
              count: saved.unassignedBirds ?? 0,
              trip: saved.tripNo,
            }),
            "info",
          );
        } else {
          showNotification(t("ops.shop_sales.updated_success"), "success");
        }
      } catch (error) {
        const apiError = toApiError(error);
        const details = apiError.details as { error?: string; assignmentLockTripNo?: string; unassignedBirds?: number } | undefined;
        if (details?.error === "trip_assignment_incomplete") {
          showNotification(
            t("ops.shop_sales.other_trips_locked", {
              trip: details.assignmentLockTripNo ?? "",
              count: details.unassignedBirds ?? 0,
            }),
            "error",
          );
        } else {
          showNotification(t("ops.shop_sales.update_failed"), "error");
        }
      }
    },
    [updateSale, showNotification, refreshSales, t]
  );

  // The API returns this trip-wide state on every related sale. Surface it
  // only once beside Search (rather than repeating the same warning per row).
  const sourceTripWithGap = sales.find((sale) => Number(sale.unassignedBirds) > 0) ?? null;
  const assignmentLock = sourceTripWithGap ?? sales.find((sale) => sale.assignmentLockTripId != null) ?? null;
  const assignmentNoticeBirds = sourceTripWithGap?.unassignedBirds ?? assignmentLock?.assignmentLockUnassignedBirds ?? null;
  const assignmentNoticeTripNo = sourceTripWithGap?.tripNo ?? assignmentLock?.assignmentLockTripNo ?? null;

  const hasActiveFilters =
    filter.fromDate !== "" ||
    filter.toDate !== "" ||
    filter.shopName.trim() !== "" ||
    filter.search.trim() !== "";

  const content = (
    <div className="w-full space-y-5 animate-in fade-in duration-500">
      <ShopSalesFilters
        fromDate={filter.fromDate}
        toDate={filter.toDate}
        shopName={filter.shopName}
        shopNames={shopNames}
        searchQuery={searchInput}
        setSearchQuery={handleSearchInputChange}
        setFromDate={(v) => setFilter({ ...filter, fromDate: v })}
        setToDate={(v) => setFilter({ ...filter, toDate: v })}
        setShopName={(v) => {
          setFilter({ ...filter, shopName: v });
          setCurrentPage(1);
        }}
        onReset={handleResetFilters}
        onRefresh={() => void handleRefresh()}
        refreshing={isLoading}
        unassignedBirds={assignmentNoticeBirds}
        assignmentTripNo={assignmentNoticeTripNo == null ? null : String(assignmentNoticeTripNo)}
      />

      {hasActiveFilters && (
        <ShopSalesSummary
          summary={summary}
          isLoading={isLoading}
        />
      )}

      <div className="rounded-2xl border border-slate-200/80 overflow-hidden bg-white shadow-sm text-xs md:text-sm">
        <ShopSalesTable
          sales={paginatedSales}
          isLoading={isLoading}
          startIndex={(currentPage - 1) * pageSize}
          onUpdateSale={handleUpdateSale}
        />
        {filteredSales.length > 0 && (
          <ShopSalesPagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            pageSize={pageSize}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setCurrentPage(1);
            }}
          />
        )}
      </div>
    </div>
  );

  if (embedded) return content;

  return (
    <div className="px-3 md:px-6 py-4 max-w-[1600px] mx-auto bg-slate-50/50 min-h-screen text-slate-800">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Shop Sales</h1>
        <p className="text-slate-500 mt-1 text-sm">Manage sales after completed vehicle trips</p>
      </div>
      {content}
    </div>
  );
}

export default ShopSalesPage;