import { useCallback, useMemo, useState } from "react";
import type { ShopSale, ShopSaleFilter } from "../types/shopSale";
import type { Trip } from "../../vehicle-trips/types/trip";
import { shopSalesService } from "../services/shopSalesService";
import { completedTripService } from "../services/completedTripService";
import { calculateSummary } from "../utils/shopSaleCalculation";

function useShopSales() {
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

  const refreshSales = useCallback(() => {
    setIsLoading(true);
    try {
      const data = shopSalesService.getAll();
      setSales(data);
    } catch (error) {
      console.error("Failed to load shop sales:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateSale = useCallback(async (updatedSale: ShopSale) => {
    const newSales = sales.map((s) =>
      s.id === updatedSale.id ? updatedSale : s
    );
    setSales(newSales);
    shopSalesService.saveAll(newSales);

    const originalSale = sales.find((s) => s.id === updatedSale.id);
    if (!originalSale) return updatedSale;

    try {
      const allTrips: Trip[] = completedTripService.getAllTrips();
      const trip = allTrips.find((t: Trip) => t.tripNo === updatedSale.tripNo);
      if (!trip) {
        console.warn(`Trip not found for tripNo: ${updatedSale.tripNo}`);
        return updatedSale;
      }

      const delivery = trip.deliveries?.find(
        (d) => d.shopName === originalSale.shopName
      );
      if (!delivery) {
        console.warn(`Delivery not found for shop: ${originalSale.shopName}`);
        return updatedSale;
      }

      delivery.shopName = updatedSale.shopName;
      delivery.birds = updatedSale.totalBirds;
      delivery.weight = updatedSale.totalWeight;
      if ('rate' in delivery) {
        (delivery as any).rate = updatedSale.rate;
      }

      completedTripService.updateTrip(trip);
    } catch (error) {
      console.error("Failed to update trip delivery:", error);
    }

    return updatedSale;
  }, [sales]);

  const shopNames = useMemo(() => {
    return [...new Set(sales.map((x) => x.shopName))].sort();
  }, [sales]);

  const filteredSales = useMemo(() => {
    let data = [...sales];

    if (filter.fromDate) {
      data = data.filter((x) => x.tripDate >= filter.fromDate);
    }
    if (filter.toDate) {
      data = data.filter((x) => x.tripDate <= filter.toDate);
    }
    if (filter.shopName.trim() !== "") {
      const search = filter.shopName.toLowerCase();
      data = data.filter((x) =>
        x.shopName.toLowerCase().includes(search)
      );
    }

    switch (filter.sortBy) {
      case "Amount":
        data.sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0));
        break;
      case "Weight":
        data.sort((a, b) => b.totalWeight - a.totalWeight);
        break;
      case "Birds":
        data.sort((a, b) => b.totalBirds - a.totalBirds);
        break;
      case "Rate":
        data.sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0));
        break;
      case "Shop":
        data.sort((a, b) => a.shopName.localeCompare(b.shopName));
        break;
      default:
        data.sort((a, b) => {
      // Use collectionDate as primary, fallback to createdDate
      const dateA = a.tripDate || a.tripDate || '';
      const dateB = b.tripDate || b.tripDate || '';
      return dateB.localeCompare(dateA);
    });
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
  };
}

export default useShopSales;