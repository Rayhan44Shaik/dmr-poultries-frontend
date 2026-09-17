// Orders — the host for the module's three pages, each of which is its own URL:
//   /operations/orders/collection        → pages/OrderCollectionPage
//   /operations/orders/assignment        → pages/OrderAssignmentPage
//   /operations/orders/delivery-tracking → pages/DeliveryTrackingPage
//
// There is deliberately NO in-page tab strip. A page is reached the same way as
// every other page in the app — from the sidebar (Operations → Orders) or by its
// own URL — so the URL, the sidebar highlight and what is on screen are always
// the same fact, and there is no second, redundant switcher to learn.
//
// This host still stays mounted across the three routes and keeps every page it
// has opened mounted underneath, so filters, pagination, the selected day and
// half-typed rows survive a sidebar move: the Collection → Assignment →
// Tracking handoff never loses work just because the URL changed.
// Legacy `?tab=orders&orderTab=x` links are canonicalised to the path form.
// Existing trip/Step 4 contracts remain the source of truth.

import "./OrdersPage.css";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ordersCanonicalUrl,
  ordersDay,
  ordersTabUrl,
  resolveOrdersTab,
} from "../utils/ordersNavigation";
import { ORDERS_PAGES } from "../routes/ordersRoutes";
import { DatabaseZap } from "lucide-react";
import { useI18n } from "../../../i18n";
import { useSafeNotification } from "../../../hooks/useSafeNotification";
import type { Trip } from "../../../shared/trip";
import { ORDERS_SAMPLE_DATA_ENABLED } from "../services/sampleOrdersData";
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
} from "../services/ordersService";
import { useToast } from "../../../components/common/ToastProvider";
import {
  buildShopBreakdown,
  localToday,
  rowsInSequence,
  type ShopDeliveryBreakdown,
} from "../utils/ordersUtils";
import { retryableImport } from "../../../routes/lazyWithRetry";
import type { OrdersFetch, OrdersTrip, OrdersTab } from "../types";
import { useOrdersI18n } from "../i18n/ordersI18n";
import { useOrdersShopSource } from "../hooks/useOrdersShopSource";
import OrderCollectionPage from "./OrderCollectionPage";
import {
  OrdersErrorState,
  OrdersTableSkeleton,
} from "../components/OrdersCommon";

const loadAssignmentPage = () => import("./OrderAssignmentPage");
const loadTrackingPage = () => import("./DeliveryTrackingPage");
const OrderAssignmentPage = React.lazy(retryableImport(loadAssignmentPage));
const DeliveryTrackingPage = React.lazy(retryableImport(loadTrackingPage));
const OrdersDeliveryDetailView = React.lazy(
  retryableImport(() => import("../components/OrdersDeliveryDetailView")),
);

// The module's three pages. `TabKey`/`activeTab` naming is kept for the panel
// ids (`orders-panel-<tab>`) that the pages, tests and deep links use.
type TabKey = OrdersTab;

// Warm one page's chunk — never every Orders/PDF chunk up front.
function preloadTab(tab: TabKey) {
  const loader =
    tab === "assignment"
      ? loadAssignmentPage
      : tab === "tracking"
        ? loadTrackingPage
        : null;
  if (loader)
    void loader().catch(() => {
      /* React.lazy handles retries on open. */
    });
}

/*
 * The flow is linear (collect → assign → track), so the page the user is
 * *probably* going to open next is warm during idle time. That keeps the
 * sidebar handoff instant without fetching a page nobody asked for — the strip's
 * hover-preload, minus the strip.
 */
const NEXT_PAGE: Record<OrdersTab, OrdersTab | null> = {
  collection: "assignment",
  assignment: "tracking",
  tracking: null,
};

/** Assignment's Suspense shell — mirrors the real page (filter card on top,
 *  titled table below) so the chunk load and the data load look identical:
 *  filters stay visible, only the record surface says it is loading. */
