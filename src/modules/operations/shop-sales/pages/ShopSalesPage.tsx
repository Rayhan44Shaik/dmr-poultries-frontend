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
import type { ShopSale } from "../types/shopSale";
import type { Trip } from "../../vehicle-trips/types/trip.ts"; // Import Trip type if needed

interface ShopSalesPageProps {
  initialTrip?: Trip | null; // Optional trip passed right after saving rates & locking
}

function ShopSalesPage({ initialTrip }: ShopSalesPageProps) {
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
  } = useShopSales();

  // Fetch master shops to ensure dropdown is fully populated
  const { shops, refreshShops } = useShops();

  useEffect(() => {
    refreshSales();
    refreshShops();
  }, [refreshSales, refreshShops]);

  // If an initialTrip is passed from the modal, auto-filter the sales list by that trip number
  useEffect(() => {
    if (initialTrip && initialTrip.tripNo) {
      setFilter((prev) => ({
        ...prev,
        searchQuery: initialTrip.tripNo, // Adjust this field depending on your filter hook structure
      }));
      showNotification(`Loaded sales for Trip #${initialTrip.tripNo}`, "success");
    }
  }, [initialTrip, setFilter, showNotification]);

  // Combine/fallback shop names from master shops and sales data
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

  const handleUpdateSale = useCallback(async (updatedSale: ShopSale) => {
    try {
      await updateSale(updatedSale);
      showNotification("Sale updated successfully", "success");
    } catch (error) {
      showNotification("Failed to update sale", "error");
    }
  }, [updateSale, showNotification]);

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
      s.tripDate,
      s.shopName,
      s.totalBirds.toString(),
      s.totalWeight.toFixed(2),
      (s.rate ?? 0).toFixed(2),
      s.amount.toFixed(2),
      s.remark || "-",
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
      s.tripDate,
      s.shopName,
      s.totalBirds,
      s.totalWeight,
      s.rate ?? 0,
      s.amount,
      s.remark || "",
    ]);
    const filename = `ShopSales_${new Date().toISOString().split("T")[0]}`;
    exportToExcel("Shop Sales Report", headers, rows, filename);
    showNotification("Excel exported successfully!", "success");
  }, [filteredSales, showNotification]);

  return (
    <div className="px-4 md:px-5 py-6 md:py-8 space-y-6 max-w-7xl mx-auto bg-slate-50 min-h-screen">
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

      <ShopSalesTable
        sales={paginatedSales}
        isLoading={isLoading}
        shopNames={shopNames}
        onUpdateSale={handleUpdateSale}
      />

      <ShopSalesPagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
      />
    </div>
  );
}

export default ShopSalesPage;