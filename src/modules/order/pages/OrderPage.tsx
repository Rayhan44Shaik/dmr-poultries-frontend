// src/modules/order/pages/OrderPage.tsx
// Main Orders page: summary cards, filters, and the orders table.

import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import OrderHeader from "../components/OrderHeader";
import OrderSummaryCards from "../components/OrderSummaryCards";
import OrderFilters from "../components/OrderFilters";
import OrderTable from "../components/OrderTable";
import OrderDetailsDrawer from "../components/OrderDetailsDrawer";
import { useOrders } from "../store/orderContext";
import { summarizeOrders } from "../utils/summary";
import { applyFilters, EMPTY_FILTERS, type OrderFilterState } from "../utils/orderFilters";
import type { Order } from "../types/orderTypes";
import { shouldShowPagination } from "../../../shared/ui/paginationStyles";

const PAGE_SIZE = 12;

export default function OrderPage() {
  const navigate = useNavigate();
  const { orders, isLoading } = useOrders();
  const [filters, setFilters] = useState<OrderFilterState>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const filtered = useMemo(() => applyFilters(orders, filters), [orders, filters]);
  const summary = useMemo(() => summarizeOrders(filtered), [filtered]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = useMemo(
    () => filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [filtered, safePage],
  );

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    window.setTimeout(() => setRefreshing(false), 600);
  }, []);

  return (
    <div className="mx-auto max-w-[1600px] px-3 py-4 md:px-6 md:py-6">
      <div className="space-y-4">
        <OrderHeader
          onNewOrder={() => navigate("/order/new")}
          onRefresh={handleRefresh}
          refreshing={refreshing}
        />

        <OrderSummaryCards summary={summary} isLoading={isLoading} />

        <OrderFilters
          filters={filters}
          onChange={(next) => {
            setFilters(next);
            setPage(1);
          }}
          orders={orders}
          resultCount={filtered.length}
          totalCount={orders.length}
        />

        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <OrderTable
            orders={paginated}
            isLoading={isLoading}
            onOpenDetails={setSelectedOrder}
          />

          {!isLoading && shouldShowPagination(filtered.length) && (
            <div className="flex items-center justify-end gap-1.5 border-t border-slate-200 px-3 py-2">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setPage(safePage - 1)}
                className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-40"
              >
                Prev
              </button>
              <span className="px-2 text-xs font-semibold text-slate-500">
                Page {safePage} of {totalPages}
              </span>
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setPage(safePage + 1)}
                className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>

      <OrderDetailsDrawer order={selectedOrder} onClose={() => setSelectedOrder(null)} />
    </div>
  );
}