function AssignmentPageFallback() {
  const { to } = useOrdersI18n();
  return (
    <div className="space-y-5" aria-busy="true">
      <section className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm md:p-5">
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i}>
              <div className="mb-1.5 h-3 w-20 rounded bg-slate-100" />
              <div className="h-10 rounded-lg border border-slate-200 bg-slate-50" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-3.5 pt-1 lg:grid-cols-12">
          <div className="lg:col-span-3">
            <div className="mb-1.5 h-3 w-14 rounded bg-slate-100" />
            <div className="h-10 rounded-lg border border-slate-200 bg-slate-50" />
          </div>
          <div className="lg:col-span-5">
            <div className="mb-1.5 h-3 w-16 rounded bg-slate-100" />
            <div className="h-10 rounded-lg border border-slate-200 bg-slate-50" />
          </div>
        </div>
      </section>
      <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="flex items-center gap-3 border-b border-slate-100 bg-gradient-to-r from-emerald-50/60 via-white to-emerald-50/40 px-6 py-3">
          <span className="h-9 w-9 rounded-xl border border-emerald-100 bg-emerald-50" />
          <h2 className="text-base font-bold tracking-tight text-slate-800">
            {to("orders.tab_assignment")}
          </h2>
        </div>
        <div
          role="status"
          className="py-16 text-center text-sm font-medium text-slate-400"
        >
          <span className="inline-flex items-center gap-2">
            <span
              className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-emerald-600"
              aria-hidden="true"
            />
            {to("orders.loading_assignment")}
          </span>
        </div>
      </section>
    </div>
  );
}

