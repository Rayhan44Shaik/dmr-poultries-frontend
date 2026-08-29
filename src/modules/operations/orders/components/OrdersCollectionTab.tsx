// src/modules/operations/orders/components/OrdersCollectionTab.tsx
// TAB 1 — ORDER COLLECTION (day-based).
//
// Shows the shops collected for the SELECTED OPERATIONAL DAY. Today is
// editable (boxes per shop — birds optional, Save Progress / Finish
// Collection); PAST DAYS AND FINISHED DAYS ARE READ-ONLY (locked, view
// only — no edit, no boxes/birds, no delete, no reorder, no assignment
// changes here). The day is chosen with the single global date selector
// (shared DatePicker) — no Previous/Next day buttons, no date-card
// scroller.
//
// The table's job is to COLLECT THE SHOP ORDER: S.No, Shop, Village,
// Birds (optional), Boxes (mandatory), Weight, Status. Assignment facts
// (trip / vehicle / sequence) are NOT permanent columns here — an assigned
// shop shows a compact status (Assigned / Delivered, full trip + vehicle
// details on hover). Assignment belongs to Tab 2, tracking to Tab 3.
//
// One compact table-level search filters the shop list (shop, village,
// trip no, vehicle no, status); results are paginated 10 per page.
//
// Persistence (existing API, no local-only state):
//   Save Progress      → POST /trips/:idOr0/steps/deliveries (mode save)
//   Finish Collection  → same call + startStepSubmitted (final validation)
// Refreshing the page always reproduces the saved collection.

import React, { useCallback, useMemo, useRef, useState } from "react";
import { Loader2, Lock, RefreshCw, Save, Send, Trash2, X } from "lucide-react";
import type { Shop } from "../../../masters/shops/types/shop";
import type { Trip } from "../../../../shared/trip";
import {
  opsPrimaryButtonClass,
  opsSecondaryButtonClass,
  opsTableDivideClass,
  opsTableHeadRowClass,
  opsTableTdClass,
  opsTableThClass,
  opsTableRowClass,
} from "../../../../shared/ui/operationsStyles";
import TripPagination from "../../vehicle-trips/components/TripPagination";
import { useSafeNotification } from "../../../../hooks/useSafeNotification";
import { usePendingDelete } from "../../../../hooks/usePendingDelete";
import { PendingDeleteNotification } from "../../../../components/common/PendingDeleteNotification";
import {
  collectionTotals,
  formatDayFull,
  formatKg,
  rowBoxes,
  weightForBirds,
} from "../ordersUtils";
import {
  finishCollection,
  saveCollection,
  toEditorRows,
  villageOf,
  type ShopDirectory,
} from "../ordersService";
import { useOrdersI18n } from "../i18n/ordersI18n";
import type { OrderShopRow, OrdersDayCollection } from "../types";
import {
  OrdersDateControl,
  OrdersEmptyState,
  OrdersFilterSelect,
  OrdersIconButton,
  OrdersSearchInput,
  OrdersStatusBadge,
  OrdersTableSkeleton,
} from "./OrdersCommon";

/** Fixed page size — 10 rows per page (global pagination component). */
const PAGE_SIZE = 10;
const ORDER_REMARKS = "[ORDER]";

let clientKeySeq = 0;
function newClientKey(): string {
  clientKeySeq += 1;
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `ck-${Date.now()}-${clientKeySeq}`;
}

/** Local editing state for one shop row. */
type EntryRow = {
  clientKey: string;
  /** Persisted delivery row id (0 = never saved). */
  id: number;
  shopId: number;
  shopName: string;
  village: string;
  birds: number;
  boxes: number;
};

function entrySnapshot(rows: EntryRow[]): string {
  return JSON.stringify(
    rows
      .filter((r) => r.birds > 0 || r.boxes > 0)
      .map((r) => [r.shopId, r.birds, r.boxes])
      .sort((a, b) => a[0] - b[0])
  );
}

