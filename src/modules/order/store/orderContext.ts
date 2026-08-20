// src/modules/order/store/orderContext.ts
// Order store context + accessor hook (no components — keeps fast refresh happy).

import { createContext, useContext } from "react";
import type { Order, OrderDraft } from "../types/orderTypes";

export interface OrderStore {
  orders: Order[];
  isLoading: boolean;
  addOrder: (draft: OrderDraft) => Order;
  updateOrder: (id: string, patch: Partial<Order>) => void;
  assignVehicle: (id: string, assignment: NonNullable<Order["vehicleAssignment"]>) => void;
  setStatus: (id: string, status: Order["status"]) => void;
  getShopById: (shopId: string) => Order["shop"] | undefined;
  listShops: () => Order["shop"][];
}

export const OrderContext = createContext<OrderStore | null>(null);

export function useOrders(): OrderStore {
  const ctx = useContext(OrderContext);
  if (!ctx) throw new Error("useOrders must be used within an OrderProvider");
  return ctx;
}
