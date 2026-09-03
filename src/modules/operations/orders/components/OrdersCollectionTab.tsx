// src/modules/operations/orders/components/OrdersCollectionTab.tsx
// TAB 1 — ORDER COLLECTION (day-wise shop working sheet).
//
// For the selected date, EVERY active shop is shown — not just the shops that
// already have an order. The backend (GET /api/orders?date=…) anchors the
// query on the SHOP set and LEFT JOINs the day's order lines, so a shop with
// no entry yet still appears with empty birds/boxes inputs. A shop may hold
// MULTIPLE orders on the same day: each order is its own line with its own
// unique order number, and "Add order" creates another line for a shop.
//
//   · Save Progress            → POST /api/orders/collection (finish=false).
//     SAVES AND STAYS ON THIS TAB — it never navigates to Assignment, and it
//     never makes an order assignment-eligible.
//   · Finish Collection        → POST /api/orders/collection (finish=true).
//     Marks the day collected; only then does Assignment gain the data
//     (the BACKEND enforces the finish gate on every assignment write).
//   · Search / date / sort / filled-only / pagination are all SERVER-SIDE.
//   · A fully delivered order is LOCKED; a partially delivered order stays
//     editable down to its delivered quantity (backend re-validates on write).
//   · A network failure never silently loses the draft: it is kept locally,
//     shown as "Waiting to sync", and retried when the connection returns.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bird,
  Clock,
  FileText,
  Hash,
  Loader2,
  Lock,
  MapPin,
  Package,
  Pencil,
  Phone,
  RefreshCw,
  Save,
  Send,
  Store,
  Trash2,
  User,
  X,
} from "lucide-react";
import { toApiError } from "../../../../api";
import {
  opsPrimaryButtonClass,
  opsSecondaryButtonClass,
  opsTableDivideClass,
  opsTableRowClass,
} from "../../../../shared/ui/operationsStyles";
import { useToast } from "../../../../components/common/ToastProvider";
import { usePendingDelete } from "../../../../hooks/usePendingDelete";
import { PendingDeleteNotification } from "../../../../components/common/PendingDeleteNotification";
import {
  deleteOrder,
  saveOrderCollection,
  type CollectionItem,
  type OrderAssignmentView,
  type OrderView,
  type OrdersPage,
} from "../services/ordersApi";
import { useOrdersI18n } from "../i18n/ordersI18n";
import type { ShopDirectory } from "../ordersService";
import {
  OrdersDateControl,
  OrdersDropdown,
  OrdersEmptyState,
  OrdersFilledOnlyToggle,
  OrdersIconButton,
  OrdersPagination,
  OrdersSearchInput,
  OrdersStatusBadge,
  OrdersTableSkeleton,
} from "./OrdersCommon";

/** One working-sheet line: an existing order line, a shop placeholder, or a
 *  locally-added order line awaiting its first save. */
type Line = {
  key: string;
  shopId: number;
  shopName: string;
  city: string;
  orderId: number;
  orderNo: string;
  clientKey?: string;
  version?: number;
  baseRequired: number;
  baseBirds: number;
  locked: boolean;
  autoFinished: boolean;
  assignedBoxes: number;
  deliveredBoxes: number;
  pendingBoxes: number;
  remainingBoxes: number;
  status: OrderView["status"];
  assignments: OrderAssignmentView[];
  isNew: boolean;
};

type NewLine = { key: string; shopId: number; shopName: string; clientKey: string };

type DraftValues = { requiredBoxes: number; birds: number };

type Props = {
  page: OrdersPage;
  loading: boolean;
  day: string;
  today: string;
  shopDirectory: ShopDirectory;
  onDaySelect: (day: string) => void;
  search: string;
  onSearchChange: (value: string) => void;
  sort: string;
  onSortChange: (value: string) => void;
  filledOnly: boolean;
  onFilledOnlyChange: (value: boolean) => void;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onReload: () => Promise<unknown> | void;
  onRefresh: () => void;
  refreshing: boolean;
};

