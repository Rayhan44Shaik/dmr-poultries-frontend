// src/modules/orders/pages/OrderCollectionPage.tsx
// ORDER COLLECTION — the day-based collection screen of the Orders module
// (/operations/orders/collection, reached from the sidebar group "Orders").
//
// Shows the shops collected for the SELECTED OPERATIONAL DAY. A day accepts
// entries for 48h from its start — 16/09 is still editable on 17/09 and is
// AUTO-CLOSED AND AUTO-SUBMITTED at 18/09 12:00 AM (see
// ordersUtils.isCollectionAutoClosed / collectionAutoSubmitDelay). There is no
// "Finish Collection" and no "Cancel": the only explicit action is
// Save Progress, and the deadline files the day by itself. Closed days,
// finished days and fully-assigned days are READ-ONLY (locked, view only —
// no edit, no boxes/birds, no reorder, no assignment changes here). The day is
// chosen with the single global date selector — no Previous/Next day buttons,
// no date-card scroller.
//
// Filters mirror the Trip List layout exactly: day + city on the first row,
// sort / search / reset on a 12-column second row, each field labelled with its
// own icon.
//
// The table's job is to COLLECT THE SHOP ORDER: S.No, Shop, City, Birds
// (optional), Boxes (mandatory), Weight, Status, Clear. Trip and vehicle are
// deliberately NOT columns here — they belong to Assignment, and an assigned
// shop only shows a compact status (details on hover).
//
// The day's cumulative total sits BELOW the table (how many shops had orders
// taken, with birds / boxes / kg muted next to it), not in the header.
//
// One compact table-level search filters the shop list (shop, village,
// status); results are paginated.
//
// Persistence (existing API, no local-only state):
//   Save Progress → POST /trips/:idOr0/steps/deliveries (mode save)
//   deadline      → same call + startStepSubmitted (the clock submits the day)
// Refreshing the page always reproduces the saved collection.

import React, {
  type ComponentType,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Activity,
  ArrowUpDown,
  Bird,
  Boxes,
  Calendar,
  ClipboardList,
  Clock,
  Eraser,
  Hash,
  Loader2,
  Lock,
  MapPin,
  RotateCcw,
  Save,
  Scale,
  Store,
  Undo2,
} from "lucide-react";
import type { Shop } from "../../masters/shops/types/shop";
import type { Trip } from "../../../shared/trip";
import {
  opsFilterCardClass,
  opsSecondaryButtonClass,
  opsTableDivideClass,
  opsTableHeadRowClass,
} from "../../../shared/ui/operationsStyles";
import { BrandRefreshButton, Pagination } from "../../../ui";
import { useSafeNotification } from "../../../hooks/useSafeNotification";
import { usePendingDelete } from "../../../hooks/usePendingDelete";
import { PendingDeleteNotification } from "../../../components/common/PendingDeleteNotification";
import { PENDING_DELETE_SECONDS } from "../../../shared/ui/pendingDelete";
import {
  COLLECTION_GRACE_DAYS,
  collectionAutoSubmitDelay,
  collectionTotals,
  formatCollectionDeadline,
  formatCountdown,
  formatDayFull,
  formatKg,
  isCollectionAutoClosed,
  rowBoxes,
  weightForBirds,
} from "../utils/ordersUtils";
import { handleApiError } from "../../../api";
import {
  finishCollection,
  saveCollection,
  toEditorRows,
  villageOf,
  type ShopDirectory,
} from "../services/ordersService";
import { useOrdersI18n } from "../i18n/ordersI18n";
import {
  compareAssignmentRows,
  type AssignmentSort,
} from "../utils/assignmentSort";
import type { OrderShopRow, OrdersDayCollection } from "../types";
import {
  ORDERS_FILTER_LABEL_CLASS,
  ORDERS_TABLE_FONT_CLASS,
  ORDERS_TABLE_TD_CLASS as opsTableTdClass,
  ORDERS_TABLE_TH_CLASS as opsTableThClass,
  ordersTableZebraRow,
} from "../utils/ordersTableStyles";
import {
  ORDERS_NO_SPINNER,
  OrdersDateControl,
  OrdersEmptyState,
  OrdersDropdown,
  OrdersMultiSelect,
  OrdersSearchInput,
  OrdersStatusBadge,
  OrdersTableSkeleton,
  onOrdersNumberWheel,
} from "../components/OrdersCommon";

/** Fixed page size — 10 rows per page (global pagination component). */

/**
 * Badge + its pending count. The count is a separate, muted piece (not part of
 * the pill) so the equal-width columns never get pushed apart by a long label;
 * it wraps under the badge when the column is narrow.
 */
function StatusWithNote({
  status,
  label,
  note,
}: {
  status: string;
  label: string;
  note: string;
}) {
  return (
    <span className="inline-flex max-w-full flex-wrap items-center gap-x-1.5 gap-y-0.5">
      <OrdersStatusBadge status={status} label={label} />
      <span className="text-[10.5px] font-bold tabular-nums text-amber-600">
        {note}
      </span>
    </span>
  );
}

const ORDER_REMARKS = "[ORDER]";

type ColIcon = ComponentType<{
  size?: number | string;
  className?: string;
  "aria-hidden"?: boolean;
}>;

/**
 * Column header with its icon — the exact Trip List pattern (14px glyph, 6px
 * gap, uppercase label, same header padding), so every Orders column reads
 * with the same spacing as the trip table it sits beside.
 */