function OrdersLoadingPanel({ tab }: { tab: TabKey }) {
  const { to } = useOrdersI18n();
  return (
    <div
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
      aria-busy="true"
    >
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-slate-50/60 px-5 py-2.5">
        <input
          disabled
          aria-label={to(`orders.search_${tab}`)}
          placeholder={to(`orders.search_${tab}`)}
          className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs sm:w-64"
        />
        <button
          type="button"
          disabled
          className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-400"
        >
          {to("orders.col_date")}
        </button>
        <button
          type="button"
          disabled
          className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-400"
        >
          {to("orders.sort")}
        </button>
      </div>
      <OrdersTableSkeleton rows={6} />
    </div>
  );
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
  const params = useMemo(
    () => new URLSearchParams(location.search),
    [location.search],
  );
  // Which page is open is decided by the URL path (see routes/ordersRoutes.ts).
  const activeTab = resolveOrdersTab(location.pathname, location.search);
  const activePath =
    ORDERS_PAGES.find((page) => page.tab === activeTab)?.path ??
    ORDERS_PAGES[0].path;
  // Switching pages is a route change (the sidebar does it), so the browser
  // back button, a reload and what is on screen always agree.
  const openPage = useCallback(
    (tab: TabKey) => {
      navigate(ordersTabUrl(location.search, tab));
    },
    [location.search, navigate],
  );
  // Normalise: legacy `?tab=orders&orderTab=x` (and a bare /operations/orders)
  // is replaced by the canonical page path, keeping the operational params.
  useEffect(() => {
    if (location.pathname === activePath) return;
    navigate(ordersCanonicalUrl(location.pathname, location.search), {
      replace: true,
    });
  }, [activePath, location.pathname, location.search, navigate]);
  useEffect(() => {
    const next = NEXT_PAGE[activeTab];
    if (!next) return;
    let idle = 0;
    const schedule = () => {
      preloadTab(next);
    };
    const w = window as Window & {
      requestIdleCallback?: (
        cb: IdleRequestCallback,
        opts?: IdleRequestOptions,
      ) => number;
    };
    if (typeof w.requestIdleCallback === "function")
      idle = w.requestIdleCallback(schedule, { timeout: 2000 });
    else idle = window.setTimeout(schedule, 1200) as unknown as number;
    return () => {
      const c = w.cancelIdleCallback;
      if (
        typeof w.requestIdleCallback === "function" &&
        typeof c === "function"
      )
        c.call(w, idle);
      else window.clearTimeout(idle);
    };
  }, [activeTab]);
  // Retain drafts and each page's independent filters/pages across a route move.
  const [visited, setVisited] = useState<TabKey[]>([activeTab]);
  if (!visited.includes(activeTab)) setVisited([...visited, activeTab]);
  const [viewingId, setViewingId] = useState<number | null>(null);
  const [pdfBusyId, setPdfBusyId] = useState<number | null>(null);
  const [whatsappBusyId, setWhatsappBusyId] = useState<number | null>(null);
  /** Which tab's table-level refresh is in flight (null = idle). */
  const [refreshing, setRefreshing] = useState<TabKey | null>(null);

  const shopDirectory = useMemo(() => buildShopDirectory(shops), [shops]);
  const [supervisorDirectory, setSupervisorDirectory] =
    useState<SupervisorDirectory>(new Map());

  // Independent collection/assignment days, today by default.
  const today = data?.today ?? "";
  const day = ordersDay(params.get("collectionDate"), today, data?.days ?? []);
  const assignmentDay = ordersDay(
    params.get("assignmentDate"),
    today,
    data?.days ?? [],
  );
  // Days live in the query of the CURRENT page's route, so a reload restores
  // exactly the page + day that was on screen.
  const selectDay = (key: string, value: string) => {
    const next = new URLSearchParams(location.search);
    next.set(key, value);
    navigate(
      { pathname: location.pathname, search: next.toString() },
      { replace: true },
    );
  };
  useEffect(() => {
    if (!data) return;
    const next = new URLSearchParams(location.search);
    let changed = false;
    for (const [key, value] of [
      ["collectionDate", day],
      ["assignmentDate", assignmentDay],
    ]) {
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
    void fetchOrdersData()
      .then(
        (next) => {
          if (cancelled) return;
          setData(next);
          setError(null);
        },
        (e: unknown) => {
          if (cancelled) return;
          setError(e instanceof Error ? e.message : "Failed to load orders");
        },
      )
      .finally(() => {
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
      if (
        typeof document !== "undefined" &&
        document.visibilityState === "hidden"
      )
        return;
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
    [supervisorDirectory],
  );

  // ── Tab 1 / Tab 2 completion flows ─────────────────────────────────────
  const handleCollectionSaved = useCallback(async () => {
    await load();
  }, [load]);

  const handleCollectionFinished = useCallback(async () => {
    await load();
    openPage("assignment");
  }, [load, openPage]);

  const handleAssignmentChanged = useCallback(async () => {
    await load();
  }, [load]);

  const handleAssignmentFinished = useCallback(async () => {
    await load();
    openPage("tracking");
  }, [load, openPage]);

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
    [toastSuccess, toastError, to],
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
            (shopId) => shopNumberOf(shopId, shopDirectory),
          ),
          language,
        });
      } catch (e) {
        showNotification(
          e instanceof Error ? e.message : to("orders.pdf_failed"),
          "error",
        );
      } finally {
        setPdfBusyId(null);
      }
    },
    [pdfBusyId, mobileOf, shopDirectory, language, to, showNotification],
  );

  const handleWhatsApp = useCallback(
    async (ot: OrdersTrip): Promise<OrdersWhatsAppResult | null> => {
      if (whatsappBusyId != null) return null;
      setWhatsappBusyId(ot.trip.id);
      try {
        const result = await sendOrdersWhatsApp(ot.trip, mobileOf(ot.trip));
        if (result.sent > 0 && result.failed === 0) {
          showNotification(
            to("orders.whatsapp_done", {
              sent: result.sent,
              total: result.sent,
            }),
            "success",
          );
        } else if (result.sent > 0) {
          showNotification(
            to("orders.whatsapp_partial", {
              sent: result.sent,
              failed: result.failed,
            }),
            "info",
          );
        } else if (result.message?.includes("not configured")) {
          showNotification(to("orders.whatsapp_not_configured"), "info");
        } else if (result.message === "no_rows") {
          showNotification(to("orders.whatsapp_no_rows"), "info");
        } else {
          showNotification(
            to("orders.whatsapp_failed", { message: result.message ?? "—" }),
            "error",
          );
        }
        return result;
      } catch (e) {
        showNotification(
          e instanceof Error
            ? e.message
            : to("orders.whatsapp_failed", { message: "network" }),
          "error",
        );
        return null;
      } finally {
        setWhatsappBusyId(null);
      }
    },
    [whatsappBusyId, mobileOf, to, showNotification],
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
          to("orders.delivery_saved_partial", {
            shop: shop.shopName || "—",
            boxes,
          }),
          "success",
        );
      } catch (e) {
        showNotification(
          e instanceof Error ? e.message : to("orders.refresh_failed"),
          "error",
        );
      }
    },
    [load, to, showNotification],
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
        const message =
          e instanceof Error ? e.message : to("orders.refresh_failed");
        showNotification(message, "error");
        return message;
      }
    },
    [load, to, showNotification],
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
        const message =
          e instanceof Error ? e.message : to("orders.refresh_failed");
        showNotification(message, "error");
        return message;
      }
    },
    [load, to, showNotification],
  );

  // ── Detail view (opened from Delivery Tracking) — a modal over that page ──
  const viewing: OrdersTrip | null =
    (viewingId != null &&
      data?.tracking.find((t) => t.trip.id === viewingId)) ||
    null;

  // Collection paints its filters before this lands (it only needs the Shop
  // Master for them), so the page renders through the load instead of being
  // replaced by a placeholder.
  const dataPending = loading || !data;
  const dayCollection =
    data && day ? (data.collectionsByDay[day] ?? null) : null;

  return (
    <div className="orders-workspace">
      {/* No tab strip — see the header note. The only thing that used to live
          here is the honest marker for a page running on bundled sample data. */}
      {ORDERS_SAMPLE_DATA_ENABLED && (
        <div className="flex justify-end px-1 pt-1">
          <span
            title={to("orders.sample_hint")}
            className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-700 md:text-[11px]"
          >
            <DatabaseZap size={12} />
            {to("orders.sample_badge")}
          </span>
        </div>
      )}
      <div className="orders-page-content">
        {error && data && (
          <OrdersErrorState
            title={to("orders.error_title")}
            message={error}
            onRetry={() => void load()}
            retryLabel={to("orders.retry")}
          />
        )}
        <React.Suspense fallback={<OrdersTableSkeleton rows={5} />}>
          {error && !data && !dataPending ? (
            <OrdersErrorState
              title={to("orders.error_title")}
              message={error}
              onRetry={() => void load()}
              retryLabel={to("orders.retry")}
            />
          ) : (
            <>
              {visited.includes("collection") && (
                <section
                  id="orders-panel-collection"
                  hidden={activeTab !== "collection"}
                  className={
                    activeTab === "collection"
                      ? "motion-safe:animate-page-pop"
                      : undefined
                  }
                >
                  <React.Suspense fallback={<OrdersTableSkeleton rows={5} />}>
                    <OrderCollectionPage
                      shops={shops}
                      shopsLoading={shopsLoading}
                      loading={dataPending}
                      shopDirectory={shopDirectory}
                      day={day}
                      today={today}
                      onDaySelect={(value) =>
                        selectDay("collectionDate", value)
                      }
                      collection={dayCollection}
                      nextTripNo={data?.nextTripNo ?? ""}
                      onSaved={() => void handleCollectionSaved()}
                      onFinished={() => void handleCollectionFinished()}
                      onRefresh={() => void handleRefresh("collection")}
                      refreshing={refreshing === "collection"}
                    />
                  </React.Suspense>
                </section>
              )}
              {visited.includes("assignment") && (
                <section
                  id="orders-panel-assignment"
                  hidden={activeTab !== "assignment"}
                  className={
                    activeTab === "assignment"
                      ? "motion-safe:animate-page-pop"
                      : undefined
                  }
                >
                  <React.Suspense fallback={<AssignmentPageFallback />}>
                    <OrderAssignmentPage
                      loading={dataPending}
                      day={assignmentDay || localToday()}
                      today={today || localToday()}
                      onDaySelect={(value) =>
                        selectDay("assignmentDate", value)
                      }
                      collection={data?.collectionsByDay[assignmentDay] ?? null}
                      eligibleVehicles={data?.eligibleVehicles ?? []}
                      dayVehicleViews={
                        data?.dayVehicleViews[assignmentDay] ?? []
                      }
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
                <section
                  id="orders-panel-tracking"
                  hidden={activeTab !== "tracking"}
                  className={
                    activeTab === "tracking"
                      ? "motion-safe:animate-page-pop"
                      : undefined
                  }
                >
                  <React.Suspense fallback={<OrdersTableSkeleton rows={5} />}>
                    <DeliveryTrackingPage
                      trips={data?.tracking ?? []}
                      loading={dataPending}
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
              {/* Assignment and Delivery Tracking read their whole shape from the
                Orders payload, so they keep the placeholder until it lands. */}
              {dataPending &&
              activeTab !== "collection" &&
              activeTab !== "assignment" ? (
                <OrdersLoadingPanel tab={activeTab} />
              ) : null}
            </>
          )}
        </React.Suspense>
      </div>

      {/* Delivery detail modal (one clean sheet; no duplicate page header) */}
      {viewing && (
        <React.Suspense
          fallback={
            <div
              role="status"
              aria-busy="true"
              className="fixed inset-0 z-50 grid place-items-center bg-slate-900/20"
            >
              <div className="rounded-xl bg-white p-4">
                <OrdersTableSkeleton rows={3} />
              </div>
            </div>
          }
        >
          <OrdersDeliveryDetailView
            orderTrip={viewing}
            shopDirectory={shopDirectory}
            supervisorMobile={mobileOf(viewing.trip)}
            pdfBusy={pdfBusyId === viewing.trip.id}
            whatsappBusy={whatsappBusyId === viewing.trip.id}
            onClose={() => setViewingId(null)}
            onWhatsApp={() => handleWhatsApp(viewing)}
            onRecordDelivery={(shop, boxes) =>
              handleRecordDelivery(viewing, shop, boxes)
            }
            onSaveProgress={() => handleSaveProgress(viewing)}
            onSubmitTrip={() => handleSubmitTrip(viewing)}
          />
        </React.Suspense>
      )}
    </div>
  );
};

export default OrdersPage;
