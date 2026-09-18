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
  Check,
  ArrowUpDown,
  Bird,
  Boxes,
  Building2,
  ClipboardList,
  Clock,
  Eraser,
  Hash,
  Loader2,
  Lock,
  MapPin,
  Save,
  Scale,
  Store,
  Truck,
} from "lucide-react";
import type { Shop } from "../../masters/shops/types/shop";
import type { Trip } from "../../../shared/trip";
import { uiActionIconMotionClass } from "../../../shared/ui/uiTokens";
import {
  opsFilterCardClass,
  opsSecondaryButtonClass,
  opsTableDivideClass,
  opsTableHeadRowClass,
} from "../../../shared/ui/operationsStyles";
import {
  BrandRefreshButton,
  FilterResetButton,
  Pagination,
  countActiveFilters,
} from "../../../ui";
import { useSafeNotification } from "../../../hooks/useSafeNotification";
import { usePendingDelete } from "../../../hooks/usePendingDelete";
import { PendingDeleteNotification } from "../../../components/common/PendingDeleteNotification";
import { PENDING_DELETE_SECONDS } from "../../../shared/ui/pendingDelete";
import {
  COLLECTION_GRACE_DAYS,
  collectionAutoSubmitDelay,
  collectionTotals,
  formatCollectionDeadline,
  formatDayFull,
  formatKg,
  isCollectionAutoClosed,
  rowBoxes,
  collectionRowWeightKg,
  weightForBirds,
} from "../utils/ordersUtils";
import { ordersErrorMessage } from "../utils/ordersErrorMessage";
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
  ORDERS_RISE_INPUT_CLASS as ORDERS_RISE_INPUT,
  ORDERS_TABLE_FONT_CLASS,
  ORDERS_TABLE_TH_WRAP_CLASS,
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
      <OrdersStatusBadge size="md" status={status} label={label} />
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
      {/* min-w-0 so a long name wraps inside the column instead of overflowing
          it — a flex item refuses to shrink below its content without this. */}
      <span className="min-w-0">{label}</span>
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

/**
 * The panel head — shared by the loaded table and by the loading shell, so the
 * card keeps its exact shape while the day's rows arrive instead of jumping.
 */
function CollectionPanelHead() {
  const { to } = useOrdersI18n();
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-sky-100 bg-sky-50 text-sky-600 shadow-inner">
        <ClipboardList size={20} aria-hidden />
      </span>
      <h2 className="text-base font-bold tracking-tight text-slate-800">
        {to("orders.tab_collection")}
      </h2>
    </div>
  );
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
  /**
   * Weight typed on this sheet (kg). 0 means "not entered" — the row is then
   * worth its birds against the average bird weight, which is what the day's
   * total reads. Nothing is prefilled: the box starts empty every time.
   */
  weight: number;
};

