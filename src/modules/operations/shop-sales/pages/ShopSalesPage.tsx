// src/pages/sales/shop-sales/ShopSalesPage.tsx

import { useEffect, useCallback } from "react";
import { useSafeNotification } from "../../../../hooks/useSafeNotification";
import { exportToPDF, exportToExcel } from "../../../../utils/exportUtils";

import useShopSales from "../hooks/useShopSales";
import { useShops } from "../../../masters/shops/hooks/useShops";
import ShopSalesFilters from "../components/ShopSalesFilters";
import ShopSalesSummary from "../components/ShopSalesSummary";
import ShopSalesTable from "../components/ShopSalesTable";
import ShopSalesPagination from "../components/ShopSalesPagination";
import type { Trip } from "../../vehicle-trips/types/trip.ts";

interface ShopSalesPageProps {
  initialTrip?: Trip | null;
  embedded?: boolean;
}

function ShopSalesPage({ initialTrip, embedded = false }: ShopSalesPageProps) {
  const { showNotification } = useSafeNotification();

  const {
    filteredSales,
    paginatedSales,
    summary,
    filter,
    setFilter,
    shopNames: salesShopNames,
    currentPage,
    setCurrentPage,
    totalPages,
    resetFilters,
    refreshSales,
    isLoading,
    updateSale,
    deleteSale,
  } = useShopSales();

  const { shops, refreshShops } = useShops();

  useEffect(() => {
    void refreshSales();
    refreshShops();
  }, [refreshSales, refreshShops]);

  useEffect(() => {
    if (initialTrip && initialTrip.tripNo) {
      setFilter((prev) => ({
        ...prev,
        searchQuery: initialTrip.tripNo,
      }));
      showNotification(`Loaded sales for Trip #${initialTrip.tripNo}`, "success");
    }
  }, [initialTrip, setFilter, showNotification]);

  const shopNames = Array.from(
    new Set([
      ...(salesShopNames || []),
      ...shops.map((s) => s.shopName),
    ])
  ).filter(Boolean);

  const handleSearch = useCallback(() => {
    setCurrentPage(1);
  }, [setCurrentPage]);

  const handleResetFilters = useCallback(() => {
    resetFilters();
    showNotification("Filters have been reset.", "info");
  }, [resetFilters, showNotification]);

  const handleUpdateSale = useCallback(
    async (id: number, patch: Parameters<typeof updateSale>[1]) => {
      try {
        await updateSale(id, patch);
        showNotification("Sale updated successfully", "success");
      } catch (err: any) {
        showNotification(err?.message || "Failed to update sale", "error");
      }
    },
    [updateSale, showNotification]
  );

  const handleDeleteSale = useCallback(
    async (id: number) => {
      try {
        await deleteSale(id);
        showNotification("Sale deleted successfully", "success");
      } catch (err: any) {
        showNotification(err?.message || "Failed to delete sale", "error");
      }
    },
    [deleteSale, showNotification]
  );

  const handleExportPDF = useCallback(() => {
    if (filteredSales.length === 0) {
      showNotification("No data to export.", "error");
      return;
    }
    const headers = [
      "Trip No",
      "Date",
      "Shop Name",
      "Birds",
      "Weight (KG)",
      "Rate (₹)",
      "Amount (₹)",
      "Remark",
    ];
    const rows = filteredSales.map((s) => [
      s.tripNo,
      s.saleDate,
      s.shopName,
      s.birds.toString(),
      s.weight.toFixed(2),
      (s.rate ?? 0).toFixed(2),
      s.amount.toFixed(2),
      s.remarks || "-",
    ]);
    const filename = `ShopSales_${new Date().toISOString().split("T")[0]}`;
    exportToPDF("Shop Sales Report", headers, rows, filename);
    showNotification("PDF exported successfully!", "success");
  }, [filteredSales, showNotification]);

  const handleExportExcel = useCallback(() => {
    if (filteredSales.length === 0) {
      showNotification("No data to export.", "error");
      return;
    }
    const headers = [
      "Trip No",
      "Date",
      "Shop Name",
      "Birds",
      "Weight (KG)",
      "Rate (₹)",
      "Amount (₹)",
      "Remark",
    ];
    const rows = filteredSales.map((s) => [
      s.tripNo,
      s.saleDate,
      s.shopName,
      s.birds,
      s.weight,
      s.rate ?? 0,
      s.amount,
      s.remarks || "",
    ]);
    const filename = `ShopSales_${new Date().toISOString().split("T")[0]}`;
    exportToExcel("Shop Sales Report", headers, rows, filename);
    showNotification("Excel exported successfully!", "success");
  }, [filteredSales, showNotification]);

  const content = (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl p-4 md:p-6 border border-slate-200/85 shadow-sm space-y-4 text-slate-800">
        <ShopSalesFilters
          fromDate={filter.fromDate}
          toDate={filter.toDate}
          shopName={filter.shopName}
          sortBy={filter.sortBy}
          shopNames={shopNames}
          totalEntries={filteredSales.length}
          setFromDate={(v) => {
            setFilter({ ...filter, fromDate: v });
            if (v) showNotification(`From date set to ${v}`, "info");
          }}
          setToDate={(v) => {
            setFilter({ ...filter, toDate: v });
            if (v) showNotification(`To date set to ${v}`, "info");
          }}
          setShopName={(v) => setFilter({ ...filter, shopName: v })}
          setSortBy={(v) => setFilter({ ...filter, sortBy: v })}
          onSearch={handleSearch}
          onReset={handleResetFilters}
          onExportPDF={handleExportPDF}
          onExportExcel={handleExportExcel}
          hasFilters={
            filter.fromDate !== "" ||
            filter.toDate !== "" ||
            filter.shopName.trim() !== ""
          }
        />

        <ShopSalesSummary
          summary={summary}
          fromDate={filter.fromDate}
          toDate={filter.toDate}
          shopName={filter.shopName}
          isLoading={isLoading}
        />

        <div className="rounded-2xl border border-slate-200/70 overflow-hidden bg-white shadow-sm text-xs md:text-sm">
          <ShopSalesTable
            sales={paginatedSales}
            isLoading={isLoading}
            onUpdateSale={handleUpdateSale}
            onDeleteSale={handleDeleteSale}
          />
        </div>

        <ShopSalesPagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />
      </div>
    </div>
  );

  if (embedded) return content;

  return (
    <div className="px-3 md:px-6 py-4 max-w-[1600px] mx-auto bg-slate-50/50 min-h-screen text-slate-800">
      {content}
    </div>
  );
}

export default ShopSalesPage;