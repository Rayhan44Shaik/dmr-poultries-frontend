// src/pages/sales/shop-sales/ShopSalesPage.tsx

import { useEffect, useCallback, useState } from "react";
import { useSafeNotification } from "../../../../hooks/useSafeNotification";
import { handleApiError } from "../../../../api";

import useShopSales from "../hooks/useShopSales";
import { useShops } from "../../../masters/shops/hooks/useShops";
import ShopSalesFilters from "../components/ShopSalesFilters";
import ShopSalesSummary from "../components/ShopSalesSummary";
import ShopSalesTable from "../components/ShopSalesTable";
import ShopSalesPagination from "../components/ShopSalesPagination";
import type { ShopSale } from "../types/shopSale";
import type { Trip } from "../../vehicle-trips/types/trip.ts";
import { notifyTripDataChanged } from "../../../../shared/events/tripDataEvents";

interface ShopSalesPageProps {
  initialTrip?: Trip | null;
  embedded?: boolean;
}

function ShopSalesPage({ initialTrip, embedded = false }: ShopSalesPageProps) {
  const { showNotification } = useSafeNotification();
  const [searchInput, setSearchInput] = useState("");

  const {
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
      showNotification(`Loaded sales for Trip #${tripNo}`, "success");
    }
  }, [initialTrip, setFilter, showNotification]);

  const shopNames = Array.from(
    new Set([
      ...(salesShopNames || []),
      ...shops.map((s) => s.shopName),
    ])
  ).filter(Boolean);

  const handleSearch = useCallback(() => {
    const query = searchInput.trim();
    setFilter((prev) => ({ ...prev, search: query }));
    setCurrentPage(1);
  }, [searchInput, setFilter, setCurrentPage]);

  const handleResetFilters = useCallback(() => {
    resetFilters();
    setSearchInput("");
    showNotification("Filters have been reset.", "info");
  }, [resetFilters, showNotification]);

  const handleRefresh = useCallback(async () => {
    const refreshed = await refreshSales();
    if (refreshed) showNotification("Shop sales refreshed.", "success");
  }, [refreshSales, showNotification]);

  const handleUpdateSale = useCallback(
    async (updatedSale: ShopSale) => {
      try {
        await updateSale(updatedSale);
        // The server has updated the source Trip delivery/totals too. Notify
        // an already-mounted Trip List to refetch that same authoritative row.
        notifyTripDataChanged({ tripId: updatedSale.tripId, source: "shop-sales" });
        showNotification("Sale updated successfully", "success");
        await refreshSales({ silent: true });
      } catch (error) {
        showNotification(handleApiError(error), "error");
      }
    },
    [updateSale, showNotification, refreshSales]
  );

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
        sortBy={filter.sortBy}
        shopNames={shopNames}
        searchQuery={searchInput}
        setSearchQuery={setSearchInput}
        setFromDate={(v) => setFilter({ ...filter, fromDate: v })}
        setToDate={(v) => setFilter({ ...filter, toDate: v })}
        setShopName={(v) => {
          setFilter({ ...filter, shopName: v });
          setCurrentPage(1);
        }}
        setSortBy={(v) => {
          setFilter({ ...filter, sortBy: v });
          setCurrentPage(1);
        }}
        onSearch={handleSearch}
        onReset={handleResetFilters}
        onRefresh={() => void handleRefresh()}
        refreshing={isLoading}
      />

      {hasActiveFilters && (
        <ShopSalesSummary
          summary={summary}
          fromDate={filter.fromDate}
          toDate={filter.toDate}
          shopName={filter.shopName}
          isLoading={isLoading}
        />
      )}

      <div className="rounded-2xl border border-slate-200/80 overflow-hidden bg-white shadow-sm text-xs md:text-sm">
        <ShopSalesTable
          sales={paginatedSales}
          isLoading={isLoading}
          startIndex={(currentPage - 1) * pageSize}
          sortBy={filter.sortBy}
          onSortChange={(sortBy) => {
            setFilter((current) => ({ ...current, sortBy }));
            setCurrentPage(1);
          }}
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