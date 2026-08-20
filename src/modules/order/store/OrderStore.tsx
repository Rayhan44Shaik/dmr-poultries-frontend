// src/modules/order/store/OrderStore.tsx
// -----------------------------------------------------------------------------
// Order store provider (frontend-only, in-memory).
//
// Backed by demo data (orderMockData) and exposed through React context so
// every Order page shares one source of truth. A real API service can replace
// the mutation functions later without changing the consuming components.
// -----------------------------------------------------------------------------

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Order, OrderDraft } from "../types/orderTypes";
import { ORDER_SEED, ORDER_SHOPS } from "../data/orderMockData";
import { nextOrderNumber } from "../utils/orderValidation";
import { OrderContext, type OrderStore } from "./orderContext";

export function OrderProvider({ children }: { children: ReactNode }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Simulated initial fetch so every data-driven section exercises a real
  // loading state before demo data arrives.
  useEffect(() => {
    const t = window.setTimeout(() => {
      setOrders(ORDER_SEED);
      setIsLoading(false);
    }, 500);
    return () => window.clearTimeout(t);
  }, []);

  const addOrder = useCallback(
    (draft: OrderDraft): Order => {
      const shop = ORDER_SHOPS.find((s) => s.id === draft.shopId) ?? ORDER_SHOPS[0];
      const now = new Date().toISOString();
      const order: Order = {
        id: `ord-${Date.now()}`,
        orderNumber: nextOrderNumber(orders.length),
        shop,
        birdType: draft.birdType,
        requirementType: draft.requirementType,
        birds: draft.birds,
        boxes: draft.boxes,
        expectedWeightKg: draft.expectedWeightKg,
        remarks: draft.remarks,
        priority: draft.priority,
        importantCustomer: draft.importantCustomer,
        deliveryDate: draft.deliveryDate,
        deadlineTime: draft.deadlineTime,
        deadlineLabel: draft.deadlineLabel,
        deliveryWindow: draft.deliveryWindow,
        status: "Confirmed",
        pickupSource: null,
        vehicleAssignment: null,
        createdAt: now,
        updatedAt: now,
      };
      setOrders((prev) => [order, ...prev]);
      return order;
    },
    [orders.length],
  );

  const updateOrder = useCallback((id: string, patch: Partial<Order>) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === id ? { ...o, ...patch, updatedAt: new Date().toISOString() } : o)),
    );
  }, []);

  const assignVehicle = useCallback((id: string, assignment: NonNullable<Order["vehicleAssignment"]>) => {
    setOrders((prev) =>
      prev.map((o) =>
        o.id === id ? { ...o, vehicleAssignment: assignment, status: "Assigned", updatedAt: new Date().toISOString() } : o,
      ),
    );
  }, []);

  const setStatus = useCallback((id: string, status: Order["status"]) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === id ? { ...o, status, updatedAt: new Date().toISOString() } : o)),
    );
  }, []);

  const getShopById = useCallback((shopId: string) => ORDER_SHOPS.find((s) => s.id === shopId), []);
  const listShops = useCallback(() => ORDER_SHOPS, []);

  const value = useMemo<OrderStore>(
    () => ({ orders, isLoading, addOrder, updateOrder, assignVehicle, setStatus, getShopById, listShops }),
    [orders, isLoading, addOrder, updateOrder, assignVehicle, setStatus, getShopById, listShops],
  );

  return <OrderContext.Provider value={value}>{children}</OrderContext.Provider>;
}
