// src/modules/operations/orders/components/OrdersDeliveryTrackingTab.tsx
// TAB 3 — DELIVERY TRACKING.
//
// A per-shop delivery history for a date RANGE. Every figure is the backend's
// own: assigned / loaded (pickup) / pending / delivered / remaining boxes and
// the ACTUAL Step 4 capture timestamp, kept in sync by the backend inside the
// Step 4 save transaction. The tab renders it — it never derives it.
//
// Row actions reuse the existing trip services: View opens the delivery
// detail sheet for the shop's trip, and PDF / WhatsApp work unchanged.

import { useMemo } from "react";
import { Eye, FileText, RefreshCw } from "lucide-react";
import {
  opsTableDivideClass,
  opsTableHeadRowClass,
  opsTableTdClass,
  opsTableThClass,
  opsTableRowClass,
} from "../../../../shared/ui/operationsStyles";
import { DatePicker } from "../../../../components/common/DatePicker";
import { formatDeliveredAtLabel } from "../ordersUtils";
import type { OrderAssignmentView, OrderView, OrdersPage } from "../services/ordersApi";
import { useOrdersI18n } from "../i18n/ordersI18n";
import {
  OrdersEmptyState,
  OrdersIconButton,
  OrdersPagination,
  OrdersSearchInput,
  OrdersStatusBadge,
  OrdersSummaryStrip,
  OrdersTableSkeleton,
  WhatsAppIcon,
} from "./OrdersCommon";

/** One rendered line = one shop on one trip (or an unassigned order). */
type TrackingLine = {
  key: string;
  order: OrderView;
  assignment: OrderAssignmentView | null;
};

