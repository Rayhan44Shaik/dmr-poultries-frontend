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
  subShopName?: string;
  birdTypeId: number;
  birdType: string;
  birds: number;
  weight: number;
  mortality: number;
  mortKg?: number;
  rate: number | null;
  amount: number;
  remarks: string;
  deliveryMode?: "box" | "weight";
  selectedBoxIds?: number[];
  farmBirds?: number;
  farmWeight?: number;
  perBoxData?: PerBoxDelivery[];
  autoCaptureTime?: string;
  clientKey?: string;
  /** READ-ONLY market/reference rate resolved by the backend. */
  marketRate?: MarketRateReference | null;
}

export type TripStatus = "Draft" | "Pending" | "Completed" | "Deleted";

export interface BoxDetail {
  boxNo: number;
  birds: number;
  weight: number;
  avgWeight?: number | null;
}

/** One Farm→Pickup→Deliveries cycle on the same Draft trip (max 4). */
export interface TripLeg {
  id: number;
  tripId: number;
  legIndex: number;
  sourceFarmId: number | null;
  sourceFarm: string | null;
  destMeter: number | null;
  pickupTolls?: number;
  farmAddress?: string | null;
  avgBirdWeight?: number | null;
  farmRemarks?: string | null;
  farmBirdTypeId?: number | null;
  farmBirdType?: string | null;
  farmBirdCount?: number | null;
  farmLoadWeight?: number | null;
  farmGpsLat?: number | null;
  farmGpsLon?: number | null;
  farmGpsAccuracy?: number | null;
  farmGpsTime?: string | null;
  farmStepSubmitted: boolean;
  farmStepSubmittedAt?: string | null;
  reachedTime?: string | null;
  dcWeight: number;
  totalBirds: number;
  boxes: number;
  avgWeight: number;
  pickupLoadTime?: string | null;
  dcPhotoKey?: string | null;
  pickupStepSubmitted: boolean;
  pickupStepSubmittedAt?: string | null;
  deliveryStepSubmitted: boolean;
  deliveriesStepSubmittedAt?: string | null;
  boxDetails?: BoxDetail[];
  deliveries?: ShopDelivery[];
}

export interface TripLoadSummary {
  load: number;
  birds: number;
  weight: number;
  mortality: number;
  mortalityWeight: number;
  weightLoss: number;
  shops: number;
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
  /** Number of Farm→Pickup→Delivery loads (1–4). */
  legCount?: number;
  /** Active load while editing steps 2–4 (1-based). */
  activeLegIndex?: number;
  legs?: TripLeg[];
  /** Count of loads whose Step 2 has been submitted. */
  submittedLoadCount?: number;
  /** Recent-table totals for each load whose Step 4 has been submitted. */
  loadSummaries?: TripLoadSummary[];

  startTime: string;
  vehicleId: number;
  vehicleNo: string;
  driverId: number;
  driverName: string;
  supervisorId: number;
  supervisorName: string;
  advanceAmount: number | null;
  helpers: string[];
  loaders?: string[];
  openingMeter: number | null;
  startStepSubmitted: boolean;
  /** Official Step 1 submit timestamp (IST, with seconds) — set once at first
   *  submit, never modified by later edits/saves. Display/audit only. */
  startStepSubmittedAt?: string | null;

  sourceFarmId: number;
  sourceFarm: string;
  birdTypeId: number;
  birdType: string;
  reachedTime: string;
  destMeter: number;
  pickupTolls: number;
  farmStepSubmitted: boolean;
  /** Official Step 2 submit timestamp (IST, with seconds) — first submit only. */
  farmStepSubmittedAt?: string | null;
  farmAddress?: string;
  avgBirdWeight?: number;
  farmGpsLat?: number | null;
  farmGpsLon?: number | null;
  farmGpsAccuracy?: number | null;
  farmGpsTime?: string | null;

  dcWeight: number;
  totalBirds: number;
  boxes: number;
  avgWeight: number;
  pickupLoadTime: string;
  pickupStepSubmitted: boolean;
  /** Official Step 3 submit timestamp (IST, with seconds) — first submit only. */
  pickupStepSubmittedAt?: string | null;
  vehicleBoxCapacity?: number;
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
  dieselEntries?: Array<{
    id?: number;
    rowIndex: number;
    litres?: number | null;
    rate?: number | null;
    amount?: number | null;
    meter?: number | null;
    bunkName?: string | null;
    bunkSource?: "MASTER" | "OTHER";
    fuelBunkId?: number | null;
    gpsLat?: number | null;
    gpsLon?: number | null;
    gpsAccuracy?: number | null;
    gpsCapturedAt?: string | null;
    imageData?: string | null;
    imageName?: string | null;
    submitted?: boolean;
    submittedAt?: string | null;
    clientKey?: string | null;
  }>;
  expensesStepSubmittedAt?: string;
  mileageKmL?: number | null;

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
  dcPhotoKey2?: string;
  dcPhotoMime2?: string;
  dcPhotoData2?: string;
  approvedBy?: string;
}
