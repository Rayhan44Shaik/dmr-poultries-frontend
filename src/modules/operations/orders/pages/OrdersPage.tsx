// src/modules/operations/orders/pages/OrdersPage.tsx
// DMR POULTRIES — Orders.
//
//   Order Collection | Order Assignment | Delivery Tracking
//
// All three tabs read the SAME backend Orders module (/api/orders), which
// owns the quantities, the locks and the statuses. The page holds only view
// state (active tab, selected day/range, search text, page, rows per page)
// and refetches from the server whenever that view state changes — so a
// refresh, a cache clear, a navigation away and back, or a change made by
// another user always reproduces the correct state.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ClipboardList, PackageCheck, Route } from "lucide-react";
import { useI18n } from "../../../../i18n";
import { useSafeNotification } from "../../../../hooks/useSafeNotification";
import { useToast } from "../../../../components/common/ToastProvider";
import {
  cityOf,
  loadOrdersTrip,
  loadShopDirectory,
  loadSupervisorDirectory,
  sendOrdersWhatsApp,
  shopMobileOf,
  supervisorMobileOf,
  type ShopDirectory,
  type SupervisorDirectory,
} from "../ordersService";
import {
  emptyOrdersPage,
  listEligibleVehicles,
  listOrders,
  type EligibleVehicle,
  type OrdersPage as OrdersPageData,
} from "../services/ordersApi";
import { addLocalDays, buildShopBreakdown, localToday, rowsInSequence } from "../ordersUtils";
import { generateOrdersPdf } from "../pdf/generateOrdersPdf";
import type { OrdersTrip } from "../types";
import { useOrdersI18n } from "../i18n/ordersI18n";
import OrdersAssignmentTab from "../components/OrdersAssignmentTab";
import OrdersCollectionTab from "../components/OrdersCollectionTab";
import OrdersDeliveryTrackingTab from "../components/OrdersDeliveryTrackingTab";
import OrdersDeliveryDetailView from "../components/OrdersDeliveryDetailView";
import { OrdersErrorState, OrdersTabHeader } from "../components/OrdersCommon";
import { ORDERS_DEFAULT_PAGE_SIZE } from "../components/ordersUiConstants";

type TabKey = "collection" | "assignment" | "tracking";

