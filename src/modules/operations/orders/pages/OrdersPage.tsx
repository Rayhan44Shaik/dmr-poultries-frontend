// src/modules/operations/orders/pages/OrdersPage.tsx
// DMR POULTRIES — Orders (3-tab operational flow, day-based).
//
// Exactly three tabs, no search/filter panel, no KPI cards, and NO
// in-page header — the global header already renders the single
// "Operations / Orders" breadcrumb + title:
//
//   1. ORDER COLLECTION — day-based collection. One collection per
//      operational day, chosen with the SINGLE global date selector
//      (compact DatePicker — default TODAY, previous days allowed,
//      FUTURE DATES NEVER SELECTABLE). Today is editable (Save Progress /
//      Finish Collection); PAST AND FINISHED DAYS ARE READ-ONLY (locked).
//      The table collects the order: shop, village, birds (optional),
//      boxes (mandatory), weight and a compact status — assignment facts
//      (trip / vehicle / sequence) show as a tooltip, not as columns.
//   2. ORDER ASSIGNMENT — day-scoped, vehicle-first: select a vehicle →
//      select the day's available shops ONE BY ONE (compact checkbox
//      table) → sequence (↑/↓) → assigned boxes (1…ordered) → Save
//      Progress / Finish. The vehicle's box capacity is a HARD LIMIT
//      (exact figures, invalid values blocked). The same shop can NOT be
//      assigned to two vehicles on the same day (enforced from persisted
//      data; re-checked before every save). Past days read-only.
//   3. DELIVERY TRACKING — order-assigned trips with their ACTUAL
//      delivery progress (Step 4 records are the source of truth; Orders
//      never writes delivery data). Completed trips stay visible only for
//      the current 7-day operational window.
//
// Data is read through the existing /api/trips contract — the same
// vehicle-trip endpoint Step 1–5 uses, so Step 4 delivery records, PDF
// and WhatsApp work unchanged.

import React, { useCallback, useEffect, useRef, useState } from "react";
import { ClipboardList, PackageCheck, Route } from "lucide-react";
import { useI18n } from "../../../../i18n";
import { loadShops } from "../../../masters/shops/services/shopService";
import type { Shop } from "../../../masters/shops/types/shop";
import { useSearchParams } from "react-router-dom";
import { subscribeTripChanges } from "../../../../shared/trip/tripSync";
import { useSafeNotification } from "../../../../hooks/useSafeNotification";
import type { Trip } from "../../../../shared/trip";
import {
  fetchOrdersData,
  loadShopDirectory,
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
  type ShopDirectory,
  type SupervisorDirectory,
} from "../ordersService";
import { useToast } from "../../../../components/common/ToastProvider";
import { buildShopBreakdown, rowsInSequence, type ShopDeliveryBreakdown } from "../ordersUtils";
import { generateOrdersPdf } from "../pdf/generateOrdersPdf";
import type { OrdersFetch, OrdersTrip } from "../types";
import { useOrdersI18n } from "../i18n/ordersI18n";
import OrdersAssignmentTab from "../components/OrdersAssignmentTab";
import OrdersCollectionTab from "../components/OrdersCollectionTab";
import OrdersDeliveryTrackingTab from "../components/OrdersDeliveryTrackingTab";
import OrdersDeliveryDetailView from "../components/OrdersDeliveryDetailView";
import { OrdersDropdown, OrdersEmptyState, OrdersErrorState, OrdersTableSkeleton } from "../components/OrdersCommon";

type TabKey = "collection" | "assignment" | "tracking";

const TAB_DEFS: Array<{
  key: TabKey;
  labelKey: string;
  icon: React.ReactNode;
  idle: string;
  active: string;
  iconIdle: string;
  iconActive: string;
}> = [
  {
    key: "collection",
    labelKey: "orders.tab_collection",
    icon: <ClipboardList size={13} />,
    idle: "text-slate-500 hover:text-sky-700",
    active: "bg-sky-50 shadow-sm text-sky-800 border border-sky-200",
    iconIdle: "text-sky-500",
    iconActive: "text-sky-600",
  },
  {
    key: "assignment",
    labelKey: "orders.tab_assignment",
    icon: <PackageCheck size={13} />,
    idle: "text-slate-500 hover:text-emerald-700",
    active: "bg-emerald-50 shadow-sm text-emerald-800 border border-emerald-200",
    iconIdle: "text-emerald-500",
    iconActive: "text-emerald-600",
  },
  {
    key: "tracking",
    labelKey: "orders.tab_tracking",
    icon: <Route size={13} />,
    idle: "text-slate-500 hover:text-violet-700",
    active: "bg-violet-50 shadow-sm text-violet-800 border border-violet-200",
    iconIdle: "text-violet-500",
    iconActive: "text-violet-600",
  },
];

