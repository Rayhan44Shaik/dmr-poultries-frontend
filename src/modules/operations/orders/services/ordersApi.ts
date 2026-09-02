// src/modules/operations/orders/services/ordersApi.ts
//
// Typed client for the Orders backend module (/api/orders). The BACKEND is
// the source of truth for every quantity, lock and status: this file only
// transports requests and surfaces the server's own validation messages.
//
//   GET    /orders                      list + search + date + pagination
//   GET    /orders/eligible-vehicles    assignable vehicle trips for a day
//   GET    /orders/notifications/:trip  real supervisor-notification outcomes
//   POST   /orders/collection           save progress / finish collection
//   POST   /orders/assignments          save progress / finish assignment
//   DELETE /orders/assignments/:id      remove ONE pending assignment
//   DELETE /orders/:id                  remove ONE pending collection line
//
// Nothing here computes a business rule locally — a refresh, a cache clear
// or a second browser always reconstructs the same state from these calls.

import { apiDelete, apiGet, apiPost } from "../../../../api";

export type OrderStatus =
  | "Pending"
  | "Collected"
  | "Assigned"
  | "Partially Delivered"
  | "Delivered"
  | "Completed";

export type OrderAssignmentView = {
  id: number;
  tripId: number;
  tripNo: string;
  vehicleNo: string;
  tripDate: string;
  tripStatus: string;
  supervisorName: string;
  sequence: number;
  /** Boxes committed to this trip (loaded / picked up). */
  pickupBoxes: number;
  deliveredBoxes: number;
  deliveredBirds: number;
  deliveredWeight: number;
  deliveredAt: string | null;
  version: number;
  /** Fully delivered → immutable (the backend rejects any change). */
  locked: boolean;
  /** Trip completed / rate-locked → immutable. */
  tripLocked: boolean;
};

export type OrderView = {
  id: number;
  orderNo: string;
  orderDate: string;
  shopId: number;
  shopName: string;
  city: string;
  requiredBoxes: number;
  birds: number;
  remarks: string;
  collected: boolean;
  version: number;
  assignedBoxes: number;
  deliveredBoxes: number;
  /** required − assigned (still to assign). */
  pendingBoxes: number;
  /** required − delivered (still to deliver). */
  remainingBoxes: number;
  status: OrderStatus;
  locked: boolean;
  assignments: OrderAssignmentView[];
};

export type OrdersSummary = {
  totalShops: number;
  totalRequiredBoxes: number;
  totalAssignedBoxes: number;
  totalDeliveredBoxes: number;
  totalPendingBoxes: number;
  totalRemainingBoxes: number;
  deliveredShops: number;
  assignedShops: number;
};

export type OrdersPage = {
  rows: OrderView[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  summary: OrdersSummary;
};

export type OrdersQuery = {
  date?: string;
  fromDate?: string;
  toDate?: string;
  search?: string;
  tripId?: number;
  page?: number;
  pageSize?: number;
};

export type EligibleVehicle = {
  tripId: number;
  tripNo: string;
  tripDate: string;
  vehicleId: number;
  vehicleNo: string;
  status: string;
  supervisorId: number;
  supervisorName: string;
  driverName: string;
  avgBirdWeight: number;
  capacity: number;
  alreadyAssigned: number;
  available: number;
};

export type OrderNotificationOutcome = {
  channel: "email" | "whatsapp";
  status: "sent" | "failed" | "not_configured" | "no_recipient";
  recipient: string;
  message?: string;
};

export type CollectionItem = {
  shopId: number;
  requiredBoxes: number;
  birds?: number;
  remarks?: string;
  /** Optimistic-concurrency token from the last read. */
  version?: number;
};

export type AssignmentItem = {
  orderId: number;
  sequence: number;
  pickupBoxes: number;
  version?: number;
};

const EMPTY_PAGE: OrdersPage = {
  rows: [],
  total: 0,
  page: 1,
  pageSize: 10,
  totalPages: 1,
  summary: {
    totalShops: 0,
    totalRequiredBoxes: 0,
    totalAssignedBoxes: 0,
    totalDeliveredBoxes: 0,
    totalPendingBoxes: 0,
    totalRemainingBoxes: 0,
    deliveredShops: 0,
    assignedShops: 0,
  },
};

export const emptyOrdersPage = (): OrdersPage => ({
  ...EMPTY_PAGE,
  rows: [],
  summary: { ...EMPTY_PAGE.summary },
});

function toParams(query: OrdersQuery): Record<string, string> {
  const params: Record<string, string> = {};
  if (query.date) params.date = query.date;
  if (query.fromDate) params.fromDate = query.fromDate;
  if (query.toDate) params.toDate = query.toDate;
  if (query.search?.trim()) params.search = query.search.trim();
  if (query.tripId) params.tripId = String(query.tripId);
  if (query.page) params.page = String(query.page);
  if (query.pageSize) params.pageSize = String(query.pageSize);
  return params;
}

/** Server-side listing — filtering, search and paging all run in SQL. */
export async function listOrders(query: OrdersQuery): Promise<OrdersPage> {
  const { data } = await apiGet<OrdersPage>("/orders", { params: toParams(query) });
  return data;
}

export async function listEligibleVehicles(date?: string): Promise<EligibleVehicle[]> {
  const { data } = await apiGet<EligibleVehicle[]>("/orders/eligible-vehicles", {
    params: date ? { date } : undefined,
  });
  return Array.isArray(data) ? data : [];
}

/** Save Progress / Finish Collection (Tab 1). */
export async function saveOrderCollection(input: {
  orderDate: string;
  items: CollectionItem[];
  finish?: boolean;
}): Promise<OrdersPage> {
  const { data } = await apiPost<OrdersPage>("/orders/collection", input);
  return data;
}

/**
 * Save Progress / Finish Assignment (Tab 2). `finish: true` makes the
 * BACKEND send the supervisor email + WhatsApp after the transaction
 * commits, and returns the real per-channel outcome.
 */
export async function saveOrderAssignment(input: {
  tripId: number;
  orderDate: string;
  items: AssignmentItem[];
  removeAssignmentIds?: number[];
  finish?: boolean;
}): Promise<{ orders: OrdersPage; notifications: OrderNotificationOutcome[] }> {
  const { data } = await apiPost<{
    orders: OrdersPage;
    notifications: OrderNotificationOutcome[];
  }>("/orders/assignments", input);
  return data;
}

export async function deleteOrderAssignment(assignmentId: number): Promise<void> {
  await apiDelete(`/orders/assignments/${assignmentId}`);
}

export async function deleteOrder(orderId: number): Promise<void> {
  await apiDelete(`/orders/${orderId}`);
}

export async function listOrderNotifications(tripId: number) {
  const { data } = await apiGet<
    Array<{
      id: number;
      channel: "email" | "whatsapp";
      status: string;
      recipient: string;
      failureReason: string | null;
      sentAt: string | null;
    }>
  >(`/orders/notifications/${tripId}`);
  return Array.isArray(data) ? data : [];
}