const OrdersPage: React.FC = () => {
  const { language } = useI18n();
  const { to } = useOrdersI18n();
  const { showNotification } = useSafeNotification();
  const { success: toastSuccess, error: toastError } = useToast();

  const today = useMemo(() => localToday(), []);

  const [activeTab, setActiveTab] = useState<TabKey>("collection");

  // ── View state (per tab) ────────────────────────────────────────────────
  const [day, setDay] = useState<string>(today);
  const [trackingFrom, setTrackingFrom] = useState<string>(addLocalDays(today, -6));
  const [trackingTo, setTrackingTo] = useState<string>(today);
  const [search, setSearch] = useState<Record<TabKey, string>>({
    collection: "",
    assignment: "",
    tracking: "",
  });
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [pageNumber, setPageNumber] = useState<Record<TabKey, number>>({
    collection: 1,
    assignment: 1,
    tracking: 1,
  });
  const [pageSize, setPageSize] = useState<Record<TabKey, number>>({
    collection: ORDERS_DEFAULT_PAGE_SIZE,
    assignment: ORDERS_DEFAULT_PAGE_SIZE,
    tracking: ORDERS_DEFAULT_PAGE_SIZE,
  });
  const [selectedTripId, setSelectedTripId] = useState<number | null>(null);
  // Collection working-sheet view state (server-driven sort + filled-only).
  const [collectionSort, setCollectionSort] = useState<string>("shopNameAsc");
  const [filledOnly, setFilledOnly] = useState<boolean>(false);

  // ── Server data ─────────────────────────────────────────────────────────
  const [data, setData] = useState<OrdersPageData>(() => emptyOrdersPage());
  // EVERY open vehicle trip (Step 4 not submitted), whatever day it was
  // raised on. Order Assignment lists them all: a day's orders may be
  // loaded onto any truck that has not delivered yet.
  const [vehicles, setVehicles] = useState<EligibleVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Which request the data currently in `data` came from. Comparing it with
  // the key the CURRENT view state asks for tells a tab whether the figures
  // on screen still describe the filters the user is looking at — so a KPI
  // can say "Updating…" instead of quietly presenting the previous day's
  // totals. Written only from the async callback, like every other field.
  const [loadedKey, setLoadedKey] = useState<string | null>(null);

  const [shopDirectory, setShopDirectory] = useState<ShopDirectory>(new Map());
  const [supervisorDirectory, setSupervisorDirectory] = useState<SupervisorDirectory>(new Map());

  // Debounce the search box so typing does not fire a query per keystroke,
  // and always reset to page 1 when the query changes.
  const activeSearch = search[activeTab];
  useEffect(() => {
    const handle = window.setTimeout(() => setDebouncedSearch(activeSearch.trim()), 300);
    return () => window.clearTimeout(handle);
  }, [activeSearch]);

  const currentQuery = useMemo(() => {
    if (activeTab === "tracking") {
      return {
        fromDate: trackingFrom,
        toDate: trackingTo,
        search: debouncedSearch,
        page: pageNumber.tracking,
        pageSize: pageSize.tracking,
      };
    }
    return {
      date: day,
      search: debouncedSearch,
      page: pageNumber[activeTab],
      pageSize: pageSize[activeTab],
      // Collection is the all-shops working sheet; Assignment only needs
      // the shops whose collection is FINISHED (collected = true).
      sort: activeTab === "collection" ? collectionSort : undefined,
      filledOnly: activeTab === "assignment" ? true : activeTab === "collection" ? filledOnly : undefined,
      collectedOnly: activeTab === "assignment" ? true : undefined,
    };
  }, [
    activeTab,
    day,
    trackingFrom,
    trackingTo,
    debouncedSearch,
    pageNumber,
    pageSize,
    collectionSort,
    filledOnly,
  ]);

  /** Identity of the request the current view state asks for. */
  const queryKey = useMemo(
    () => `${activeTab}|${JSON.stringify(currentQuery)}`,
    [activeTab, currentQuery]
  );

  // A monotonically increasing token: only the newest response is applied,
  // so a slow earlier request can never overwrite fresher data.
  const requestToken = useRef(0);

  /**
   * Reloads the current tab from the server. State is only ever written from
   * the async callbacks, so the effect below never sets state synchronously
   * (no cascading renders).
   */
  const fetchPage = useCallback(
    (): Promise<boolean> => {
      const token = (requestToken.current += 1);
      const key = queryKey;
      return Promise.all([
        listOrders(currentQuery),
        activeTab === "assignment"
          ? listEligibleVehicles()
          : Promise.resolve<EligibleVehicle[]>([]),
      ]).then(
        ([next, eligible]) => {
          if (token !== requestToken.current) return false;
          setData(next);
          if (activeTab === "assignment") setVehicles(eligible);
          setError(null);
          setLoadedKey(key);
          setLoading(false);
          setRefreshing(false);
          return true;
        },
        (e: unknown) => {
          if (token !== requestToken.current) return false;
          setError(e instanceof Error ? e.message : "Failed to load orders");
          setLoading(false);
          setRefreshing(false);
          return false;
        }
      );
    },
    [currentQuery, activeTab, queryKey]
  );

  useEffect(() => {
    void fetchPage();
  }, [fetchPage]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [shopDir, supDir] = await Promise.all([
          loadShopDirectory(),
          loadSupervisorDirectory(),
        ]);
        if (!cancelled) {
          setShopDirectory(shopDir);
          setSupervisorDirectory(supDir);
        }
      } catch {
        // Non-fatal: city / supervisor-mobile decorations fall back to "—".
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // A vehicle that is no longer eligible (completed, rate-locked, another
  // day) must never linger as a stale selection — derived, not stored.
  const effectiveTripId = useMemo(
    () => (selectedTripId && vehicles.some((v) => v.tripId === selectedTripId) ? selectedTripId : null),
    [selectedTripId, vehicles]
  );

  // ── View-state setters (filters always reset pagination) ────────────────
  const setTabSearch = useCallback(
    (value: string) => {
      setSearch((prev) => ({ ...prev, [activeTab]: value }));
      setPageNumber((prev) => ({ ...prev, [activeTab]: 1 }));
    },
    [activeTab]
  );

  const setTabPage = useCallback(
    (value: number) => setPageNumber((prev) => ({ ...prev, [activeTab]: Math.max(1, value) })),
    [activeTab]
  );

  const setTabPageSize = useCallback(
    (value: number) => {
      setPageSize((prev) => ({ ...prev, [activeTab]: value }));
      setPageNumber((prev) => ({ ...prev, [activeTab]: 1 }));
    },
    [activeTab]
  );

  const handleDaySelect = useCallback((next: string) => {
    setDay(next);
    setPageNumber({ collection: 1, assignment: 1, tracking: 1 });
  }, []);

  const handleRangeChange = useCallback((from: string, toDay: string) => {
    setTrackingFrom(from);
    setTrackingTo(toDay);
    setPageNumber((prev) => ({ ...prev, tracking: 1 }));
  }, []);

  const handleSortChange = useCallback((next: string) => {
    setCollectionSort(next);
    setPageNumber((prev) => ({ ...prev, collection: 1 }));
  }, []);

  const handleFilledOnlyChange = useCallback((next: boolean) => {
    setFilledOnly(next);
    setPageNumber((prev) => ({ ...prev, collection: 1 }));
  }, []);

  const handleRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    // The refresh NEVER throws: it reports the real outcome instead.
    const ok = await fetchPage();
    if (ok) toastSuccess(to(`orders.refresh_${activeTab}`), 5000);
    else toastError(to("orders.refresh_failed"), 5000);
  }, [refreshing, fetchPage, toastSuccess, toastError, to, activeTab]);

  // ── Row actions on Delivery Tracking (existing trip services) ───────────
  const [viewing, setViewing] = useState<OrdersTrip | null>(null);
  const [pdfBusyTripId, setPdfBusyTripId] = useState<number | null>(null);
  const [whatsappBusyTripId, setWhatsappBusyTripId] = useState<number | null>(null);

  const openTrip = useCallback(
    async (tripId: number) => {
      if (!tripId) return;
      try {
        setViewing(await loadOrdersTrip(tripId, data.rows));
      } catch (e) {
        showNotification(e instanceof Error ? e.message : to("orders.load_failed"), "error");
      }
    },
    [data.rows, showNotification, to]
  );

  const handlePdf = useCallback(
    async (tripId: number) => {
      if (!tripId || pdfBusyTripId != null) return;
      setPdfBusyTripId(tripId);
      try {
        const ot = await loadOrdersTrip(tripId, data.rows);
        await generateOrdersPdf({
          trip: ot.trip,
          supervisorMobile: supervisorMobileOf(ot.trip, supervisorDirectory),
          progress: ot.progress,
          breakdown: buildShopBreakdown(
            rowsInSequence(ot.trip),
            ot.originalShopIds,
            (shopId, shopName) => cityOf(shopId, shopName, shopDirectory),
            ot.originalQuantities,
            (shopId) => shopMobileOf(shopId, shopDirectory)
          ),
          language,
        });
      } catch (e) {
        showNotification(e instanceof Error ? e.message : to("orders.pdf_failed"), "error");
      } finally {
        setPdfBusyTripId(null);
      }
    },
    [pdfBusyTripId, data.rows, supervisorDirectory, shopDirectory, language, showNotification, to]
  );

  const handleWhatsApp = useCallback(
    async (tripId: number) => {
      if (!tripId || whatsappBusyTripId != null) return;
      setWhatsappBusyTripId(tripId);
      try {
        const ot = await loadOrdersTrip(tripId, data.rows);
        const result = await sendOrdersWhatsApp(
          ot.trip,
          supervisorMobileOf(ot.trip, supervisorDirectory)
        );
        if (result.sent > 0 && result.failed === 0) {
          showNotification(
            to("orders.whatsapp_done", { sent: result.sent, total: result.sent }),
            "success"
          );
        } else if (result.sent > 0) {
          showNotification(
            to("orders.whatsapp_partial", { sent: result.sent, failed: result.failed }),
            "info"
          );
        } else if (result.message?.includes("not configured")) {
          showNotification(to("orders.whatsapp_not_configured"), "info");
        } else if (result.message === "no_rows") {
          showNotification(to("orders.whatsapp_no_rows"), "info");
        } else {
          showNotification(
            to("orders.whatsapp_failed", { message: result.message ?? "—" }),
            "error"
          );
        }
      } catch (e) {
        showNotification(
          e instanceof Error ? e.message : to("orders.whatsapp_failed", { message: "network" }),
          "error"
        );
      } finally {
        setWhatsappBusyTripId(null);
      }
    },
    [whatsappBusyTripId, data.rows, supervisorDirectory, showNotification, to]
  );

  const tabs = useMemo(
    () => [
      {
        key: "collection",
        label: to("orders.tab_collection"),
        icon: <ClipboardList size={14} />,
      },
      {
        key: "assignment",
        label: to("orders.tab_assignment"),
        icon: <PackageCheck size={14} />,
      },
      { key: "tracking", label: to("orders.tab_tracking"), icon: <Route size={14} /> },
    ],
    [to]
  );

  return (
    <div className="space-y-4">
      <OrdersTabHeader
        tabs={tabs}
        activeKey={activeTab}
        onSelect={(key) => setActiveTab(key as TabKey)}
        ariaLabel={to("orders.tabs_aria")}
      />

      {error ? (
        <OrdersErrorState
          title={to("orders.error_title")}
          message={error}
          onRetry={() => void fetchPage()}
          retryLabel={to("orders.retry")}
        />
      ) : activeTab === "collection" ? (
        <OrdersCollectionTab
          page={data}
          loading={loading}
          day={day}
          today={today}
          shopDirectory={shopDirectory}
          onDaySelect={handleDaySelect}
          search={search.collection}
          onSearchChange={setTabSearch}
          sort={collectionSort}
          onSortChange={handleSortChange}
          filledOnly={filledOnly}
          onFilledOnlyChange={handleFilledOnlyChange}
          pageSize={pageSize.collection}
          onPageChange={setTabPage}
          onPageSizeChange={setTabPageSize}
          onReload={() => fetchPage()}
          onRefresh={() => void handleRefresh()}
          refreshing={refreshing}
        />
      ) : activeTab === "assignment" ? (
        <OrdersAssignmentTab
          page={data}
          loading={loading}
          day={day}
          today={today}
          onDaySelect={handleDaySelect}
          vehicles={vehicles}
          selectedTripId={effectiveTripId}
          onSelectTrip={setSelectedTripId}
          search={search.assignment}
          onSearchChange={setTabSearch}
          pageSize={pageSize.assignment}
          onPageChange={setTabPage}
          onPageSizeChange={setTabPageSize}
          onReload={() => fetchPage()}
          onRefresh={() => void handleRefresh()}
          shopDirectory={shopDirectory}
          supervisorDirectory={supervisorDirectory}
          onFinished={() => setActiveTab("tracking")}
          refreshing={refreshing}
          dataReady={loadedKey !== null}
          syncing={refreshing || loadedKey !== queryKey}
        />
      ) : (
        <OrdersDeliveryTrackingTab
          page={data}
          loading={loading}
          fromDate={trackingFrom}
          toDate={trackingTo}
          today={today}
          onRangeChange={handleRangeChange}
          search={search.tracking}
          onSearchChange={setTabSearch}
          pageSize={pageSize.tracking}
          onPageChange={setTabPage}
          onPageSizeChange={setTabPageSize}
          onRefresh={() => void handleRefresh()}
          refreshing={refreshing}
          onView={(tripId) => void openTrip(tripId)}
          onPdf={(tripId) => void handlePdf(tripId)}
          onWhatsApp={(tripId) => void handleWhatsApp(tripId)}
          pdfBusyTripId={pdfBusyTripId}
          whatsappBusyTripId={whatsappBusyTripId}
        />
      )}

      {/* Delivery detail modal (one clean sheet; no duplicate page header) */}
      {viewing && (
        <OrdersDeliveryDetailView
          orderTrip={viewing}
          shopDirectory={shopDirectory}
          supervisorMobile={supervisorMobileOf(viewing.trip, supervisorDirectory)}
          pdfBusy={pdfBusyTripId === viewing.trip.id}
          whatsappBusy={whatsappBusyTripId === viewing.trip.id}
          onClose={() => setViewing(null)}
          onPdf={() => void handlePdf(viewing.trip.id)}
          onWhatsApp={() => void handleWhatsApp(viewing.trip.id)}
        />
      )}
    </div>
  );
};

export default OrdersPage;
