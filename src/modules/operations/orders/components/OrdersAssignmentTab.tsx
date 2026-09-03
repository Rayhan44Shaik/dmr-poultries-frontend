// src/modules/operations/orders/components/OrdersAssignmentTab.tsx
// TAB 2 — ORDER ASSIGNMENT.
//
// ONE workspace, not a stack of panels. The card below the key figures holds
// the day/search toolbar, then EVERY OPEN vehicle trip — Step 2 done and
// Step 4 not yet submitted — whatever day it was raised on, because a day's
// orders may legitimately be loaded onto a truck from another day. Each row
// carries vehicle no, trip no and date, supervisor and supervisor mobile from
// the masters, beside that truck's live load. Expanding a row opens the shop
// assignment for THAT truck inline, right under it, with its own Save /
// Finish actions. There is no separate vehicle picker and no separate details
// panel: the row you expand IS the trip you are assigning to.
//
// Everything the tables show — required / pickup / pending / delivered boxes,
// the trip and vehicle, the status and every LOCK — is served by the backend
// Orders module, so Step 2, Step 4 and Delivery Tracking can never disagree
// with it.
//
//   · Save Progress / Finish Assignment → POST /api/orders/assignments
//     (`finish: true` makes the BACKEND send the supervisor email +
//      WhatsApp after the transaction commits, and returns the real
//      per-channel outcome — no window.open, no setTimeout, no fake toast)
//   · Remove a pending shop             → 10-second undo, then
//                                         DELETE /api/orders/assignments/:id
//   · A fully delivered shop is LOCKED; a partially delivered shop may only
//     be changed between its delivered quantity and the order quantity.
//     Both limits are re-validated by the backend on every write.
//
// Unsaved edits are kept PER TRIP, so collapsing a row — or opening another
// truck to compare — never throws away what was typed. Only changing the day
// clears them, because the orders themselves change underneath.

import { Fragment, useCallback, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ListChecks,
  Loader2,
  Lock,
  RefreshCw,
  Save,
  Send,
  Trash2,
  Truck,
} from "lucide-react";
import {
  opsPrimaryButtonClass,
  opsSecondaryButtonClass,
  opsTableDivideClass,
  opsTableHeadRowClass,
  opsTableTdClass,
  opsTableThClass,
  opsTableRowClass,
} from "../../../../shared/ui/operationsStyles";
import { useToast } from "../../../../components/common/ToastProvider";
import { usePendingDelete } from "../../../../hooks/usePendingDelete";
import { PendingDeleteNotification } from "../../../../components/common/PendingDeleteNotification";
import { formatDayFull } from "../ordersUtils";
import {
  supervisorMobileByName,
  type ShopDirectory,
  type SupervisorDirectory,
} from "../ordersService";
import {
  deleteOrderAssignment,
  saveOrderAssignment,
  type EligibleVehicle,
  type OrderNotificationOutcome,
  type OrderView,
  type OrdersPage,
} from "../services/ordersApi";
import { useOrdersI18n } from "../i18n/ordersI18n";
import {
  OrdersDateControl,
  OrdersEmptyState,
  OrdersIconButton,
  OrdersPagination,
  OrdersSearchInput,
  OrdersStatusBadge,
  OrdersTableSkeleton,
} from "./OrdersCommon";
import OrdersAssignmentKpis from "./OrdersAssignmentKpis";
import { fillPercent, TONE_BAR, TONE_ICON } from "./ordersUiConstants";
import OrdersLoadedShopsDialog from "./OrdersLoadedShopsDialog";

/**
 * One unsaved edit. `basePickupBoxes` is the SERVER value at the moment the
 * row was first touched, so the projected totals and the save payload stay
 * correct even after the user pages away from the edited row — the draft is
 * keyed by order id, never by the visible page.
 */
type DraftEntry = {
  pickupBoxes: number;
  sequence: number;
  basePickupBoxes: number;
  /** Optimistic-concurrency token captured with the first edit. */
  version?: number;
};

type Draft = ReadonlyMap<number, DraftEntry>;
/** Unsaved edits per trip — collapsing a row must not discard them. */
type DraftsByTrip = ReadonlyMap<number, Draft>;

/** Shared empties: setting an already-empty value is an identity no-op, so
 *  clearing twice cannot cause a second render. */
const EMPTY_DRAFT: Draft = new Map<number, DraftEntry>();
const EMPTY_DRAFTS: DraftsByTrip = new Map<number, Draft>();

