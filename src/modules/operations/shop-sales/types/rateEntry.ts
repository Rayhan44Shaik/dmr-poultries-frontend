// src/modules/operations/shop-sales/types/rateEntry.ts
//
// Mirrors backend/src/types/operations.ts RateEntryTrip / RateEntry exactly.
// Rate Entry is one rate per Trip (rate_entry.trip_id UNIQUE), not a
// per-shop-delivery rate table.

export type RateEntryStatus = "Pending" | "Entered";

/** A Rate Entry–eligible trip (status = Completed, not deleted), as
 * returned by GET /api/operations/rate-entry — optionally joined with its
 * rate record if one has already been entered. */
export interface RateEntryTripRow {
  tripId: number;
  tripNo: string;
  tripDate: string;
  tripStatus: string;
  vehicleId: number | null;
  vehicleNo: string | null;
  driverId: number | null;
  driverName: string | null;
  supervisorId: number | null;
  supervisorName: string | null;
  sourceFarmId: number | null;
  sourceFarm: string | null;
  totalBirds: number;
  totalWeight: number;
  totalShops: number;
  birdTypeId: number | null;
  birdType: string | null;
  rateStatus: RateEntryStatus;
  rateEntryId: number | null;
  rate: number | null;
  remarks: string | null;
  createdBy?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

/** A single persisted rate_entry record, as returned by POST/PUT. */
export interface RateEntryRecord {
  id: number;
  tripId: number;
  tripNo?: string;
  birdTypeId: number | null;
  birdType: string;
  rate: number;
  remarks: string;
  createdBy?: string;
  updatedBy?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface RateEntryInput {
  tripId: number;
  rate: number;
  birdTypeId?: number | null;
  birdType?: string;
  remarks?: string | null;
  createdBy?: string;
}

export interface RateEntryUpdateInput {
  rate?: number;
  birdTypeId?: number | null;
  birdType?: string;
  remarks?: string | null;
  updatedBy?: string;
}

export interface RateEntryFilters {
  search?: string;
  rateStatus?: "ALL" | RateEntryStatus;
  fromDate?: string;
  toDate?: string;
  vehicleNo?: string;
  supervisorName?: string;
}
