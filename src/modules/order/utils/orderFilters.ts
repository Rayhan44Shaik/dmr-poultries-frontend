// src/modules/order/utils/orderFilters.ts
// Pure filtering logic for the Order list (kept separate from the component
// so it stays independently testable and fast-refresh friendly).

import type { Order } from "../types/orderTypes";

export interface OrderFilterState {
  search: string;
  deliveryDate: string;
  priority: string;
  status: string;
  vehicle: string;
  pickupLocation: string;
  shop: string;
  birdType: string;
  assigned: "" | "assigned" | "unassigned";
  importantOnly: boolean;
  urgentOnly: boolean;
}

export const EMPTY_FILTERS: OrderFilterState = {
  search: "",
  deliveryDate: "",
  priority: "",
  status: "",
  vehicle: "",
  pickupLocation: "",
  shop: "",
  birdType: "",
  assigned: "",
  importantOnly: false,
  urgentOnly: false,
};

export const ORDER_STATUSES: readonly string[] = [
  "Draft", "Pending", "Confirmed", "Awaiting Assignment", "Assigned",
  "Pickup Pending", "Picked Up", "Route Planned", "In Transit",
  "Arrived", "Delivered", "Cancelled",
];

export function applyFilters(orders: Order[], filters: OrderFilterState): Order[] {
  const q = filters.search.trim().toLowerCase();
  return orders.filter((o) => {
    if (q) {
      const haystack = [
        o.orderNumber,
        o.shop.name,
        o.shop.location,
        o.vehicleAssignment?.vehicleNo ?? "",
        o.vehicleAssignment?.driverName ?? "",
        o.vehicleAssignment?.pickupFarm ?? "",
        o.birdType,
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    if (filters.deliveryDate && o.deliveryDate !== filters.deliveryDate) return false;
    if (filters.priority && o.priority !== filters.priority) return false;
    if (filters.status && o.status !== filters.status) return false;
    if (filters.vehicle && o.vehicleAssignment?.vehicleNo !== filters.vehicle) return false;
    if (filters.pickupLocation && o.pickupSource?.location !== filters.pickupLocation) return false;
    if (filters.shop && o.shop.id !== filters.shop) return false;
    if (filters.birdType && o.birdType !== filters.birdType) return false;
    if (filters.assigned === "assigned" && !o.vehicleAssignment) return false;
    if (filters.assigned === "unassigned" && o.vehicleAssignment) return false;
    if (filters.importantOnly && !o.importantCustomer) return false;
    if (filters.urgentOnly && o.priority !== "Urgent") return false;
    return true;
  });
}
