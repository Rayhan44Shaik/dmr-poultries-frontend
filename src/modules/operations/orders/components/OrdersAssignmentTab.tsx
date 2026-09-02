// src/modules/operations/orders/components/OrdersAssignmentTab.tsx
// TAB 2 — ORDER ASSIGNMENT.
//
// Assigns the day's collected orders to ONE vehicle trip. Everything the
// table shows — required / pickup / pending / delivered boxes, the trip and
// vehicle, the status and every LOCK — is served by the backend Orders
// module, so Step 2, Step 4 and Delivery Tracking can never disagree with it.
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

import { useCallback, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Lock, RefreshCw, Save, Send, Trash2 } from "lucide-react";
import Select from "react-select";
import {
  opsPrimaryButtonClass,
  opsReactSelectStyles,
  opsSecondaryButtonClass,
  opsTableDivideClass,
  opsTableHeadRowClass,
  opsTableTdClass,
  opsTableThClass,
  opsTableRowClass,
} from "../../../../shared/ui/operationsStyles";
import { useSafeNotification } from "../../../../hooks/useSafeNotification";
import { usePendingDelete } from "../../../../hooks/usePendingDelete";
import { PendingDeleteNotification } from "../../../../components/common/PendingDeleteNotification";
import { formatDayFull } from "../ordersUtils";
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
  OrdersSummaryStrip,
  OrdersTableSkeleton,
} from "./OrdersCommon";

type Draft = Map<number, { pickupBoxes: number; sequence: number }>;

