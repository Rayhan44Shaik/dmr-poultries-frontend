// Orders — three independently addressable, state-preserving table pages.
// ?tab=orders&orderTab=collection|assignment|tracking
// Collection and Assignment have separate, validated operational-day URLs.
// Visited tabs stay mounted to preserve local filters, pagination and drafts;
// refresh replaces server data and shows a loader only in the requesting table.
// Existing trip/Step 4 contracts remain the source of truth.

import "./OrdersPage.css";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ordersDay, ordersTabUrl, resolveOrdersTab } from "../ordersNavigation";
import { ClipboardList, DatabaseZap, PackageCheck, Route } from "lucide-react";
import { useI18n } from "../../../../i18n";
import { useShops } from "../../../masters/shops/hooks/useShops";
import type { Shop } from "../../../masters/shops/types/shop";
import { useSafeNotification } from "../../../../hooks/useSafeNotification";
import type { Trip } from "../../../../shared/trip";
import {
  ORDERS_SAMPLE_DATA_ENABLED,
  sampleShopRecords,
} from "../sampleOrdersData";
import {
  fetchOrdersData,
  buildShopDirectory,
  loadSupervisorDirectory,
  recordShopDelivery,
  saveShopDeliveries,
  submitShopDeliveries,
  sendOrdersWhatsApp,
  shopMobileOf,
  shopNumberOf,
  supervisorMobileOf,
  villageOf,
  type OrdersWhatsAppResult,
  type SupervisorDirectory,
} from "../ordersService";
import { useToast } from "../../../../components/common/ToastProvider";
import { buildShopBreakdown, rowsInSequence, type ShopDeliveryBreakdown } from "../ordersUtils";
import { retryableImport } from "../../../../routes/lazyWithRetry";
import type { OrdersFetch, OrdersTrip } from "../types";
import { useOrdersI18n } from "../i18n/ordersI18n";
import OrdersCollectionTab from "../components/OrdersCollectionTab";
import { OrdersErrorState, OrdersTableSkeleton } from "../components/OrdersCommon";

const loadAssignmentTab = () => import("../components/OrdersAssignmentTab");
const loadTrackingTab = () => import("../components/OrdersDeliveryTrackingTab");
const OrdersAssignmentTab = React.lazy(retryableImport(loadAssignmentTab));
const OrdersDeliveryTrackingTab = React.lazy(retryableImport(loadTrackingTab));
const OrdersDeliveryDetailView = React.lazy(retryableImport(() => import("../components/OrdersDeliveryDetailView")));

type TabKey = "collection" | "assignment" | "tracking";

// Warm only the tab the user intends to open, not every Orders/PDF chunk.
function preloadTab(tab: TabKey) {
  const loader = tab === "assignment" ? loadAssignmentTab : tab === "tracking" ? loadTrackingTab : null;
  if (loader) void loader().catch(() => { /* React.lazy handles retries on open. */ });
}

const TAB_DEFS: Array<{
  key: TabKey;
  labelKey: string;
  icon: React.ReactNode;
  iconIdle: string;
  iconActive: string;
}> = [
  {
    key: "collection",
    labelKey: "orders.tab_collection",
    icon: <ClipboardList size={13} />,
    iconIdle: "text-sky-500",
    iconActive: "text-sky-600",
  },
  {
    key: "assignment",
    labelKey: "orders.tab_assignment",
    icon: <PackageCheck size={13} />,
    iconIdle: "text-emerald-500",
    iconActive: "text-emerald-600",
  },
  {
    key: "tracking",
    labelKey: "orders.tab_tracking",
    icon: <Route size={13} />,
    iconIdle: "text-violet-500",
    iconActive: "text-violet-600",
  },
];

/** Sample mode never touches the network — the shop list is the bundled master. */
function useSampleShops(): { shops: Shop[]; loading: boolean } {
  return { shops: sampleShopRecords(), loading: false };
}

// The flag is a module constant, so exactly one of these two hooks is ever
// mounted for the life of the app — the hook order stays stable.
const useOrdersShopSource = ORDERS_SAMPLE_DATA_ENABLED ? useSampleShops : useShops;

function OrdersLoadingPanel({ tab }: { tab: TabKey }) {
  const { to } = useOrdersI18n();
  return <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white" aria-busy="true">
    <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-slate-50/60 px-5 py-2.5">
      <input disabled aria-label={to(`orders.search_${tab}`)} placeholder={to(`orders.search_${tab}`)} className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs sm:w-64" />
      <button type="button" disabled className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-400">{to("orders.col_date")}</button>
      <button type="button" disabled className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-400">{to("orders.sort")}</button>
    </div>
    <OrdersTableSkeleton rows={6} />
  </div>;
}

