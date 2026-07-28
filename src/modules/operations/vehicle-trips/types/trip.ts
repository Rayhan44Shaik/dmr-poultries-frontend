export interface ShopDelivery {
  id: number;
  serialNo?: number;
  // Manual Box No (Duplicates Allowed)
  boxNo: number;

  // Shop
  shopId: number;
  shopName: string;

  // Bird Type
  birdTypeId: number;
  birdType: string;

  // Delivery
  birds: number;
  weight: number;
  mortality: number;

  // Sales (After Trip Completion)
  rate: number | null;
  amount: number;

  // Remarks
  remarks: string;
}

export type TripStatus = "Draft" | "Pending" | "Completed" | "Deleted";

export interface Trip {
  id: number;
  // --- General ---
  tripNo: string;
  tripDate: string; // YYYY-MM-DD

  // --- STEP 1: TRIP START ---
  startTime: string;
  vehicleId: number;
  vehicleNo: string;
  driverId: number;
  driverName: string;
  supervisorId: number;
  supervisorName: string;
  advanceAmount: number; 
  helpers: string[];
  openingMeter: number;
  startStepSubmitted: boolean;

  // --- STEP 2: REACH FARM ---
  sourceFarmId: number;
  sourceFarm: string;
  reachedTime: string;
  destMeter: number;
  pickupTolls: number;
  farmStepSubmitted: boolean;
  // ✅ NEW: store farm address separately
  farmAddress?: string;

  // --- STEP 3: PICKUP KPI ---
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

  // --- STEP 4: SHOP DELIVERIES ---
  deliveries: ShopDelivery[];
  deliveryStepSubmitted: boolean;

  // --- STEP 5: END TRIP ---
  closingMeter: number;
  endTime: string;
  deliveryTolls: number;
  // ✅ NEW: indicates End step has been submitted
  endStepSubmitted?: boolean;

  // --- ADVANCED KPI FIELDS (Calculated) ---
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

  // --- Legacy & Meta ---
  fuel: number;
  expense: number;
  remarks: string;
  status: TripStatus;
  rateCompleted?: boolean;
  
  // Audit
  createdAt?: string;
  updatedAt?: string;
  deleted?: boolean;
  deletedReason?: string;
  dcPhotoKey?: string;
}

export interface BoxDetail {
  boxNo: number;
  birds: number;
  weight: number;
}