/** Build the initial entries map + snapshot from the day's collection. */
function buildInitial(
  shops: Shop[],
  dayCollection: OrdersDayCollection | null
): { map: Map<number, EntryRow>; snapshot: string } {
  const map = new Map<number, EntryRow>();
  for (const shop of shops) {
    map.set(shop.id, {
      clientKey: newClientKey(),
      id: 0,
      shopId: shop.id,
      shopName: shop.shopName,
      village: shop.village,
      birds: 0,
      boxes: 0,
    });
  }
  if (dayCollection) {
    for (const row of toEditorRows(dayCollection.trip)) {
      const existing = map.get(row.shopId);
      if (existing) {
        existing.id = row.id;
        existing.birds = Number(row.birds) || 0;
        existing.boxes = rowBoxes(row);
      }
    }
  }
  return { map, snapshot: entrySnapshot(Array.from(map.values())) };
}

function toOrderShopRows(rows: EntryRow[]): OrderShopRow[] {
  return rows
    .filter((r) => r.birds > 0 || r.boxes > 0)
    .map((r, i) => ({
      id: r.id,
      clientKey: r.clientKey,
      serialNo: i + 1,
      boxNo: r.boxes,
      shopId: r.shopId,
      shopName: r.shopName,
      birdTypeId: 0,
      birdType: "",
      birds: r.birds,
      weight: 0,
      mortality: 0,
      mortKg: 0,
      rate: null,
      amount: 0,
      remarks: ORDER_REMARKS,
      deliveryMode: "box" as const,
      selectedBoxIds: [],
      village: r.village,
    }));
}

type Props = {
  /** Active shops from the Shop Master (already filtered + sorted). */
  shops: Shop[];
  shopsLoading: boolean;
  shopDirectory: ShopDirectory;
  /** Selected operational day (YYYY-MM-DD). */
  day: string;
  /** Operational today (YYYY-MM-DD). */
  today: string;
  /** Day changed from the global date selector. */
  onDaySelect: (day: string) => void;
  /** The selected day's persisted collection (null = nothing collected yet). */
  collection: OrdersDayCollection | null;
  /** Trip number reserved for a brand-new collection today. */
  nextTripNo: string;
  /** Persisted snapshot changed (save) — page refreshes its data. */
  onSaved: (trip: Trip) => void;
  /** Collection finished — page refreshes its data. */
  onFinished: (trip: Trip) => void;
  /** Table-level refresh — page refetches Orders data (soft toast after). */
  onRefresh: () => void;
  /** Refresh in flight (duplicate-call guard + busy icon). */
  refreshing: boolean;
};

function OrdersCollectionTab(props: Props) {
  const { to } = useOrdersI18n();
  const { shops, shopsLoading } = props;

  // Shops load asynchronously. The stateful editor mounts only once they are
  // ready (and re-mounts per day via key={day} from the page), so it can seed
  // its entries in a useState initializer — no effect-based state sync.
  if (shopsLoading) {
    return <OrdersTableSkeleton rows={6} />;
  }
  if (shops.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm">
        <OrdersEmptyState title={to("orders.no_active_shops")} />
      </div>
    );
  }
  return <CollectionEntries {...props} />;
}

