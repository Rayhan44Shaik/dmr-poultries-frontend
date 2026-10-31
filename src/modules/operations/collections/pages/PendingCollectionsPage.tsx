// src/modules/operations/collections/pages/PendingCollectionsPage.tsx

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { collectionService } from "../services/collectionService";
import { onShopDataChanged } from "../../../../shared/events/shopDataEvents";
import { useShops } from "../../../masters/shops/hooks/useShops";
import type {
  Collection,
  CollectionPendingSummaryRow,
  PendingOverallTotals,
  PendingShopSortDir,
  PendingShopSortKey,
} from "../types/collection";
import { useToast } from "../../../../components/common/ToastProvider";
import { ShopCollectionDetailModal } from "../components/pending/ShopCollectionDetailModal";
import PendingCollectionsFilters from "../components/pending/PendingCollectionsFilters";
import PendingCollectionsSummary from "../components/pending/PendingCollectionsSummary";
import PendingCollectionsTable from "../components/pending/PendingCollectionsTable";
import { Pagination } from "../../../../ui";
import { shouldShowPagination } from "../../../../shared/ui/paginationStyles";
import { todayBusinessDate } from "../../../../utils/businessDate";
import { useI18n } from "../../../../i18n";
import { CAPABILITIES, useCan } from "../../../auth/permissions";
import { exportPendingCollectionsExcel, exportPendingCollectionsPdf } from "../utils/exportPendingCollections";

const DEFAULT_PAGE_SIZE = 15;

interface PendingReportRow {
  shopId: number;
  shopName: string;
  ownerName: string;
  phoneNumber: string;
  weekStart: string;
  weekEnd: string;
  balance: number;
  weeklySales: number;
  weeklyApprovedCollections: number;
  weeklyPendingCollections: number;
  recoveryPercentage: number;
  overdueDays: number | null;
  lastCollectionDate: string | null | undefined;
  hasPendingCollections: boolean;
}