const OrdersPage: React.FC = () => {
  const { language } = useI18n();
  const { to } = useOrdersI18n();
  const { showNotification } = useSafeNotification();
  const { shops, loading: shopsLoading } = useOrdersShopSource();

  const [data, setData] = useState<OrdersFetch | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const activeTab = resolveOrdersTab(params.get("orderTab"));
  const setActiveTab = useCallback((tab: TabKey) => {
    navigate(ordersTabUrl(location.search, tab));
  }, [location.search, navigate]);
  useEffect(() => {
    if (params.get("orderTab") !== activeTab || location.pathname !== "/operations") {
      navigate(ordersTabUrl(location.search, activeTab), { replace: true });
    }
  }, [activeTab, location.pathname, location.search, navigate, params]);
  useEffect(() => {
    document.getElementById(`orders-tab-${activeTab}`)?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeTab]);
  // Retain drafts and each tab's independent filters/pages when switching.
  const [visited, setVisited] = useState<TabKey[]>([activeTab]);
  if (!visited.includes(activeTab)) setVisited([...visited, activeTab]);
  const [viewingId, setViewingId] = useState<number | null>(null);
  const [pdfBusyId, setPdfBusyId] = useState<number | null>(null);
  const [whatsappBusyId, setWhatsappBusyId] = useState<number | null>(null);
  /** Which tab's table-level refresh is in flight (null = idle). */
  const [refreshing, setRefreshing] = useState<TabKey | null>(null);

  const shopDirectory = useMemo(() => buildShopDirectory(shops), [shops]);
  const [supervisorDirectory, setSupervisorDirectory] = useState<SupervisorDirectory>(new Map());

  // Independent collection/assignment days, today by default.
  const today = data?.today ?? "";
  const day = ordersDay(params.get("collectionDate"), today, data?.days ?? []);
  const assignmentDay = ordersDay(params.get("assignmentDate"), today, data?.days ?? []);
  const selectDay = (key: string, value: string) => {
    const next = new URLSearchParams(location.search);
    next.set(key, value);
    navigate({ pathname: '/operations', search: next.toString() }, { replace: true });
  };
  useEffect(() => {
    if (!data) return;
    const next = new URLSearchParams(location.search);
    let changed = false;
    for (const [key, value] of [["collectionDate", day], ["assignmentDate", assignmentDay]]) {
      if (next.has(key) && next.get(key) !== value) {
        next.set(key, value);
        changed = true;
      }
    }
    if (changed) navigate({ search: next.toString() }, { replace: true });
  }, [data, day, assignmentDay, location.search, navigate]);
  const refreshLock = useRef(false);

  const load = useCallback(async () => {
    try {
      const next = await fetchOrdersData();
      setData(next);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load orders");
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load. The retry button and post-mutation refreshes use `load`;
  // the first fetch is inlined here so the effect only sets state from
  // async callbacks (no synchronous setState in the effect body).
  useEffect(() => {
    let cancelled = false;
    void fetchOrdersData().then(
      (next) => {
        if (cancelled) return;
        setData(next);
        setError(null);
      },
      (e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to load orders");
      }
    ).finally(() => {
      if (!cancelled) setLoading(false);
    });
    void (async () => {
      try {
        const supDir = await loadSupervisorDirectory();
        if (!cancelled) {
          setSupervisorDirectory(supDir);
        }
      } catch {
        // Non-fatal: village / supervisor-mobile columns fall back to "—".
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Light frontend revalidation while Delivery Tracking is open: refetch on
  // window focus / tab visibility. No polling, no extra backend contract.
  useEffect(() => {
    if (activeTab !== "tracking") return;
    let inFlight = false;
    let cancelled = false;
    const refresh = () => {
      if (inFlight) return;
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      inFlight = true;
      void fetchOrdersData()
        .then((next) => {
          if (cancelled) return;
          setData(next);
          setError(null);
        })
        .catch(() => {
          /* keep the last good snapshot — this is a silent revalidate */
        })
        .finally(() => {
          inFlight = false;
        });
    };
    const onVis = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [activeTab]);

  const mobileOf = useCallback(
    (trip: Trip) => supervisorMobileOf(trip, supervisorDirectory),
    [supervisorDirectory]
  );

  // ── Tab 1 / Tab 2 completion flows ─────────────────────────────────────
  const handleCollectionSaved = useCallback(async () => {
    await load();
  }, [load]);

  const handleCollectionFinished = useCallback(async () => {
    await load();
    setActiveTab("assignment");
  }, [load, setActiveTab]);

  const handleAssignmentChanged = useCallback(async () => {
    await load();
  }, [load]);

  const handleAssignmentFinished = useCallback(async () => {
    await load();
    setActiveTab("tracking");
  }, [load, setActiveTab]);

  // ── Table-level Refresh (all three tabs) ─────────────────────────────────
  // Refetches only the Orders data for the current tab: no app reload, no
  // unrelated modules, no main skeleton swap (the visible table stays), and
  // the selected day / tab / search text / sort / filters are preserved
  // (only `data` is replaced — the tab components keep their local state).
  // Confirmed with the EXISTING global compact toast (auto-dismiss ~5s,
  // non-blocking — never a modal, never covering the table); a guard
  // blocks duplicate calls while a refresh is in flight.
  const { success: toastSuccess, error: toastError } = useToast();
  const handleRefresh = useCallback(
    async (tab: TabKey) => {
      if (refreshLock.current) return;
      refreshLock.current = true;
      setRefreshing(tab);
      try {
        const next = await fetchOrdersData();
        setData(next);
        setError(null);
        toastSuccess(to(`orders.refresh_${tab}`), 5000);
      } catch {
        toastError(to("orders.refresh_failed"), 5000);
      } finally {
        refreshLock.current = false;
        setRefreshing(null);
      }
    },
    [toastSuccess, toastError, to]
  );

  // ── Row-level operations (PDF / WhatsApp) ──────────────────────────────
  const handlePdf = useCallback(
    async (ot: OrdersTrip) => {
      if (pdfBusyId != null) return;
      setPdfBusyId(ot.trip.id);
      try {
        const { generateOrdersPdf } = await import("../pdf/generateOrdersPdf");
        await generateOrdersPdf({
          trip: ot.trip,
          supervisorMobile: mobileOf(ot.trip),
          progress: ot.progress,
          breakdown: buildShopBreakdown(
            rowsInSequence(ot.trip),
            ot.originalShopIds,
            (shopId, shopName) => villageOf(shopId, shopName, shopDirectory),
            ot.originalQuantities,
            (shopId) => shopMobileOf(shopId, shopDirectory),
            (shopId) => shopNumberOf(shopId, shopDirectory)
          ),
          language,
        });
      } catch (e) {
        showNotification(e instanceof Error ? e.message : to("orders.pdf_failed"), "error");
      } finally {
        setPdfBusyId(null);
      }
    },
    [pdfBusyId, mobileOf, shopDirectory, language, to, showNotification]
  );

  const handleWhatsApp = useCallback(
    async (ot: OrdersTrip): Promise<OrdersWhatsAppResult | null> => {
      if (whatsappBusyId != null) return null;
      setWhatsappBusyId(ot.trip.id);
      try {
        const result = await sendOrdersWhatsApp(ot.trip, mobileOf(ot.trip));
        if (result.sent > 0 && result.failed === 0) {
          showNotification(to("orders.whatsapp_done", { sent: result.sent, total: result.sent }), "success");
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
          showNotification(to("orders.whatsapp_failed", { message: result.message ?? "—" }), "error");
        }
        return result;
      } catch (e) {
        showNotification(
          e instanceof Error ? e.message : to("orders.whatsapp_failed", { message: "network" }),
          "error"
        );
        return null;
      } finally {
        setWhatsappBusyId(null);
      }
    },
    [whatsappBusyId, mobileOf, to, showNotification]
  );

  // ── Shop-level delivery capture (Tab 3 detail) ─────────────────────────
  // Partial by design: only the entered boxes are written as a Step 4
  // record, so the shop stays "Part Delivered" until the rest is in. The
  // view caps the entry at the shop's remaining boxes — that is also the
  // duplicate guard (nothing left to capture once the order is complete).
  const handleRecordDelivery = useCallback(
    async (ot: OrdersTrip, shop: ShopDeliveryBreakdown, boxes: number) => {
      try {
        // Refetch before write so a stale modal snapshot cannot duplicate a capture.
        const fresh = await fetchOrdersData();
        const current = fresh.tracking.find((t) => t.trip.id === ot.trip.id);
        if (!current) {
          showNotification(to("orders.refresh_failed"), "error");
          return;
        }
        setData(fresh);
        await recordShopDelivery(current.trip, { shopId: shop.shopId, boxes });
        await load();
        showNotification(
          to("orders.delivery_saved_partial", { shop: shop.shopName || "—", boxes }),
          "success"
        );
      } catch (e) {
        showNotification(
          e instanceof Error ? e.message : to("orders.refresh_failed"),
          "error"
        );
      }
    },
    [load, to, showNotification]
  );

  // ── Check-popup actions: bank the entries, then submit the trip ─────────
  const handleSaveProgress = useCallback(
    async (ot: OrdersTrip): Promise<string | null> => {
      try {
        const fresh = await fetchOrdersData();
        const current = fresh.tracking.find((t) => t.trip.id === ot.trip.id);
        if (!current) {
          showNotification(to("orders.refresh_failed"), "error");
          return to("orders.refresh_failed");
        }
        setData(fresh);
        await saveShopDeliveries(current.trip);
        await load();
        showNotification(to("orders.pdf_saved_ok"), "success");
        return null;
      } catch (e) {
        const message = e instanceof Error ? e.message : to("orders.refresh_failed");
        showNotification(message, "error");
        return message;
      }
    },
    [load, to, showNotification]
  );

  const handleSubmitTrip = useCallback(
    async (ot: OrdersTrip): Promise<string | null> => {
      try {
        const fresh = await fetchOrdersData();
        const current = fresh.tracking.find((t) => t.trip.id === ot.trip.id);
        if (!current) {
          showNotification(to("orders.refresh_failed"), "error");
          return to("orders.refresh_failed");
        }
        setData(fresh);
        await submitShopDeliveries(current.trip);
        await load();
        showNotification(to("orders.pdf_submitted_ok"), "success");
        return null;
      } catch (e) {
        const message = e instanceof Error ? e.message : to("orders.refresh_failed");
        showNotification(message, "error");
        return message;
      }
    },
    [load, to, showNotification]
  );

  // ── Detail view (opened from Tab 3) — rendered as a modal over the tab ─
  const viewing: OrdersTrip | null =
    (viewingId != null && data?.tracking.find((t) => t.trip.id === viewingId)) || null;

  const dayCollection = data && day ? data.collectionsByDay[day] ?? null : null;

  return (
    <div className="orders-workspace">
      {/* Tabs are URL-backed; filters and drafts remain isolated per panel. */}
      <div className="orders-tab-rail">
      <div role="tablist" aria-label={to("orders.tabs_label")} className="orders-browser-tabs">
        {TAB_DEFS.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              id={`orders-tab-${tab.key}`}
              role="tab"
              aria-selected={active}
              aria-controls={`orders-panel-${tab.key}`}
              tabIndex={active ? 0 : -1}
              onKeyDown={(event) => {
                const index = TAB_DEFS.findIndex(item => item.key === tab.key);
                const next = event.key === "ArrowRight" ? (index + 1) % TAB_DEFS.length
                  : event.key === "ArrowLeft" ? (index + TAB_DEFS.length - 1) % TAB_DEFS.length
                  : event.key === "Home" ? 0 : event.key === "End" ? TAB_DEFS.length - 1 : -1;
                if (next < 0) return;
                event.preventDefault();
                const key = TAB_DEFS[next].key;
                setActiveTab(key);
                document.getElementById(`orders-tab-${key}`)?.focus();
              }}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              onPointerEnter={() => preloadTab(tab.key)}
              onFocus={() => preloadTab(tab.key)}
              className="orders-browser-tab"
            >
              <span className={`orders-browser-tab-icon ${active ? tab.iconActive : tab.iconIdle}`}>{tab.icon}</span>
              <span className="orders-browser-tab-label">{to(tab.labelKey)}</span>
            </button>
          );
        })}

        {/* Honest marker while the page runs on bundled sample data (no
            backend). Save / Finish actions work against the in-memory store. */}
        {ORDERS_SAMPLE_DATA_ENABLED && (
          <span
            title={to("orders.sample_hint")}
            className="ml-auto inline-flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-2.5 py-2 text-[10px] md:text-[11px] font-bold text-amber-700"
          >
            <DatabaseZap size={12} />
            {to("orders.sample_badge")}
          </span>
        )}
      </div>

      </div>
      <div className="orders-page-content">
      {error && data && <OrdersErrorState title={to("orders.error_title")} message={error} onRetry={() => void load()} retryLabel={to("orders.retry")} />}
      <React.Suspense fallback={<OrdersTableSkeleton rows={5} />}>
        {loading ? (
          <OrdersLoadingPanel tab={activeTab} />
        ) : error && !data ? (
          <OrdersErrorState
            title={to("orders.error_title")}
            message={error}
            onRetry={() => void load()}
            retryLabel={to("orders.retry")}
          />
        ) : data ? (
          <>
            {visited.includes("collection") && (
              <section id="orders-panel-collection" role="tabpanel" aria-labelledby="orders-tab-collection" hidden={activeTab !== "collection"} className={activeTab === "collection" ? "motion-safe:animate-page-pop" : undefined}>
                <React.Suspense fallback={<OrdersTableSkeleton rows={5} />}>
                <OrdersCollectionTab
                  shops={shops}
                  shopsLoading={shopsLoading}
                  shopDirectory={shopDirectory}
                  day={day}
                  today={today}
                  onDaySelect={(value) => selectDay("collectionDate", value)}
                  collection={dayCollection}
                  nextTripNo={data.nextTripNo}
                  onSaved={() => void handleCollectionSaved()}
                  onFinished={() => void handleCollectionFinished()}
                  onRefresh={() => void handleRefresh("collection")}
                  refreshing={refreshing === "collection"}
                />
                </React.Suspense>
              </section>
            )}
            {visited.includes("assignment") && (
              <section id="orders-panel-assignment" role="tabpanel" aria-labelledby="orders-tab-assignment" hidden={activeTab !== "assignment"} className={activeTab === "assignment" ? "motion-safe:animate-page-pop" : undefined}>
                <React.Suspense fallback={<OrdersTableSkeleton rows={5} />}>
                <OrdersAssignmentTab
                  loading={false}
                  day={assignmentDay}
                  today={today}
                  onDaySelect={(value) => selectDay("assignmentDate", value)}
                  collection={data.collectionsByDay[assignmentDay] ?? null}
                  eligibleVehicles={data.eligibleVehicles}
                  dayVehicleViews={data.dayVehicleViews[assignmentDay] ?? []}
                  shopDirectory={shopDirectory}
                  supervisorDirectory={supervisorDirectory}
                  onChanged={() => void handleAssignmentChanged()}
                  onFinished={() => void handleAssignmentFinished()}
                  onRefresh={() => void handleRefresh("assignment")}
                  refreshing={refreshing === "assignment"}
                />
                </React.Suspense>
              </section>
            )}
            {visited.includes("tracking") && (
              <section id="orders-panel-tracking" role="tabpanel" aria-labelledby="orders-tab-tracking" hidden={activeTab !== "tracking"} className={activeTab === "tracking" ? "motion-safe:animate-page-pop" : undefined}>
                <React.Suspense fallback={<OrdersTableSkeleton rows={5} />}>
                <OrdersDeliveryTrackingTab
                  trips={data.tracking}
                  loading={false}
                  today={today}
                  shopDirectory={shopDirectory}
                  supervisorDirectory={supervisorDirectory}
                  pdfBusyId={pdfBusyId}
                  onPdf={(ot) => void handlePdf(ot)}
                  onView={(ot) => setViewingId(ot.trip.id)}
                  onRefresh={() => void handleRefresh("tracking")}
                  refreshing={refreshing === "tracking"}
                />
                </React.Suspense>
              </section>
            )}
          </>
        ) : null}
      </React.Suspense>

      </div>

      {/* Delivery detail modal (one clean sheet; no duplicate page header) */}
      {viewing && (
        <React.Suspense fallback={
          <div role="status" aria-busy="true" className="fixed inset-0 z-50 grid place-items-center bg-slate-900/20">
            <div className="rounded-xl bg-white p-4"><OrdersTableSkeleton rows={3} /></div>
          </div>
        }>
        <OrdersDeliveryDetailView
          orderTrip={viewing}
          shopDirectory={shopDirectory}
          supervisorMobile={mobileOf(viewing.trip)}
          pdfBusy={pdfBusyId === viewing.trip.id}
          whatsappBusy={whatsappBusyId === viewing.trip.id}
          onClose={() => setViewingId(null)}
          onWhatsApp={() => handleWhatsApp(viewing)}
          onRecordDelivery={(shop, boxes) => handleRecordDelivery(viewing, shop, boxes)}
          onSaveProgress={() => handleSaveProgress(viewing)}
          onSubmitTrip={() => handleSubmitTrip(viewing)}
        />
        </React.Suspense>
      )}
    </div>
  );
}

export default OrdersPage;
