// src/modules/operations/orders/components/OrdersDeliveryTrackingTab.tsx
// TAB 3 — DELIVERY TRACKING.
//
// EXACTLY TWO TABLES (completed and pending vehicles are never mixed),
// each with the SAME clean column set:
//   S.No · Trip No · Vehicle · Supervisor · Total Shops · Ordered Boxes ·
//   Delivered Boxes · Difference · Progress · Status · Completed At ·
//   Actions
//   1. PENDING & IN PROGRESS — assigned / partially delivered trips
//   2. COMPLETED — completed trips, latest 7 operational days only
//      (window applied by the service; no old-history search, no deletion)
//
// ONE compact table-level search (shop / village / trip / vehicle /
// supervisor / status) + ONE compact status filter + ONE compact
// difference filter — both tables are filtered together, then each is
// paginated 10 rows per page (existing global pagination component; page
// resets to 1 on search/filter change).
//
// Step 4 delivery records are the source of truth — Orders never marks
// anything itself and never writes delivery data. Progress and differences
// are derived from the persisted Step 4 rows (no UI-only state).

import React, { useMemo, useState } from "react";
import { Eye, FileText, MessageCircle, RefreshCw } from "lucide-react";
import {
  opsTableDivideClass,
  opsTableHeadRowClass,
  opsTableTdClass,
  opsTableThClass,
  opsTableRowClass,
} from "../../../../shared/ui/operationsStyles";
import {
  paginationBarClass,
  shouldShowPagination,
} from "../../../../shared/ui/paginationStyles";
import TripPagination from "../../vehicle-trips/components/TripPagination";
import { formatCount, formatDeliveredAtLabel } from "../ordersUtils";
import { paginate, villageOf, type ShopDirectory } from "../ordersService";
import { useOrdersI18n } from "../i18n/ordersI18n";
import type { OrdersTrip } from "../types";
import {
  OrdersEmptyState,
  OrdersFilterSelect,
  OrdersIconButton,
  OrdersSearchInput,
  OrdersStatusBadge,
  OrdersTableSkeleton,
} from "./OrdersCommon";

const PAGE_SIZE = 10;

type Props = {
  trips: OrdersTrip[];
  loading: boolean;
  shopDirectory: ShopDirectory;
  pdfBusyId: number | null;
  whatsappBusyId: number | null;
  onPdf: (ot: OrdersTrip) => void;
  onWhatsApp: (ot: OrdersTrip) => void;
  onView: (ot: OrdersTrip) => void;
  /** Table-level refresh — page refetches Orders data (soft toast after). */
  onRefresh: () => void;
  /** Refresh in flight (duplicate-call guard + busy icon). */
  refreshing: boolean;
};

/**
 * Per-table page slice (existing pattern). Resets to page 1 whenever the
 * resetKey (search + filters) or the result count changes.
 */
function usePaged<T>(
  items: T[],
  pageSize: number,
  resetKey: string
): [T[], number, number, (p: number) => void] {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const [page, setPage] = useState(1);
  const [lastKey, setLastKey] = useState(`${resetKey}|${items.length}`);
  if (lastKey !== `${resetKey}|${items.length}`) {
    setLastKey(`${resetKey}|${items.length}`);
    if (page !== 1) setPage(1);
  }
  const safePage = Math.min(page, totalPages);
  const slice = useMemo(
    () => paginate(items, safePage, pageSize),
    [items, safePage, pageSize]
  );
  return [slice, safePage, totalPages, setPage];
}

// ─── Compact filters (status + difference) ──────────────────────────────────

type StatusFilter =
  | "all"
  | "assigned"
  | "pending"
  | "in_progress"
  | "completed"
  | "not_listed"
  | "with_diff";
type DifferenceFilter = "all" | "none" | "short" | "extra" | "not_listed";