/** Columns in the vehicle table, for the expanded row's colSpan. */
const VEHICLE_COLUMNS = 8;

/** Stable empty notification list (identity no-op when already empty). */
const NO_NOTIFICATIONS: OrderNotificationOutcome[] = [];

// The vehicle table is a compact record list, not a data grid: the shared ops
// cell padding runs it past the card and clips the action column.
const vehicleThClass =
  "px-2.5 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap";
const vehicleTdClass = "px-2.5 py-2.5 text-sm text-slate-700 whitespace-nowrap";

type Props = {
  page: OrdersPage;
  loading: boolean;
  day: string;
  today: string;
  onDaySelect: (day: string) => void;
  /** EVERY open trip (Step 4 not submitted), newest trip date first. */
  vehicles: EligibleVehicle[];
  /** The expanded trip: expanding a row IS selecting it for assignment. */
  selectedTripId: number | null;
  onSelectTrip: (tripId: number | null) => void;
  search: string;
  onSearchChange: (value: string) => void;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onReload: () => Promise<unknown> | void;
  /** Table-level Refresh (same fetch + a confirmation toast). */
  onRefresh: () => void;
  /** Shop Master reference data (owner / city / mobile decorations). */
  shopDirectory: ShopDirectory;
  /** Employee Master supervisor mobiles, keyed by lower-case name. */
  supervisorDirectory: SupervisorDirectory;
  /** Assignment finished — the page moves on to Delivery Tracking. */
  onFinished: () => void;
  refreshing: boolean;
  /** false = nothing has loaded successfully yet (figures show skeletons). */
  dataReady: boolean;
  /** true = a fetch is in flight / the held data predates the current
   *  filters — the figures keep their last good values and say "Updating…". */
  syncing: boolean;
};

function statusKeyOf(status: OrderView["status"]): string {
  switch (status) {
    case "Pending":
      return "orders.status_pending";
    case "Collected":
      return "orders.status_collected";
    case "Assigned":
      return "orders.status_assigned";
    case "Partially Delivered":
      return "orders.status_partially_delivered";
    case "Delivered":
      return "orders.status_delivered";
    case "Completed":
    default:
      return "orders.status_completed";
  }
}

