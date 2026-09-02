// src/modules/operations/orders/components/OrdersCollectionTab.tsx
// TAB 1 — ORDER COLLECTION.
//
// Collects the REQUIRED boxes per shop for one operational day. The rows,
// their quantities, their locks and their statuses all come from the backend
// Orders module (GET /api/orders) — a refresh, a cache clear or a second
// browser reconstructs exactly the same table.
//
//   · Save Progress / Finish Collection → POST /api/orders/collection
//   · Delete a pending line             → 10-second undo, then
//                                         DELETE /api/orders/:id
//   · Fully delivered shops are LOCKED (the backend rejects any change and
//     the inputs are disabled) — partially delivered shops stay editable
//     down to their delivered quantity.
//   · Search (shop / city / order no / trip / vehicle), the date filter and
//     pagination all run SERVER-SIDE over the whole dataset.

import { useCallback, useMemo, useState } from "react";
import { Loader2, Lock, Plus, RefreshCw, Save, Send, Trash2 } from "lucide-react";
import Select from "react-select";
import type { Shop } from "../../../masters/shops/types/shop";
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
  deleteOrder,
  saveOrderCollection,
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

/** Draft edits keyed by order id (only what the user actually changed). */
type Draft = Map<number, { requiredBoxes: number; birds: number }>;