const OrdersPage: React.FC = () => {
  const { language } = useI18n();
  const { to } = useOrdersI18n();
  const { showNotification } = useSafeNotification();
  const [shops, setShops] = useState<Shop[]>([]);
  const shopsLoading = false;
  const shopsError = null;
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedTripId = Number(searchParams.get("tripId")) || null;
  const loadId = useRef(0);

  const [data, setData] = useState<OrdersFetch | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("collection");
  const [viewingId, setViewingId] = useState<number | null>(null);
  const [pdfBusyId, setPdfBusyId] = useState<number | null>(null);
  const [whatsappBusyId, setWhatsappBusyId] = useState<number | null>(null);
  /** Which tab's table-level refresh is in flight (null = idle). */
  const [refreshing, setRefreshing] = useState<TabKey | null>(null);

  const [shopDirectory, setShopDirectory] = useState<ShopDirectory>(new Map());
  const [supervisorDirectory, setSupervisorDirectory] = useState<SupervisorDirectory>(new Map());

  // ── Selected operational day (drives Tabs 1 + 2; today by default) ──────
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const today = data?.today ?? "";
  // Clamp: never future, always inside the 7-day window.
  const day = selectedDay && today && selectedDay <= today && data?.days.includes(selectedDay)
    ? selectedDay
    : today;

  const load = useCallback(async () => {
    const request = ++loadId.current;
    try {
      const [next,realShops,supDir] = await Promise.all([fetchOrdersData(),loadShops(),loadSupervisorDirectory()]);
      const shopDir=await loadShopDirectory(realShops);
      if (request !== loadId.current) return;
      setData(next); setShops(realShops); setShopDirectory(shopDir); setSupervisorDirectory(supDir); setError(null);
    } catch(e) {
      if (request === loadId.current) setError(e instanceof Error ? e.message : "Failed to load orders");
    } finally { if (request === loadId.current) setLoading(false); }
  }, []);
  useEffect(() => {
    void load();
    let scheduled = false;
    const refresh = () => {
      if (scheduled || document.visibilityState === 'hidden') return;
      scheduled = true;
      queueMicrotask(() => { scheduled = false; void load(); });
    };
    const unsubscribe=subscribeTripChanges(refresh);
    window.addEventListener('focus',refresh);
    document.addEventListener('visibilitychange',refresh);
    return () => { loadId.current++; unsubscribe(); window.removeEventListener('focus',refresh); document.removeEventListener('visibilitychange',refresh); };
  },[load]);

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
  }, [load]);

  const handleAssignmentChanged = useCallback(async () => {
    await load();
  }, [load]);

  const handleAssignmentFinished = useCallback(async () => {
    await load();
    setActiveTab("tracking");
  }, [load]);

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
      if (refreshing) return;
      setRefreshing(tab);
      try {
        const next = await fetchOrdersData();
        setData(next);
        setError(null);
        toastSuccess(to(`orders.refresh_${tab}`), 5000);
      } catch {
        toastError(to("orders.refresh_failed"), 5000);
      } finally {
        setRefreshing(null);
      }
    },
    [refreshing, toastSuccess, toastError, to]
  );

  // ── Row-level operations (PDF / WhatsApp) ──────────────────────────────
  const handlePdf = useCallback(
    async (snapshot: OrdersTrip) => {
      if (pdfBusyId != null) return;
      setPdfBusyId(snapshot.trip.id);
      try {
        const fresh=await fetchOrdersData();
        const ot=fresh.tracking.find(t=>t.trip.id===snapshot.trip.id);
        if (!ot) throw new Error("Trip is no longer available. Refresh Delivery Tracking.");
        setData(fresh);
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

  const selectedTrip = data?.trips.find(t => t.id === selectedTripId) ?? null;
  const tripDay = selectedTrip?.tripDate ?? day;
  const dayCollection = selectedTrip ? data?.collectionsByTripId[selectedTrip.id] ?? null : null;
  const selectTrip = (value: string) => {
    const id = Number(value);
    const found = data?.trips.find(t => t.id === id);
    if (found) setSelectedDay(found.tripDate);
    setSearchParams(previous => { const next=new URLSearchParams(previous); if (found) next.set('tripId',String(found.id)); else next.delete('tripId'); return next; });
  };

  return (
    <div className="space-y-4">
      {/* Tab switcher — clean labels only (no numeric counters). The ONE
          global date selector lives in the table-level controls of Tabs 1
          and 2; the selected day is preserved across tab switches. */}
      <div className="flex items-center gap-2 flex-wrap">
        {TAB_DEFS.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[11px] md:text-xs font-bold transition-colors ${
                active ? tab.active : tab.idle
              }`}
            >
              <span className={active ? tab.iconActive : tab.iconIdle}>{tab.icon}</span>
              {to(tab.labelKey)}
            </button>
          );
        })}


      </div>

      {data && activeTab !== "tracking" && (
        <div className="flex items-center gap-3 flex-wrap">
          <OrdersDropdown ariaLabel="Orders trip" value={selectedTripId ? String(selectedTripId) : ""}
            onChange={selectTrip} widthClass="w-80" options={[
              {value:"",label:"Select Trip Entry trip"},
              ...data.trips.map(trip=>({value:String(trip.id),label:`${trip.tripNo} · ${trip.vehicleNo} · ${trip.tripDate}`}))
            ]} />
        </div>
      )}
      {(error || shopsError) && data && <OrdersErrorState title={to("orders.error_title")} message={error || shopsError || ""}
        onRetry={()=>{void load();}} retryLabel={to("orders.retry")} />}
      {loading ? (
        <OrdersTableSkeleton rows={5} />
      ) : (error || shopsError) && !data ? (
        <OrdersErrorState
          title={to("orders.error_title")}
          message={error || shopsError || ""}
          onRetry={() => void load()}
          retryLabel={to("orders.retry")}
        />
      ) : data ? (
        <>
          {activeTab !== "tracking" && !selectedTrip && <OrdersEmptyState
            title={data.trips.length ? "Select a Trip Entry trip" : "No trips available"}
            hint="Create or open the real trip in Trip Entry, then select its trip number above." />}
          {activeTab === "collection" && selectedTrip && (
            <OrdersCollectionTab
              key={`collection|${selectedTrip.id}`}
              shops={shops}
              shopsLoading={shopsLoading}
              shopDirectory={shopDirectory}
              day={tripDay}
              today={today}
              onDaySelect={(value)=>{setSelectedDay(value); if(value!==tripDay) selectTrip("");}}
              collection={dayCollection}
              onSaved={handleCollectionSaved}
              onFinished={handleCollectionFinished}
              onRefresh={() => void handleRefresh("collection")}
              refreshing={refreshing === "collection"}
            />
          )}
          {activeTab === "assignment" && selectedTrip && (
            <OrdersAssignmentTab
              key={`assignment|${selectedTrip.id}`}
              loading={false}
              day={tripDay}
              today={today}
              onDaySelect={() => {}}
              collection={dayCollection?.rows.length ? dayCollection : null}
              eligibleVehicles={data.eligibleVehicles.filter(v=>v.trip.id===selectedTrip.id)}
              dayVehicleViews={(data.dayVehicleViews[tripDay] ?? []).filter(v=>v.trip.id===selectedTrip.id)}
              shopDirectory={shopDirectory}
              supervisorDirectory={supervisorDirectory}
              onChanged={handleAssignmentChanged}
              onFinished={handleAssignmentFinished}
              onRefresh={() => void handleRefresh("assignment")}
              refreshing={refreshing === "assignment"}
            />
          )}
          {activeTab === "tracking" && (
            <OrdersDeliveryTrackingTab
              trips={data.tracking}
              loading={false}
              today={today}
              shopDirectory={shopDirectory}
              supervisorDirectory={supervisorDirectory}
              pdfBusyId={pdfBusyId}
              onPdf={(ot) => void handlePdf(ot)}
              onView={(ot) => { void load().then(()=>setViewingId(ot.trip.id)); }}
              onRefresh={() => void handleRefresh("tracking")}
              refreshing={refreshing === "tracking"}
            />
          )}
        </>
      ) : null}

      {/* Delivery detail modal (one clean sheet; no duplicate page header) */}
      {viewing && (
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
      )}
    </div>
  );
}

export default OrdersPage;