export default function OrdersAssignmentTab({
  page,
  loading,
  day,
  today,
  onDaySelect,
  vehicles,
  selectedTripId,
  onSelectTrip,
  search,
  onSearchChange,
  pageSize,
  onPageChange,
  onPageSizeChange,
  onReload,
  onRefresh,
  shopDirectory,
  supervisorDirectory,
  onFinished,
  refreshing,
  dataReady,
  syncing,
}: Props) {
  const { to } = useOrdersI18n();
  const { success: toastSuccess, error: toastError, info: toastInfo } = useToast();

  const [draftsByTrip, setDraftsByTrip] = useState<DraftsByTrip>(EMPTY_DRAFTS);
  const [saving, setSaving] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [notifications, setNotifications] =
    useState<OrderNotificationOutcome[]>(NO_NOTIFICATIONS);
  const [loadedShopsTripId, setLoadedShopsTripId] = useState<number | null>(null);
  const busy = saving || finishing;

  const isPast = day < today;
  const vehicle = vehicles.find((v) => v.tripId === selectedTripId) ?? null;
  const vehicleLocked = vehicle ? vehicle.status === "Completed" : false;
  const canEdit = Boolean(vehicle) && !isPast && !vehicleLocked;

  const rows = page.rows;

  // Drafts belong to a DAY: its orders are what they edit. Switching the
  // expanded trip keeps them, so comparing two trucks costs no typing.
  // Adjusting the state DURING render (React's documented pattern) re-runs
  // this component before anything is committed — no frame of stale values.
  const [scopeDay, setScopeDay] = useState(day);
  if (scopeDay !== day) {
    setScopeDay(day);
    setDraftsByTrip(EMPTY_DRAFTS);
    setNotifications(NO_NOTIFICATIONS);
    // The list would otherwise re-read a different day for the trip it was
    // opened with.
    setLoadedShopsTripId(null);
  }

  const draft = (selectedTripId != null && draftsByTrip.get(selectedTripId)) || EMPTY_DRAFT;

  /** Orders on the CURRENT page, by id — used to refresh a draft's version. */
  const rowsById = useMemo(() => {
    const map = new Map<number, OrderView>();
    for (const row of rows) map.set(row.id, row);
    return map;
  }, [rows]);

  /** The assignment of the EXPANDED trip for one order (null = none yet). */
  const assignmentOf = useCallback(
    (row: OrderView) =>
      selectedTripId ? row.assignments.find((a) => a.tripId === selectedTripId) ?? null : null,
    [selectedTripId]
  );

  /** Boxes committed to OTHER trips — the order's remaining quantity here. */
  const committedElsewhere = useCallback(
    (row: OrderView) =>
      row.assignments
        .filter((a) => a.tripId !== selectedTripId)
        .reduce((s, a) => s + Math.max(a.pickupBoxes, a.deliveredBoxes), 0),
    [selectedTripId]
  );

  /** Highest value this trip may hold for the order (backend re-validates). */
  const maxHere = useCallback(
    (row: OrderView) => Math.max(0, row.requiredBoxes - committedElsewhere(row)),
    [committedElsewhere]
  );

  const boxesOf = useCallback(
    (row: OrderView) => {
      const d = draft.get(row.id);
      if (d) return d.pickupBoxes;
      return assignmentOf(row)?.pickupBoxes ?? 0;
    },
    [draft, assignmentOf]
  );

  const sequenceOf = useCallback(
    (row: OrderView, index: number) => {
      const d = draft.get(row.id);
      if (d) return d.sequence;
      return assignmentOf(row)?.sequence ?? index + 1;
    },
    [draft, assignmentOf]
  );

  /** Replaces the EXPANDED trip's draft; an emptied draft is dropped. */
  const updateTripDraft = useCallback(
    (tripId: number, update: (prev: Draft) => Draft) => {
      setDraftsByTrip((prev) => {
        const updated = update(prev.get(tripId) ?? EMPTY_DRAFT);
        if (updated === prev.get(tripId)) return prev;
        const next = new Map(prev);
        if (updated.size === 0) next.delete(tripId);
        else next.set(tripId, updated);
        return next;
      });
    },
    []
  );

  const updateDraft = useCallback(
    (row: OrderView, index: number, field: "pickupBoxes" | "sequence", raw: string) => {
      if (selectedTripId == null) return;
      const parsed = Math.max(0, Math.min(99999, Math.floor(Number(raw) || 0)));
      const assignment = assignmentOf(row);
      updateTripDraft(selectedTripId, (prev) => {
        const next = new Map(prev);
        const current: DraftEntry = next.get(row.id) ?? {
          pickupBoxes: assignment?.pickupBoxes ?? 0,
          sequence: assignment?.sequence ?? index + 1,
          basePickupBoxes: assignment?.pickupBoxes ?? 0,
          version: assignment?.version,
        };
        next.set(row.id, {
          ...current,
          [field]: field === "sequence" ? Math.max(1, parsed) : parsed,
        });
        return next;
      });
    },
    [selectedTripId, assignmentOf, updateTripDraft]
  );

  const isDirty = draft.size > 0;

  /**
   * Boxes each trip's unsaved draft ADDS to (or removes from) it, measured
   * against the server values captured when each row was first edited.
   * Computed from the DRAFTS — not from the visible rows — so paging through
   * the table never changes the figures.
   */
  const draftDeltaByTrip = useMemo(() => {
    const deltas = new Map<number, number>();
    for (const [tripId, entries] of draftsByTrip) {
      let delta = 0;
      for (const entry of entries.values()) {
        delta += entry.pickupBoxes - entry.basePickupBoxes;
      }
      deltas.set(tripId, delta);
    }
    return deltas;
  }, [draftsByTrip]);

  /** The day-level projection the key figures footnote. */
  const totalDraftDelta = useMemo(() => {
    let total = 0;
    for (const delta of draftDeltaByTrip.values()) total += delta;
    return total;
  }, [draftDeltaByTrip]);

  const persist = useCallback(
    async (finish: boolean) => {
      if (busy || !canEdit || !selectedTripId) return;
      const items: Array<{
        orderId: number;
        sequence: number;
        pickupBoxes: number;
        version?: number;
      }> = [];
      // Every edited order is sent — including rows the user has since paged
      // away from — so no input is silently dropped. The backend upserts only
      // the listed orders and leaves the trip's other assignments untouched.
      // The concurrency token is taken FRESH from the current page when the
      // row is still visible, and otherwise from the token captured with the
      // edit, so a genuine conflict is still rejected with a 409.
      for (const [orderId, d] of draft) {
        const visible = rowsById.get(orderId);
        items.push({
          orderId,
          sequence: d.sequence,
          pickupBoxes: d.pickupBoxes,
          version: visible ? assignmentOf(visible)?.version : d.version,
        });
      }
      // Deterministic payload order (identical request for identical edits).
      items.sort((a, b) => a.orderId - b.orderId);

      if (items.length === 0 && !finish) {
        toastInfo(to("orders.nothing_to_save"), 5000);
        return;
      }
      if (finish && items.length === 0) {
        // Re-confirm the already persisted assignment (the backend
        // re-validates every line and then fires the supervisor
        // notifications).
        for (const row of rows) {
          const a = assignmentOf(row);
          if (a && a.pickupBoxes > 0) {
            items.push({
              orderId: row.id,
              sequence: a.sequence,
              pickupBoxes: a.pickupBoxes,
              version: a.version,
            });
          }
        }
        if (items.length === 0) {
          toastInfo(to("orders.assign_at_least_one_shop"), 5000);
          return;
        }
      }

      const setBusy = finish ? setFinishing : setSaving;
      setBusy(true);
      try {
        const result = await saveOrderAssignment({
          tripId: selectedTripId,
          orderDate: day,
          items,
          finish,
        });
        updateTripDraft(selectedTripId, () => EMPTY_DRAFT);
        setNotifications(finish ? result.notifications : NO_NOTIFICATIONS);
        await onReload();
        if (finish) {
          toastSuccess(to("orders.assignment_finished"), 5000);
          onFinished();
        } else {
          toastSuccess(to("orders.assignment_saved"), 5000);
        }
      } catch (error) {
        // The backend's own validation message (box limit, delivered lock,
        // completed trip, stale version) is what the user sees.
        toastError(
          error instanceof Error ? error.message : to("orders.save_failed"),
          5000
        );
        await onReload();
      } finally {
        setBusy(false);
      }
    },
    [
      busy,
      canEdit,
      selectedTripId,
      rows,
      rowsById,
      draft,
      assignmentOf,
      updateTripDraft,
      day,
      onReload,
      onFinished,
      toastSuccess,
      toastError,
      toastInfo,
      to,
    ]
  );

  // ── Remove a PENDING shop from the assignment (10-second undo) ──────────
  const doRemove = useCallback(
    async (assignmentId: number) => {
      try {
        await deleteOrderAssignment(assignmentId);
        await onReload();
        toastSuccess(to("orders.assignment_removed"), 5000);
      } catch (error) {
        toastError(
          error instanceof Error ? error.message : to("orders.delete_failed"),
          5000
        );
        await onReload();
      }
    },
    [onReload, toastSuccess, toastError, to]
  );

  const { requestDelete, cancel: cancelDelete, pendingItems } = usePendingDelete<number>(
    (id) => void doRemove(id)
  );
  const pendingAssignmentIds = useMemo(
    () => new Set(pendingItems.map((p) => p.id)),
    [pendingItems]
  );

  /**
   * EVERY assignable vehicle trip for the day. `alreadyAssigned` is the
   * server's total for the WHOLE trip, so the load is never a sum of the
   * visible rows; each truck's own unsaved draft is added on top.
   */
  const vehicleRows = useMemo(
    () =>
      vehicles.map((v) => {
        const loaded = Math.max(0, v.alreadyAssigned + (draftDeltaByTrip.get(v.tripId) ?? 0));
        return {
          trip: v,
          supervisorMobile: supervisorMobileByName(v.supervisorName, supervisorDirectory),
          loaded,
          over: Math.max(0, loaded - v.capacity),
          available: Math.max(0, v.capacity - loaded),
          percent: fillPercent(loaded, v.capacity),
          expanded: v.tripId === selectedTripId,
          locked: v.status === "Completed",
        };
      }),
    [vehicles, draftDeltaByTrip, supervisorDirectory, selectedTripId]
  );

  /** The vehicle the loaded-shop list is open for (null = closed). */
  const loadedShopsVehicle = useMemo(
    () => vehicles.find((v) => v.tripId === loadedShopsTripId) ?? null,
    [vehicles, loadedShopsTripId]
  );

  const toggleExpand = useCallback(
    (tripId: number) => onSelectTrip(tripId === selectedTripId ? null : tripId),
    [onSelectTrip, selectedTripId]
  );

  const startIndex = (page.page - 1) * page.pageSize;

  // ── The shop assignment for ONE expanded trip ──────────────────────────
  const renderAssignmentPanel = (tripDate: string) => (
    <div className="border-t border-emerald-200 bg-slate-50/70 px-3 py-3">
      {tripDate !== day && (
        <p className="mb-2 flex items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50/70 px-3 py-1.5 text-[11px] font-semibold text-sky-800">
          <CalendarDays size={12} aria-hidden />
          {to("orders.cross_date_note", {
            orderDate: formatDayFull(day),
            tripDate: formatDayFull(tripDate),
          })}
        </p>
      )}
      {isPast && (
        <p className="mb-2 flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-600">
          <Lock size={12} aria-hidden /> {to("orders.read_only_note")}
        </p>
      )}
      {vehicleLocked && (
        <p className="mb-2 flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-600">
          <Lock size={12} aria-hidden /> {to("orders.trip_locked")}
        </p>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <OrdersTableSkeleton rows={4} />
        ) : rows.length === 0 ? (
          <OrdersEmptyState
            title={to("orders.no_orders_for_day", { date: formatDayFull(day) })}
            hint={to("orders.assignment_empty")}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1240px]">
              <thead className={opsTableHeadRowClass}>
                <tr>
                  <th className={opsTableThClass}>{to("orders.col_sno")}</th>
                  <th className={opsTableThClass}>{to("orders.col_order_no")}</th>
                  <th className={opsTableThClass}>{to("orders.col_shop_name")}</th>
                  <th className={opsTableThClass}>{to("orders.col_city")}</th>
                  <th className={opsTableThClass}>{to("orders.col_sequence")}</th>
                  <th className={opsTableThClass}>{to("orders.col_required_boxes")}</th>
                  <th className={opsTableThClass}>{to("orders.col_pickup_boxes")}</th>
                  <th className={opsTableThClass}>{to("orders.col_pending_boxes")}</th>
                  <th className={opsTableThClass}>{to("orders.col_delivered_boxes")}</th>
                  <th className={opsTableThClass}>{to("orders.col_remaining_boxes")}</th>
                  <th className={opsTableThClass}>{to("orders.col_trip")}</th>
                  <th className={opsTableThClass}>{to("orders.col_status")}</th>
                  <th className={`${opsTableThClass} text-right`}>{to("orders.col_action")}</th>
                </tr>
              </thead>
              <tbody className={opsTableDivideClass}>
                {rows.map((row, index) => {
                  const assignment = assignmentOf(row);
                  const locked =
                    row.locked ||
                    Boolean(assignment?.locked) ||
                    Boolean(assignment?.tripLocked) ||
                    (assignment != null && pendingAssignmentIds.has(assignment.id));
                  const editable = canEdit && !locked;
                  const limit = maxHere(row);
                  const minHere = assignment?.deliveredBoxes ?? 0;
                  const value = boxesOf(row);
                  const overLimit = value > limit;
                  const underDelivered = value < minHere;
                  return (
                    <tr
                      key={row.id}
                      className={`${opsTableRowClass} ${
                        assignment != null && pendingAssignmentIds.has(assignment.id)
                          ? "opacity-40"
                          : ""
                      }`}
                    >
                      <td className={opsTableTdClass}>{startIndex + index + 1}</td>
                      <td className={`${opsTableTdClass} font-mono text-xs text-slate-500`}>
                        {row.orderNo}
                      </td>
                      <td className={`${opsTableTdClass} font-semibold text-slate-800`}>
                        <span className="inline-flex items-center gap-1.5">
                          {locked && <Lock size={11} className="text-slate-400" aria-hidden />}
                          {row.shopName}
                        </span>
                      </td>
                      <td className={opsTableTdClass}>{row.city || "—"}</td>
                      <td className={opsTableTdClass}>
                        {editable ? (
                          <input
                            type="number"
                            min={1}
                            value={sequenceOf(row, index)}
                            aria-label={`${to("orders.col_sequence")} — ${row.shopName}`}
                            onChange={(e) => updateDraft(row, index, "sequence", e.target.value)}
                            className="no-spinner h-8 w-16 rounded-lg border border-slate-200 px-2 text-xs"
                          />
                        ) : (
                          <span className="tabular-nums">{assignment?.sequence ?? "—"}</span>
                        )}
                      </td>
                      <td className={`${opsTableTdClass} font-semibold tabular-nums`}>
                        {row.requiredBoxes}
                      </td>
                      <td className={opsTableTdClass}>
                        {editable ? (
                          <span className="inline-flex flex-col">
                            <input
                              type="number"
                              min={minHere}
                              max={limit}
                              value={value || ""}
                              aria-label={`${to("orders.col_pickup_boxes")} — ${row.shopName}`}
                              onChange={(e) =>
                                updateDraft(row, index, "pickupBoxes", e.target.value)
                              }
                              className={`no-spinner h-8 w-24 rounded-lg border px-2 text-xs font-semibold ${
                                overLimit || underDelivered
                                  ? "border-rose-400 text-rose-700"
                                  : "border-emerald-300"
                              }`}
                            />
                            <span
                              className={`mt-0.5 text-[10px] ${
                                overLimit || underDelivered ? "text-rose-600" : "text-slate-400"
                              }`}
                            >
                              {to("orders.max_hint", { min: minHere, max: limit })}
                            </span>
                          </span>
                        ) : (
                          <span className="tabular-nums">{assignment?.pickupBoxes ?? 0}</span>
                        )}
                      </td>
                      <td className={`${opsTableTdClass} tabular-nums font-semibold text-amber-700`}>
                        {row.pendingBoxes}
                      </td>
                      <td className={`${opsTableTdClass} tabular-nums font-semibold text-emerald-700`}>
                        {row.deliveredBoxes}
                      </td>
                      <td className={`${opsTableTdClass} tabular-nums`}>{row.remainingBoxes}</td>
                      <td className={`${opsTableTdClass} text-xs text-slate-500`}>
                        {row.assignments.map((a) => a.tripNo).join(", ") || "—"}
                      </td>
                      <td className={opsTableTdClass}>
                        <OrdersStatusBadge status={row.status} label={to(statusKeyOf(row.status))} />
                      </td>
                      <td className={`${opsTableTdClass} text-right`}>
                        <OrdersIconButton
                          label={to("orders.remove_assignment", { shop: row.shopName })}
                          tone="rose"
                          disabled={
                            !canEdit ||
                            !assignment ||
                            assignment.deliveredBoxes > 0 ||
                            assignment.tripLocked ||
                            busy
                          }
                          onClick={() => {
                            if (!assignment) return;
                            requestDelete(assignment.id, {
                              label: to("orders.remove_assignment", { shop: row.shopName }),
                            });
                          }}
                        >
                          <Trash2 size={13} />
                        </OrdersIconButton>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <OrdersPagination
          page={page.page}
          totalPages={page.totalPages}
          total={page.total}
          pageSize={pageSize}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
          t={to}
        />

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 bg-slate-50/60 px-4 py-3">
          {isDirty && (
            <span className="mr-auto text-[11px] font-semibold text-amber-700">
              {to("orders.unsaved_changes")}
            </span>
          )}
          <button
            type="button"
            className={opsSecondaryButtonClass}
            disabled={busy || !isDirty}
            onClick={() => selectedTripId != null && updateTripDraft(selectedTripId, () => EMPTY_DRAFT)}
          >
            {to("orders.cancel")}
          </button>
          <button
            type="button"
            className={opsSecondaryButtonClass}
            disabled={busy || !canEdit}
            onClick={() => void persist(false)}
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? to("orders.saving") : to("orders.save_progress")}
          </button>
          <button
            type="button"
            className={opsPrimaryButtonClass}
            disabled={busy || !canEdit}
            onClick={() => void persist(true)}
          >
            {finishing ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            {finishing ? to("orders.submitting") : to("orders.finish_assignment")}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      {/* Order Assignment's OWN key figures: shops / boxes against ordered,
          assigned and pending, straight from the server summary for the whole
          filtered day. */}
      <OrdersAssignmentKpis
        shopsOrdered={page.summary.orderedShops}
        shopsAssigned={page.summary.fullyAssignedShops}
        shopsPending={page.summary.pendingAssignmentShops}
        boxesOrdered={page.summary.totalRequiredBoxes}
        boxesAssigned={page.summary.totalAssignedBoxes}
        boxesPending={page.summary.totalPendingBoxes}
        draftBoxesDelta={totalDraftDelta}
        ready={dataReady}
        /* `busy` covers the save → reload window: persist() only clears it
           after onReload() has re-read the server, so the figures never show
           pre-save totals as if they were the saved result. */
        syncing={syncing || busy}
        t={to}
      />

      {/* Real supervisor-notification outcome (never a fabricated success). */}
      {notifications.length > 0 && (
        <div className="space-y-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5">
          {notifications.map((n) => (
            <div key={n.channel} className="flex items-center gap-2 text-[11px]">
              {n.status === "sent" ? (
                <CheckCircle2 size={13} className="text-emerald-600" aria-hidden />
              ) : (
                <AlertTriangle size={13} className="text-amber-600" aria-hidden />
              )}
              <span className="font-bold uppercase tracking-wide text-slate-500">
                {n.channel === "email" ? to("orders.channel_email") : to("orders.channel_whatsapp")}
              </span>
              <span className={n.status === "sent" ? "text-emerald-700" : "text-amber-700"}>
                {n.status === "sent"
                  ? to("orders.notify_sent", { recipient: n.recipient })
                  : n.message || to("orders.notify_not_sent")}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ONE workspace: the day/search toolbar, then the day's vehicles, each
          expanding in place into its own shop assignment. */}
      <div className="overflow-visible rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50/60 px-4 py-2.5">
          <OrdersSearchInput
            value={search}
            onChange={onSearchChange}
            placeholder={to("orders.search_assignment")}
            className="w-full sm:w-72"
          />
          <OrdersDateControl day={day} today={today} onDaySelect={onDaySelect} t={to} />
          <span
            className={`w-24 flex-shrink-0 truncate text-[10.5px] font-semibold text-slate-400 transition-opacity duration-150 motion-reduce:transition-none ${
              syncing ? "opacity-100" : "opacity-0"
            }`}
            role="status"
            aria-live="polite"
          >
            {syncing ? to("orders.kpi_syncing") : ""}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <OrdersIconButton
              label={`${to("orders.refresh")} — ${to("orders.refresh_assignment")}`}
              onClick={onRefresh}
              busy={refreshing}
            >
              <RefreshCw size={14} />
            </OrdersIconButton>
          </div>
        </div>

        {vehicleRows.length === 0 ? (
          <p className="px-4 py-3 text-[11.5px] font-semibold text-slate-500">
            {to("orders.no_eligible_vehicles")}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px]">
              <thead className={opsTableHeadRowClass}>
                <tr>
                  <th className={vehicleThClass}>{to("orders.col_vehicle_no")}</th>
                  <th className={vehicleThClass}>{to("orders.col_trip")}</th>
                  <th className={vehicleThClass}>{to("orders.supervisor")}</th>
                  <th className={vehicleThClass}>{to("orders.supervisor_mobile")}</th>
                  <th className={vehicleThClass}>{to("orders.kpi_trip_capacity")}</th>
                  <th className={vehicleThClass}>{to("orders.kpi_trip_loaded")}</th>
                  <th className={vehicleThClass}>{to("orders.kpi_trip_available")}</th>
                  <th className={`${vehicleThClass} text-right`}>{to("orders.col_action")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {vehicleRows.map((v) => (
                  <Fragment key={v.trip.tripId}>
                    <tr className={v.expanded ? "bg-emerald-50/60" : "hover:bg-slate-50/70"}>
                      <td className={`${vehicleTdClass} font-bold text-slate-800`}>
                        <span className="inline-flex items-center gap-1.5">
                          <span
                            className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg border ${
                              v.over > 0 ? TONE_ICON.rose : TONE_ICON.emerald
                            }`}
                            aria-hidden
                          >
                            {v.over > 0 ? <AlertTriangle size={14} /> : <Truck size={14} />}
                          </span>
                          {v.trip.vehicleNo || "—"}
                          {v.locked && <Lock size={11} className="text-slate-400" aria-hidden />}
                        </span>
                      </td>
                      <td className={vehicleTdClass}>
                        <span className="flex flex-col leading-tight">
                          <span className="font-semibold text-slate-700">
                            {v.trip.tripNo || "—"}
                          </span>
                          <span
                            className={`text-[10.5px] font-bold ${
                              v.trip.tripDate === day ? "text-emerald-600" : "text-slate-400"
                            }`}
                          >
                            {formatDayFull(v.trip.tripDate)}
                          </span>
                        </span>
                      </td>
                      <td className={`${vehicleTdClass} font-semibold text-slate-700`}>
                        {v.trip.supervisorName || "—"}
                      </td>
                      <td className={`${vehicleTdClass} tabular-nums`}>
                        {v.supervisorMobile || "—"}
                      </td>
                      <td className={`${vehicleTdClass} font-bold tabular-nums text-slate-800`}>
                        {v.trip.capacity}
                      </td>
                      <td className={vehicleTdClass}>
                        <span className="flex min-w-[104px] items-center gap-2">
                          <span
                            className={`w-8 flex-shrink-0 text-right font-bold tabular-nums ${
                              v.over > 0 ? "text-rose-700" : "text-emerald-700"
                            }`}
                          >
                            {v.loaded}
                          </span>
                          <span className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                            <span
                              className={`block h-full rounded-full transition-[width] duration-300 ease-out motion-reduce:transition-none ${
                                v.over > 0 ? TONE_BAR.rose : TONE_BAR.emerald
                              }`}
                              style={{ width: `${v.percent}%` }}
                            />
                          </span>
                          <span
                            className={`w-9 flex-shrink-0 text-right text-[11px] font-bold tabular-nums ${
                              v.over > 0 ? "text-rose-600" : "text-slate-500"
                            }`}
                          >
                            {v.percent}%
                          </span>
                        </span>
                      </td>
                      <td
                        className={`${vehicleTdClass} font-bold tabular-nums ${
                          v.available === 0 ? "text-amber-700" : "text-slate-800"
                        }`}
                      >
                        {v.available}
                      </td>
                      <td className={`${vehicleTdClass} text-right`}>
                        <span className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setLoadedShopsTripId(v.trip.tripId)}
                            // Always available: the list has a proper empty
                            // state, and "confirm nothing is loaded yet" is a
                            // real question to ask of a truck.
                            title={`${to("orders.view_loaded_shops")} — ${
                              v.trip.vehicleNo || v.trip.tripNo
                            }`}
                            className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-2.5 text-[11.5px] font-bold text-slate-600 outline-none transition-colors hover:bg-slate-50 hover:text-slate-800 focus-visible:ring-2 focus-visible:ring-emerald-500/40"
                          >
                            <ListChecks size={14} aria-hidden />
                            {to("orders.view_loaded_shops")}
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleExpand(v.trip.tripId)}
                            aria-expanded={v.expanded}
                            aria-label={`${to("orders.assign_shops")} — ${
                              v.trip.vehicleNo || v.trip.tripNo
                            }`}
                            className={`inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 text-[11.5px] font-bold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-emerald-500/40 ${
                              v.expanded
                                ? "border-emerald-300 bg-emerald-100 text-emerald-800"
                                : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                            }`}
                          >
                            <ChevronDown
                              size={13}
                              className={`transition-transform motion-reduce:transition-none ${
                                v.expanded ? "rotate-180" : ""
                              }`}
                              aria-hidden
                            />
                            {v.expanded ? to("orders.close_assign") : to("orders.assign_shops")}
                          </button>
                        </span>
                      </td>
                    </tr>
                    {v.expanded && (
                      <tr>
                        {/* `w-0 min-w-full` keeps this full-width cell from
                            contributing to the table's intrinsic width: the
                            shop table inside is far wider and would otherwise
                            stretch the vehicle row and push its action column
                            off the card. The panel scrolls on its own. */}
                        <td colSpan={VEHICLE_COLUMNS} className="p-0">
                          <div className="w-0 min-w-full">{renderAssignmentPanel(v.trip.tripDate)}</div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {vehicleRows.length > 0 && selectedTripId == null && (
          <p className="border-t border-slate-100 px-4 py-2.5 text-[11px] font-semibold text-slate-400">
            {to("orders.expand_to_assign")}
          </p>
        )}

        {vehicleRows.some((v) => v.over > 0) && (
          <div className="border-t border-rose-100 bg-rose-50/70 px-4 py-2">
            {vehicleRows
              .filter((v) => v.over > 0)
              .map((v) => (
                <p
                  key={v.trip.tripId}
                  className="flex items-center gap-1.5 text-[11px] font-bold text-rose-700"
                >
                  <AlertTriangle size={12} aria-hidden />
                  {`${v.trip.vehicleNo || v.trip.tripNo} — ${to("orders.kpi_trip_over", {
                    value: v.over,
                  })}`}
                </p>
              ))}
          </div>
        )}
      </div>

      <PendingDeleteNotification items={pendingItems} onCancel={cancelDelete} />

      {/* Every shop carrying boxes on ONE trip — re-read from the server for
          the WHOLE trip, not filtered from the visible page. */}
      {loadedShopsVehicle && (
        <OrdersLoadedShopsDialog
          tripId={loadedShopsVehicle.tripId}
          vehicleNo={loadedShopsVehicle.vehicleNo}
          tripNo={loadedShopsVehicle.tripNo}
          shopDirectory={shopDirectory}
          // Unsaved edits only ever concern the trip they were typed into.
          dirty={(draftsByTrip.get(loadedShopsVehicle.tripId)?.size ?? 0) > 0}
          onClose={() => setLoadedShopsTripId(null)}
          t={to}
        />
      )}
    </div>
  );
}
