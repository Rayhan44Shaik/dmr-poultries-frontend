// src/modules/operations/orders/components/OrdersLoadedShopsDialog.tsx
// TAB 2 — ORDER ASSIGNMENT · "View Loaded Shops".
//
// Opened from the vehicle-details table. Lists EVERY shop that carries more
// than zero pickup boxes on the selected trip, with the full shop record
// (order no, shop, owner, city, mobile, sequence) beside the quantities.
//
// It re-reads the SERVER for the whole trip instead of filtering the table's
// current page: the assignment table shows 10 rows at a time, so a page-local
// filter would silently omit shops on page 2. The listing is fetched with the
// backend's own `tripId` filter and paged through to the end, so the dialog is
// complete and identical for every user.
//
// Only PERSISTED assignments appear here — unsaved pickup edits are still in
// the table's draft, and a banner says so rather than letting the two
// disagree in silence.
//
// Concurrency: the fetch carries a cancel flag checked after every await, so
// a retry supersedes the run it replaces and closing the dialog mid-flight
// writes nothing.

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Store, X } from "lucide-react";
import {
  opsPrimaryButtonClass,
  opsTableDivideClass,
  opsTableHeadRowClass,
  opsTableTdClass,
  opsTableThClass,
  opsTableRowClass,
} from "../../../../shared/ui/operationsStyles";
import { listOrders, type OrderView } from "../services/ordersApi";
import type { ShopDirectory } from "../ordersService";
import { sortLoadedShops, toLoadedShops, type LoadedShopRow } from "../ordersUtils";
import type { OrdersT } from "../i18n/ordersI18n";
import {
  OrdersEmptyState,
  OrdersErrorState,
  OrdersPagination,
  OrdersSearchInput,
  OrdersStatusBadge,
  OrdersTableSkeleton,
} from "./OrdersCommon";
import { ORDERS_DEFAULT_PAGE_SIZE } from "./ordersUiConstants";

/** Hard stop so a malformed response can never spin the pager forever. */
const MAX_FETCH_PAGES = 25;
const FETCH_PAGE_SIZE = 200;

/** Shared empty result — keeps the derived memos referentially stable. */
const EMPTY_ROWS: LoadedShopRow[] = [];

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

type FetchState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; rows: LoadedShopRow[] };

type Props = {
  tripId: number;
  vehicleNo: string;
  tripNo: string;
  shopDirectory: ShopDirectory;
  /** true = the table holds unsaved pickup edits not reflected here. */
  dirty: boolean;
  onClose: () => void;
  t: OrdersT;
};