function statusMatches(ot: OrdersTrip, f: StatusFilter): boolean {
  const p = ot.progress;
  if (!p) return f === "all";
  switch (f) {
    case "all":
      return true;
    case "assigned":
    case "pending":
      // Waiting for the first Step 4 capture (delivery not started yet).
      return p.status === "Assigned";
    case "in_progress":
      return p.status === "In Progress";
    case "completed":
      return p.status === "Completed";
    case "not_listed":
      return p.additionalShopCount > 0;
    case "with_diff":
      return p.deliveredShops > 0 && p.deliveredBoxes !== p.totalBoxes;
  }
}

function differenceMatches(ot: OrdersTrip, f: DifferenceFilter): boolean {
  const p = ot.progress;
  if (!p) return f === "all";
  switch (f) {
    case "all":
      return true;
    case "none":
      // 10/10 — clean delivery, nothing extra.
      return p.deliveredShops > 0 && p.deliveredBoxes === p.totalBoxes;
    case "short":
      // 10/9 — fewer boxes delivered than ordered.
      return p.deliveredShops > 0 && p.deliveredBoxes < p.totalBoxes;
    case "extra":
      // 10/11 — more boxes delivered than ordered.
      return p.deliveredShops > 0 && p.deliveredBoxes > p.totalBoxes;
    case "not_listed":
      // Step-4-only: shops delivered that were never in the order.
      return p.additionalShopCount > 0;
  }
}

/** Signed box difference for the Difference column (null = no delivery yet). */
function boxDiff(ot: OrdersTrip): number | null {
  const p = ot.progress;
  if (!p || p.deliveredShops === 0) return null;
  return p.deliveredBoxes - p.totalBoxes;
}

function StatusBadge({ status }: { status: string }) {
  const { to } = useOrdersI18n();
  const label =
    status === "Assigned"
      ? to("orders.status_assigned")
      : status === "In Progress"
        ? to("orders.status_in_progress")
        : to("orders.status_completed");
  return <OrdersStatusBadge status={status} label={label} />;
}

function ActionButtons({
  ot,
  pdfBusyId,
  whatsappBusyId,
  onPdf,
  onWhatsApp,
  onView,
}: {
  ot: OrdersTrip;
  pdfBusyId: number | null;
  whatsappBusyId: number | null;
  onPdf: (ot: OrdersTrip) => void;
  onWhatsApp: (ot: OrdersTrip) => void;
  onView: (ot: OrdersTrip) => void;
}) {
  const { to } = useOrdersI18n();
  const { trip } = ot;
  return (
    <div className="flex items-center gap-1.5">
      <OrdersIconButton label={to("orders.view")} onClick={() => onView(ot)} tone="emerald">
        <Eye size={14} />
      </OrdersIconButton>
      <OrdersIconButton label={to("orders.pdf")} onClick={() => onPdf(ot)} busy={pdfBusyId === trip.id}>
        <FileText size={14} />
      </OrdersIconButton>
      <OrdersIconButton
        label={to("orders.whatsapp")}
        onClick={() => onWhatsApp(ot)}
        busy={whatsappBusyId === trip.id}
      >
        <MessageCircle size={14} />
      </OrdersIconButton>
    </div>
  );
}