function entrySnapshot(rows: EntryRow[]): string {
  return JSON.stringify(
    rows
      .filter((r) => r.birds > 0 || r.boxes > 0 || r.weight > 0)
      .map((r) => [r.shopId, r.birds, r.boxes, r.weight])
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
      weight: 0,
    });
  }
  if (dayCollection) {
    for (const row of toEditorRows(dayCollection.trip)) {
      const existing = map.get(row.shopId);
      if (existing) {
        existing.id = row.id;
        existing.birds = Number(row.birds) || 0;
        existing.boxes = rowBoxes(row);
        existing.weight = Number(row.weight) || 0;
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
        // Only a weight we were given is sent; the derived one stays a screen
        // figure so the sheet never invents a number for billing to chase.
        weight: r.weight,
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
  /**
   * The day's Orders data is still being fetched. It never blanks the screen:
   * the filters stay and only the table reports it (the Trip List's contract).
   */
  loading: boolean;
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
  shopFilters: string[];
  setShopFilters: (values: string[]) => void;
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
  const {
    shops,
    shopsLoading,
    loading,
    shopDirectory,
    day,
    today,
    onDaySelect,
    onRefresh,
    refreshing,
  } = props;
  const [query, setQuery] = useState("");
  const [cityFilters, setCityFilters] = useState<string[]>([]);
  const [shopFilters, setShopFilters] = useState<string[]>([]);
  const [sortMode, setSortMode] = useState<CollectionSort>("collected");
  const [pageSize, setPageSize] = useState(10);

  // The filter card is built HERE, above the loading gate, and it never
  // unmounts: a filter that is swapped for a skeleton while data arrives is a
  // filter that throws away what you just picked. City and shop names come from
  // the Shop Master, which is already in memory, so the controls are usable
  // immediately — exactly how the Trip List behaves: its filters stay put and
  // only the table body reports the load.
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
  // The shop list is the long one, so it gets the searchable panel, and every row
  // names its city on the right — two shops of the same name in two cities are
  // then tellable apart without leaving the picker.
  const shopOptions = useMemo(
    () =>
      shops
        .map((shop) => ({
          value: shop.shopName,
          label: shop.shopName,
          hint: villageOf(shop.id, shop.shopName, shopDirectory).trim(),
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [shops, shopDirectory],
  );
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

  const resetFilters = () => {
    setQuery("");
    setSortMode("collected");
    setCityFilters([]);
    setShopFilters([]);
    if (day !== today) onDaySelect(today);
  };
  const activeFilterCount = countActiveFilters(
    query.trim() !== "",
    sortMode !== "collected",
    cityFilters.length > 0,
    shopFilters.length > 0,
    day !== today,
  );

  // One 12-column grid, two rows, every control filling its cell: day · city ·
  // shop · sort across the first line, then the search (8) with the day's
  // buttons (4) under it — bottom-aligned on one baseline, all controls 40px.
  // Labels are 13px and each carries one coloured glyph, never a second copy of
  // a glyph the field already shows (which is why the date has no icon here: the
  // picker's own calendar is the one you click).
  const filterCard = (
    <section
      className={opsFilterCardClass}
      aria-label={to("orders.collection_filters")}
    >
      <div className="grid grid-cols-1 gap-x-3.5 gap-y-4 sm:grid-cols-2 lg:grid-cols-12 lg:items-end">
        <div className="lg:col-span-3">
          <div className={ORDERS_FILTER_LABEL_CLASS}>
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
        <div className="lg:col-span-3">
          <div className={ORDERS_FILTER_LABEL_CLASS}>
            <MapPin
              size={17}
              className="text-amber-500 flex-shrink-0"
              aria-hidden
            />
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
        <div className="lg:col-span-3">
          <div className={ORDERS_FILTER_LABEL_CLASS}>
            <Building2
              size={17}
              className="text-sky-600 flex-shrink-0"
              aria-hidden
            />
            <span>{to("orders.filter_shop")}</span>
          </div>
          <OrdersMultiSelect
            values={shopFilters}
            onChange={setShopFilters}
            options={shopOptions}
            ariaLabel={to("orders.filter_shop")}
            placeholder={to("orders.filter_shop_all")}
            searchable
            searchLabel={to("orders.filter_shops")}
            unitLabel={to("orders.shop_unit")}
            unitLabelPlural={to("orders.shop_unit_plural")}
            className="w-full"
            widthClass="w-full"
          />
        </div>
        <div className="lg:col-span-3">
          <div className={ORDERS_FILTER_LABEL_CLASS}>
            <ArrowUpDown
              size={17}
              className="text-violet-500 flex-shrink-0"
              aria-hidden
            />
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
          <FilterResetButton count={activeFilterCount} onClick={resetFilters} />
          <BrandRefreshButton onClick={onRefresh} loading={refreshing} />
        </div>
      </div>
    </section>
  );

  // Shops and the day's collection land at different times; both are the
  // TABLE's problem to report, never the filter's.
  if (loading || shopsLoading) {
    return (
      <div className="space-y-5">
        {filterCard}
        <div
          className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm"
          aria-busy="true"
        >
          <div className="border-b border-slate-100 bg-sky-50/40 px-6 py-3">
            <CollectionPanelHead />
          </div>
          {/* The table frame is already here — heads, widths, density — so the
              load lands as rows appearing, not as the page changing shape. */}
          <div className="overflow-x-auto">
            <table
              className={`w-full min-w-[63.75rem] table-fixed ${ORDERS_TABLE_FONT_CLASS}`}
            >
              <CollectionTableHead />
              <tbody className={opsTableDivideClass}>
                <CollectionLoadingRow />
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }
  if (shops.length === 0) {
    return (
      <div className="space-y-5">
        {filterCard}
        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <OrdersEmptyState title={to("orders.no_active_shops")} />
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-5">
      {filterCard}
      {/* Shops load asynchronously. The stateful editor mounts only once they are
          ready (and re-mounts per day via key={day}), so it can seed its entries
          in a useState initializer — no effect-based state sync. */}
      <CollectionEntries
        key={props.day}
        {...props}
        query={query}
        setQuery={setQuery}
        cityFilters={cityFilters}
        setCityFilters={setCityFilters}
        shopFilters={shopFilters}
        setShopFilters={setShopFilters}
        sortMode={sortMode}
        setSortMode={setSortMode}
        pageSize={pageSize}
        setPageSize={setPageSize}
      />
    </div>
  );
}

/**
 * The eight Collection columns, in one place: the loaded table and the loading
 * shell render the identical frame, so the first paint shows the real grid with
 * a body that is simply still arriving — Trip List does exactly this with
 * `TripMasterTable isLoading`.
 */
function CollectionTableHead() {
  const { to } = useOrdersI18n();
  return (
    <thead>
      <tr className={opsTableHeadRowClass}>
        {/* Collection-only columns. Trip / vehicle are deliberately not here —
            they belong to Assignment. */}
        {/* Two columns are measured, the rest are divided evenly: S.No because a
            glyph plus "S.No" needs its own room, Action because the eraser and its
            10-second countdown must never be clipped. Everything between them —
            shop, city, birds, boxes, weight, status — takes an equal sixth.
            Every column, measured or not, starts its content at the same left edge:
            right-aligning the last two put the air in different places per column,
            which is what made Weight look crammed against Status and stranded
            after Boxes. */}
        <th className={`${opsTableThClass} w-24`}>
          <ColHead
            icon={Hash}
            label={to("orders.col_sno")}
            align="left"
            tone="text-slate-400"
          />
        </th>
        <th className={ORDERS_TABLE_TH_WRAP_CLASS}>
          <ColHead
            icon={Store}
            label={to("orders.col_shop_name")}
            tone="text-sky-600"
          />
        </th>
        <th className={ORDERS_TABLE_TH_WRAP_CLASS}>
          <ColHead
            icon={MapPin}
            label={to("orders.col_village")}
            tone="text-amber-600"
          />
        </th>
        <th className={ORDERS_TABLE_TH_WRAP_CLASS}>
          <ColHead
            icon={Bird}
            label={to("orders.col_birds")}
            tone="text-emerald-600"
          />
        </th>
        <th className={ORDERS_TABLE_TH_WRAP_CLASS}>
          <ColHead
            icon={Boxes}
            label={`${to("orders.col_boxes")} *`}
            tone="text-violet-600"
          />
        </th>
        <th className={ORDERS_TABLE_TH_WRAP_CLASS}>
          <ColHead
            icon={Scale}
            label={to("orders.col_weight")}
            align="left"
            tone="text-teal-600"
          />
        </th>
        <th className={`${ORDERS_TABLE_TH_WRAP_CLASS} text-center`}>
          <ColHead
            icon={Activity}
            label={to("orders.col_status")}
            align="center"
            tone="text-indigo-600"
          />
        </th>
        <th className={`${opsTableThClass} w-28`}>
          <ColHead
            icon={Eraser}
            label={to("orders.col_action")}
            align="left"
            tone="text-rose-500"
          />
        </th>
      </tr>
    </thead>
  );
}

/** The table's own "in flight" row — a spinner in the body, never a page swap. */
function CollectionLoadingRow() {
  const { to } = useOrdersI18n();
  return (
    <tr>
      <td colSpan={8} className="px-4 py-14 text-center">
        <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-slate-400">
          <span
            className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-emerald-600"
            aria-hidden="true"
          />
          {to("common.loading")}
          <span className="text-slate-300" aria-hidden>
            ·
          </span>
          <span className="font-medium normal-case tracking-normal text-slate-400">
            {to("orders.tab_collection")}
          </span>
        </span>
      </td>
    </tr>
  );
}

function CollectionEntries({
  shops,
  shopDirectory,
  day,
  today,
  collection,
  nextTripNo,
  onSaved,
  onFinished,
  refreshing,
  cityFilters,
  shopFilters,
  query,
  sortMode,
  pageSize,
  setPageSize,
}: Omit<Props, "shopsLoading" | "loading" | "onDaySelect" | "onRefresh"> &
  CollectionFilters) {
  const { to } = useOrdersI18n();
  const { showNotification } = useSafeNotification();

  // A day stays editable for 48h from its start — the 04/09 collection is
  // still open on 05/09 and AUTO-CLOSES at 06/09 12:00 AM, finished or not.
  const isAutoClosed = isCollectionAutoClosed(day);
  const isPast = day < today;

  // The chip ticks (30s) so the deadline reads as something moving rather than
  // a date to interpret — no countdown text beside it, only the window filling
  // underneath. One interval, and only while the day can still be edited: a
  // closed day has nothing left to count down to.
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (isAutoClosed) return;
    const id = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, [isAutoClosed]);
  const autoSubmitDeadline = formatCollectionDeadline(day);
  const autoSubmitRemainingMs =
    collectionAutoSubmitDelay(day, new Date(nowMs)) ?? 0;
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
  // The average in force for the day's own rows: a vehicle's once the shop is on
  // one, the day's before that. Declared here so the totals and every row read
  // the same number.
  const dayAvgBirdWeight = Number(collection?.trip.avgBirdWeight) || 0;
  /** What one row is worth in kg: typed weight first, birds × average next. */
  const rowWeightKg = useCallback(
    (row: { birds: number; weight: number } | undefined, shopId: number) =>
      collectionRowWeightKg(
        row?.weight,
        row?.birds ?? 0,
        collection?.shops.get(shopId)?.avgBirdWeight ?? dayAvgBirdWeight,
      ),
    [collection, dayAvgBirdWeight],
  );
  const totals = useMemo(() => {
    const base = collectionTotals(toOrderShopRows(entered));
    // collectionTotals can only add up what the sheet carries, and an empty Weight
    // box carries nothing — so the day's kg is summed from each row's effective
    // weight instead of the raw payload.
    const weight = entered.reduce(
      (sum, row) => sum + rowWeightKg(row, row.shopId),
      0,
    );
    return { ...base, totalWeight: Number(weight.toFixed(2)) };
  }, [entered, rowWeightKg]);

  // The footer needs two things the totals object does not carry: how many
  // different cities today's orders cover, and how many of the entered shops are
  // already placed on a vehicle. Both come from the same rows the totals sum, so
  // the footer and the table can never disagree.
  const footerStats = useMemo(() => {
    const cities = new Set<string>();
    let onVehicles = 0;
    for (const row of entered) {
      if (row.village) cities.add(row.village);
      if (collection?.shops.get(row.shopId) != null) onVehicles += 1;
    }
    return {
      cities: cities.size,
      onVehicles,
      awaiting: entered.length - onVehicles,
    };
  }, [entered, collection]);

  // The day's own average bird weight comes from the collection container, so
  // an ordered row shows its weight before it is assigned to a vehicle (the
  // vehicle's own average takes over once the row has an assignment).

  // ── Row updates (editable days only) ─────────────────────────────────────
  const updateEntry = useCallback(
    (shopId: number, field: "birds" | "boxes" | "weight", raw: string) => {
      // Loaded-on-a-vehicle shops are immutable here (see rowLocked).
      if ((collection?.shops.get(shopId)?.assignedBoxesTotal ?? 0) > 0) return;
      // Birds and boxes are counts; weight is a measured kg figure, so it keeps
      // its decimals (2dp) instead of being floored like a count.
      const n =
        field === "weight"
          ? Number(Math.max(0, Math.min(999999, Number(raw) || 0)).toFixed(2))
          : Math.max(0, Math.min(9999, Math.floor(Number(raw) || 0)));
      setEntries((prev) => {
        const row = prev.get(shopId);
        if (!row) return prev;
        const next = new Map(prev);
        next.set(shopId, { ...row, [field]: n });
        return next;
      });
    },
    [collection],
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
      // Birds and boxes go to zero and the typed weight goes with them, so the
      // row cannot end up "0 birds, 900 kg".
      next.set(shopId, { ...row, birds: 0, boxes: 0, weight: 0 });
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
          {
            operationalDay: day,
            onContainerCreated: (trip) => {
              containerRef.current = { id: trip.id, tripNo: trip.tripNo };
            },
          },
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
        showNotification(ordersErrorMessage(error), "error");
      } finally {
        persistLockRef.current = false;
      }
    },
    [entries, onSaved, showNotification, to, day],
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

  // The button confirms itself: for a moment after a save it carries a popping
  // check instead of the disk, so the click is answered inside the button and not
  // only in a toast at the corner of the screen. Cosmetic by design — no cleanup
  // and no timer bookkeeping, and a re-click simply re-arms the same flash.
  const [savedFlash, setSavedFlash] = useState(false);
  const flashSaved = useCallback(() => {
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1_400);
  }, []);

  const validateEntries = useCallback(
    (all: EntryRow[]): boolean => {
      const activeIds = new Set(shops.map((shop) => shop.id));
      const seen = new Set<number>();
      for (const row of all) {
        const hasValue = row.boxes > 0 || row.birds > 0 || row.weight > 0;
        if (!hasValue) continue;
        if (!Number.isSafeInteger(row.shopId) || row.shopId <= 0 || !activeIds.has(row.shopId)) {
          showNotification("A selected shop is no longer active. Refresh the order list.", "error");
          return false;
        }
        if (!row.shopName.trim()) {
          showNotification("Every order row must have a valid shop name.", "error");
          return false;
        }
        if (seen.has(row.shopId)) {
          showNotification(`Duplicate shop row: ${row.shopName}.`, "error");
          return false;
        }
        seen.add(row.shopId);
        if (!Number.isSafeInteger(row.boxes) || row.boxes <= 0 || row.boxes > 9999) {
          showNotification(`Enter whole-number boxes from 1 to 9,999 for ${row.shopName}.`, "error");
          return false;
        }
        if (!Number.isSafeInteger(row.birds) || row.birds < 0 || row.birds > 9999) {
          showNotification(`Enter a valid whole-number bird count for ${row.shopName}.`, "error");
          return false;
        }
        if (!Number.isFinite(row.weight) || row.weight < 0 || row.weight > 999999 || Number(row.weight.toFixed(2)) !== row.weight) {
          showNotification(`Enter a valid weight with at most 2 decimals for ${row.shopName}.`, "error");
          return false;
        }
        if (row.weight > 0 && row.birds === 0) {
          showNotification(`Enter birds for ${row.shopName} when a weight is supplied.`, "error");
          return false;
        }
      }
      return true;
    },
    [shops, showNotification],
  );

  // ── Save Progress (no final validation) ───────────────────────────────────
  const handleSave = useCallback(async () => {
    if (persistLockRef.current || busy || !isEditable) return;
    const allEntries = Array.from(entries.values());
    if (!validateEntries(allEntries)) return;
    const rows = toOrderShopRows(allEntries);
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
        {
          operationalDay: day,
          onContainerCreated: (trip) => {
            containerRef.current = { id: trip.id, tripNo: trip.tripNo };
          },
        },
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
      flashSaved();
    } catch (error) {
      showNotification(ordersErrorMessage(error), "error");
    } finally {
      persistLockRef.current = false;
      setSaving(false);
    }
  }, [busy, isEditable, entries, validateEntries, onSaved, showNotification, flashSaved, to, day]);

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
    if (!validateEntries(all)) return false;
    persistLockRef.current = true;
    setFinishing(true);
    try {
      const updated = await finishCollection(
        containerRef.current.id,
        containerRef.current.tripNo,
        toOrderShopRows(all),
        {
          operationalDay: day,
          onContainerCreated: (trip) => {
            containerRef.current = { id: trip.id, tripNo: trip.tripNo };
          },
        },
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
      showNotification(ordersErrorMessage(error), "error");
      return false;
    } finally {
      persistLockRef.current = false;
      setFinishing(false);
    }
  }, [onFinished, showNotification, to, day, validateEntries]);

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
    const map = new Map<
      number,
      {
        id: number;
        birds: number;
        boxes: number;
        weight: number;
      }
    >();
    for (const row of collection ? toEditorRows(collection.trip) : []) {
      map.set(row.shopId, {
        id: row.id,
        birds: Number(row.birds) || 0,
        boxes: rowBoxes(row),
        weight: Number(row.weight) || 0,
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
  /** "Collected" for a row = it holds an order, saved or being typed right now. */
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

  const citySet = useMemo(() => new Set(cityFilters), [cityFilters]);
  const shopSet = useMemo(() => new Set(shopFilters), [shopFilters]);

  const filteredShopList = useMemo(() => {
    const list = shops.filter((shop) => {
      if (
        citySet.size &&
        !citySet.has(villageOf(shop.id, shop.shopName, shopDirectory).trim())
      )
        return false;
      // The shop-name dropdown picks exact shops; the search box still narrows
      // inside that pick rather than replacing it.
      if (shopSet.size && !shopSet.has(shop.shopName)) return false;
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
        weight: rowWeightKg(
          isEditable
            ? entry
            : { birds, weight: readOnlyEntries.get(shop.id)?.weight ?? 0 },
          shop.id,
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
    shopSet,
    rowWeightKg,
  ]);

  // ── Pagination (existing global component; reset to page 1 when the
  //     filtered result or the day changes) ─────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(filteredShopList.length / pageSize));
  const [page, setPage] = useState(1);
  const listKey = `${day}|${q}|${sortMode}|${pageSize}|${cityFilters.join(",")}|${shopFilters.join(",")}`;
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

  const tableTitle = <CollectionPanelHead />;

  // ── Render ────────────────────────────────────────────────────────────────
  // Closed day with nothing collected: clean empty state (read-only by nature).
  if (isAutoClosed && !collection) {
    return (
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-sky-50/40 px-6 py-3">
          {tableTitle}
        </div>
        <OrdersEmptyState
          title={to("orders.no_orders_for_day", { date: formatDayFull(day) })}
        />
      </div>
    );
  }

  return (
    <>
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
            className={`w-full min-w-[63.75rem] table-fixed ${ORDERS_TABLE_FONT_CLASS}`}
          >
            <CollectionTableHead />
            <tbody
              key={`${safePage}|${q}|${sortMode}|${pageSize}`}
              className={`${opsTableDivideClass} motion-safe:animate-page-pop`}
            >
              {refreshing ? (
                <CollectionLoadingRow />
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
                  // Weight: what this sheet typed, else what the birds are worth
                  // at the average in force. The empty box keeps the derived
                  // number as its placeholder, so nothing is ever prefilled.
                  const typedKg = isEditable
                    ? (live?.weight ?? 0)
                    : (ro?.weight ?? 0);
                  const autoKg = weightForBirds(
                    birds,
                    assignment?.avgBirdWeight ?? dayAvgBirdWeight,
                  );
                  const rowKg = collectionRowWeightKg(
                    typedKg,
                    birds,
                    assignment?.avgBirdWeight ?? dayAvgBirdWeight,
                  );
                  // Inside the undo window: the row is marked, nothing has changed.
                  const clearing = isPending(shop.id);
                  // Once a shop's order is ON A VEHICLE (assignment saved or
                  // submitted) the collected figures are the contract the truck
                  // was loaded against — the row becomes read-only here even on
                  // an editable day. Un-assigning happens in Order Assignment.
                  const rowLocked = Boolean(
                    assignment && assignment.assignedBoxesTotal > 0,
                  );
                  const rowEditable = isEditable && !rowLocked;

                  let statusNode: React.ReactNode = (
                    <OrdersStatusBadge
                      size="md"
                      status="Not Collected"
                      label={to("orders.status_not_collected")}
                    />
                  );
                  if (hasEntry) {
                    if (!assignment) {
                      // Order collected but not yet on any vehicle.
                      statusNode = (
                        <OrdersStatusBadge
                          size="md"
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
                          size="md"
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
                          size="md"
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
                      <td className={opsTableTdClass}>
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
                        {rowEditable ? (
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
                            className={`${ORDERS_NO_SPINNER} ${ORDERS_RISE_INPUT} border-emerald-300/70 bg-emerald-50/50 text-emerald-900 focus:border-emerald-500`}
                          />
                        ) : (
                          <span className="font-medium text-slate-700">
                            {hasEntry ? birds : "—"}
                          </span>
                        )}
                      </td>
                      <td className={opsTableTdClass}>
                        {rowEditable ? (
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
                            className={`${ORDERS_NO_SPINNER} ${ORDERS_RISE_INPUT} border-violet-300/70 bg-violet-50/50 text-violet-900 focus:border-violet-500`}
                          />
                        ) : (
                          <span className="font-medium text-slate-700">
                            {hasEntry ? boxes : "—"}
                          </span>
                        )}
                      </td>
                      <td className={opsTableTdClass}>
                        {/* The ORDERED weight of the row: the shop's birds against
                          the vehicle's average bird weight once it is assigned,
                          and the day's own average before that — so a collected
                          row never shows a dash when its birds are known. */}
                        {rowEditable ? (
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={typedKg || ""}
                            placeholder={autoKg ? String(autoKg) : "0"}
                            aria-label={`${to("orders.col_weight")} — ${shop.shopName}`}
                            onChange={(e) =>
                              updateEntry(shop.id, "weight", e.target.value)
                            }
                            onWheel={onOrdersNumberWheel}
                            className={`${ORDERS_NO_SPINNER} ${ORDERS_RISE_INPUT} border-teal-300/70 bg-teal-50/50 text-teal-900 focus:border-teal-500`}
                          />
                        ) : rowKg > 0 ? (
                          <span className="font-medium text-slate-600">
                            {formatKg(rowKg)}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className={opsTableTdClass}>
                        {/* A gutter after the pill: the status column and the Action
                            column share the sheet's last two cells, and without room
                            of its own the badge reads as if it is being cut off. */}
                        {/* Centred in its own column: the pill is the one piece of
                            data in this table that is a chip and not a value, so it
                            reads best sitting in the middle of its share instead of
                            starting a third edge, and centring it keeps it clear of
                            the eraser without a hand-made gutter. */}
                        <div className="flex min-w-0 flex-wrap items-center justify-center gap-x-2.5 gap-y-1">
                          {statusNode}
                        </div>
                      </td>
                      <td className={opsTableTdClass}>
                        {rowEditable ? (
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
                            className={`group inline-flex h-8 min-w-8 items-center justify-center gap-1 rounded-lg border px-1.5 text-[11px] font-bold transition-[color,background-color,border-color,box-shadow,transform] duration-200 ease-out ${
                              clearing
                                ? "border-amber-300 bg-amber-100/70 text-amber-700 motion-safe:animate-pulse"
                                : "border-slate-200/80 bg-white text-slate-400 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 hover:shadow-[0_4px_12px_-4px_rgba(244,63,94,0.55)] motion-safe:hover:-translate-y-px active:translate-y-0 active:scale-95 disabled:opacity-30 disabled:shadow-none"
                            }`}
                          >
                            {/*
                             * The same motion the trip delete uses, from the same
                             * token. On hover the eraser wiggles; while the
                             * 10-second window is open it keeps wiggling, so the
                             * row visibly holds the pending clear instead of
                             * freezing on a swapped icon — and the click cancels.
                             */}
                            <span
                              className={`inline-flex ${
                                clearing
                                  ? "motion-safe:animate-[var(--animate-action-delete)]"
                                  : uiActionIconMotionClass.delete
                              }`}
                              aria-hidden
                            >
                              <Eraser size={14} />
                            </span>
                            {clearing ? (
                              <span className="tabular-nums">
                                {secondsLeft(shop.id)}
                              </span>
                            ) : null}
                          </button>
                        ) : rowLocked && isEditable ? (
                          <span
                            title={to("orders.row_locked_assigned")}
                            aria-label={to("orders.row_locked_assigned")}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200/80 bg-slate-50 text-slate-400"
                          >
                            <Lock size={13} aria-hidden />
                          </span>
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
            {entered.length > 0 ? (
              /* Cumulative detail, one cell per column — the totals row the Salary
                 Register ends with, rather than a sentence under the table. A number
                 sitting under its own heading is read where it is looked for, and it
                 moves as the day is typed: birds, boxes, kg and city counts all come
                 from the rows above, never from a second calculation. */
              <tfoot>
                <tr className="border-t-2 border-slate-200 bg-slate-50">
                  <td className="px-4 py-4" aria-hidden="true">
                    <Hash size={13} className="text-slate-300" />
                  </td>
                  <th
                    scope="row"
                    className="px-4 py-4 text-left text-[13px] font-bold whitespace-nowrap text-slate-800"
                  >
                    <span className="inline-flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-lg border border-sky-100 bg-sky-50 text-sky-600">
                        <Store size={12} aria-hidden />
                      </span>
                      {to("orders.collection_summary_shops", {
                        shops: totals.totalShops,
                      })}
                    </span>
                  </th>
                  <td className="px-4 py-4 text-[13px] font-bold whitespace-nowrap text-amber-700 tabular-nums">
                    {to("orders.collection_footer_cities", {
                      cities: footerStats.cities,
                    })}
                  </td>
                  <td className="px-4 py-4 text-[13px] font-bold whitespace-nowrap text-emerald-700 tabular-nums">
                    {totals.totalBirds}{" "}
                    <span className="text-[11px] font-semibold text-emerald-600/80">
                      {to("orders.word_birds")}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-[13px] font-bold whitespace-nowrap text-violet-700 tabular-nums">
                    {totals.totalBoxes}{" "}
                    <span className="text-[11px] font-semibold text-violet-600/80">
                      {to("orders.word_boxes")}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-[13px] font-bold whitespace-nowrap text-teal-700 tabular-nums">
                    {formatKg(totals.totalWeight, false)}{" "}
                    <span className="text-[11px] font-semibold text-teal-600/80">
                      kg
                    </span>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className="inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 text-[11px] font-semibold text-slate-500">
                      <span className="inline-flex items-center gap-1 whitespace-nowrap tabular-nums">
                        <Truck
                          size={12}
                          className="text-indigo-500"
                          aria-hidden
                        />
                        {to("orders.collection_footer_on_vehicles", {
                          count: footerStats.onVehicles,
                        })}
                      </span>
                      <span className="text-slate-300" aria-hidden>
                        ·
                      </span>
                      <span className="inline-flex items-center gap-1 whitespace-nowrap tabular-nums">
                        <Clock
                          size={12}
                          className="text-slate-400"
                          aria-hidden
                        />
                        {to("orders.collection_footer_awaiting", {
                          count: footerStats.awaiting,
                        })}
                      </span>
                    </span>
                  </td>
                  <td className="px-4 py-4" />
                </tr>
              </tfoot>
            ) : null}
          </table>
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
                className={`group relative ${opsSecondaryButtonClass} border-emerald-300 text-emerald-700 transition-[background-color,box-shadow,transform,border-color] duration-200 ease-out hover:-translate-y-px hover:bg-emerald-50 hover:shadow-[0_6px_16px_-8px_rgba(16,185,129,0.6)] focus-visible:ring-2 focus-visible:ring-emerald-500/40 active:translate-y-0 active:scale-[0.985] motion-safe:transition ${
                  savedFlash ? "border-emerald-400 bg-emerald-50/70 " : ""
                }`}
              >
                {saving ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : savedFlash ? (
                  // Saved: the check pops in once, then the disk returns.
                  <span className="inline-flex motion-safe:animate-[var(--animate-pop-in)]">
                    <Check size={14} />
                  </span>
                ) : (
                  <span
                    className={`inline-flex ${uiActionIconMotionClass.approve}`}
                  >
                    <Save size={14} />
                  </span>
                )}
                {saving
                  ? to("orders.saving")
                  : savedFlash
                    ? to("orders.collection_saved_short")
                    : to("orders.save_progress")}
                {/* The window's own bar, so the button says "kept" even after the
                    check has gone back to a disk. */}
                <span
                  className={`pointer-events-none absolute inset-x-2 bottom-0 h-[2px] rounded-full bg-emerald-500/70 transition-opacity duration-500 ${
                    savedFlash ? "opacity-100" : "opacity-0"
                  }`}
                  aria-hidden
                />
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
    </>
  );
}

export default React.memo(OrderCollectionPage);