function OrdersLoadedShopsDialog({
  tripId,
  vehicleNo,
  tripNo,
  shopDirectory,
  dirty,
  onClose,
  t,
}: Props) {
  const [state, setState] = useState<FetchState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(ORDERS_DEFAULT_PAGE_SIZE);

  // Whole trip, every page — the dialog is a complete list by definition.
  // State is written ONLY from the async callbacks, so the effect never
  // triggers a cascading render.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const collected: LoadedShopRow[] = [];
        let current = 1;
        for (let i = 0; i < MAX_FETCH_PAGES; i += 1) {
          // Addressed by TRIP, not by day: an open trip may carry orders
          // raised on another date, and every one of them is on that truck.
          const result = await listOrders({
            tripId,
            page: current,
            pageSize: FETCH_PAGE_SIZE,
          });
          if (cancelled) return;
          collected.push(...toLoadedShops(result.rows, tripId, shopDirectory));
          if (result.page >= result.totalPages) break;
          current = result.page + 1;
        }
        if (!cancelled) setState({ status: "ready", rows: sortLoadedShops(collected) });
      } catch (error) {
        if (!cancelled) {
          setState({
            status: "error",
            message: error instanceof Error ? error.message : t("orders.load_failed"),
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tripId, shopDirectory, attempt, t]);

  const retry = useCallback(() => {
    setState({ status: "loading" });
    setAttempt((a) => a + 1);
  }, []);

  // Escape closes, exactly like the delivery detail sheet.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Stable identity while loading / on error, so the memos below do not
  // recompute on every render.
  const allRows = useMemo(
    () => (state.status === "ready" ? state.rows : EMPTY_ROWS),
    [state]
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return allRows;
    return allRows.filter((r) =>
      [r.shopName, r.owner, r.city, r.mobile, r.orderNo].some((field) =>
        field.toLowerCase().includes(needle)
      )
    );
  }, [allRows, query]);

  // Filters always reset pagination (adjusted during render, not in an
  // effect, so the user never sees an out-of-range page for a frame).
  const filterKey = `${query}|${filtered.length}|${pageSize}`;
  const [lastFilterKey, setLastFilterKey] = useState(filterKey);
  if (lastFilterKey !== filterKey) {
    setLastFilterKey(filterKey);
    if (page !== 1) setPage(1);
  }

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const startIndex = filtered.length === 0 ? 0 : (safePage - 1) * pageSize;

  /** Totals over every MATCHING row — not just the visible page. */
  const totals = useMemo(
    () =>
      filtered.reduce(
        (acc, r) => ({
          required: acc.required + r.requiredBoxes,
          pickup: acc.pickup + r.pickupBoxes,
          delivered: acc.delivered + r.deliveredBoxes,
          open: acc.open + r.openBoxes,
        }),
        { required: 0, pickup: 0, delivered: 0, open: 0 }
      ),
    [filtered]
  );

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} aria-hidden />

      <div className="relative flex min-h-full items-start justify-center p-3 md:p-8">
        <div className="relative w-full max-w-6xl overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-2xl">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-3.5">
            <div className="flex min-w-0 items-center gap-2.5">
              <span
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-emerald-100 bg-emerald-50 text-emerald-600"
                aria-hidden
              >
                <Store size={16} />
              </span>
              <div className="min-w-0">
                <h2 className="truncate text-base font-bold leading-tight text-slate-900">
                  {t("orders.loaded_shops_title")}
                </h2>
                <p className="truncate text-[11.5px] font-semibold text-slate-500">
                  {`${vehicleNo || "—"} · ${tripNo}`}
                  {state.status === "ready" &&
                    ` · ${t("orders.loaded_shops_count", {
                      shops: allRows.length,
                      boxes: allRows.reduce((s, r) => s + r.pickupBoxes, 0),
                    })}`}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-800 active:scale-95"
              aria-label={t("orders.close")}
            >
              <X size={16} />
            </button>
          </div>

          <div className="space-y-3 p-3 md:p-4">
            {dirty && (
              <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/70 px-3.5 py-2.5 text-[11.5px] font-semibold text-amber-800">
                <AlertTriangle size={14} className="mt-px flex-shrink-0" aria-hidden />
                {t("orders.loaded_shops_unsaved")}
              </div>
            )}

            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50/60 px-4 py-2.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  {t("orders.loaded_shops_section")}
                </h3>
                <OrdersSearchInput
                  value={query}
                  onChange={setQuery}
                  placeholder={t("orders.search_loaded_shops")}
                  className="ml-auto w-full sm:w-72"
                />
              </div>

              {state.status === "loading" ? (
                <OrdersTableSkeleton rows={6} />
              ) : state.status === "error" ? (
                <OrdersErrorState
                  title={t("orders.error_title")}
                  message={state.message}
                  onRetry={retry}
                  retryLabel={t("orders.retry")}
                />
              ) : filtered.length === 0 ? (
                <OrdersEmptyState
                  title={
                    allRows.length === 0
                      ? t("orders.no_loaded_shops")
                      : t("orders.no_loaded_shops_match")
                  }
                  hint={allRows.length === 0 ? t("orders.no_loaded_shops_hint") : undefined}
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1180px]">
                    <thead className={opsTableHeadRowClass}>
                      <tr>
                        <th className={opsTableThClass}>{t("orders.col_sno")}</th>
                        <th className={opsTableThClass}>{t("orders.col_order_no")}</th>
                        <th className={opsTableThClass}>{t("orders.col_shop_name")}</th>
                        <th className={opsTableThClass}>{t("orders.col_owner")}</th>
                        <th className={opsTableThClass}>{t("orders.col_city")}</th>
                        <th className={opsTableThClass}>{t("orders.col_mobile")}</th>
                        <th className={opsTableThClass}>{t("orders.col_sequence")}</th>
                        <th className={opsTableThClass}>{t("orders.col_required_boxes")}</th>
                        <th className={opsTableThClass}>{t("orders.col_pickup_boxes")}</th>
                        <th className={opsTableThClass}>{t("orders.col_delivered_boxes")}</th>
                        <th className={opsTableThClass}>{t("orders.col_open_boxes")}</th>
                        <th className={opsTableThClass}>{t("orders.col_status")}</th>
                      </tr>
                    </thead>
                    <tbody className={opsTableDivideClass}>
                      {pageRows.map((row, index) => (
                        <tr key={row.key} className={opsTableRowClass}>
                          <td className={`${opsTableTdClass} text-slate-400`}>
                            {startIndex + index + 1}
                          </td>
                          <td className={`${opsTableTdClass} font-mono text-xs text-slate-500`}>
                            {row.orderNo || "—"}
                          </td>
                          <td className={`${opsTableTdClass} font-semibold text-slate-800`}>
                            {row.shopName}
                          </td>
                          <td className={opsTableTdClass}>{row.owner || "—"}</td>
                          <td className={opsTableTdClass}>{row.city || "—"}</td>
                          <td className={`${opsTableTdClass} tabular-nums`}>
                            {row.mobile || "—"}
                          </td>
                          <td className={`${opsTableTdClass} tabular-nums`}>{row.sequence}</td>
                          <td className={`${opsTableTdClass} tabular-nums`}>
                            {row.requiredBoxes}
                          </td>
                          <td
                            className={`${opsTableTdClass} font-bold tabular-nums text-emerald-700`}
                          >
                            {row.pickupBoxes}
                          </td>
                          <td className={`${opsTableTdClass} tabular-nums`}>
                            {row.deliveredBoxes}
                          </td>
                          <td
                            className={`${opsTableTdClass} tabular-nums font-semibold ${
                              row.openBoxes > 0 ? "text-amber-700" : "text-slate-400"
                            }`}
                          >
                            {row.openBoxes}
                          </td>
                          <td className={opsTableTdClass}>
                            <OrdersStatusBadge
                              status={row.status}
                              label={t(statusKeyOf(row.status))}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-slate-200 bg-slate-50/80">
                        <td
                          className={`${opsTableTdClass} font-bold uppercase tracking-wider text-slate-500`}
                          colSpan={7}
                        >
                          {t("orders.loaded_shops_total", { shops: filtered.length })}
                        </td>
                        <td className={`${opsTableTdClass} font-bold tabular-nums text-slate-700`}>
                          {totals.required}
                        </td>
                        <td className={`${opsTableTdClass} font-bold tabular-nums text-emerald-700`}>
                          {totals.pickup}
                        </td>
                        <td className={`${opsTableTdClass} font-bold tabular-nums text-slate-700`}>
                          {totals.delivered}
                        </td>
                        <td className={`${opsTableTdClass} font-bold tabular-nums text-amber-700`}>
                          {totals.open}
                        </td>
                        <td className={opsTableTdClass} />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              {state.status === "ready" && filtered.length > 0 && (
                <OrdersPagination
                  page={safePage}
                  totalPages={totalPages}
                  total={filtered.length}
                  pageSize={pageSize}
                  onPageChange={setPage}
                  onPageSizeChange={setPageSize}
                  t={t}
                />
              )}
            </div>

            <div className="flex justify-end">
              <button type="button" className={opsPrimaryButtonClass} onClick={onClose}>
                {t("orders.close")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default React.memo(OrdersLoadedShopsDialog);
