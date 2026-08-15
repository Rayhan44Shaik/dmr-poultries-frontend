import { useCallback, useEffect, useMemo, useState } from "react";
import type { ShopSale, ShopSaleFilter } from "../types/shopSale";
import { listShopSales, updateShopSale, type ShopSalePatch } from "../services/shopSalesApiService";
import { handleApiError } from "../../../../api";
import { calculateSummary } from "../utils/shopSaleCalculation";

/**
 * PostgreSQL (via shopSalesApiService) is the single source of truth for
 * Shop Sales — no localStorage read or write happens anywhere in this
 * hook. The backend's eligibility query (Rate Entry locked) is never
 * re-derived here; this hook only filters/sorts/paginates whatever the
 * backend already decided is eligible.
 */
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

  const refreshSales = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await listShopSales({
        fromDate: filter.fromDate || undefined,
        toDate: filter.toDate || undefined,
      });
      setSales(data);
    } catch (error) {
      handleApiError(error);
      // Do not fall back to stale/fake data on failure — an empty,
      // clearly-not-current list is preferable to silently showing data
      // that no longer reflects PostgreSQL.
      setSales([]);
    } finally {
      setIsLoading(false);
    }
  }, [filter.fromDate, filter.toDate]);

  // Re-fetch from the backend whenever the date range actually changes —
  // this is the "real backend filtering" the from/to date fields now
  // drive, replacing the old client-only localStorage filter for those
  // two fields specifically. Shop-name search and sort stay client-side
  // below, same as before.
  useEffect(() => {
    refreshSales();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter.fromDate, filter.toDate]);

  const updateSale = useCallback(
    async (updatedSale: ShopSale) => {
      const original = sales.find((s) => s.id === updatedSale.id);
      if (!original || original.numericId == null) {
        throw new Error("Shop sale not found");
      }

      // Only include fields that actually changed from the last-known
      // backend value. The existing table always builds a full row object
      // on save (including unchanged rate/shopName) — sending those
      // unconditionally would trip the backend's locked-field rejection on
      // every single edit, even a birds-only change. `amount` is never
      // sent at all; the backend always recomputes it from weight × the
      // locked rate.
      const patch: ShopSalePatch = {};
      if (updatedSale.totalBirds !== original.totalBirds) patch.birds = updatedSale.totalBirds;
      if (updatedSale.totalWeight !== original.totalWeight) patch.weight = updatedSale.totalWeight;
      if (updatedSale.remark !== original.remark) patch.remarks = updatedSale.remark;
      // A genuine attempted rate or shop change is passed through
      // deliberately — the backend will correctly reject it with 409 once
      // Rate Entry is locked, and the catch below refreshes the
      // authoritative record so the UI snaps back rather than showing the
      // rejected value.
      if (updatedSale.rate !== original.rate && updatedSale.rate != null) patch.rate = updatedSale.rate;
      if (updatedSale.shopName !== original.shopName) patch.shopName = updatedSale.shopName;

      if (Object.keys(patch).length === 0) {
        return updatedSale;
      }

      try {
        const saved = await updateShopSale(original.numericId, patch);
        setSales((prev) => prev.map((s) => (s.id === saved.id ? saved : s)));
        return saved;
      } catch (error) {
        // Don't leave the optimistic/invalid value displayed — reload the
        // authoritative record from PostgreSQL so the row reverts to the
        // real current state (e.g. after a 409 rate-lock rejection, or a
        // 422 capacity rejection, or a concurrent edit by someone else).
        await refreshSales();
        throw error;
      }
    },
    [sales, refreshSales]
  );

  const shopNames = useMemo(() => {
    return [...new Set(sales.map((x) => x.shopName))].sort();
  }, [sales]);

  const filteredSales = useMemo(() => {
    let data = [...sales];

    // fromDate/toDate are already applied server-side (refreshSales); kept
    // here too only as a safety net against any state/refetch race, not as
    // the primary enforcement.
    if (filter.fromDate) data = data.filter((x) => x.tripDate >= filter.fromDate);
    if (filter.toDate) data = data.filter((x) => x.tripDate <= filter.toDate);
    if (filter.shopName.trim() !== "") {
      const search = filter.shopName.toLowerCase();
      data = data.filter((x) => x.shopName.toLowerCase().includes(search));
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
          const dateA = a.tripDate || "";
          const dateB = b.tripDate || "";
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