function statusKeyOf(status: OrderView["status"]): string {
  switch (status) {
    case "Not Collected":
      return "orders.status_not_collected";
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

/** Simplified Collection status: Saved → Assigned → Partially Delivered →
 *  Delivered (derived from authoritative quantities, never recomputed). */
function derivedStatusOf(line: Line): string {
  if (!line.orderId && !line.isNew) return "none";
  if (line.isNew) return "draft";
  if (line.deliveredBoxes > 0 && line.deliveredBoxes >= line.baseRequired && line.baseRequired > 0) {
    return "delivered";
  }
  if (line.deliveredBoxes > 0) return "partial";
  if (line.assignedBoxes > 0) return "assigned";
  return "saved";
}

function statusLabelOf(status: string, to: (key: string) => string): string {
  switch (status) {
    case "draft":
    case "none":
      return "—";
    case "saved":
      return "Saved";
    case "assigned":
      return "Assigned";
    case "partial":
      return "Partially Delivered";
    case "delivered":
      return "Delivered";
    default:
      return to(statusKeyOf(status as OrderView["status"]));
  }
}

function draftStorageKey(day: string): string {
  return `dmr.orders.collection.draft.${day}`;
}

// Compact, readable working-sheet cell styles (fixed paddings, medium weight —
// no over-bold shop names, no oversized columns). Header uses a light green
// brand tint with medium weight, slightly stronger contrast than the body.
const colTh = "px-2.5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-emerald-900/80 whitespace-nowrap";
const colThRight = "px-2.5 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-emerald-900/80 whitespace-nowrap";
const colTd = "px-2.5 py-2 text-[13px] text-slate-700 whitespace-nowrap";
const colTdRight = "px-2.5 py-2 text-[13px] text-slate-700 whitespace-nowrap text-right tabular-nums";

export default function OrdersCollectionTab({
  page,
  loading,
  day,
  today,
  shopDirectory,
  onDaySelect,
  search,
  onSearchChange,
  sort,
  onSortChange,
  filledOnly,
  onFilledOnlyChange,
  pageSize,
  onPageChange,
  onPageSizeChange,
  onReload,
  onRefresh,
  refreshing,
}: Props) {
  const { to } = useOrdersI18n();
  const { success: toastSuccess, error: toastError, info: toastInfo } = useToast();

  const [draft, setDraft] = useState<Map<string, DraftValues>>(new Map());
  const [addedLines, setAddedLines] = useState<NewLine[]>([]);
  const [saving, setSaving] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [waitingToSync, setWaitingToSync] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const busy = saving || finishing;

  const isPast = day < today;
  const autoFinished = page.summary.autoFinished;
  const dayEditable = !isPast && !autoFinished;

  // Refs mirror the latest state so the offline "online" retry always reads
  // fresh values (no stale closure).
  const draftRef = useRef(draft);
  const addedLinesRef = useRef(addedLines);
  const pendingFinishRef = useRef(false);
  // Hard guard against duplicate/racing submits (double-click, tab switch,
  // retry and a manual click arriving in the same tick).
  const saveInFlightRef = useRef(false);
  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);
  useEffect(() => {
    addedLinesRef.current = addedLines;
  }, [addedLines]);

  // ── Build the display lines (server order lines + local additions) ──────
  const serverLines = useMemo<Line[]>(
    () =>
      page.rows.map((row) => ({
        key: row.id > 0 ? `o:${row.id}` : `s:${row.shopId}`,
        shopId: row.shopId,
        shopName: row.shopName,
        city: row.city,
        orderId: row.id,
        orderNo: row.orderNo,
        version: row.version,
        baseRequired: row.requiredBoxes,
        baseBirds: row.birds,
        locked: row.locked,
        autoFinished: row.autoFinished,
        assignedBoxes: row.assignedBoxes,
        deliveredBoxes: row.deliveredBoxes,
        pendingBoxes: row.pendingBoxes,
        remainingBoxes: row.remainingBoxes,
        status: row.status,
        assignments: row.assignments,
        isNew: false,
      })),
    [page.rows]
  );

  const addedLineObjs = useMemo<Line[]>(
    () =>
      addedLines.map((al) => ({
        key: al.key,
        shopId: al.shopId,
        shopName: al.shopName,
        city: page.rows.find((r) => r.shopId === al.shopId)?.city ?? "",
        orderId: 0,
        orderNo: "",
        clientKey: al.clientKey,
        version: undefined,
        baseRequired: 0,
        baseBirds: 0,
        locked: false,
        autoFinished: false,
        assignedBoxes: 0,
        deliveredBoxes: 0,
        pendingBoxes: 0,
        remainingBoxes: 0,
        status: "Not Collected" as OrderView["status"],
        assignments: [],
        isNew: true,
      })),
    [addedLines, page.rows]
  );

  const lines = useMemo(() => [...serverLines, ...addedLineObjs], [serverLines, addedLineObjs]);

  const filteredLines = useMemo(() => {
    if (statusFilter === "all") return lines;
    return lines.filter((line) => derivedStatusOf(line) === statusFilter);
  }, [lines, statusFilter]);

  const valueOf = useCallback(
    (line: Line, field: "requiredBoxes" | "birds"): number => {
      const d = draft.get(line.key);
      if (d) return d[field];
      return field === "requiredBoxes" ? line.baseRequired : line.baseBirds;
    },
    [draft]
  );

  const updateDraft = useCallback((line: Line, field: "requiredBoxes" | "birds", raw: string) => {
    const n = Math.max(0, Math.min(99999, Math.floor(Number(raw) || 0)));
    setDraft((prev) => {
      const next = new Map(prev);
      const current = next.get(line.key) ?? {
        requiredBoxes: line.baseRequired,
        birds: line.baseBirds,
      };
      next.set(line.key, { ...current, [field]: n });
      return next;
    });
  }, []);

  const isDirty = draft.size > 0 || addedLines.length > 0;

  /** Payload for every line the user actually changed or added (partial save). */
  const buildItems = useCallback((): CollectionItem[] => {
    const items: CollectionItem[] = [];
    for (const line of lines) {
      if (line.isNew) {
        const d = draft.get(line.key);
        const requiredBoxes = d?.requiredBoxes ?? 0;
        const birds = d?.birds ?? 0;
        if (requiredBoxes <= 0 && birds <= 0) continue;
        items.push({
          shopId: line.shopId,
          requiredBoxes,
          birds,
          clientKey: line.clientKey,
        });
        continue;
      }
      if (!draft.has(line.key)) continue;
      const d = draft.get(line.key)!;
      items.push({
        orderId: line.orderId > 0 ? line.orderId : undefined,
        shopId: line.shopId,
        requiredBoxes: d.requiredBoxes,
        birds: d.birds,
        version: line.orderId > 0 ? line.version : undefined,
      });
    }
    return items;
  }, [lines, draft]);

  /** Existing order lines that carry data (used to re-confirm on Finish). */
  const filledItems = useCallback((): CollectionItem[] => {
    const items: CollectionItem[] = [];
    for (const line of serverLines) {
      if (line.locked) continue;
      if (line.baseRequired <= 0 && line.baseBirds <= 0) continue;
      items.push({
        orderId: line.orderId,
        shopId: line.shopId,
        requiredBoxes: line.baseRequired,
        birds: line.baseBirds,
        version: line.version,
      });
    }
    return items;
  }, [serverLines]);

  // ── Local draft persistence (network-failure protection) ────────────────
  const persistLocalDraft = useCallback(() => {
    try {
      const snapshot = {
        draft: Object.fromEntries(draftRef.current),
        addedLines: addedLinesRef.current,
      };
      localStorage.setItem(draftStorageKey(day), JSON.stringify(snapshot));
    } catch {
      /* storage full/unavailable — draft still lives in React state */
    }
  }, [day]);

  const clearLocalDraft = useCallback(() => {
    try {
      localStorage.removeItem(draftStorageKey(day));
    } catch {
      /* ignore */
    }
  }, [day]);

  const restoreLocalDraft = useCallback((): boolean => {
    try {
      const raw = localStorage.getItem(draftStorageKey(day));
      if (!raw) return false;
      const parsed = JSON.parse(raw) as {
        draft?: Record<string, DraftValues>;
        addedLines?: NewLine[];
      };
      if (parsed.draft && Object.keys(parsed.draft).length > 0) {
        setDraft(new Map(Object.entries(parsed.draft)));
      }
      if (Array.isArray(parsed.addedLines) && parsed.addedLines.length > 0) {
        setAddedLines(parsed.addedLines);
      }
      return (
        (parsed.draft && Object.keys(parsed.draft).length > 0) ||
        (Array.isArray(parsed.addedLines) && parsed.addedLines.length > 0)
      );
    } catch {
      return false;
    }
  }, [day]);

  // Restore any unsaved draft when the day changes (or on first mount). The
  // restore is deferred out of the synchronous effect body (React state must
  // not be written synchronously in an effect).
  useEffect(() => {
    const timer = window.setTimeout(() => {
      // The working sheet changed — never keep a stale per-row edit open.
      setEditingKey(null);
      if (restoreLocalDraft()) {
        setWaitingToSync(true);
        toastInfo(to("orders.draft_restored"), 5000);
      }
    }, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day]);

  const persist = useCallback(
    async (finish: boolean) => {
      if (saveInFlightRef.current || busy || !dayEditable) return;
      let items = buildItems();

      if (finish) {
        if (items.length === 0) items = filledItems();
        if (items.length === 0) {
          toastInfo(to("orders.add_at_least_one_shop"), 5000);
          return;
        }
      } else if (items.length === 0) {
        toastInfo(to("orders.nothing_to_save"), 5000);
        return;
      }

      saveInFlightRef.current = true;
      const setBusy = finish ? setFinishing : setSaving;
      setBusy(true);
      try {
        await saveOrderCollection({ orderDate: day, items, finish });
        clearLocalDraft();
        setDraft(new Map());
        setAddedLines([]);
        setEditingKey(null);
        setWaitingToSync(false);
        await onReload();
        toastSuccess(finish ? to("orders.collection_finished") : to("orders.collection_saved"), 5000);
      } catch (error) {
        const apiErr = toApiError(error);
        const isNetwork =
          apiErr.code === "NETWORK_ERROR" || apiErr.code === "TIMEOUT" || apiErr.status == null;
        if (isNetwork) {
          // Keep the draft, mark "Waiting to sync", and let the online event
          // retry automatically. Never claim "saved" while offline.
          pendingFinishRef.current = finish;
          persistLocalDraft();
          setWaitingToSync(true);
          toastError(to("orders.offline_waiting"), 5000);
        } else {
          // Validation / conflict: keep the draft so the user can fix it, and
          // pull authoritative state so a stale row can never linger.
          if (apiErr.status === 409) toastError(to("orders.conflict_refresh"), 5000);
          else toastError(apiErr.message || to("orders.save_failed"), 5000);
          await onReload();
        }
      } finally {
        saveInFlightRef.current = false;
        setBusy(false);
      }
    },
    [busy, dayEditable, buildItems, filledItems, day, clearLocalDraft, persistLocalDraft, onReload, to, toastSuccess, toastError, toastInfo]
  );

  // Auto-retry the pending save when the connection returns.
  const persistRef = useRef(persist);
  useEffect(() => {
    persistRef.current = persist;
  }, [persist]);

  useEffect(() => {
    if (!waitingToSync) return;
    const onOnline = () => {
      void persistRef.current(pendingFinishRef.current);
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [waitingToSync]);

  // ── Delete a PENDING line (10-second undo, then the real DELETE) ────────
  const doDelete = useCallback(
    async (orderId: number) => {
      try {
        await deleteOrder(orderId);
        await onReload();
        toastSuccess(to("orders.entry_deleted"), 5000);
      } catch (error) {
        toastError(toApiError(error).message || to("orders.delete_failed"), 5000);
        await onReload();
      }
    },
    [onReload, to, toastSuccess, toastError]
  );

  const { requestDelete, cancel: cancelDelete, pendingItems } = usePendingDelete<number>(
    (id) => void doDelete(id)
  );
  const pendingIds = useMemo(() => new Set(pendingItems.map((p) => p.id)), [pendingItems]);

  const sortOptions = useMemo(
    () => [
      { value: "shopNameAsc", label: to("orders.sort_shop_az") },
      { value: "shopNameDesc", label: to("orders.sort_shop_za") },
      { value: "cityAsc", label: to("orders.sort_city_az") },
      { value: "cityDesc", label: to("orders.sort_city_za") },
      { value: "requiredBoxesDesc", label: to("orders.sort_required_desc") },
      { value: "requiredBoxesAsc", label: to("orders.sort_required_asc") },
      { value: "loadedDesc", label: to("orders.sort_loaded_desc") },
      { value: "pendingDesc", label: to("orders.sort_pending_desc") },
      { value: "deliveredDesc", label: to("orders.sort_delivered_desc") },
      { value: "remainingDesc", label: to("orders.sort_remaining_desc") },
    ],
    [to]
  );

  const startIndex = (page.page - 1) * page.pageSize;

  const emptyTitle = search.trim()
    ? to("orders.no_search_results")
    : to("orders.no_shops_available");

  return (
    <div className="w-full space-y-3">
      {/* Main container — mirrors the Master Shops spacing rhythm */}
      <div className="w-full bg-white rounded-xl border border-slate-200/90 shadow-sm">
        {/* Filter toolbar */}
        <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50/40 rounded-t-xl">
          <div className="flex items-center gap-3 flex-wrap">
            <OrdersDateControl day={day} today={today} onDaySelect={onDaySelect} t={to} />
            <OrdersDropdown
              value={sort}
              onChange={onSortChange}
              options={sortOptions}
              ariaLabel={to("orders.sort_by")}
              widthClass="w-52"
            />
            <OrdersDropdown
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: "all", label: "All Statuses" },
                { value: "saved", label: "Saved" },
                { value: "assigned", label: "Assigned" },
                { value: "partial", label: "Partially Delivered" },
                { value: "delivered", label: "Delivered" },
              ]}
              ariaLabel="Status"
              widthClass="w-40"
            />
            <OrdersFilledOnlyToggle
              checked={filledOnly}
              onChange={onFilledOnlyChange}
              label={to("orders.filled_only")}
              ariaLabel={to("orders.filled_only")}
            />
            <OrdersSearchInput
              value={search}
              onChange={onSearchChange}
              placeholder={to("orders.search_collection")}
              className="w-full sm:w-64"
            />
            <div className="ml-auto">
              <OrdersIconButton
                label={`${to("orders.refresh")} — ${to("orders.refresh_collection")}`}
                onClick={onRefresh}
                busy={refreshing}
              >
                <RefreshCw size={14} />
              </OrdersIconButton>
            </div>
          </div>
        </div>

        {/* Summary / status bar */}
        <div className="px-4 py-2 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between gap-3 flex-wrap text-xs text-slate-600">
          <span className="inline-flex items-center gap-1.5">
            <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
              Today
            </span>
            <span>
              <span className="font-bold text-slate-800">{page.summary.totalShops}</span> shops
            </span>
            <span className="text-slate-300">·</span>
            <span>
              <span className="font-bold text-emerald-700">{page.summary.shopsWithOrders}</span> shops with orders
            </span>
            <span className="text-slate-300">·</span>
            <span>
              <span className="font-bold text-sky-700">{page.summary.totalRequiredBoxes}</span> boxes
            </span>
          </span>
        </div>
        {/* Auto-completed collection (finished at the daily cutoff). */}
        {autoFinished && (
          <div className="px-4 py-2 border-b border-emerald-200 bg-emerald-50/70 text-[11px] font-semibold text-emerald-700 flex items-center gap-1.5">
            <Lock size={12} aria-hidden />
            {to("orders.auto_finished_note")}
          </div>
        )}

        {/* Waiting-to-sync banner (draft kept locally, not yet on the server). */}
        {waitingToSync && (
          <div className="px-4 py-2 border-b border-amber-200 bg-amber-50/60 text-[11px] font-semibold text-amber-700 flex items-center gap-1.5">
            <Loader2 size={12} className="animate-spin" aria-hidden />
            {to("orders.offline_waiting")}
          </div>
        )}

        {/* ── Working-sheet table (ALL shops, editable in-place) ────────── */}
        {loading ? (
          <OrdersTableSkeleton rows={8} />
        ) : filteredLines.length === 0 ? (
          <OrdersEmptyState title={emptyTitle} hint={to("orders.working_sheet_hint")} />
        ) : (
          <div className="p-0 relative min-h-[120px]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px]">
              <thead className="border-b border-slate-200 bg-white">
                <tr>
                  <th className={`${colTh} w-12`}>
                    <span className="inline-flex items-center gap-1">
                      <Hash size={12} className="text-slate-400" />
                      {to("orders.col_sno")}
                    </span>
                  </th>
                  <th className={`${colTh} min-w-[170px]`}>
                    <span className="inline-flex items-center gap-1">
                      <Store size={12} className="text-indigo-500" />
                      {to("orders.col_shop_name")}
                    </span>
                  </th>
                  <th className={colTh}>
                    <span className="inline-flex items-center gap-1">
                      <User size={12} className="text-violet-500" />
                      {to("orders.col_owner")}
                    </span>
                  </th>
                  <th className={colTh}>
                    <span className="inline-flex items-center gap-1">
                      <Phone size={12} className="text-emerald-500" />
                      {to("orders.col_mobile")}
                    </span>
                  </th>
                  <th className={colTh}>
                    <span className="inline-flex items-center gap-1">
                      <MapPin size={12} className="text-sky-500" />
                      {to("orders.col_city")}
                    </span>
                  </th>
                  <th className={colTh}>
                    <span className="inline-flex items-center gap-1">
                      <FileText size={12} className="text-emerald-500" />
                      {to("orders.col_order_no")}
                    </span>
                  </th>
                  <th className={colThRight}>
                    <span className="inline-flex items-center justify-end gap-1">
                      <Bird size={12} className="text-blue-500" />
                      {to("orders.col_birds")}
                    </span>
                  </th>
                  <th className={colThRight}>
                    <span className="inline-flex items-center justify-end gap-1">
                      <Package size={12} className="text-blue-500" />
                      {to("orders.col_required_boxes")}
                    </span>
                  </th>
                  <th className={`${colTh} text-center`}>
                    <span className="inline-flex items-center gap-1">
                      <Clock size={12} className="text-slate-400" />
                      {to("orders.col_status")}
                    </span>
                  </th>
                  <th className={`${colTh} text-right`}>
                    <span className="inline-flex items-center justify-end gap-1">
                      <Send size={12} className="text-slate-400" />
                      {to("orders.col_action")}
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody className={opsTableDivideClass}>
                {filteredLines.map((line, index) => {
                  const rowLocked = line.locked || line.assignments.some((a) => a.tripLocked);
                  const hasOrder = line.orderId > 0;
                  const editable = dayEditable && !rowLocked && !pendingIds.has(line.orderId) && editingKey === line.key;
                  const required = valueOf(line, "requiredBoxes");
                  const birds = valueOf(line, "birds");
                  const derivedStatus = derivedStatusOf(line);
                  return (
                    <tr
                      key={line.key}
                      className={`${opsTableRowClass} ${
                        pendingIds.has(line.orderId) ? "opacity-40" : ""
                      }`}
                    >
                      <td className={`${colTd} text-slate-400`}>{startIndex + index + 1}</td>
                      <td className={`${colTd} font-bold text-slate-800`}>
                        <span className="inline-flex items-center gap-1.5">
                          {rowLocked && <Lock size={11} className="text-slate-400" aria-hidden />}
                          {line.shopName}
                        </span>
                      </td>
                      <td className={colTd}>{shopDirectory.get(line.shopId)?.ownerName || "—"}</td>
                      <td className={`${colTd} tabular-nums`}>
                        {shopDirectory.get(line.shopId)?.mobile || "—"}
                      </td>
                      <td className={colTd}>{line.city || "—"}</td>
                      <td className={`${colTd} font-mono text-[11px] text-slate-500`}>
                        {hasOrder ? line.orderNo : "—"}
                      </td>
                      <td className={colTdRight}>
                        {editable ? (
                          <input
                            type="number"
                            min={0}
                            value={birds || ""}
                            aria-label={`${to("orders.col_birds")} — ${line.shopName}`}
                            onChange={(e) => updateDraft(line, "birds", e.target.value)}
                            className="no-spinner h-7 w-16 rounded-md border border-slate-200 px-2 text-right text-xs"
                          />
                        ) : (
                          <span>{line.baseBirds || "—"}</span>
                        )}
                      </td>
                      <td className={colTdRight}>
                        {editable ? (
                          <input
                            type="number"
                            min={hasOrder ? Math.max(1, line.deliveredBoxes, line.assignedBoxes) : 0}
                            value={required || ""}
                            aria-label={`${to("orders.col_required_boxes")} — ${line.shopName}`}
                            onChange={(e) => updateDraft(line, "requiredBoxes", e.target.value)}
                            className="no-spinner h-7 w-16 rounded-md border border-emerald-300 px-2 text-right text-xs font-semibold"
                          />
                        ) : (
                          <span className="font-semibold">{line.baseRequired}</span>
                        )}
                      </td>
                      <td className={`${colTd} text-center`}>
                        <OrdersStatusBadge status={line.autoFinished ? "Auto Completed" : line.status} label={statusLabelOf(derivedStatus, to)} />
                      </td>
                      <td className={`${colTd} text-right`}>
                        {editingKey === line.key ? (
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              title={to("orders.cancel")}
                              aria-label={to("orders.cancel")}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40"
                              disabled={busy}
                              onClick={() => setEditingKey(null)}
                            >
                              <X size={14} />
                            </button>
                            <button
                              type="button"
                              title={to("orders.save")}
                              aria-label={to("orders.save")}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40"
                              disabled={busy || !isDirty}
                              onClick={() => void persist(false)}
                            >
                              <Save size={14} />
                            </button>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1">
                            <OrdersIconButton
                              label={to("orders.edit_entry", { shop: line.shopName })}
                              disabled={!dayEditable || rowLocked || busy}
                              onClick={() => setEditingKey(line.key)}
                            >
                              <Pencil size={13} />
                            </OrdersIconButton>
                            <OrdersIconButton
                              label={to("orders.delete_entry", { shop: line.shopName })}
                              tone="rose"
                              disabled={!dayEditable || !hasOrder || rowLocked || busy}
                              onClick={() =>
                                requestDelete(line.orderId, {
                                  label: to("orders.delete_entry", { shop: line.shopName }),
                                })
                              }
                            >
                              <Trash2 size={13} />
                            </OrdersIconButton>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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

        {/* ── Footer actions ───────────────────────────────────────────── */}
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
                setAddedLines([]);
                clearLocalDraft();
                setWaitingToSync(false);
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