type Props = {
  /** Active shops from the Shop Master (for the "add shop" picker). */
  shops: Shop[];
  shopsLoading: boolean;
  /** Server page for the selected day. */
  page: OrdersPage;
  loading: boolean;
  day: string;
  today: string;
  onDaySelect: (day: string) => void;
  search: string;
  onSearchChange: (value: string) => void;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  /** Reload the current tab's server data. */
  onReload: () => Promise<unknown> | void;
  /** Table-level Refresh (same fetch + a confirmation toast). */
  onRefresh: () => void;
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

export default function OrdersCollectionTab({
  shops,
  shopsLoading,
  page,
  loading,
  day,
  today,
  onDaySelect,
  search,
  onSearchChange,
  pageSize,
  onPageChange,
  onPageSizeChange,
  onReload,
  onRefresh,
  refreshing,
}: Props) {
  const { to } = useOrdersI18n();
  const { showNotification } = useSafeNotification();

  const [draft, setDraft] = useState<Draft>(new Map());
  const [newShopIds, setNewShopIds] = useState<Array<{ shopId: number; boxes: number; birds: number }>>([]);
  const [saving, setSaving] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const busy = saving || finishing;

  // Past days are read-only; today stays editable per row (a fully
  // delivered row is locked by the BACKEND, mirrored here for the inputs).
  const isPast = day < today;
  const dayEditable = !isPast;

  const rows = page.rows;
  const collectedShopIds = useMemo(() => new Set(rows.map((r) => r.shopId)), [rows]);

  const addableShops = useMemo(
    () =>
      shops
        .filter((s) => !collectedShopIds.has(s.id) && !newShopIds.some((n) => n.shopId === s.id))
        .map((s) => ({ value: s.id, label: `${s.shopName}${s.city ? ` · ${s.city}` : ""}` })),
    [shops, collectedShopIds, newShopIds]
  );

  const valueOf = useCallback(
    (row: OrderView, field: "requiredBoxes" | "birds"): number => {
      const d = draft.get(row.id);
      if (d) return d[field];
      return field === "requiredBoxes" ? row.requiredBoxes : row.birds;
    },
    [draft]
  );

  const updateDraft = useCallback(
    (row: OrderView, field: "requiredBoxes" | "birds", raw: string) => {
      const n = Math.max(0, Math.min(99999, Math.floor(Number(raw) || 0)));
      setDraft((prev) => {
        const next = new Map(prev);
        const current = next.get(row.id) ?? {
          requiredBoxes: row.requiredBoxes,
          birds: row.birds,
        };
        next.set(row.id, { ...current, [field]: n });
        return next;
      });
    },
    []
  );

  const isDirty = draft.size > 0 || newShopIds.length > 0;

  /** Payload for the backend: every touched row + every newly added shop. */
  const buildItems = useCallback(() => {
    const items: Array<{
      shopId: number;
      requiredBoxes: number;
      birds: number;
      version?: number;
    }> = [];
    for (const row of rows) {
      const d = draft.get(row.id);
      if (!d) continue;
      items.push({
        shopId: row.shopId,
        requiredBoxes: d.requiredBoxes,
        birds: d.birds,
        // Optimistic-concurrency token: a competing change is rejected
        // by the backend instead of silently overwritten.
        version: row.version,
      });
    }
    for (const added of newShopIds) {
      if (added.boxes <= 0) continue;
      items.push({ shopId: added.shopId, requiredBoxes: added.boxes, birds: added.birds });
    }
    return items;
  }, [rows, draft, newShopIds]);

  const persist = useCallback(
    async (finish: boolean) => {
      if (busy || !dayEditable) return;
      const items = buildItems();
      if (items.length === 0 && !finish) {
        showNotification(to("orders.nothing_to_save"), "info");
        return;
      }
      if (finish && items.length === 0 && rows.length === 0) {
        showNotification(to("orders.add_at_least_one_shop"), "info");
        return;
      }
      if (finish) {
        const invalid = rows
          .map((r) => ({ row: r, boxes: valueOf(r, "requiredBoxes") }))
          .filter((r) => r.boxes <= 0);
        if (invalid.length > 0) {
          showNotification(
            to("orders.finish_invalid", {
              shops:
                invalid.slice(0, 5).map((r) => r.row.shopName).join(", ") +
                (invalid.length > 5 ? "…" : ""),
            }),
            "info"
          );
          return;
        }
      }
      const setBusy = finish ? setFinishing : setSaving;
      setBusy(true);
      try {
        await saveOrderCollection({
          orderDate: day,
          items:
            items.length > 0
              ? items
              : rows.map((r) => ({
                  shopId: r.shopId,
                  requiredBoxes: r.requiredBoxes,
                  birds: r.birds,
                })),
          finish,
        });
        setDraft(new Map());
        setNewShopIds([]);
        await onReload();
        showNotification(
          finish ? to("orders.collection_finished") : to("orders.collection_saved"),
          "success"
        );
      } catch (error) {
        // The backend message is the real reason (quantity below delivered,
        // stale version, delivered lock…). Never swallowed, never faked.
        showNotification(
          error instanceof Error ? error.message : to("orders.save_failed"),
          "error"
        );
        await onReload();
      } finally {
        setBusy(false);
      }
    },
    [busy, dayEditable, buildItems, rows, valueOf, day, onReload, showNotification, to]
  );

  // ── Delete a PENDING line (10-second undo, then the real DELETE) ────────
  const doDelete = useCallback(
    async (orderId: number) => {
      try {
        await deleteOrder(orderId);
        await onReload();
        showNotification(to("orders.entry_deleted"), "success");
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
    (id) => void doDelete(id)
  );
  const pendingIds = useMemo(
    () => new Set(pendingItems.map((p) => p.id)),
    [pendingItems]
  );

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
        key: "delivered",
        label: to("orders.metric_delivered"),
        value: page.summary.totalDeliveredBoxes,
        tone: "emerald" as const,
      },
      {
        key: "remaining",
        label: to("orders.metric_remaining"),
        value: page.summary.totalRemainingBoxes,
        tone: "rose" as const,
      },
    ],
    [page.summary, to]
  );

  const startIndex = (page.page - 1) * page.pageSize;

  return (
    <div className="space-y-3">
      <OrdersSummaryStrip metrics={summaryMetrics} />

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-visible">
        {/* ── Table-level controls: search · date · refresh ───────────── */}
        <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50/60 flex items-center gap-2 flex-wrap">
          <OrdersSearchInput
            value={search}
            onChange={onSearchChange}
            placeholder={to("orders.search_collection")}
            className="w-full sm:w-72"
          />
          <OrdersDateControl day={day} today={today} onDaySelect={onDaySelect} t={to} />
          <div className="ml-auto flex items-center gap-2">
            <OrdersIconButton
              label={`${to("orders.refresh")} — ${to("orders.refresh_collection")}`}
              onClick={onRefresh}
              busy={refreshing}
            >
              <RefreshCw size={14} />
            </OrdersIconButton>
          </div>
        </div>

        {/* ── Add a shop to the day's collection ─────────────────────── */}
        {dayEditable && (
          <div className="px-4 py-2.5 border-b border-slate-100 flex items-center gap-2 flex-wrap">
            <div className="min-w-[240px] flex-1 max-w-md">
              <Select
                inputId="orders-add-shop"
                aria-label={to("orders.add_shop")}
                isDisabled={shopsLoading || busy}
                options={addableShops}
                value={null}
                placeholder={to("orders.add_shop")}
                styles={opsReactSelectStyles() as never}
                onChange={(option) => {
                  const shopId = Number((option as { value?: number } | null)?.value ?? 0);
                  if (!shopId) return;
                  setNewShopIds((prev) => [...prev, { shopId, boxes: 0, birds: 0 }]);
                }}
              />
            </div>
            <span className="text-[11px] text-slate-400">{to("orders.collection_hint")}</span>
          </div>
        )}

        {/* ── Newly added shops (not persisted until Save) ───────────── */}
        {newShopIds.length > 0 && (
          <div className="px-4 py-2.5 border-b border-slate-100 space-y-2">
            {newShopIds.map((added, index) => {
              const shop = shops.find((s) => s.id === added.shopId);
              return (
                <div key={added.shopId} className="flex items-center gap-2 flex-wrap">
                  <Plus size={13} className="text-emerald-500" aria-hidden />
                  <span className="text-xs font-semibold text-slate-700 min-w-[160px]">
                    {shop?.shopName ?? `Shop ${added.shopId}`}
                  </span>
                  <span className="text-[11px] text-slate-400 min-w-[100px]">
                    {shop?.city || "—"}
                  </span>
                  <input
                    type="number"
                    min={0}
                    value={added.birds || ""}
                    aria-label={`${to("orders.col_birds")} — ${shop?.shopName ?? ""}`}
                    onChange={(e) =>
                      setNewShopIds((prev) =>
                        prev.map((n, i) =>
                          i === index
                            ? { ...n, birds: Math.max(0, Math.floor(Number(e.target.value) || 0)) }
                            : n
                        )
                      )
                    }
                    className="h-8 w-24 rounded-lg border border-slate-200 px-2 text-xs"
                    placeholder={to("orders.col_birds")}
                  />
                  <input
                    type="number"
                    min={1}
                    value={added.boxes || ""}
                    aria-label={`${to("orders.col_required_boxes")} — ${shop?.shopName ?? ""}`}
                    onChange={(e) =>
                      setNewShopIds((prev) =>
                        prev.map((n, i) =>
                          i === index
                            ? { ...n, boxes: Math.max(0, Math.floor(Number(e.target.value) || 0)) }
                            : n
                        )
                      )
                    }
                    className="h-8 w-24 rounded-lg border border-emerald-300 px-2 text-xs font-semibold"
                    placeholder={to("orders.col_required_boxes")}
                  />
                  <OrdersIconButton
                    label={to("orders.remove_added_shop")}
                    tone="rose"
                    onClick={() =>
                      setNewShopIds((prev) => prev.filter((_, i) => i !== index))
                    }
                  >
                    <Trash2 size={13} />
                  </OrdersIconButton>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Table ───────────────────────────────────────────────────── */}
        {loading ? (
          <OrdersTableSkeleton rows={6} />
        ) : rows.length === 0 ? (
          <OrdersEmptyState
            title={to("orders.no_orders_for_day", { date: formatDayFull(day) })}
            hint={dayEditable ? to("orders.collection_hint") : to("orders.read_only_note")}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px]">
              <thead className={opsTableHeadRowClass}>
                <tr>
                  <th className={opsTableThClass}>{to("orders.col_sno")}</th>
                  <th className={opsTableThClass}>{to("orders.col_shop_name")}</th>
                  <th className={opsTableThClass}>{to("orders.col_city")}</th>
                  <th className={opsTableThClass}>{to("orders.col_birds")}</th>
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
                  const rowLocked = row.locked || row.assignments.some((a) => a.tripLocked);
                  const editable = dayEditable && !rowLocked && !pendingIds.has(row.id);
                  const tripLabel = row.assignments
                    .map((a) => `${a.tripNo}${a.vehicleNo ? ` · ${a.vehicleNo}` : ""}`)
                    .join(", ");
                  return (
                    <tr
                      key={row.id}
                      className={`${opsTableRowClass} ${pendingIds.has(row.id) ? "opacity-40" : ""}`}
                    >
                      <td className={opsTableTdClass}>{startIndex + index + 1}</td>
                      <td className={`${opsTableTdClass} font-semibold text-slate-800`}>
                        <span className="inline-flex items-center gap-1.5">
                          {rowLocked && <Lock size={11} className="text-slate-400" aria-hidden />}
                          {row.shopName}
                        </span>
                      </td>
                      <td className={opsTableTdClass}>{row.city || "—"}</td>
                      <td className={opsTableTdClass}>
                        {editable ? (
                          <input
                            type="number"
                            min={0}
                            value={valueOf(row, "birds") || ""}
                            aria-label={`${to("orders.col_birds")} — ${row.shopName}`}
                            onChange={(e) => updateDraft(row, "birds", e.target.value)}
                            className="h-8 w-24 rounded-lg border border-slate-200 px-2 text-xs"
                          />
                        ) : (
                          <span className="tabular-nums">{row.birds || "—"}</span>
                        )}
                      </td>
                      <td className={opsTableTdClass}>
                        {editable ? (
                          <input
                            type="number"
                            min={Math.max(1, row.deliveredBoxes, row.assignedBoxes)}
                            value={valueOf(row, "requiredBoxes") || ""}
                            aria-label={`${to("orders.col_required_boxes")} — ${row.shopName}`}
                            onChange={(e) => updateDraft(row, "requiredBoxes", e.target.value)}
                            className="h-8 w-24 rounded-lg border border-emerald-300 px-2 text-xs font-semibold"
                          />
                        ) : (
                          <span className="font-semibold tabular-nums">{row.requiredBoxes}</span>
                        )}
                      </td>
                      <td className={`${opsTableTdClass} tabular-nums`}>{row.assignedBoxes}</td>
                      <td className={`${opsTableTdClass} tabular-nums font-semibold text-amber-700`}>
                        {row.pendingBoxes}
                      </td>
                      <td className={`${opsTableTdClass} tabular-nums font-semibold text-emerald-700`}>
                        {row.deliveredBoxes}
                      </td>
                      <td className={`${opsTableTdClass} tabular-nums`}>{row.remainingBoxes}</td>
                      <td className={`${opsTableTdClass} text-xs text-slate-500`}>
                        {tripLabel || "—"}
                      </td>
                      <td className={opsTableTdClass}>
                        <OrdersStatusBadge status={row.status} label={to(statusKeyOf(row.status))} />
                      </td>
                      <td className={`${opsTableTdClass} text-right`}>
                        <OrdersIconButton
                          label={to("orders.delete_entry", { shop: row.shopName })}
                          tone="rose"
                          disabled={!dayEditable || row.deliveredBoxes > 0 || busy}
                          onClick={() =>
                            requestDelete(row.id, {
                              label: to("orders.delete_entry", { shop: row.shopName }),
                            })
                          }
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

        {/* ── Actions ─────────────────────────────────────────────────── */}
        {dayEditable && (
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
              onClick={() => {
                setDraft(new Map());
                setNewShopIds([]);
              }}
            >
              {to("orders.cancel")}
            </button>
            <button
              type="button"
              className={opsSecondaryButtonClass}
              disabled={busy}
              onClick={() => void persist(false)}
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {saving ? to("orders.saving") : to("orders.save_progress")}
            </button>
            <button
              type="button"
              className={opsPrimaryButtonClass}
              disabled={busy}
              onClick={() => void persist(true)}
            >
              {finishing ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              {finishing ? to("orders.submitting") : to("orders.finish_collection")}
            </button>
          </div>
        )}
        {!dayEditable && (
          <div className="px-4 py-2.5 border-t border-slate-200 bg-slate-50/60 text-[11px] font-semibold text-slate-500 flex items-center gap-1.5">
            <Lock size={12} /> {to("orders.read_only_note")}
          </div>
        )}
      </div>

      {/* 10-second undo window before the deletion is finalized. */}
      <PendingDeleteNotification items={pendingItems} onCancel={cancelDelete} />
    </div>
  );
}
