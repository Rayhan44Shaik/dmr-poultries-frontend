// src/modules/operations/fuel-expenses/types/fuelExpense.ts

export type FuelSourceType = "TRIP" | "MANUAL";

/** Mirrors backend OpsRecordStatus (types/operations.ts) */
export type FuelApprovalStatus = "Draft" | "Pending Approval" | "Approved" | "Rejected" | "Deleted";

export interface FuelExpense {
  id: string;
  billNo: string;
  billDate: string; // YYYY-MM-DD

  sourceType: FuelSourceType;
  tripId: number | null;
  tripNo?: string | null;
  tripFuelEntryIndex: number | null;

  vehicleId: number | null;
  vehicleNo: string | null;
  driverId: number | null;
  driverName: string | null;
  supervisorId: number | null;
  supervisorName: string | null;

  currentMeter: number;
  fuelRate: number;
  liters: number;
  amount: number;

  pumpName: string;
  bunkAddress?: string | null;
  remarks?: string | null;

  imageData?: string | null;
  imageName?: string | null;
  imageMime?: string | null;

  status: FuelApprovalStatus;
  deleted: boolean;
  deletedReason?: string | null;

  approvedBy?: string | null;
  approvedAt?: string | null;

  rejectedBy?: string | null;
  rejectedAt?: string | null;
  rejectedReason?: string | null;

  createdBy?: string;
  createdAt?: string | null;
  updatedAt?: string | null;
}

/** Payload accepted by create/update — backend computes amount, bill number,
 * source type and approval status authoritatively; client cannot set them. */
export interface FuelExpenseInput {
  billDate: string;
  vehicleId?: number | null;
  vehicleNo?: string | null;
  driverId?: number | null;
  driverName?: string | null;
  supervisorId?: number | null;
  supervisorName?: string | null;
  tripId?: number | null;
  currentMeter?: number;
  fuelRate?: number;
  liters?: number;
  pumpName?: string;
  bunkAddress?: string | null;
  remarks?: string | null;
  imageData?: string | null;
  imageName?: string | null;
  imageMime?: string | null;
  createdBy?: string;
}

export interface FuelExpenseFilters {
  fromDate?: string;
  toDate?: string;
  vehicleId?: number;
  driverId?: number;
  sourceType?: "ALL" | FuelSourceType;
  status?: "ALL" | FuelApprovalStatus;
  search?: string;
}