export default function PendingCollectionsPage() {
  // Entry-only roles (supervisor) view pending balances without delete rights.
  const can = useCan();
  const { t } = useI18n();
  const toast = useToast();

  // Load ALL shops from Master → Shops (Active + Inactive)
  const { shops, loading: shopsLoading, reload: reloadShops } = useShops();
  const allShops = shops; // Show ALL shops (Active + Inactive)

  const [allCollections] = useState<Collection[]>([]);

  // Filter state (unapplied)
  const [shopName, setShopName] = useState("");
  /**
   * Column order, held as key + direction — one vocabulary shared with the
   * table headers and the filter bar's Sort By, exactly like Trip List.
   * `null` means no column order: the register's own sequence.
   */
  const [sortBy, setSortBy] = useState<PendingShopSortKey | null>(null);
  const [sortDir, setSortDir] = useState<PendingShopSortDir>("asc");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [recoveryThreshold, setRecoveryThreshold] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");

  // Debounced search
  const debouncedSearchRef = useRef<NodeJS.Timeout | null>(null);
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");

  useEffect(() => {
    if (debouncedSearchRef.current) {
      clearTimeout(debouncedSearchRef.current);
    }
    debouncedSearchRef.current = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    return () => {
      if (debouncedSearchRef.current) {
        clearTimeout(debouncedSearchRef.current);
      }
    };
  }, [searchQuery]);

  // Applied filters
  const [appliedShopName, setAppliedShopName] = useState("");
  const [appliedSortBy, setAppliedSortBy] = useState<PendingShopSortKey | null>(null);
  const [appliedSortDir, setAppliedSortDir] = useState<PendingShopSortDir>("asc");
  const [appliedFromDate, setAppliedFromDate] = useState("");
  const [appliedToDate, setAppliedToDate] = useState("");
  const [appliedRecoveryThreshold, setAppliedRecoveryThreshold] = useState(0);
  const [appliedSearchQuery, setAppliedSearchQuery] = useState("");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  // Selection state for table
  const [selectedShopName, setSelectedShopName] = useState<string | null>(null);

  // Modal state
  const [selectedShop, setSelectedShop] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Pending summary from backend (for shops that have collections)
  const [pendingSummaryRows, setPendingSummaryRows] = useState<CollectionPendingSummaryRow[]>([]);
  /**
   * The table is the only thing that loads. Everything below tracks a read that
   * changes table rows, so the page keeps its filter bar, its KPI strip and its
   * card header on screen and never flashes a full-page loader.
   */
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const hasRowsRef = useRef(false);

  const summaryAsOfDate = useCallback(() => {
    const today = todayBusinessDate();
    if (!appliedToDate) return today;
    return appliedToDate < today ? appliedToDate : today;
  }, [appliedToDate]);

  const loadSummary = useCallback(async (opts?: { quiet?: boolean }) => {
    if (!opts?.quiet || !hasRowsRef.current) setSummaryLoading(true);
    else setRefreshing(true);
    try {
      const payload = await collectionService.fetchPendingSummary(
        summaryAsOfDate(),
        appliedFromDate && appliedToDate ? { fromDate: appliedFromDate, toDate: appliedToDate } : undefined,
      );
      setPendingSummaryRows(payload.shops);
      hasRowsRef.current = payload.shops.length > 0;
    } catch {
      if (!opts?.quiet) setPendingSummaryRows([]);
    } finally {
      setSummaryLoading(false);
      setRefreshing(false);
    }
  }, [appliedFromDate, appliedToDate, summaryAsOfDate]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  useEffect(
    () =>
      onShopDataChanged(() => {
        void loadSummary({ quiet: true });
      }),
    [loadSummary],
  );

  useEffect(() => {
    setAppliedFromDate(fromDate);
    setAppliedToDate(toDate);
  }, [fromDate, toDate]);

  useEffect(() => {
    setAppliedShopName(shopName);
  }, [shopName]);

  useEffect(() => {
    setAppliedSortBy(sortBy);
    setAppliedSortDir(sortDir);
  }, [sortBy, sortDir]);

  useEffect(() => {
    setAppliedRecoveryThreshold(recoveryThreshold);
  }, [recoveryThreshold]);

  useEffect(() => {
    setAppliedSearchQuery(debouncedSearchQuery);
  }, [debouncedSearchQuery]);

// Build the complete report from ALL shops + backend data
  const reportData = useMemo((): PendingReportRow[] => {
    const summaryMap = new Map<string, CollectionPendingSummaryRow>();
    pendingSummaryRows.forEach((row) => summaryMap.set(row.shopName, row));

    return allShops.map((shop) => {
      const backendData = summaryMap.get(shop.shopName);
      if (backendData) {
        return {
          shopId: backendData.shopId,
          shopName: backendData.shopName,
          ownerName: shop.ownerName,
          phoneNumber: shop.phoneNumber,
          weekStart: backendData.weekStart,
          weekEnd: backendData.weekEnd,
          balance: backendData.balance,
          weeklySales: backendData.weeklySales,
          weeklyApprovedCollections: backendData.weeklyApprovedCollections,
          weeklyPendingCollections: backendData.weeklyPendingCollections,
          recoveryPercentage: backendData.recoveryPercentage,
          overdueDays: backendData.overdueDays,
          lastCollectionDate: backendData.lastCollectionDate,
          hasPendingCollections: backendData.hasPendingCollections,
        };
      }
      // Shop exists in Master but has no backend summary - show zeros
      return {
        shopId: shop.id,
        shopName: shop.shopName,
        ownerName: shop.ownerName,
        phoneNumber: shop.phoneNumber,
        weekStart: appliedFromDate,
        weekEnd: appliedToDate,
        balance: shop.currentBalance ?? 0,
        weeklySales: 0,
        weeklyApprovedCollections: 0,
        weeklyPendingCollections: 0,
        recoveryPercentage: 0,
        overdueDays: null,
        lastCollectionDate: null,
        hasPendingCollections: false,
      };
    });
  }, [allShops, pendingSummaryRows, appliedFromDate, appliedToDate]);

  // Apply filters (debounced search)
  const filteredData = useMemo(() => {
    let data = [...reportData];

    if (debouncedSearchQuery.trim()) {
      const query = debouncedSearchQuery.toLowerCase().trim();
      data = data.filter((s) => s.shopName.toLowerCase().includes(query));
    }

    if (appliedShopName) {
      data = data.filter((s) => s.shopName === appliedShopName);
    }

    if (appliedRecoveryThreshold > 0) {
      data = data.filter((shop) => shop.recoveryPercentage >= appliedRecoveryThreshold);
    }

    if (appliedSortBy) {
      const direction = appliedSortDir === "asc" ? 1 : -1;
      const orderValue = (row: PendingReportRow): string | number => {
        switch (appliedSortBy) {
          case "balance":
            return row.balance;
          case "weeklySales":
            return row.weeklySales;
          case "weeklyApprovedCollections":
            return row.weeklyApprovedCollections;
          case "recoveryPercentage":
            return row.recoveryPercentage;
          case "overdueDays":
            // A shop that is not overdue sits below every overdue shop, in both
            // directions — "not overdue" is an absence, not a small number.
            return row.overdueDays ?? -1;
          case "lastCollectionDate":
            return row.lastCollectionDate ?? "";
          case "shopName":
          default:
            return row.shopName.toLowerCase();
        }
      };
      data.sort((a, b) => {
        const left = orderValue(a);
        const right = orderValue(b);
        if (typeof left === "number" && typeof right === "number") {
          return (left - right) * direction;
        }
        return String(left).localeCompare(String(right)) * direction;
      });
    }
    return data;
  }, [
    reportData,
    debouncedSearchQuery,
    appliedShopName,
    appliedSortBy,
    appliedSortDir,
    appliedRecoveryThreshold,
  ]);

  const totalItems = filteredData.length;
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, currentPage, pageSize]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [appliedSearchQuery, appliedShopName, appliedSortBy, appliedSortDir, appliedRecoveryThreshold]);

  // Totals for KPI
  const totalOutstanding = filteredData.reduce((sum, s) => sum + s.balance, 0);
  const totalWeeklySales = filteredData.reduce((sum, s) => sum + s.weeklySales, 0);
  const totalWeeklyCollections = filteredData.reduce((sum, s) => sum + s.weeklyApprovedCollections, 0);
  /**
   * Recovery for the strip: approved collections ÷ sales, over exactly the
   * rows on screen — the same formula the backend's `totals.recoveryPercentage`
   * and the dashboard's collection-performance card use.
   *
   * It used to be the MEAN of each shop's own percentage, and that is what made
   * the KPI impossible to reconcile: 90 of the 128 shops in the default week
   * collected against older dues while selling nothing this week, every one of
   * them reading 0%, so the average landed on 49.9% beside ₹14,60,000 collected
   * on ₹4,74,014 of sales. Dividing the two figures the strip already shows
   * gives the honest 308.01% for the same rows.
   */
  const overallRecovery = totalWeeklySales > 0 ? (totalWeeklyCollections / totalWeeklySales) * 100 : 0;

  /**
   * The cumulative that closes the table. Summed over `filteredData` — the
   * whole filtered set — never over the rows of the current page, so the same
   * figures show on page 1 and on the last page.
   */
  const overallTotals = useMemo((): PendingOverallTotals | null => {
    if (filteredData.length === 0) return null;
    const collectionDates = filteredData
      .map((row) => row.lastCollectionDate ?? "")
      .filter((value) => Boolean(value))
      .sort();
    return {
      shops: filteredData.length,
      balance: totalOutstanding,
      weeklySales: totalWeeklySales,
      weeklyApprovedCollections: totalWeeklyCollections,
      recoveryPercentage: overallRecovery,
      lastCollectionDate: collectionDates.length > 0 ? collectionDates[collectionDates.length - 1] : null,
      overdueShops: filteredData.filter((row) => (row.overdueDays ?? 0) > 0).length,
    };
  }, [filteredData, totalOutstanding, totalWeeklySales, totalWeeklyCollections, overallRecovery]);

  /** Header click: ascending → descending → back to the register order. */
  const handleSortChange = useCallback((key: PendingShopSortKey) => {
    if (sortBy !== key) {
      setSortBy(key);
      setSortDir("asc");
      return;
    }
    if (sortDir === "asc") {
      setSortDir("desc");
      return;
    }
    setSortBy(null);
    setSortDir("asc");
  }, [sortBy, sortDir]);

  /** The filter bar's single setter for both halves of the order. */
  const setSort = useCallback((key: PendingShopSortKey | null, dir: PendingShopSortDir) => {
    setSortBy(key);
    setSortDir(dir);
  }, []);

  /**
   * Side arrows in the shop view walk the same order the table shows — the
   * filtered, sorted list — and move the table's highlighted row with them.
   */
  const shopPosition = useMemo(
    () => filteredData.findIndex((row) => row.shopName === selectedShop),
    [filteredData, selectedShop],
  );

  const navigateShop = useCallback(
    (direction: -1 | 1) => {
      if (shopPosition < 0) return;
      const next = shopPosition + direction;
      if (next < 0 || next >= filteredData.length) return;
      const nextShop = filteredData[next].shopName;
      setSelectedShop(nextShop);
      setSelectedShopName(nextShop);
    },
    [filteredData, shopPosition],
  );

  const handleView = (shopName: string) => {
    setSelectedShop(shopName);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedShop(null);
  };

  const refreshData = async () => {
    try {
      await Promise.all([reloadShops(), loadSummary({ quiet: true })]);
      toast.success(t("ops.collection.refreshed"));
    } catch {
      toast.error(t("ops.collection.failed_refresh"));
    }
  };

  const resetFilters = () => {
    setFromDate("");
    setToDate("");
    setShopName("");
    setSortBy(null);
    setSortDir("asc");
    setRecoveryThreshold(0);
    setSearchQuery("");
    setAppliedFromDate("");
    setAppliedToDate("");
    setAppliedShopName("");
    setAppliedSortBy(null);
    setAppliedSortDir("asc");
    setAppliedRecoveryThreshold(0);
    setAppliedSearchQuery("");
    setCurrentPage(1);
    toast.info(t("ops.collection.filters_reset"));
  };

  const firstLoad = (shopsLoading || summaryLoading) && pendingSummaryRows.length === 0;
  const tableLoading = firstLoad;
  const hasKpiFilters = Boolean(appliedShopName || (appliedFromDate && appliedToDate));
  const exportFileName = `pending-collections-${todayBusinessDate()}`;
  const handleExportPdf = useCallback(() => {
    void exportPendingCollectionsPdf(filteredData, exportFileName);
  }, [filteredData, exportFileName]);
  const handleExportExcel = useCallback(() => {
    exportPendingCollectionsExcel(filteredData, exportFileName);
  }, [filteredData, exportFileName]);

  return (
    <div className="w-full space-y-5 animate-in fade-in duration-500">
      {/* Filter Bar */}
      <PendingCollectionsFilters
        fromDate={fromDate}
        toDate={toDate}
        shopName={shopName}
        sortBy={sortBy}
        sortDir={sortDir}
        shopNames={allShops.map((s) => s.shopName).sort()}
        recoveryThreshold={recoveryThreshold}
        searchQuery={searchQuery}
        setFromDate={setFromDate}
        setToDate={setToDate}
        setShopName={setShopName}
        setSort={setSort}
        setRecoveryThreshold={setRecoveryThreshold}
        setSearchQuery={setSearchQuery}
        onReset={resetFilters}
        onRefresh={refreshData}
        onExportPdf={handleExportPdf}
        onExportExcel={handleExportExcel}
        exportEnabled={hasKpiFilters && filteredData.length > 0 && !tableLoading}
        refreshing={firstLoad || refreshing}
      />

      {hasKpiFilters && (
        <div className="animate-in fade-in slide-in-from-top-1 duration-200">
          <PendingCollectionsSummary
            totalOutstanding={totalOutstanding}
            weeklySales={totalWeeklySales}
            weeklyCollections={totalWeeklyCollections}
            recoveryPercentage={overallRecovery}
            isLoading={firstLoad}
          />
        </div>
      )}

      {/* Table Section */}
      <div className="rounded-2xl border border-slate-200/80 overflow-hidden bg-white shadow-sm text-xs md:text-sm">
        <PendingCollectionsTable
          data={paginatedData}
          selectedShopName={selectedShopName}
          onSelectShop={setSelectedShopName}
          onView={handleView}
          onOpenShop={handleView}
          allowDelete={can(CAPABILITIES.COLLECTION_DELETE)}
          totalShops={filteredData.length}
          startIndex={(currentPage - 1) * pageSize}
          isLoading={tableLoading}
          refreshing={refreshing}
          sortBy={sortBy}
          sortDir={sortDir}
          onSortChange={handleSortChange}
          overall={overallTotals}
        />
        {shouldShowPagination(totalItems) && (
          <Pagination
            compact
            page={currentPage}
            pageSize={pageSize}
            totalItems={totalItems}
            onPageChange={setCurrentPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setCurrentPage(1);
            }}
            disabled={tableLoading}
          />
        )}
      </div>

      {selectedShop && (
        <ShopCollectionDetailModal
          isOpen={isModalOpen}
          onClose={closeModal}
          shopName={selectedShop}
          allCollections={allCollections}
          shops={allShops}
          onRefresh={refreshData}
          onNavigateShop={navigateShop}
          canGoPrev={shopPosition > 0}
          canGoNext={shopPosition >= 0 && shopPosition < filteredData.length - 1}
          shopIndex={shopPosition >= 0 ? shopPosition + 1 : undefined}
          shopTotal={filteredData.length}
          allowDelete={can(CAPABILITIES.COLLECTION_DELETE)}
        />
      )}
    </div>
  );
}