type Props = {
  page: OrdersPage;
  loading: boolean;
  day: string;
  today: string;
  onDaySelect: (day: string) => void;
  vehicles: EligibleVehicle[];
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
  /** Assignment finished — the page moves on to Delivery Tracking. */
  onFinished: () => void;
  refreshing: boolean;
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
  onFinished,
  refreshing,
}: Props) {
  const { to } = useOrdersI18n();
  const { showNotification } = useSafeNotification();

  const [draft, setDraft] = useState<Draft>(new Map());
  const [saving, setSaving] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [notifications, setNotifications] = useState<OrderNotificationOutcome[]>([]);
  const busy = saving || finishing;

  const isPast = day < today;
  const vehicle = vehicles.find((v) => v.tripId === selectedTripId) ?? null;
  const vehicleLocked = vehicle ? vehicle.status === "Completed" : false;
  const canEdit = Boolean(vehicle) && !isPast && !vehicleLocked;

  const rows = page.rows;

  /** The assignment of the SELECTED trip for one order (null = none yet). */
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

  const updateDraft = useCallback(
    (row: OrderView, index: number, field: "pickupBoxes" | "sequence", raw: string) => {
      const parsed = Math.max(0, Math.min(99999, Math.floor(Number(raw) || 0)));
      setDraft((prev) => {
        const next = new Map(prev);
        const current = next.get(row.id) ?? {
          pickupBoxes: assignmentOf(row)?.pickupBoxes ?? 0,
          sequence: assignmentOf(row)?.sequence ?? index + 1,
        };
        next.set(row.id, {
          ...current,
          [field]: field === "sequence" ? Math.max(1, parsed) : parsed,
        });
        return next;
      });
    },
    [assignmentOf]
  );

  const isDirty = draft.size > 0;

  const persist = useCallback(
    async (finish: boolean) => {
      if (busy || !canEdit || !selectedTripId) return;
      const items: Array<{
        orderId: number;
        sequence: number;
        pickupBoxes: number;
        version?: number;
      }> = [];
      for (const row of rows) {
        const d = draft.get(row.id);
        if (!d) continue;
        items.push({
          orderId: row.id,
          sequence: d.sequence,
          pickupBoxes: d.pickupBoxes,
          version: assignmentOf(row)?.version,
        });
      }

      if (items.length === 0 && !finish) {
        showNotification(to("orders.nothing_to_save"), "info");
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
          showNotification(to("orders.assign_at_least_one_shop"), "info");
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
        setDraft(new Map());
        setNotifications(finish ? result.notifications : []);
        await onReload();
        if (finish) {
          showNotification(to("orders.assignment_finished"), "success");
          onFinished();
        } else {
          showNotification(to("orders.assignment_saved"), "success");
        }
      } catch (error) {
        // The backend's own validation message (box limit, delivered lock,
        // completed trip, stale version) is what the user sees.
        showNotification(
          error instanceof Error ? error.message : to("orders.save_failed"),
          "error"
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
      draft,
      assignmentOf,
      day,
      onReload,
      onFinished,
      showNotification,
      to,
    ]
  );

  // ── Remove a PENDING shop from the assignment (10-second undo) ──────────
  const doRemove = useCallback(
    async (assignmentId: number) => {
      try {
        await deleteOrderAssignment(assignmentId);
        await onReload();
        showNotification(to("orders.assignment_removed"), "success");
      } catch (error) {
        showNotification(
          error instanceof Error ? error.message : to("orders.delete_failed"),
          "error"
        );
        await onReload();
      }
    },
    [onReload, showNotification, to]
  );

  const { requestDelete, cancel: cancelDelete, pendingItems } = usePendingDelete<number>(
    (id) => void doRemove(id)
  );
  const pendingAssignmentIds = useMemo(
    () => new Set(pendingItems.map((p) => p.id)),
    [pendingItems]
  );

  const assignedOnTrip = useMemo(() => {
    let total = 0;
    for (const row of rows) {
      total += boxesOf(row);
    }
    return total;
  }, [rows, boxesOf]);

  const summaryMetrics = useMemo(
    () => [
      { key: "shops", label: to("orders.metric_shops"), value: page.summary.totalShops },
      {
        key: "required",
        label: to("orders.metric_required"),
        value: page.summary.totalRequiredBoxes,
        tone: "sky" as const,
      },
      {
        key: "loaded",
        label: to("orders.metric_loaded"),
        value: page.summary.totalAssignedBoxes,
        tone: "emerald" as const,
      },
      {
        key: "pending",
        label: to("orders.metric_pending"),
        value: page.summary.totalPendingBoxes,
        tone: "amber" as const,
      },
      {
        key: "capacity",
        label: to("orders.metric_capacity"),
        value: vehicle ? vehicle.capacity : "—",
      },
      {
        key: "available",
        label: to("orders.metric_available"),
        value: vehicle ? Math.max(0, vehicle.capacity - assignedOnTrip) : "—",
        tone: "emerald" as const,
      },
    ],
    [page.summary, vehicle, assignedOnTrip, to]
  );

  const vehicleOptions = useMemo(
    () =>
      vehicles.map((v) => ({
        value: v.tripId,
        label: `${v.vehicleNo || "—"} · ${v.tripNo} · ${to("orders.available_boxes")}: ${v.available}`,
      })),
    [vehicles, to]
  );

  const startIndex = (page.page - 1) * page.pageSize;

  return (
    <div className="space-y-3">
      <OrdersSummaryStrip metrics={summaryMetrics} />

      {/* Real supervisor-notification outcome (never a fabricated success). */}
      {notifications.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 space-y-1">
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

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-visible">
        <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50/60 flex items-center gap-2 flex-wrap">
          <div className="min-w-[260px]">
            <Select
              inputId="orders-vehicle-select"
              aria-label={to("orders.select_vehicle")}
              options={vehicleOptions}
              value={vehicleOptions.find((o) => o.value === selectedTripId) ?? null}
              placeholder={to("orders.select_vehicle")}
              styles={opsReactSelectStyles() as never}
              isClearable
              onChange={(option) =>
                onSelectTrip(Number((option as { value?: number } | null)?.value ?? 0) || null)
              }
            />
          </div>
          <OrdersSearchInput
            value={search}
            onChange={onSearchChange}
            placeholder={to("orders.search_assignment")}
            className="w-full sm:w-64"
          />
          <OrdersDateControl day={day} today={today} onDaySelect={onDaySelect} t={to} />
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

        {!vehicle && (
          <div className="px-4 py-2 border-b border-slate-100 text-[11px] font-semibold text-amber-700 bg-amber-50/50">
            {vehicles.length === 0 ? to("orders.no_eligible_vehicles") : to("orders.select_order")}
          </div>
        )}
        {vehicleLocked && (
          <div className="px-4 py-2 border-b border-slate-100 text-[11px] font-semibold text-slate-600 bg-slate-50 flex items-center gap-1.5">
            <Lock size={12} /> {to("orders.trip_locked")}
          </div>
        )}

        {loading ? (
          <OrdersTableSkeleton rows={6} />
        ) : rows.length === 0 ? (
          <OrdersEmptyState
            title={to("orders.no_orders_for_day", { date: formatDayFull(day) })}
            hint={to("orders.assignment_empty")}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px]">
              <thead className={opsTableHeadRowClass}>
                <tr>
                  <th className={opsTableThClass}>{to("orders.col_sno")}</th>
                  <th className={opsTableThClass}>{to("orders.col_shop_name")}</th>
                  <th className={opsTableThClass}>{to("orders.col_city")}</th>
                  <th className={opsTableThClass}>{to("orders.col_sequence")}</th>
                  <th className={opsTableThClass}>{to("orders.col_required_boxes")}</th>
                  <th className={opsTableThClass}>{to("orders.col_pickup_boxes")}</th>
                  <th className={opsTableThClass}>{to("orders.col_pending_boxes")}</th>
                  <th className={opsTableThClass}>{to("orders.col_delivered_boxes")}</th>
                  <th className={opsTableThClass}>{to("orders.col_trip")}</th>
                  <th className={opsTableThClass}>{to("orders.col_vehicle")}</th>
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
                            className="h-8 w-16 rounded-lg border border-slate-200 px-2 text-xs"
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
                              className={`h-8 w-24 rounded-lg border px-2 text-xs font-semibold ${
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
                      <td className={`${opsTableTdClass} text-xs text-slate-500`}>
                        {row.assignments.map((a) => a.tripNo).join(", ") || "—"}
                      </td>
                      <td className={`${opsTableTdClass} text-xs text-slate-500`}>
                        {row.assignments.map((a) => a.vehicleNo).filter(Boolean).join(", ") || "—"}
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

        <div className="px-4 py-3 border-t border-slate-200 bg-slate-50/60 flex items-center justify-end gap-2 flex-wrap">
          {isDirty && (
            <span className="mr-auto text-[11px] font-semibold text-amber-700">
              {to("orders.unsaved_changes")}
            </span>
          )}
          <button
            type="button"
            className={opsSecondaryButtonClass}
            disabled={busy || !isDirty}
            onClick={() => setDraft(new Map())}
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

      <PendingDeleteNotification items={pendingItems} onCancel={cancelDelete} />
    </div>
  );
}