function CollectionEntries({
  shops,
  shopDirectory,
  day,
  today,
  onDaySelect,
  collection,
  nextTripNo,
  onSaved,
  onFinished,
  onRefresh,
  refreshing,
}: Omit<Props, "shopsLoading">) {
  const { to } = useOrdersI18n();
  const { showNotification } = useSafeNotification();

  // Past days and completed days are read-only (view only).
  const isPast = day < today;
  const isLocked = isPast || Boolean(collection?.finished) || Boolean(collection?.fullyAssigned);
  const isEditable = !isLocked;

  // ── Entries (local editing state, seeded from the day's collection) ──
  const initial = useMemo(
    () => buildInitial(shops, collection),
    // Once per mount — the component re-mounts per day/tab visit; later data
    // refreshes keep the user's in-progress edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  const [entries, setEntries] = useState<Map<number, EntryRow>>(initial.map);
  const [savedSnapshot, setSavedSnapshot] = useState<string>(initial.snapshot);

  const isDirty = useMemo(
    () => !isLocked && entrySnapshot(Array.from(entries.values())) !== savedSnapshot,
    [entries, savedSnapshot, isLocked]
  );

  // ── Container identity (one container per day — reuse or create today) ──
  const containerRef = useRef<{ id: number | null; tripNo: string | null }>({
    id: collection?.trip.id ?? null,
    tripNo: collection?.trip.tripNo ?? (day === today && nextTripNo ? nextTripNo : null),
  });

  // ── Busy flags (double-submit protection) ────────────────────────────────
  const [saving, setSaving] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const busy = saving || finishing;

  const entered = useMemo(
    () => Array.from(entries.values()).filter((r) => r.birds > 0 || r.boxes > 0),
    [entries]
  );
  const totals = useMemo(
    () => collectionTotals(toOrderShopRows(entered)),
    [entered]
  );

  // ── Row updates (editable days only) ─────────────────────────────────────
  const updateEntry = useCallback(
    (shopId: number, field: "birds" | "boxes", raw: string) => {
      const n = Math.max(0, Math.min(9999, Math.floor(Number(raw) || 0)));
      setEntries((prev) => {
        const row = prev.get(shopId);
        if (!row) return prev;
        const next = new Map(prev);
        next.set(shopId, { ...row, [field]: n });
        return next;
      });
    },
    []
  );

  // ── Clear a row (persisted rows re-save without it; 10s undo) ─────────────
  const doClear = useCallback(
    async (shopId: number) => {
      const row = entries.get(shopId);
      if (!row) return;
      const wasPersisted = row.id > 0;
      if (wasPersisted) {
        const remaining = toOrderShopRows(
          Array.from(entries.values())
            .filter((r) => r.shopId !== shopId)
        );
        if (remaining.length === 0) {
          showNotification(to("orders.add_at_least_one_shop"), "info");
          return;
        }
        const updated = await saveCollection(
          containerRef.current.id,
          containerRef.current.tripNo,
          remaining
        );
        containerRef.current = { id: updated.id, tripNo: updated.tripNo };
        const fresh = new Map(entries);
        const kept = fresh.get(shopId);
        if (kept) fresh.set(shopId, { ...kept, id: 0, birds: 0, boxes: 0 });
        setEntries(fresh);
        setSavedSnapshot(entrySnapshot(Array.from(fresh.values())));
        onSaved(updated);
        showNotification(to("orders.entry_cleared", { shop: row.shopName }), "success");
      } else {
        const next = new Map(entries);
        next.set(shopId, { ...row, id: 0, birds: 0, boxes: 0 });
        setEntries(next);
        showNotification(to("orders.entry_cleared", { shop: row.shopName }), "success");
      }
    },
    [entries, onSaved, showNotification, to]
  );

  const { requestDelete, cancel: cancelDelete, pendingItems } =
    usePendingDelete<number>((id) => void doClear(id));

  const onClearClick = (shopId: number) => {
    if (busy || !isEditable) return;
    const row = entries.get(shopId);
    if (!row || (row.birds === 0 && row.boxes === 0)) return;
    if (row.id > 0) {
      requestDelete(shopId, { label: to("orders.clear_entry_label", { shop: row.shopName }) });
    } else {
      void doClear(shopId);
    }
  };

  // ── Save Progress (no final validation) ───────────────────────────────────
  const handleSave = useCallback(async () => {
    if (busy || !isEditable) return;
    const rows = toOrderShopRows(Array.from(entries.values()));
    if (rows.length === 0) {
      showNotification(to("orders.add_at_least_one_shop"), "info");
      return;
    }
    setSaving(true);
    try {
      const updated = await saveCollection(
        containerRef.current.id,
        containerRef.current.tripNo,
        rows
      );
      containerRef.current = { id: updated.id, tripNo: updated.tripNo };
      // Sync persisted row ids + snapshot from the response.
      const persisted = toEditorRows(updated);
      setEntries((prev) => {
        const next = new Map(prev);
        for (const [shopId, row] of next) {
          const match = persisted.find((p) => p.shopId === shopId);
          next.set(shopId, {
            ...row,
            id: match?.id ?? 0,
            birds: Number(match?.birds) || 0,
            boxes: match ? rowBoxes(match) : 0,
          });
        }
        return next;
      });
      setSavedSnapshot(entrySnapshot(Array.from(entries.values())));
      onSaved(updated);
      showNotification(to("orders.collection_saved"), "success");
    } catch {
      showNotification(to("orders.refresh_failed"), "error");
    } finally {
      setSaving(false);
    }
  }, [busy, isEditable, entries, onSaved, showNotification, to]);

  // ── Finish Collection (final mandatory validation) ───────────────────────
  // Boxes are MANDATORY per shop; birds are OPTIONAL (weight stays
  // pending until the delivery step).
  const handleFinish = useCallback(async () => {
    if (busy || !isEditable) return;
    const all = Array.from(entries.values());
    const enteredRows = all.filter((r) => r.birds > 0 || r.boxes > 0);
    if (enteredRows.length === 0) {
      showNotification(to("orders.add_at_least_one_shop"), "info");
      return;
    }
    const invalid = enteredRows.filter((r) => !(r.boxes > 0));
    if (invalid.length > 0) {
      showNotification(
        to("orders.finish_invalid", {
          shops: invalid
            .slice(0, 5)
            .map((r) => r.shopName)
            .join(", ") + (invalid.length > 5 ? "…" : ""),
        }),
        "info"
      );
      return;
    }
    setFinishing(true);
    try {
      const updated = await finishCollection(
        containerRef.current.id,
        containerRef.current.tripNo,
        toOrderShopRows(all)
      );
      containerRef.current = { id: updated.id, tripNo: updated.tripNo };
      showNotification(to("orders.collection_finished"), "success");
      onFinished(updated);
    } catch {
      showNotification(to("orders.refresh_failed"), "error");
    } finally {
      setFinishing(false);
    }
  }, [busy, isEditable, entries, onFinished, showNotification, to]);

  // ── Cancel (discard unsaved entries) ──────────────────────────────────────
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const handleCancel = () => {
    if (busy || !isEditable) return;
    if (isDirty) {
      setConfirmDiscard(true);
      return;
    }
  };
  const applyDiscard = () => {
    setEntries((prev) => {
      const next = new Map(prev);
      const persisted = collection ? toEditorRows(collection.trip) : [];
      for (const [shopId, row] of next) {
        const match = persisted.find((p) => p.shopId === shopId);
        next.set(shopId, {
          ...row,
          id: match?.id ?? 0,
          birds: Number(match?.birds) || 0,
          boxes: match ? rowBoxes(match) : 0,
        });
      }
      setSavedSnapshot(entrySnapshot(Array.from(next.values())));
      return next;
    });
    setConfirmDiscard(false);
  };

  // ── Read-only state copy (persisted values only) ─────────────────────────
  const readOnlyEntries = useMemo(() => {
    const map = new Map<number, { id: number; birds: number; boxes: number }>();
    for (const row of collection ? toEditorRows(collection.trip) : []) {
      map.set(row.shopId, {
        id: row.id,
        birds: Number(row.birds) || 0,
        boxes: rowBoxes(row),
      });
    }
    return map;
  }, [collection]);

  // ── Table-level search (full dataset, not just the visible page) ────────
  // Matches: shop name, village, trip number, vehicle number, status.
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  const statusLabelOf = useCallback(
    (shopId: number, hasEntry: boolean): string => {
      const assignment = collection?.shops.get(shopId) ?? null;
      if (!hasEntry) return "";
      if (!assignment) return to("orders.not_assigned");
      return assignment.delivered ? to("orders.status_delivered") : to("orders.status_assigned");
    },
    [collection, to]
  );

  // ── Compact table-level sort (works with search + pagination + date) ────
  // "Collected" = the shop has an order entry for the selected day
  // (persisted, or in-progress on an editable day).
  const [sortMode, setSortMode] = useState<"collected" | "az" | "za">("collected");
  const sortOptions = useMemo(
    () => [
      { value: "collected", label: to("orders.sort_collected_first") },
      { value: "az", label: to("orders.sort_name_az") },
      { value: "za", label: to("orders.sort_name_za") },
    ],
    [to]
  );

  const collectedOf = useCallback(
    (shopId: number): boolean => {
      const ro = readOnlyEntries.get(shopId);
      const live = entries.get(shopId);
      return (
        (ro?.birds ?? 0) > 0 ||
        (ro?.boxes ?? 0) > 0 ||
        (isEditable && ((live?.birds ?? 0) > 0 || (live?.boxes ?? 0) > 0))
      );
    },
    [readOnlyEntries, entries, isEditable]
  );

  const filteredShopList = useMemo(() => {
    const list = shops.filter((shop) => {
      if (!q) return true;
      const assignment = collection?.shops.get(shop.id) ?? null;
      const ro = readOnlyEntries.get(shop.id);
      const live = entries.get(shop.id);
      const hasEntry =
        (ro?.birds ?? 0) > 0 ||
        (ro?.boxes ?? 0) > 0 ||
        (isEditable && ((live?.birds ?? 0) > 0 || (live?.boxes ?? 0) > 0));
      const haystack = [
        shop.shopName,
        villageOf(shop.id, shop.shopName, shopDirectory),
        assignment?.tripNo ?? "",
        assignment?.vehicleNo ?? "",
        statusLabelOf(shop.id, hasEntry),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
    list.sort((a, b) => {
      if (sortMode === "az") return a.shopName.localeCompare(b.shopName);
      if (sortMode === "za") return b.shopName.localeCompare(a.shopName);
      // Collected first, then alphabetically by shop name.
      const ca = collectedOf(a.id) ? 0 : 1;
      const cb = collectedOf(b.id) ? 0 : 1;
      return ca - cb || a.shopName.localeCompare(b.shopName);
    });
    return list;
  }, [shops, q, collection, readOnlyEntries, entries, isEditable, shopDirectory, statusLabelOf, sortMode, collectedOf]);

  // ── Pagination (existing global component; reset to page 1 when the
  //     filtered result or the day changes) ─────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(filteredShopList.length / PAGE_SIZE));
  const [page, setPage] = useState(1);
  const listKey = `${day}|${filteredShopList.length}|${q}|${sortMode}`;
  const [lastKey, setLastKey] = useState(listKey);
  if (lastKey !== listKey) {
    setLastKey(listKey);
    if (page !== 1) setPage(1);
  }
  const safePage = Math.min(page, totalPages);
  const pageShops = filteredShopList.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );
  const startIndex = filteredShopList.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE;

  // ── Render ────────────────────────────────────────────────────────────────
  // Past day with nothing collected: clean empty state (read-only by nature).
  if (isPast && !collection) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        {/* Controls only — the active tab already identifies the section. */}
        <div className="px-5 py-2.5 border-b border-slate-200 bg-slate-50/60 flex items-center gap-3 flex-wrap">
          <OrdersDateControl day={day} today={today} onDaySelect={onDaySelect} t={to} />
          <OrdersIconButton
            label={`${to("orders.refresh")} — ${to("orders.refresh_collection")}`}
            onClick={onRefresh}
            busy={refreshing}
          >
            <RefreshCw size={14} />
          </OrdersIconButton>
        </div>
        <OrdersEmptyState
          title={to("orders.no_orders_for_day", { date: formatDayFull(day) })}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        {/* Table-level controls: [Search][Date][Refresh][Sort] + compact
            status. No section heading — the active tab says it. No
            Previous/Next day buttons, no scroller. */}
        <div className="px-5 py-2.5 border-b border-slate-200 bg-slate-50/60 flex items-center gap-3 flex-wrap">
          <OrdersSearchInput
            value={query}
            onChange={setQuery}
            placeholder={to("orders.search_collection")}
            className="w-full sm:w-64"
          />
          <OrdersDateControl day={day} today={today} onDaySelect={onDaySelect} t={to} />
          <OrdersIconButton
            label={`${to("orders.refresh")} — ${to("orders.refresh_collection")}`}
            onClick={onRefresh}
            busy={refreshing}
          >
            <RefreshCw size={14} />
          </OrdersIconButton>
          <span className="text-[11px] font-semibold text-slate-400 whitespace-nowrap">
            {to("orders.sort")}
          </span>
          <OrdersFilterSelect
            value={sortMode}
            onChange={(v) => setSortMode(v as "collected" | "az" | "za")}
            options={sortOptions}
            ariaLabel={to("orders.sort")}
            className="w-44"
          />
          {isLocked && !isPast && (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 border border-slate-300 px-2 py-0.5 text-[11px] font-bold text-slate-600">
              <Lock size={11} />
              {to("orders.collection_complete")}
            </span>
          )}
          <span className="ml-auto text-[11px] font-semibold text-slate-400 whitespace-nowrap">
            {to("orders.collection_summary", {
              shops: totals.totalShops,
              boxes: totals.totalBoxes,
              birds: totals.totalBirds,
            })}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs md:text-sm">
            <thead>
              <tr className={opsTableHeadRowClass}>
                <th className={`${opsTableThClass} w-16`}>{to("orders.col_sno")}</th>
                <th className={opsTableThClass}>{to("orders.col_shop_name")}</th>
                <th className={opsTableThClass}>{to("orders.col_village")}</th>
                <th className={`${opsTableThClass} w-28`}>{to("orders.col_birds")}</th>
                <th className={`${opsTableThClass} w-28`}>{to("orders.col_boxes")} *</th>
                <th className={`${opsTableThClass} w-24 text-right`}>{to("orders.col_weight")}</th>
                <th className={`${opsTableThClass} w-32`}>{to("orders.col_status")}</th>
                <th className={`${opsTableThClass} w-20`}>{to("orders.col_action")}</th>
              </tr>
            </thead>
            <tbody className={opsTableDivideClass}>
              {pageShops.map((shop, index) => {
                const live = entries.get(shop.id);
                const ro = readOnlyEntries.get(shop.id);
                const birds = isEditable ? live?.birds ?? 0 : ro?.birds ?? 0;
                const boxes = isEditable ? live?.boxes ?? 0 : ro?.boxes ?? 0;
                const hasEntry = birds > 0 || boxes > 0;
                const assignment = collection?.shops.get(shop.id) ?? null;

                let statusNode: React.ReactNode = (
                  <span className="text-slate-300 text-xs">—</span>
                );
                if (hasEntry) {
                  if (!assignment) {
                    statusNode = (
                      <OrdersStatusBadge
                        status="Not Assigned"
                        label={to("orders.not_assigned")}
                      />
                    );
                  } else if (assignment.delivered) {
                    // Step 4 confirmed this shop was delivered → GREEN.
                    statusNode = (
                      <span
                        title={`${assignment.tripNo} · ${assignment.vehicleNo} · ${to("orders.seq_n", { n: assignment.sequence })}`}
                      >
                        <OrdersStatusBadge status="Delivered" label={to("orders.status_delivered")} />
                      </span>
                    );
                  } else {
                    // Compact indicator only — trip / vehicle / sequence
                    // live on hover; details belong to Tab 2 / Tab 3.
                    statusNode = (
                      <span
                        title={`${assignment.tripNo} · ${assignment.vehicleNo} · ${to("orders.seq_n", { n: assignment.sequence })}`}
                      >
                        <OrdersStatusBadge status="Assigned" label={to("orders.status_assigned")} />
                      </span>
                    );
                  }
                }

                return (
                  <tr key={shop.id} className={`${opsTableRowClass} align-middle`}>
                    <td className={opsTableTdClass}>
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-slate-50 text-[12px] font-bold text-slate-600">
                        {startIndex + index + 1}
                      </span>
                    </td>
                    <td className={`${opsTableTdClass} font-semibold text-slate-800`}>
                      {shop.shopName}
                    </td>
                    <td className={opsTableTdClass}>
                      {villageOf(shop.id, shop.shopName, shopDirectory) || "—"}
                    </td>
                    <td className={opsTableTdClass}>
                      {isEditable ? (
                        <input
                          type="number"
                          min={0}
                          value={birds || ""}
                          placeholder="0"
                          aria-label={`${to("orders.col_birds")} — ${shop.shopName}`}
                          onChange={(e) => updateEntry(shop.id, "birds", e.target.value)}
                          className="h-8 w-full rounded-lg border border-emerald-300/70 bg-emerald-50/50 px-2 text-sm font-bold text-emerald-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                        />
                      ) : (
                        <span className="font-bold text-slate-700">{hasEntry ? birds : "—"}</span>
                      )}
                    </td>
                    <td className={opsTableTdClass}>
                      {isEditable ? (
                        <input
                          type="number"
                          min={0}
                          value={boxes || ""}
                          placeholder="0"
                          aria-label={`${to("orders.col_boxes")} — ${shop.shopName}`}
                          onChange={(e) => updateEntry(shop.id, "boxes", e.target.value)}
                          className="h-8 w-full rounded-lg border border-emerald-300/70 bg-emerald-50/50 px-2 text-sm font-bold text-emerald-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                        />
                      ) : (
                        <span className="font-bold text-slate-700">{hasEntry ? boxes : "—"}</span>
                      )}
                    </td>
                    <td className={`${opsTableTdClass} text-right`}>
                      {assignment && assignment.avgBirdWeight > 0 && birds > 0 ? (
                        <span className="font-semibold text-slate-600">
                          {formatKg(weightForBirds(birds, assignment.avgBirdWeight))}
                        </span>
                      ) : (
                        <span
                          className="text-slate-400"
                          title={to("orders.weight_pending")}
                        >
                          —
                        </span>
                      )}
                    </td>
                    <td className={opsTableTdClass}>{statusNode}</td>
                    <td className={opsTableTdClass}>
                      {isEditable ? (
                        <button
                          type="button"
                          onClick={() => onClearClick(shop.id)}
                          disabled={!hasEntry || busy}
                          title={to("orders.clear_entry")}
                          aria-label={`${to("orders.clear_entry")} — ${shop.shopName}`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200/80 bg-white text-slate-400 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200 transition-colors disabled:opacity-30"
                        >
                          <Trash2 size={14} />
                        </button>
                      ) : (
                        <span className="text-slate-300 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {pageShops.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12">
                    <OrdersEmptyState
                      title={
                        q
                          ? to("orders.no_search_results")
                          : isPast
                            ? to("orders.no_orders_for_day", { date: formatDayFull(day) })
                            : to("orders.no_active_shops")
                      }
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Global pagination (existing component) */}
        {filteredShopList.length > PAGE_SIZE && (
          <div className="px-4 py-3 border-t border-slate-100">
            <TripPagination
              currentPage={safePage}
              totalPages={totalPages}
              onPageChange={setPage}
            />
          </div>
        )}

        {/* Footer actions (editable days only) */}
        {isEditable ? (
          <div className="border-t border-slate-200 bg-slate-50/70 px-5 py-3.5 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <button type="button" onClick={handleCancel} disabled={busy} className={opsSecondaryButtonClass}>
                {to("orders.cancel")}
              </button>
              {isDirty && (
                <span className="text-[11px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-1">
                  {to("orders.unsaved_changes")}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={busy || entered.length === 0}
                className={`${opsSecondaryButtonClass} border-emerald-300 text-emerald-700 hover:bg-emerald-50`}
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {saving ? to("orders.saving") : to("orders.save_progress")}
              </button>
              <button
                type="button"
                onClick={() => void handleFinish()}
                disabled={busy || entered.length === 0}
                className={opsPrimaryButtonClass}
              >
                {finishing ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                {finishing ? to("orders.submitting") : to("orders.finish_collection")}
              </button>
            </div>
          </div>
        ) : (
          <div className="border-t border-slate-200 bg-slate-50/70 px-5 py-3 flex items-center gap-2 text-[11px] font-semibold text-slate-500">
            <Lock size={13} />
            {isPast
              ? to("orders.read_only_note")
              : to("orders.finish_collection_locked")}
          </div>
        )}
      </div>

      {/* 10-second clear undo (existing global pattern) */}
      <PendingDeleteNotification items={pendingItems} onCancel={cancelDelete} />

      {/* Discard confirmation */}
      {confirmDiscard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" role="dialog" aria-modal="true">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden border border-emerald-200">
            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 p-6">
              <div className="flex items-start gap-4">
                <div className="mt-0.5 p-2 rounded-full bg-white/80 border border-emerald-200">
                  <X size={20} className="text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800">{to("orders.confirm_discard_title")}</h3>
                  <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">{to("orders.confirm_discard_message")}</p>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 bg-slate-50 border-t border-slate-100">
              <button type="button" onClick={() => setConfirmDiscard(false)} className="px-5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-sm font-medium text-slate-600 transition-all shadow-xs">
                {to("orders.cancel")}
              </button>
              <button type="button" onClick={applyDiscard} className="px-5 py-2 rounded-lg text-sm font-bold text-white shadow-xs transition-all active:scale-[0.98] bg-rose-600 hover:bg-rose-700 inline-flex items-center gap-2">
                {to("orders.discard")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default React.memo(OrdersCollectionTab);