type Props = {
  page: OrdersPage;
  loading: boolean;
  fromDate: string;
  toDate: string;
  today: string;
  onRangeChange: (from: string, to: string) => void;
  search: string;
  onSearchChange: (value: string) => void;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  /** Table-level Refresh (same fetch + a confirmation toast). */
  onRefresh: () => void;
  refreshing: boolean;
  /** Row actions (reuse the existing trip detail / PDF / WhatsApp services). */
  onView: (tripId: number) => void;
  onPdf: (tripId: number) => void;
  onWhatsApp: (tripId: number) => void;
  pdfBusyTripId: number | null;
  whatsappBusyTripId: number | null;
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

export default function OrdersDeliveryTrackingTab({
  page,
  loading,
  fromDate,
  toDate,
  today,
  onRangeChange,
  search,
  onSearchChange,
  pageSize,
  onPageChange,
  onPageSizeChange,
  onRefresh,
  refreshing,
  onView,
  onPdf,
  onWhatsApp,
  pdfBusyTripId,
  whatsappBusyTripId,
}: Props) {
  const { to } = useOrdersI18n();

  // One line per (order, assignment). An order with no assignment yet still
  // appears — "Pending"/"Collected" is part of the delivery history too.
  const lines = useMemo<TrackingLine[]>(() => {
    const out: TrackingLine[] = [];
    for (const order of page.rows) {
      if (order.assignments.length === 0) {
        out.push({ key: order.id > 0 ? `o-${order.id}` : `s-${order.shopId}`, order, assignment: null });
        continue;
      }
      for (const assignment of order.assignments) {
        out.push({ key: `o-${order.id}-a-${assignment.id}`, order, assignment });
      }
    }
    return out;
  }, [page.rows]);

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
      {
        key: "delivered_shops",
        label: to("orders.metric_delivered_shops"),
        value: page.summary.deliveredShops,
      },
    ],
    [page.summary, to]
  );

  const startIndex = (page.page - 1) * page.pageSize;

  return (
    <div className="space-y-3">
      <OrdersSummaryStrip metrics={summaryMetrics} />

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-visible">
        <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50/60 flex items-center gap-2 flex-wrap">
          <OrdersSearchInput
            value={search}
            onChange={onSearchChange}
            placeholder={to("orders.search_tracking")}
            className="w-full sm:w-72"
          />
          {/* Date RANGE — both bounds drive the server query. */}
          <div className="inline-flex items-center gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
              {to("orders.from")}
            </span>
            <DatePicker
              value={fromDate}
              onChange={(v) => v && onRangeChange(v, v > toDate ? v : toDate)}
              maxDate={today}
              placeholder="DD/MM/YYYY"
              hideThisWeek
              hideClear
              className="w-40"
              data-testid="orders-tracking-from"
            />
            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
              {to("orders.to")}
            </span>
            <DatePicker
              value={toDate}
              onChange={(v) => v && onRangeChange(v < fromDate ? v : fromDate, v)}
              maxDate={today}
              placeholder="DD/MM/YYYY"
              hideThisWeek
              hideClear
              className="w-40"
              data-testid="orders-tracking-to"
            />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <OrdersIconButton
              label={`${to("orders.refresh")} — ${to("orders.refresh_tracking")}`}
              onClick={onRefresh}
              busy={refreshing}
            >
              <RefreshCw size={14} />
            </OrdersIconButton>
          </div>
        </div>

        {loading ? (
          <OrdersTableSkeleton rows={6} />
        ) : lines.length === 0 ? (
          <OrdersEmptyState title={to("orders.tracking_empty")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1420px]">
              <thead className={opsTableHeadRowClass}>
                <tr>
                  <th className={opsTableThClass}>{to("orders.col_sno")}</th>
                  <th className={opsTableThClass}>{to("orders.col_date")}</th>
                  <th className={opsTableThClass}>{to("orders.col_order_no")}</th>
                  <th className={opsTableThClass}>{to("orders.col_shop_name")}</th>
                  <th className={opsTableThClass}>{to("orders.col_city")}</th>
                  <th className={opsTableThClass}>{to("orders.col_trip")}</th>
                  <th className={opsTableThClass}>{to("orders.col_vehicle")}</th>
                  <th className={opsTableThClass}>{to("orders.col_sequence")}</th>
                  <th className={opsTableThClass}>{to("orders.col_required_boxes")}</th>
                  <th className={opsTableThClass}>{to("orders.col_pickup_boxes")}</th>
                  <th className={opsTableThClass}>{to("orders.col_pending_boxes")}</th>
                  <th className={opsTableThClass}>{to("orders.col_delivered_boxes")}</th>
                  <th className={opsTableThClass}>{to("orders.col_remaining_boxes")}</th>
                  <th className={opsTableThClass}>{to("orders.col_delivered_at")}</th>
                  <th className={opsTableThClass}>{to("orders.col_status")}</th>
                  <th className={`${opsTableThClass} text-right`}>{to("orders.col_action")}</th>
                </tr>
              </thead>
              <tbody className={opsTableDivideClass}>
                {lines.map((line, index) => {
                  const { order, assignment } = line;
                  const tripId = assignment?.tripId ?? 0;
                  // The per-delivery email/WhatsApp services accept COMPLETED
                  // trips only (they reject anything else with 422), so the
                  // action must not be offered before the trip is completed.
                  const tripCompleted = assignment?.tripStatus === "Completed";
                  return (
                    <tr key={line.key} className={opsTableRowClass}>
                      <td className={opsTableTdClass}>{startIndex + index + 1}</td>
                      <td className={opsTableTdClass}>{order.orderDate}</td>
                      <td className={`${opsTableTdClass} font-mono text-xs text-slate-500`}>
                        {order.orderNo}
                      </td>
                      <td className={`${opsTableTdClass} font-semibold text-slate-800`}>
                        {order.shopName}
                      </td>
                      <td className={opsTableTdClass}>{order.city || "—"}</td>
                      <td className={`${opsTableTdClass} text-xs`}>{assignment?.tripNo ?? "—"}</td>
                      <td className={`${opsTableTdClass} text-xs`}>{assignment?.vehicleNo || "—"}</td>
                      <td className={`${opsTableTdClass} tabular-nums`}>{assignment?.sequence ?? "—"}</td>
                      <td className={`${opsTableTdClass} font-semibold tabular-nums`}>
                        {order.requiredBoxes}
                      </td>
                      <td className={`${opsTableTdClass} tabular-nums`}>
                        {assignment?.pickupBoxes ?? 0}
                      </td>
                      <td className={`${opsTableTdClass} tabular-nums font-semibold text-amber-700`}>
                        {order.pendingBoxes}
                      </td>
                      <td className={`${opsTableTdClass} tabular-nums font-semibold text-emerald-700`}>
                        {assignment?.deliveredBoxes ?? 0}
                      </td>
                      <td className={`${opsTableTdClass} tabular-nums`}>{order.remainingBoxes}</td>
                      <td className={`${opsTableTdClass} text-xs text-slate-500`}>
                        {formatDeliveredAtLabel(assignment?.deliveredAt ?? null)}
                      </td>
                      <td className={opsTableTdClass}>
                        <OrdersStatusBadge
                          status={order.status}
                          label={to(statusKeyOf(order.status))}
                        />
                      </td>
                      <td className={`${opsTableTdClass} text-right`}>
                        <div className="inline-flex items-center gap-1.5">
                          <OrdersIconButton
                            label={to("orders.view_delivery")}
                            disabled={!tripId}
                            onClick={() => onView(tripId)}
                          >
                            <Eye size={14} />
                          </OrdersIconButton>
                          <OrdersIconButton
                            label={to("orders.download_pdf")}
                            tone="rose"
                            disabled={!tripId}
                            busy={pdfBusyTripId === tripId && tripId > 0}
                            onClick={() => onPdf(tripId)}
                          >
                            <FileText size={14} />
                          </OrdersIconButton>
                          <OrdersIconButton
                            label={
                              tripCompleted
                                ? to("orders.send_whatsapp")
                                : to("orders.whatsapp_completed_only")
                            }
                            tone="emerald"
                            disabled={!tripId || !tripCompleted}
                            busy={whatsappBusyTripId === tripId && tripId > 0}
                            onClick={() => onWhatsApp(tripId)}
                          >
                            <WhatsAppIcon size={14} />
                          </OrdersIconButton>
                        </div>
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
      </div>
    </div>
  );
}
