import { useCallback, useMemo, useState } from "react";
import type { ShopSale, ShopSaleFilter, ShopSaleUpdateInput } from "../types/shopSale";
import { shopSalesApiService } from "../services/shopSalesApiService";
import { calculateSummary } from "../utils/shopSaleCalculation";
import { useSafeNotification } from "../../../../hooks/useSafeNotification";

function useShopSales() {
  const { showNotification } = useSafeNotification();
  const [sales, setSales] = useState<ShopSale[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<ShopSaleFilter>({
    fromDate: "",
    toDate: "",
    shopName: "",
    sortBy: "Latest",
  });
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Real PostgreSQL data via GET /api/operations/shop-sales — no localStorage.
  const refreshSales = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await shopSalesApiService.listShopSales();
      setSales(data);
    } catch (error) {
      console.error("Failed to load shop sales:", error);
      showNotification("Unable to load shop sales from the server.", "error");
    } finally {
      setIsLoading(false);
    }
  }, [showNotification]);

  // Backend recomputes amount server-side (weight × rate) and rejects the
  // edit once the trip's 10-day window has closed or the cumulative
  // birds/weight would exceed the trip's available quantity.
  const updateSale = useCallback(async (id: number, patch: ShopSaleUpdateInput) => {
    const updated = await shopSalesApiService.updateShopSale(id, patch);
    setSales((prev) => prev.map((s) => (s.id === id ? updated : s)));
    return updated;
  }, []);

  const deleteSale = useCallback(async (id: number, reason?: string) => {
    await shopSalesApiService.deleteShopSale(id, reason);
    setSales((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const shopNames = useMemo(() => {
    return [...new Set(sales.map((x) => x.shopName))].sort();
  }, [sales]);

  const filteredSales = useMemo(() => {
    let data = [...sales];

    if (filter.fromDate) {
      data = data.filter((x) => x.saleDate >= filter.fromDate);
    }
    if (filter.toDate) {
      data = data.filter((x) => x.saleDate <= filter.toDate);
    }
    if (filter.shopName.trim() !== "") {
      const search = filter.shopName.toLowerCase();
      data = data.filter((x) => x.shopName.toLowerCase().includes(search));
    }

    switch (filter.sortBy) {
      case "Amount":
        data.sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0));
        break;
      case "Weight":
        data.sort((a, b) => b.weight - a.weight);
        break;
      case "Birds":
        data.sort((a, b) => b.birds - a.birds);
        break;
      case "Rate":
        data.sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0));
        break;
      case "Shop":
        data.sort((a, b) => a.shopName.localeCompare(b.shopName));
        break;
      default:
        data.sort((a, b) => b.saleDate.localeCompare(a.saleDate));
    }

    return data;
  }, [sales, filter]);

  const totalPages = Math.max(1, Math.ceil(filteredSales.length / pageSize));

  const paginatedSales = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredSales.slice(start, start + pageSize);
  }, [filteredSales, currentPage, pageSize]);

  const summary = useMemo(() => calculateSummary(filteredSales), [filteredSales]);

  const resetFilters = useCallback(() => {
    setFilter({
      fromDate: "",
      toDate: "",
      shopName: "",
      sortBy: "Latest",
    });
    setCurrentPage(1);
  }, []);

  return {
    sales,
    filteredSales,
    paginatedSales,
    summary,
    filter,
    setFilter,
    shopNames,
    currentPage,
    setCurrentPage,
    totalPages,
    resetFilters,
    refreshSales,
    isLoading,
    updateSale,
    deleteSale,
  };
}

export default useShopSales;
