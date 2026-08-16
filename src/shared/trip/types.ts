export interface MarketRateReference {
  shopId: number | null;
  shopName: string;
  birdTypeId: number | null;
  birdType: string;
  masterRate: number | null;
  lastTripRate: number | null;
  lastTripDate: string | null;
  lastTripNo: string | null;
  avgTripRate: number | null;
  tripRateSamples: number;
}

export interface ShopDelivery {
  id: number;
  serialNo?: number;
  boxNo: number;
  shopId: number;
  shopName: string;
  birdTypeId: number;
  birdType: string;
  birds: number;
  weight: number;
  mortality: number;
  rate: number | null;
  amount: number;
  remarks: string;
  /** READ-ONLY market/reference rate resolved by the backend. */
  marketRate?: MarketRateReference | null;
}

export type TripStatus = "Draft" | "Pending" | "Completed" | "Deleted";

export interface BoxDetail {
  boxNo: number;
  birds: number;
  weight: number;
}

export interface PerBoxDelivery {
  boxNo: number;
  birds: number;
  weight: number;
}

/**
 * Authoritative frontend Trip Entry shape shared by desktop and mobile.
 * Transport-only values remain optional so existing API adapters stay compatible.
 */
export interface Trip {
  id: number;
  tripNo: string;
  tripDate: string;

  startTime: string;
  vehicleId: number;
  vehicleNo: string;
  driverId: number;
  driverName: string;
  supervisorId: number;
  supervisorName: string;
  advanceAmount: number;
  helpers: string[];
  loaders?: string[];
  openingMeter: number;
  startStepSubmitted: boolean;

  sourceFarmId: number;
  sourceFarm: string;
  reachedTime: string;
  destMeter: number;
  pickupTolls: number;
  farmStepSubmitted: boolean;
  farmAddress?: string;
  avgBirdWeight?: number;

  dcWeight: number;
  totalBirds: number;
  boxes: number;
  avgWeight: number;
  pickupLoadTime: string;
  pickupStepSubmitted: boolean;
  boxNo: number;
  birds: number;
  weight: number;
  boxDetails: BoxDetail[];

  deliveries: ShopDelivery[];
  deliveryStepSubmitted: boolean;

  closingMeter: number;
  endTime: string;
  deliveryTolls: number;
  destinationTolls?: number;
  meals?: number;
  loading?: number;
  mealsTiffin?: number;
  vehicleMaintenance?: number;
  othersRC?: number;
  others1Amt?: number;
  others2Amt?: number;
  others3Amt?: number;
  others4Amt?: number;
  others5Amt?: number;
  submittedAtTimestamp?: string;
  endStepSubmitted?: boolean;
  expensesStepSubmitted?: boolean;

  totalKm: number;
  totalShops: number;
  totalWeight: number;
  totalDeliveredWeight: number;
  totalBirdsDelivered: number;
  totalMortality: number;
  totalMortalityCount: number;
  totalMortalityWeight: number;
  weightLoss: number;
  survivalRate: number;
  lastShop: string;

  fuel: number;
  expense: number;
  remarks: string;
  status: TripStatus;
  rateCompleted?: boolean;

  rateLockedAt?: string | null;
  rateLockedBy?: string | null;
  ratesEntered?: number;
  version?: number;
  createdAt?: string;
  updatedAt?: string;
  deleted?: boolean;
  deletedReason?: string;
  dcPhotoKey?: string;
  dcPhotoMime?: string;
  dcPhotoData?: string;
  approvedBy?: string;
}
