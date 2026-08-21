// src/modules/order/utils/summary.ts
// Summary derivation for the Order dashboard cards.

import type { Order } from "../types/orderTypes";

export interface OrderSummary {
  total: number;
  pending: number;
  urgent: number;
  assigned: number;
  inDelivery: number;
  completed: number;
}

export function summarizeOrders(orders: Order[]): OrderSummary {
  return {
    total: orders.length,
    pending: orders.filter((o) => o.status === "Pending" || o.status === "Awaiting Assignment" || o.status === "Confirmed").length,
    urgent: orders.filter((o) => o.priority === "Urgent" && o.status !== "Delivered" && o.status !== "Cancelled").length,
    assigned: orders.filter((o) => o.vehicleAssignment != null && o.status !== "Delivered" && o.status !== "Cancelled").length,
    inDelivery: orders.filter((o) => o.status === "In Transit" || o.status === "Picked Up" || o.status === "Arrived").length,
    completed: orders.filter((o) => o.status === "Delivered").length,
  };
}
