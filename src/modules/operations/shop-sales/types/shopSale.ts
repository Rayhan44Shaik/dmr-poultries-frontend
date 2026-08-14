// src/modules/operations/shop-sales/types/shopSale.ts
//
// Mirrors backend/src/types/operations.ts ShopSale exactly. A Shop Sale is a
// trip_deliveries row (+ parent trip) — not a separate localStorage record.

export type ShopSaleStatus = "Draft" | "Pending Approval" | "Approved" | "Rejected" | "Deleted";

export interface ShopSale {
  id: number;
  saleNo: string;
  saleDate: string;
  shopId: number | null;
  shopName: string;
  birdTypeId: number | null;
  birdType: string;
  tripId: number | null;
  tripNo: string;
  vehicleNo: string | null;
  farmName: string | null;
  birds: number;
  weight: number;
  rate: number;
  amount: number;
  mortality: number;
  remarks: string;
  status: ShopSaleStatus;
  deleted: boolean;
  deletedReason?: string | null;
  /** True when the parent trip is soft-deleted. The sale is NOT deleted and
   * remains a permanent historical accounting record. */
  tripDeleted: boolean;
  /** Backend-authoritative: whether this sale can be edited/deleted right now. */
  editable: boolean;
  /** ISO date the 10-day edit window closes (once the trip is Completed). */
  windowExpiresAt: string | null;
  approvedBy?: string | null;
  approvedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface ShopSaleUpdateInput {
  birdTypeId?: number | null;
  birdType?: string;
  birds?: number;
  weight?: number;
  rate?: number;
  mortality?: number;
  remarks?: string;
}

export interface ShopSaleFilters {
  shopId?: number;
  fromDate?: string;
  toDate?: string;
  status?: string;
  includeDeleted?: boolean;
}

export interface ShopSaleSummary {
  totalBirds: number;
  totalShops: number;
  totalWeight: number;
  totalAmount: number;
  averageRate: number;
  averageWeightPerBird: number;
}

export interface ShopSaleFilter {
  fromDate: string;
  toDate: string;
  shopName: string;
  sortBy: string;
}
