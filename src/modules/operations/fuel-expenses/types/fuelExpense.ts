export type FuelSourceType = "TRIP" | "MANUAL";
export type FuelUiStatus = "Pending" | "Approved" | "Rejected" | "Deleted";

export type FuelSortKey =
  | "billNo"
  | "date"
  | "sourceType"
  | "tripNo"
  | "vehicleNo"
  | "driverName"
  | "supervisorName"
  | "meterReading"
  | "litres"
  | "rate"
  | "amount"
  | "petrolBunk"
  | "status";

export interface FuelTripLoad {
  load: number;
  farmName?: string | null;
  dcWeight?: number;
  birds?: number;
}

export interface FuelExpense {
  id: string;
  billNo: string;
  date: string;
  sourceType?: FuelSourceType;
  vehicleId: number;
  vehicleNo: string;
  driverId: number;
  driverName: string;
  supervisorId?: number;
  supervisorName?: string;
  tripId?: number | null;
  tripNo?: string | null;
  meterReading: number;
  amount: number;
  rate: number;
  litres: number;
  petrolBunk: string;
  gpsAddress?: string;
  remarks?: string;
  gpsLat?: number | null;
  gpsLon?: number | null;
  gpsAccuracy?: number | null;
  gpsCapturedAt?: string | null;
  status: FuelUiStatus;
  /** Authoritative saved trip distance (trips.total_km, else end − opening)
   * for trip-linked bills; null otherwise. Read-only: never entered here. */
  travelDistance?: number | null;
  /** Diesel entry index within the linked trip (identity with the trip's
   * Step 5 diesel row); null for manual bills. */
  tripFuelEntryIndex?: number | null;
  /** Number of pickup-submitted loads on the linked trip; null when unlinked. */
  tripLoadCount?: number | null;
  /** Per-load DC/farm context of the linked trip for the Load 1/Load 2 display. */
  tripLoads?: FuelTripLoad[];
  deleted?: boolean;
  deletedAt?: string;
  deletedReason?: string;
  createdDate: string;
  createdBy: string;
  approvedDate?: string;
  approvedBy?: string;
  updatedDate?: string;
  image?: string;
  imageName?: string;
  synced?: boolean;
}

export type FuelExpenseDraft = Omit<
  FuelExpense,
  "id" | "billNo" | "createdDate" | "createdBy" | "status" | "sourceType" | "driverId" | "driverName" | "supervisorId" | "supervisorName"
> & { driverId?: number; driverName?: string; supervisorId?: number; supervisorName?: string };