function ColHead({
  icon: Icon,
  label,
  align = "left",
  tone = "text-slate-400",
}: {
  icon: ColIcon;
  label: string;
  align?: "left" | "right" | "center";
  /** Per-column colour so the header scans by eye, the way the app's icons do. */
  tone?: string;
}) {
  return (
    <span
      className={`flex items-center gap-2${
        align === "right"
          ? " justify-end"
          : align === "center"
            ? " justify-center"
            : ""
      }`}
    >
      <Icon size={15} className={`${tone} flex-shrink-0`} aria-hidden />
      <span>{label}</span>
    </span>
  );
}

/** setTimeout rolls over past ~24.8 days — longer waits are not armed. */
const MAX_TIMEOUT_MS = 2 ** 31 - 1;

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
      .sort((a, b) => a[0] - b[0]),
  );
}

/** Build the initial entries map + snapshot from the day's collection. */
function buildInitial(
  shops: Shop[],
  dayCollection: OrdersDayCollection | null,
): { map: Map<number, EntryRow>; snapshot: string } {
  const map = new Map<number, EntryRow>();
  for (const shop of shops) {
    map.set(shop.id, {
      clientKey: newClientKey(),
      id: 0,
      shopId: shop.id,
      shopName: shop.shopName,
      // Shop Master redesign renamed `village` to `city` — same locality value.
      village: shop.city,
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

function toOrderShopRows(
  rows: EntryRow[],
  keepZeroFor: number | null = null,
): OrderShopRow[] {
  return (
    rows
      // A row normally rides along only when it holds something. `keepZeroFor` is
      // how "clear" persists a shop at zero instead of deleting its line.
      .filter((r) => r.birds > 0 || r.boxes > 0 || r.shopId === keepZeroFor)
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
      }))
  );
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

type CollectionSort =
  "collected" | "status" | Exclude<AssignmentSort, "pending" | "sequence">;

type CollectionFilters = {
  cityFilters: string[];
  setCityFilters: (values: string[]) => void;
  query: string;
  setQuery: (value: string) => void;
  sortMode: CollectionSort;
  setSortMode: (value: CollectionSort) => void;
  pageSize: number;
  setPageSize: (value: number) => void;
};

function OrderCollectionPage(props: Props) {
  const { to } = useOrdersI18n();
  const { shops, shopsLoading } = props;
  const [query, setQuery] = useState("");
  const [cityFilters, setCityFilters] = useState<string[]>([]);
  const [sortMode, setSortMode] = useState<CollectionSort>("collected");
  const [pageSize, setPageSize] = useState(10);

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
  return (
    <CollectionEntries
      key={props.day}
      {...props}
      query={query}
      setQuery={setQuery}
      cityFilters={cityFilters}
      setCityFilters={setCityFilters}
      sortMode={sortMode}
      setSortMode={setSortMode}
      pageSize={pageSize}
      setPageSize={setPageSize}
    />
  );
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
  cityFilters,
  setCityFilters,
  query,
  setQuery,
  sortMode,
  setSortMode,
  pageSize,
  setPageSize,
}: Omit<Props, "shopsLoading"> & CollectionFilters) {
  const { to } = useOrdersI18n();
  const { showNotification } = useSafeNotification();

  // A day stays editable for 48h from its start — the 04/09 collection is
  // still open on 05/09 and AUTO-CLOSES at 06/09 12:00 AM, finished or not.
  const isAutoClosed = isCollectionAutoClosed(day);
  const isPast = day < today;

  // The chip ticks (30s) so the closing moment is something you can watch
  // moving, not a date to interpret. One interval, and only while the day can
  // still be edited — a closed day has nothing left to count down to.
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (isAutoClosed) return;
    const id = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, [isAutoClosed]);
  const autoSubmitDeadline = formatCollectionDeadline(day);
  const autoSubmitRemainingMs =
    collectionAutoSubmitDelay(day, new Date(nowMs)) ?? 0;
  const autoSubmitRemaining = formatCountdown(autoSubmitRemainingMs);
  const autoSubmitProgressPct = Math.min(
    100,
    Math.max(
      0,
      Math.round(
        100 -
          (autoSubmitRemainingMs / (COLLECTION_GRACE_DAYS * 86_400_000)) * 100,
      ),
    ),
  );
  const isLocked =
    isAutoClosed ||
    Boolean(collection?.finished) ||
    Boolean(collection?.fullyAssigned);
  const isEditable = !isLocked;

  // ── Entries (local editing state, seeded from the day's collection) ──
  const initial = useMemo(
    () => buildInitial(shops, collection),
    [shops, collection],
  );
  const [entries, setEntries] = useState<Map<number, EntryRow>>(initial.map);
  // The auto-submit timer reads the rows through this ref, so typing never
  // re-arms the deadline timer (and the timer never holds stale rows).
  const entriesRef = useRef(entries);
  useEffect(() => {
    entriesRef.current = entries;
  }, [entries]);
  const [savedSnapshot, setSavedSnapshot] = useState<string>(initial.snapshot);

  const isDirty = useMemo(
    () =>
      !isLocked &&
      entrySnapshot(Array.from(entries.values())) !== savedSnapshot,
    [entries, savedSnapshot, isLocked],
  );

  const [lastServerSnapshot, setLastServerSnapshot] = useState(
    initial.snapshot,
  );
  if (lastServerSnapshot !== initial.snapshot) {
    setLastServerSnapshot(initial.snapshot);
    if (!isDirty) {
      setEntries(initial.map);
      setSavedSnapshot(initial.snapshot);
    }
  }

  // ── Container identity (one container per day — reuse or create today) ──
  const containerRef = useRef<{ id: number | null; tripNo: string | null }>({
    id: collection?.trip.id ?? null,
    tripNo:
      collection?.trip.tripNo ??
      (day === today && nextTripNo ? nextTripNo : null),
  });

  // ── Busy flags (double-submit protection) ────────────────────────────────
  const [saving, setSaving] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const persistLockRef = useRef(false);
  const busy = saving || finishing || refreshing;

  const entered = useMemo(
    () =>
      Array.from(entries.values()).filter((r) => r.birds > 0 || r.boxes > 0),
    [entries],
  );
  const totals = useMemo(
    () => collectionTotals(toOrderShopRows(entered)),
    [entered],
  );

  // The day's own average bird weight comes from the collection container, so
  // an ordered row shows its weight before it is assigned to a vehicle (the
  // vehicle's own average takes over once the row has an assignment).
  const dayAvgBirdWeight = Number(collection?.trip.avgBirdWeight) || 0;

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
    [],
  );

  // ── Clear a row: zero the order, never remove the shop ───────────────────
  // The Action column is not a delete. The shop keeps its place on the sheet
  // and its birds and boxes go to zero — weight follows, since it is read from
  // the birds. Like a pending trip in the Recent table, the click opens a
  // 10-second window: Undo puts the numbers back and nothing is written until
  // the window runs out.
  const doClear = useCallback(
    async (shopId: number) => {
      if (persistLockRef.current) return;
      const row = entries.get(shopId);
      if (!row) return;
      const next = new Map(entries);
      next.set(shopId, { ...row, birds: 0, boxes: 0 });
      if (row.id === 0) {
        // Nothing on the server yet — zero locally and let Save Progress carry it.
        setEntries(next);
        showNotification(
          to("orders.entry_cleared", { shop: row.shopName }),
          "success",
        );
        return;
      }
      persistLockRef.current = true;
      try {
        const updated = await saveCollection(
          containerRef.current.id,
          containerRef.current.tripNo,
          toOrderShopRows(Array.from(next.values()), shopId),
        );
        containerRef.current = { id: updated.id, tripNo: updated.tripNo };
        setEntries(next);
        setSavedSnapshot(entrySnapshot(Array.from(next.values())));
        onSaved(updated);
        showNotification(
          to("orders.entry_cleared", { shop: row.shopName }),
          "success",
        );
      } catch (error) {
        showNotification(handleApiError(error), "error");
      } finally {
        persistLockRef.current = false;
      }
    },
    [entries, onSaved, showNotification, to],
  );

  const {
    requestDelete,
    cancel: cancelDelete,
    isPending,
    secondsLeft,
    pendingItems,
  } = usePendingDelete<number>((id) => void doClear(id));

  const onClearClick = (shopId: number) => {
    if (busy || !isEditable) return;
    const row = entries.get(shopId);
    if (!row || (row.birds === 0 && row.boxes === 0)) return;
    // Every clear gets the undo window — a draft row included, so a mis-click
    // never costs typed numbers.
    requestDelete(shopId, {
      label: to("orders.clear_entry_label", { shop: row.shopName }),
    });
  };

  // ── Save Progress (no final validation) ───────────────────────────────────
  const handleSave = useCallback(async () => {
    if (persistLockRef.current || busy || !isEditable) return;
    const rows = toOrderShopRows(Array.from(entries.values()));
    if (rows.length === 0) {
      showNotification(to("orders.add_at_least_one_shop"), "info");
      return;
    }
    persistLockRef.current = true;
    setSaving(true);
    try {
      const updated = await saveCollection(
        containerRef.current.id,
        containerRef.current.tripNo,
        rows,
      );
      containerRef.current = { id: updated.id, tripNo: updated.tripNo };
      // Authoritative values come from the API response — never a stale
      // pre-setState snapshot, never an independent optimistic total.
      const persisted = toEditorRows(updated);
      const next = new Map(entries);
      for (const [shopId, row] of next) {
        const match = persisted.find((p) => p.shopId === shopId);
        next.set(shopId, {
          ...row,
          id: match?.id ?? 0,
          birds: Number(match?.birds) || 0,
          boxes: match ? rowBoxes(match) : 0,
        });
      }
      setEntries(next);
      setSavedSnapshot(entrySnapshot(Array.from(next.values())));
      onSaved(updated);
      showNotification(to("orders.collection_saved"), "success");
    } catch (error) {
      showNotification(handleApiError(error), "error");
    } finally {
      persistLockRef.current = false;
      setSaving(false);
    }
  }, [busy, isEditable, entries, onSaved, showNotification, to]);

  // ── The clock finishes the day (no Finish button) ─────────────────────────
  // A day's window is 48h from its start, so the 16th is filed at the 18th
  // 12:00 AM. Nothing to press: the deadline submits whatever is entered
  // (validated rows included as-is — a supervisor's birds must not be lost
  // because boxes were still blank). While the page is open a timer fires at
  // the exact deadline; if the window closed while nobody was looking, the
  // first load files it instead.
  /** Files the day. Resolves true when a submit actually went out, so the
   *  caller knows whether the day still owes one. */
  const autoSubmitDay = useCallback(async (): Promise<boolean> => {
    if (persistLockRef.current) return false;
    const all = Array.from(entriesRef.current.values());
    const enteredRows = all.filter((r) => r.birds > 0 || r.boxes > 0);
    if (enteredRows.length === 0) return false;
    persistLockRef.current = true;
    setFinishing(true);
    try {
      const updated = await finishCollection(
        containerRef.current.id,
        containerRef.current.tripNo,
        toOrderShopRows(all),
      );
      containerRef.current = { id: updated.id, tripNo: updated.tripNo };
      const missingBoxes = enteredRows.filter((r) => !(r.boxes > 0)).length;
      showNotification(
        missingBoxes > 0
          ? to("orders.collection_auto_submitted_partial", {
              shops: missingBoxes,
            })
          : to("orders.collection_auto_submitted"),
        "success",
      );
      onFinished(updated);
      return true;
    } catch (error) {
      showNotification(handleApiError(error), "error");
      return false;
    } finally {
      persistLockRef.current = false;
      setFinishing(false);
    }
  }, [onFinished, showNotification, to]);

  const autoSubmittedDayRef = useRef<string | null>(null);
  useEffect(() => {
    // A day whose window is closed is read-only, but the clock still owes it a
    // submission — so this keys off "finished", not off the lock. Each day is
    // filed at most once per mount.
    if (collection?.finished || autoSubmittedDayRef.current === day) return;
    const delay = collectionAutoSubmitDelay(day);
    if (delay == null) return;
    if (delay === 0) {
      // The window shut while nobody was looking. The day is only marked as
      // handled once the POST actually went out: on a first pass the saved rows
      // may still be landing, and an empty sheet must not swallow the submit.
      void autoSubmitDay().then((filed) => {
        if (filed) autoSubmittedDayRef.current = day;
      });
      return;
    }
    // The picker only offers a 10-day window, so a delay that long is a
    // hand-typed URL; leave those days to the next load rather than arming a
    // timer that would misfire early.
    if (delay > MAX_TIMEOUT_MS) return;
    const timer = window.setTimeout(() => {
      void autoSubmitDay().then((filed) => {
        if (filed) autoSubmittedDayRef.current = day;
      });
    }, delay);
    return () => window.clearTimeout(timer);
    // savedSnapshot is in the deps so the day is re-checked the moment the
    // server's rows land; re-arming the timer then costs nothing.
  }, [day, collection?.finished, savedSnapshot, autoSubmitDay]);

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
  // Matches shop name, city / village and status. A trip or vehicle number
  // still lands on the shop it belongs to, but the table no longer shows
  // those columns, so the placeholder only promises what a row actually is.
  const q = query.trim().toLowerCase();

  const statusLabelOf = useCallback(
    (shopId: number, hasEntry: boolean): string => {
      const assignment = collection?.shops.get(shopId) ?? null;
      if (!hasEntry) return to("orders.status_not_collected");
      if (!assignment) return to("orders.status_collected");
      if (!assignment.delivered) return to("orders.status_assigned");
      // PART DELIVERY: some boxes are in, the rest are still pending.
      if (
        assignment.deliveredBoxes > 0 &&
        assignment.deliveredBoxes < assignment.boxes
      ) {
        return to("orders.status_part_delivered");
      }
      return to("orders.status_delivered");
    },
    [collection, to],
  );

  // ── Compact table-level sort (works with search + pagination + date) ────
  // "Collected" = the shop has an order entry for the selected day
  // (persisted, or in-progress on an editable day).
  const sortOptions = useMemo(
    () => [
      { value: "collected", label: to("orders.sort_collected_first") },
      { value: "az", label: to("orders.sort_name_az") },
      { value: "za", label: to("orders.sort_name_za") },
      // Only what this table actually shows: a shop's vehicle / trip is not a
      // Collection column, so it is not a Collection sort either.
      ...[
        "city_az",
        "city_za",
        "birds_asc",
        "birds_desc",
        "boxes_asc",
        "boxes_desc",
        "weight_asc",
        "weight_desc",
        "status",
      ].map((value) => ({ value, label: to(`orders.sort_${value}`) })),
    ],
    [to],
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
    [readOnlyEntries, entries, isEditable],
  );

  const cityOptions = useMemo(
    () =>
      [
        ...new Set(
          shops
            .map((shop) =>
              villageOf(shop.id, shop.shopName, shopDirectory).trim(),
            )
            .filter(Boolean),
        ),
      ]
        .sort((a, b) => a.localeCompare(b))
        .map((city) => ({ value: city, label: city })),
    [shops, shopDirectory],
  );
  const citySet = useMemo(() => new Set(cityFilters), [cityFilters]);

  const filteredShopList = useMemo(() => {
    const list = shops.filter((shop) => {
      if (
        citySet.size &&
        !citySet.has(villageOf(shop.id, shop.shopName, shopDirectory).trim())
      )
        return false;
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
        shop.shopNumber,
        shop.phoneNumber,
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
    const sortRow = (shop: Shop) => {
      const entry = isEditable
        ? entries.get(shop.id)
        : readOnlyEntries.get(shop.id);
      const birds = entry?.birds ?? 0;
      const assignment = collection?.shops.get(shop.id);
      return {
        name: shop.shopName,
        city: villageOf(shop.id, shop.shopName, shopDirectory),
        birds,
        boxes: entry?.boxes ?? 0,
        weight: weightForBirds(
          birds,
          assignment?.avgBirdWeight ?? dayAvgBirdWeight,
        ),
        sequence: shop.id,
        vehicle: assignment?.vehicleNo ?? "",
        trip: assignment?.tripNo ?? "",
        assigned: collectedOf(shop.id),
      };
    };
    list.sort((a, b) => {
      if (sortMode === "collected")
        return (
          Number(collectedOf(b.id)) - Number(collectedOf(a.id)) ||
          a.shopName.localeCompare(b.shopName)
        );
      if (sortMode === "status")
        return (
          statusLabelOf(a.id, collectedOf(a.id)).localeCompare(
            statusLabelOf(b.id, collectedOf(b.id)),
          ) || a.shopName.localeCompare(b.shopName)
        );
      return compareAssignmentRows(sortRow(a), sortRow(b), sortMode);
    });
    return list;
  }, [
    shops,
    q,
    collection,
    readOnlyEntries,
    entries,
    isEditable,
    shopDirectory,
    statusLabelOf,
    sortMode,
    collectedOf,
    citySet,
    dayAvgBirdWeight,
  ]);

  // ── Pagination (existing global component; reset to page 1 when the
  //     filtered result or the day changes) ─────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(filteredShopList.length / pageSize));
  const [page, setPage] = useState(1);
  const listKey = `${day}|${q}|${sortMode}|${pageSize}|${cityFilters.join(",")}`;
  const [lastKey, setLastKey] = useState(listKey);
  if (lastKey !== listKey) {
    setLastKey(listKey);
    if (page !== 1) setPage(1);
  }
  const safePage = Math.min(page, totalPages);
  const pageShops = filteredShopList.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize,
  );
  const startIndex =
    filteredShopList.length === 0 ? 0 : (safePage - 1) * pageSize;

  // One 12-column grid, two rows, every control filling its cell: day · city ·
  // sort on the first line, the search and the day's actions under it, all
  // bottom-aligned on one baseline with the same 40px controls the Trip List
  // uses. Labels are one size up; the search keeps only its own magnifier.
  const filterCard = (
    <section
      className={opsFilterCardClass}
      aria-label={to("orders.collection_filters")}
    >
      <div className="grid grid-cols-1 gap-x-3.5 gap-y-4 sm:grid-cols-2 lg:grid-cols-12 lg:items-end">
        <div className="lg:col-span-4">
          <div className={ORDERS_FILTER_LABEL_CLASS}>
            <Calendar size={17} className="text-emerald-500 flex-shrink-0" />
            <span>{to("orders.col_date")}</span>
          </div>
          <OrdersDateControl
            day={day}
            today={today}
            onDaySelect={onDaySelect}
            t={to}
            hideDayChip
            className="w-full"
            fieldClassName="w-full"
          />
        </div>
        <div className="lg:col-span-4">
          <div className={ORDERS_FILTER_LABEL_CLASS}>
            <MapPin size={17} className="text-amber-500 flex-shrink-0" />
            <span>{to("orders.city")}</span>
          </div>
          <OrdersMultiSelect
            values={cityFilters}
            onChange={setCityFilters}
            options={cityOptions}
            ariaLabel={to("orders.filter_city")}
            placeholder={to("orders.filter_city_all")}
            className="w-full"
            widthClass="w-full"
          />
        </div>
        <div className="lg:col-span-4">
          <div className={ORDERS_FILTER_LABEL_CLASS}>
            <ArrowUpDown size={17} className="text-violet-500 flex-shrink-0" />
            <span>{to("orders.sort")}</span>
          </div>
          <OrdersDropdown
            value={sortMode}
            onChange={(value) => setSortMode(value as CollectionSort)}
            options={sortOptions}
            ariaLabel={to("orders.sort")}
            className="w-full"
            widthClass="w-full"
          />
        </div>
        <div className="sm:col-span-2 lg:col-span-8">
          <div className={ORDERS_FILTER_LABEL_CLASS}>
            <span>{to("orders.search_label")}</span>
          </div>
          <OrdersSearchInput
            value={query}
            onChange={setQuery}
            placeholder={to("orders.search_collection")}
            className="w-full"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end lg:col-span-4">
          <button
            type="button"
            className={`group relative ${opsSecondaryButtonClass}`}
            onClick={() => {
              setQuery("");
              setSortMode("collected");
              setCityFilters([]);
              setPage(1);
              if (day !== today) onDaySelect(today);
            }}
            aria-label={to("common.reset")}
          >
            <span className="inline-flex motion-safe:group-hover:animate-[var(--animate-action-reset)]">
              <RotateCcw size={14} />
            </span>
            {to("common.reset")}
          </button>
          <BrandRefreshButton onClick={onRefresh} loading={refreshing} />
        </div>
      </div>
    </section>
  );
  const tableTitle = (
    <div className="flex items-center gap-3">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-sky-100 bg-sky-50 text-sky-600 shadow-inner">
        <ClipboardList size={20} aria-hidden />
      </span>
      <h2 className="text-base font-bold tracking-tight text-slate-800">
        {to("orders.tab_collection")}
      </h2>
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────
  // Closed day with nothing collected: clean empty state (read-only by nature).
  if (isAutoClosed && !collection) {
    return (
      <div className="space-y-5">
        {filterCard}
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-sky-50/40 px-6 py-3">
            {tableTitle}
          </div>
          <OrdersEmptyState
            title={to("orders.no_orders_for_day", { date: formatDayFull(day) })}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {filterCard}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 bg-gradient-to-r from-sky-50/60 via-white to-sky-50/40 px-6 py-3">
          {tableTitle}
          {isLocked && !isAutoClosed && (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 border border-slate-300 px-2 py-0.5 text-[11px] font-bold text-slate-600">
              <Lock size={11} />
              {to("orders.collection_complete")}
            </span>
          )}
          {/* Day state only — the day's cumulative totals live under the table.
              TODAY while the window is open, CLOSED once it has passed. */}
          <div className="ml-auto flex items-center gap-2 flex-wrap justify-end">
            {isAutoClosed ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 border border-rose-200 px-2 py-0.5 text-[11px] font-bold text-rose-700 whitespace-nowrap">
                <Lock size={11} />
                {to("orders.closed_day")}
              </span>
            ) : day === today ? (
              <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[11px] font-bold tracking-wide text-emerald-700 whitespace-nowrap">
                {to("orders.today_chip")}
              </span>
            ) : null}
            {isEditable ? (
              /* No Finish button, so the deadline has to be visible — once, in
                 the day's own state row. It shows when the day files itself and
                 counts down to it, with a bar across the bottom showing how much
                 of the 48h window is behind us. */
              <span className="relative inline-flex items-center gap-2 overflow-hidden rounded-full border border-sky-200 bg-sky-50 py-1 pl-2.5 pr-3 text-[11.5px] font-bold whitespace-nowrap text-sky-800">
                <span
                  className="relative flex h-1.5 w-1.5 flex-shrink-0"
                  aria-hidden
                >
                  <span className="absolute inset-0 rounded-full bg-sky-500/60 motion-safe:animate-ping" />
                  <span className="relative h-1.5 w-1.5 rounded-full bg-sky-500" />
                </span>
                <Clock
                  size={12}
                  className="flex-shrink-0 text-sky-600"
                  aria-hidden
                />
                <span>
                  {to("orders.auto_submits_at", {
                    deadline: autoSubmitDeadline,
                  })}
                </span>
                <span
                  className="font-semibold tabular-nums text-sky-600 motion-safe:transition-opacity motion-safe:duration-500"
                  aria-live="off"
                >
                  ·{" "}
                  {to("orders.auto_submits_in", { time: autoSubmitRemaining })}
                </span>
                <span
                  className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px] bg-sky-500/15"
                  aria-hidden
                >
                  <span
                    className="block h-full rounded-r-full bg-sky-500/70 motion-safe:transition-[width] motion-safe:duration-700 motion-safe:ease-out"
                    style={{ width: `${autoSubmitProgressPct}%` }}
                  />
                </span>
              </span>
            ) : null}
          </div>
        </div>

        <div className="overflow-x-auto" aria-busy={refreshing}>
          {/* table-fixed with one measured column: S.No keeps its 96px and every other
              column takes an equal share of what is left, so the eight headings sit
              on one rhythm instead of chasing their content. */}
          <table
            className={`w-full min-w-[900px] table-fixed ${ORDERS_TABLE_FONT_CLASS}`}
          >
            <thead>
              <tr className={opsTableHeadRowClass}>
                {/* Collection-only columns. Trip / vehicle are deliberately not
                    here — they belong to Assignment. */}
                {/* The only measured column: it has to hold its glyph plus the
                    word "S.No", and everything else shares what is left. */}
                <th className={`${opsTableThClass} w-[96px] text-center`}>
                  <ColHead
                    icon={Hash}
                    label={to("orders.col_sno")}
                    align="center"
                    tone="text-slate-400"
                  />
                </th>
                <th className={opsTableThClass}>
                  <ColHead
                    icon={Store}
                    label={to("orders.col_shop_name")}
                    tone="text-sky-600"
                  />
                </th>
                <th className={opsTableThClass}>
                  <ColHead
                    icon={MapPin}
                    label={to("orders.col_village")}
                    tone="text-amber-600"
                  />
                </th>
                <th className={opsTableThClass}>
                  <ColHead
                    icon={Bird}
                    label={to("orders.col_birds")}
                    tone="text-emerald-600"
                  />
                </th>
                <th className={opsTableThClass}>
                  <ColHead
                    icon={Boxes}
                    label={`${to("orders.col_boxes")} *`}
                    tone="text-violet-600"
                  />
                </th>
                <th className={`${opsTableThClass} text-right`}>
                  <ColHead
                    icon={Scale}
                    label={to("orders.col_weight")}
                    align="right"
                    tone="text-teal-600"
                  />
                </th>
                <th className={opsTableThClass}>
                  <ColHead
                    icon={Activity}
                    label={to("orders.col_status")}
                    tone="text-indigo-600"
                  />
                </th>
                <th className={`${opsTableThClass} text-right`}>
                  <ColHead
                    icon={Eraser}
                    label={to("orders.col_action")}
                    align="right"
                    tone="text-rose-500"
                  />
                </th>
              </tr>
            </thead>
            <tbody
              key={`${safePage}|${q}|${sortMode}|${pageSize}`}
              className={`${opsTableDivideClass} motion-safe:animate-page-pop`}
            >
              {refreshing ? (
                <tr>
                  <td colSpan={8}>
                    <OrdersTableSkeleton rows={Math.min(pageSize, 6)} />
                  </td>
                </tr>
              ) : (
                pageShops.map((shop, index) => {
                  const live = entries.get(shop.id);
                  const ro = readOnlyEntries.get(shop.id);
                  const birds = isEditable
                    ? (live?.birds ?? 0)
                    : (ro?.birds ?? 0);
                  const boxes = isEditable
                    ? (live?.boxes ?? 0)
                    : (ro?.boxes ?? 0);
                  const hasEntry = birds > 0 || boxes > 0;
                  const assignment = collection?.shops.get(shop.id) ?? null;
                  // Inside the undo window: the row is marked, nothing has changed.
                  const clearing = isPending(shop.id);

                  let statusNode: React.ReactNode = (
                    <OrdersStatusBadge
                      status="Not Collected"
                      label={to("orders.status_not_collected")}
                    />
                  );
                  if (hasEntry) {
                    if (!assignment) {
                      // Order collected but not yet on any vehicle.
                      statusNode = (
                        <OrdersStatusBadge
                          status="Collected"
                          label={to("orders.status_collected")}
                        />
                      );
                    } else if (
                      assignment.delivered &&
                      assignment.deliveredBoxes > 0 &&
                      assignment.deliveredBoxes < assignment.boxes
                    ) {
                      // PART DELIVERY — the balance stays visible (25 ordered,
                      // 10 in → 15 still to deliver), never a green "Delivered".
                      // The count rides beside the badge instead of inside it: the
                      // columns are equal width, and a long pill would push past
                      // its cell.
                      const remaining =
                        assignment.boxes - assignment.deliveredBoxes;
                      statusNode = (
                        <StatusWithNote
                          status="Part Delivered"
                          label={to("orders.status_part_delivered")}
                          note={to("orders.boxes_to_deliver", {
                            boxes: remaining,
                          })}
                        />
                      );
                    } else if (assignment.delivered) {
                      // Step 4 confirmed this shop was delivered → GREEN.
                      statusNode = (
                        <OrdersStatusBadge
                          status="Delivered"
                          label={to("orders.status_delivered")}
                        />
                      );
                    } else if (
                      // SPLIT still open: part of the order is on vehicles, the
                      // balance is still waiting for another truck.
                      assignment.assignedBoxesTotal < assignment.boxes
                    ) {
                      const pendingAssign =
                        assignment.boxes - assignment.assignedBoxesTotal;
                      statusNode = (
                        <StatusWithNote
                          status="Part Assigned"
                          label={to("orders.status_part_assigned")}
                          note={to("orders.boxes_to_assign", {
                            boxes: pendingAssign,
                          })}
                        />
                      );
                    } else {
                      // Fully placed on vehicles — this is the ONLY case that
                      // reads "Assigned"; everything else reads pending/part.
                      statusNode = (
                        <OrdersStatusBadge
                          status="Assigned"
                          label={to("orders.status_assigned")}
                        />
                      );
                    }
                  }

                  return (
                    <tr
                      key={shop.id}
                      className={ordersTableZebraRow(
                        index,
                        clearing
                          ? "align-middle bg-amber-50/70"
                          : "align-middle",
                      )}
                    >
                      <td className={`${opsTableTdClass} text-center`}>
                        <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-slate-50 text-[12px] font-semibold text-slate-600">
                          {startIndex + index + 1}
                        </span>
                      </td>
                      <td
                        className={`${opsTableTdClass} font-semibold text-slate-800`}
                      >
                        {shop.shopName}
                      </td>
                      <td className={opsTableTdClass}>
                        {villageOf(shop.id, shop.shopName, shopDirectory) ||
                          "—"}
                      </td>
                      <td className={opsTableTdClass}>
                        {isEditable ? (
                          <input
                            type="number"
                            min={0}
                            value={birds || ""}
                            placeholder="0"
                            aria-label={`${to("orders.col_birds")} — ${shop.shopName}`}
                            onChange={(e) =>
                              updateEntry(shop.id, "birds", e.target.value)
                            }
                            onWheel={onOrdersNumberWheel}
                            className={`${ORDERS_NO_SPINNER} h-8 w-full rounded-lg border border-emerald-300/70 bg-emerald-50/50 px-2 text-xs font-medium text-emerald-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500`}
                          />
                        ) : (
                          <span className="font-medium text-slate-700">
                            {hasEntry ? birds : "—"}
                          </span>
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
                            onChange={(e) =>
                              updateEntry(shop.id, "boxes", e.target.value)
                            }
                            onWheel={onOrdersNumberWheel}
                            className={`${ORDERS_NO_SPINNER} h-8 w-full rounded-lg border border-emerald-300/70 bg-emerald-50/50 px-2 text-xs font-medium text-emerald-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500`}
                          />
                        ) : (
                          <span className="font-medium text-slate-700">
                            {hasEntry ? boxes : "—"}
                          </span>
                        )}
                      </td>
                      <td className={`${opsTableTdClass} text-right`}>
                        {/* The ORDERED weight of the row: the shop's birds against
                          the vehicle's average bird weight once it is assigned,
                          and the day's own average before that — so a collected
                          row never shows a dash when its birds are known. */}
                        {birds > 0 &&
                        (assignment?.avgBirdWeight ?? dayAvgBirdWeight) > 0 ? (
                          <span className="font-medium text-slate-600">
                            {formatKg(
                              weightForBirds(
                                birds,
                                assignment?.avgBirdWeight ?? dayAvgBirdWeight,
                              ),
                            )}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className={`${opsTableTdClass} min-w-0 break-words`}>
                        {statusNode}
                      </td>
                      <td className={`${opsTableTdClass} text-right`}>
                        {isEditable ? (
                          <button
                            type="button"
                            onClick={() =>
                              clearing
                                ? cancelDelete(shop.id)
                                : onClearClick(shop.id)
                            }
                            disabled={(!hasEntry && !clearing) || busy}
                            aria-label={
                              clearing
                                ? to("orders.undo_clear_label", {
                                    shop: shop.shopName,
                                  })
                                : `${to("orders.clear_entry")} — ${shop.shopName}`
                            }
                            className={`inline-flex h-8 min-w-8 items-center justify-center gap-1 rounded-lg border px-1.5 text-[11px] font-bold transition-colors ${
                              clearing
                                ? "border-amber-300 bg-amber-100/70 text-amber-700 motion-safe:animate-pulse"
                                : "border-slate-200/80 bg-white text-slate-400 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200 disabled:opacity-30"
                            }`}
                          >
                            {clearing ? (
                              <>
                                <Undo2 size={13} aria-hidden />
                                <span className="tabular-nums">
                                  {secondsLeft(shop.id)}
                                </span>
                              </>
                            ) : (
                              <Eraser size={14} />
                            )}
                          </button>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
              {!refreshing && pageShops.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12">
                    <OrdersEmptyState
                      title={
                        q
                          ? to("orders.no_search_results")
                          : isPast
                            ? to("orders.no_orders_for_day", {
                                date: formatDayFull(day),
                              })
                            : to("orders.no_active_shops")
                      }
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Cumulative line — BELOW the table, not a KPI row: how many shops
            this day actually took orders (the number that matters), with the
            birds / boxes / weight kept quiet beside it. */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-100 bg-slate-50/50 px-6 py-3">
          <span className="inline-flex items-center gap-2 text-[13px] font-bold text-slate-800">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-sky-100 bg-sky-50 text-sky-600">
              <Store size={14} aria-hidden />
            </span>
            {to("orders.collection_summary_shops", {
              shops: totals.totalShops,
            })}
          </span>
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold text-slate-400">
            <span className="inline-flex items-center gap-1">
              <Bird size={13} className="flex-shrink-0" aria-hidden />
              {totals.totalBirds} {to("orders.word_birds")}
            </span>
            <span className="text-slate-200" aria-hidden>
              ·
            </span>
            <span className="inline-flex items-center gap-1">
              <Boxes size={13} className="flex-shrink-0" aria-hidden />
              {totals.totalBoxes} {to("orders.word_boxes")}
            </span>
            <span className="text-slate-200" aria-hidden>
              ·
            </span>
            <span className="inline-flex items-center gap-1">
              <Scale size={13} className="flex-shrink-0" aria-hidden />
              {formatKg(totals.totalWeight)}
            </span>
          </span>
        </div>

        {/* Global pagination (existing component) */}
        <Pagination
          page={safePage}
          pageSize={pageSize}
          totalItems={filteredShopList.length}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
          disabled={refreshing}
        />

        {/* Footer — Save Progress is the only action a day gets. There is no
            Cancel (the draft is the record, so there is nothing to discard) and
            no Finish: the deadline files the day itself. */}
        {isEditable ? (
          <div className="border-t border-slate-200 bg-slate-50/70 px-5 py-3.5 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2.5">
              {isDirty ? (
                <span className="text-[11px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-1">
                  {to("orders.unsaved_changes")}
                </span>
              ) : null}
            </div>
            <div className="flex items-center gap-2.5">
              {finishing ? (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
                  <Loader2 size={14} className="animate-spin" />
                  {to("orders.submitting")}
                </span>
              ) : null}
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={busy || entered.length === 0}
                className={`${opsSecondaryButtonClass} border-emerald-300 text-emerald-700 hover:bg-emerald-50`}
              >
                {saving ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Save size={14} />
                )}
                {saving ? to("orders.saving") : to("orders.save_progress")}
              </button>
            </div>
          </div>
        ) : (
          <div className="border-t border-slate-200 bg-slate-50/70 px-5 py-3 flex items-center gap-2 text-[11px] font-semibold text-slate-500">
            <Lock size={13} />
            {isAutoClosed
              ? collection?.finished
                ? to("orders.auto_closed_note", {
                    deadline: formatCollectionDeadline(day),
                  })
                : to("orders.auto_closed_empty_note", {
                    deadline: formatCollectionDeadline(day),
                  })
              : to("orders.finish_collection_locked")}
          </div>
        )}
      </div>

      {/* 10-second clear undo — the same countdown the Recent table gives a pending
          trip, worded for a zero-out because this action never removes the shop. */}
      <PendingDeleteNotification
        items={pendingItems.map((item) => ({
          ...item,
          description: to("orders.pending_clear_note", {
            seconds: PENDING_DELETE_SECONDS,
          }),
          busyLabel: to("orders.clearing_entry"),
        }))}
        onCancel={cancelDelete}
        icon={<Eraser size={22} />}
        ariaLabel={to("orders.pending_clear_aria")}
        countdownLabel={(seconds) => to("orders.clear_in_seconds", { seconds })}
      />
    </div>
  );
}

export default React.memo(OrderCollectionPage);