/** Progress bar from ACTUAL Step 4 records: delivered shops / total shops. */
function ProgressBar({ ot }: { ot: OrdersTrip }) {
  const { to } = useOrdersI18n();
  const p = ot.progress;
  if (!p) return <span className="text-slate-300 text-xs">—</span>;
  const pct = p.totalShops > 0 ? Math.round((p.deliveredShops / p.totalShops) * 100) : 0;
  return (
    <div className="min-w-[110px]">
      <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 mb-1">
        <span>{to("orders.delivered_of", { x: p.deliveredShops, y: p.totalShops })}</span>
        <span className="text-slate-400">{pct}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${pct === 100 ? "bg-emerald-500" : "bg-amber-400"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function SectionTitle({ label, note }: { label: string; note?: string }) {
  return (
    <div className="px-5 py-3 border-b border-slate-200 bg-slate-50/60 flex items-center justify-between flex-wrap gap-2">
      <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">{label}</h3>
      {note ? <span className="text-[11px] font-semibold text-slate-400">{note}</span> : null}
    </div>
  );
}

/** ONE table with the unified tracking column set. */
function TrackingTable({
  trips,
  pageSlice,
  safePage,
  totalPages,
  onPageChange,
  actionProps,
}: {
  trips: OrdersTrip[];
  pageSlice: OrdersTrip[];
  safePage: number;
  totalPages: number;
  onPageChange: (p: number) => void;
  actionProps: {
    pdfBusyId: number | null;
    whatsappBusyId: number | null;
    onPdf: (ot: OrdersTrip) => void;
    onWhatsApp: (ot: OrdersTrip) => void;
    onView: (ot: OrdersTrip) => void;
  };
}) {
  const { to } = useOrdersI18n();
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1160px] text-xs md:text-sm">
        <thead>
          <tr className={opsTableHeadRowClass}>
            <th className={`${opsTableThClass} w-14`}>{to("orders.col_sno")}</th>
            <th className={opsTableThClass}>{to("orders.col_trip_no")}</th>
            <th className={opsTableThClass}>{to("orders.col_vehicle_no")}</th>
            <th className={opsTableThClass}>{to("orders.supervisor")}</th>
            <th className={`${opsTableThClass} w-20 text-right`}>{to("orders.col_total_shops")}</th>
            <th className={`${opsTableThClass} w-24 text-right`}>{to("orders.ordered_boxes")}</th>
            <th className={`${opsTableThClass} w-28 text-right`}>{to("orders.col_delivered_boxes")}</th>
            <th className={`${opsTableThClass} w-20 text-right`}>{to("orders.col_difference")}</th>
            <th className={`${opsTableThClass} w-32`}>{to("orders.col_progress")}</th>
            <th className={`${opsTableThClass} w-28`}>{to("orders.col_status")}</th>
            <th className={`${opsTableThClass} w-36`}>{to("orders.col_completed_at")}</th>
            <th className={`${opsTableThClass} w-28`}>{to("orders.col_action")}</th>
          </tr>
        </thead>
        <tbody className={opsTableDivideClass}>
          {pageSlice.map((ot, index) => {
            const { trip, progress } = ot;
            const status = progress?.status ?? "Assigned";
            const diff = boxDiff(ot);
            return (
              <tr key={trip.id} className={`${opsTableRowClass} align-middle`}>
                <td className={opsTableTdClass}>
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-slate-50 text-[12px] font-bold text-slate-600">
                    {(safePage - 1) * PAGE_SIZE + index + 1}
                  </span>
                </td>
                <td className={`${opsTableTdClass} font-bold text-emerald-700`}>{trip.tripNo}</td>
                <td className={opsTableTdClass}>{trip.vehicleNo || "—"}</td>
                <td className={opsTableTdClass}>{trip.supervisorName || "—"}</td>
                <td className={`${opsTableTdClass} text-right font-semibold`}>
                  {progress ? formatCount(progress.totalShops) : "—"}
                </td>
                <td className={`${opsTableTdClass} text-right font-bold text-emerald-800`}>
                  {progress ? formatCount(progress.totalBoxes) : "—"}
                </td>
                <td className={`${opsTableTdClass} text-right font-semibold`}>
                  {progress ? formatCount(progress.deliveredBoxes) : "—"}
                </td>
                <td className={opsTableTdClass}>
                  {diff === null ? (
                    <span className="text-slate-300">—</span>
                  ) : diff < 0 ? (
                    <span className="font-bold text-rose-600">−{Math.abs(diff)}</span>
                  ) : diff > 0 ? (
                    <span className="font-bold text-sky-600">+{diff}</span>
                  ) : (
                    <span className="font-semibold text-slate-400">0</span>
                  )}
                </td>
                <td className={opsTableTdClass}>
                  <ProgressBar ot={ot} />
                </td>
                <td className={opsTableTdClass}>
                  <StatusBadge status={status} />
                  {progress && progress.additionalShopCount > 0 && (
                    <span
                      className="ml-1.5 inline-flex items-center rounded-full bg-rose-50 border border-rose-200 px-2 py-0.5 text-[10px] font-bold text-rose-600"
                      title={to("orders.additional_legend")}
                    >
                      +{progress.additionalShopCount}
                    </span>
                  )}
                </td>
                <td className={`${opsTableTdClass} text-slate-500 whitespace-nowrap`}>
                  {formatDeliveredAtLabel(trip.submittedAtTimestamp ?? null) || (
                    <span className="text-slate-300">—</span>
                  )}
                </td>
                <td className={opsTableTdClass}>
                  <ActionButtons ot={ot} {...actionProps} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {shouldShowPagination(trips.length) && (
        <div className={`${paginationBarClass} px-4 py-3 border-t border-slate-100`}>
          <TripPagination
            currentPage={safePage}
            totalPages={totalPages}
            onPageChange={onPageChange}
          />
        </div>
      )}
    </div>
  );
}

function OrdersDeliveryTrackingTab({
  trips,
  loading,
  shopDirectory,
  pdfBusyId,
  whatsappBusyId,
  onPdf,
  onWhatsApp,
  onView,
  onRefresh,
  refreshing,
}: Props) {
  const { to } = useOrdersI18n();

  const active = useMemo(
    () => trips.filter((t) => t.progress?.status !== "Completed"),
    [trips]
  );
  const completed = useMemo(
    () => trips.filter((t) => t.progress?.status === "Completed"),
    [trips]
  );

  // ── One compact search + status filter + difference filter ───────────────
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [differenceFilter, setDifferenceFilter] = useState<DifferenceFilter>("all");
  const q = query.trim().toLowerCase();

  const statusOptions = useMemo(
    () => [
      { value: "all", label: to("orders.all") },
      { value: "assigned", label: to("orders.status_assigned") },
      { value: "pending", label: to("orders.status_pending") },
      { value: "in_progress", label: to("orders.status_in_progress") },
      { value: "completed", label: to("orders.status_completed") },
      { value: "not_listed", label: to("orders.status_not_listed") },
      { value: "with_diff", label: to("orders.delivered_with_difference") },
    ],
    [to]
  );
  const differenceOptions = useMemo(
    () => [
      { value: "all", label: to("orders.all") },
      { value: "none", label: to("orders.no_difference") },
      { value: "short", label: to("orders.short_delivery") },
      { value: "extra", label: to("orders.extra_delivery") },
      { value: "not_listed", label: to("orders.status_not_listed") },
    ],
    [to]
  );

  const haystackFor = (ot: OrdersTrip): string => {
    const { trip, progress } = ot;
    const status = progress?.status ?? "Assigned";
    const parts: string[] = [
      trip.tripNo,
      trip.vehicleNo,
      trip.supervisorName,
      trip.driverName,
      progress?.status === "Completed"
        ? to("orders.status_completed")
        : status === "In Progress"
          ? to("orders.status_in_progress")
          : to("orders.status_assigned"),
    ];
    if (progress && progress.additionalShopCount > 0) parts.push(to("orders.status_not_listed"));
    if (progress && progress.deliveredShops > 0 && progress.deliveredBoxes !== progress.totalBoxes)
      parts.push(to("orders.delivered_with_difference"));
    for (const d of trip.deliveries) {
      parts.push(`${d.shopName} ${villageOf(d.shopId, d.shopName, shopDirectory)}`);
    }
    return parts.filter(Boolean).join(" ").toLowerCase();
  };

  const activeFiltered = useMemo(
    () =>
      active.filter(
        (ot) =>
          statusMatches(ot, statusFilter) &&
          differenceMatches(ot, differenceFilter) &&
          (!q || haystackFor(ot).includes(q))
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [active, statusFilter, differenceFilter, q, to, shopDirectory]
  );
  const completedFiltered = useMemo(
    () =>
      completed.filter(
        (ot) =>
          statusMatches(ot, statusFilter) &&
          differenceMatches(ot, differenceFilter) &&
          (!q || haystackFor(ot).includes(q))
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [completed, statusFilter, differenceFilter, q, to, shopDirectory]
  );

  const filterKey = `${q}|${statusFilter}|${differenceFilter}`;
  const [activePage, safeActivePage, activeTotalPages, setActivePage] = usePaged(
    activeFiltered,
    PAGE_SIZE,
    filterKey
  );
  const [completedPage, safeCompletedPage, completedTotalPages, setCompletedPage] =
    usePaged(completedFiltered, PAGE_SIZE, filterKey);

  if (loading) return <OrdersTableSkeleton rows={5} />;

  const actionProps = { pdfBusyId, whatsappBusyId, onPdf, onWhatsApp, onView };
  const filtersActive = q !== "" || statusFilter !== "all" || differenceFilter !== "all";

  return (
    <div className="space-y-4">
      {/* Table-level controls: ONE search + ONE status filter + ONE
          difference filter + Refresh (both tables below are filtered
          together). No section heading — the active tab says it. */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm px-5 py-2.5 flex items-center gap-3 flex-wrap">
        <OrdersSearchInput
          value={query}
          onChange={setQuery}
          placeholder={to("orders.search_tracking")}
          ariaLabel={to("orders.search_tracking")}
          className="w-full sm:w-64"
        />
        <OrdersFilterSelect
          value={statusFilter}
          onChange={(v) => setStatusFilter(v as StatusFilter)}
          options={statusOptions}
          ariaLabel={to("orders.filter_status")}
        />
        <OrdersFilterSelect
          value={differenceFilter}
          onChange={(v) => setDifferenceFilter(v as DifferenceFilter)}
          options={differenceOptions}
          ariaLabel={to("orders.filter_difference")}
        />
        <OrdersIconButton
          label={`${to("orders.refresh")} — ${to("orders.refresh_tracking")}`}
          onClick={onRefresh}
          busy={refreshing}
        >
          <RefreshCw size={14} />
        </OrdersIconButton>
      </div>

      {/* ── TABLE 1 — PENDING & IN PROGRESS ─────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <SectionTitle label={to("orders.tracking_active_title")} />
        {activeFiltered.length === 0 ? (
          <OrdersEmptyState
            title={
              filtersActive && active.length > 0
                ? to("orders.no_search_results")
                : to("orders.no_pending_deliveries")
            }
          />
        ) : (
          <TrackingTable
            trips={activeFiltered}
            pageSlice={activePage}
            safePage={safeActivePage}
            totalPages={activeTotalPages}
            onPageChange={setActivePage}
            actionProps={actionProps}
          />
        )}
      </div>

      {/* ── TABLE 2 — COMPLETED (latest 7 operational days) ─────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <SectionTitle
          label={to("orders.tracking_completed_title")}
          note={to("orders.week_window_note")}
        />
        {completedFiltered.length === 0 ? (
          <OrdersEmptyState
            title={
              filtersActive && completed.length > 0
                ? to("orders.no_search_results")
                : to("orders.no_completed_window")
            }
          />
        ) : (
          <TrackingTable
            trips={completedFiltered}
            pageSlice={completedPage}
            safePage={safeCompletedPage}
            totalPages={completedTotalPages}
            onPageChange={setCompletedPage}
            actionProps={actionProps}
          />
        )}
      </div>
    </div>
  );
}

export default React.memo(OrdersDeliveryTrackingTab);
