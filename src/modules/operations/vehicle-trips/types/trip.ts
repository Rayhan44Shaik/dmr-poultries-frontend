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

export type TripStatus = "Pending" | "Completed";

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
  helpers: string[];
  openingMeter: number;
  startStepSubmitted: boolean; // 🔹 NEW

  // --- STEP 2: REACH FARM ---
  sourceFarmId: number;
  sourceFarm: string;
  reachedTime: string;
  destMeter: number;
  pickupTolls: number;
  farmStepSubmitted: boolean; // 🔹 NEW

  // --- STEP 3: PICKUP KPI ---
  dcWeight: number;
  totalBirds: number;
  boxes: number;
  avgWeight: number;
  pickupLoadTime: string;
  pickupStepSubmitted: boolean; // 🔹 NEW

  // --- STEP 4: SHOP DELIVERIES ---
  deliveries: ShopDelivery[];
  deliveryStepSubmitted: boolean; // 🔹 NEW

  // --- STEP 5: END TRIP ---
  closingMeter: number;
  endTime: string;
  deliveryTolls: number;

  // --- ADVANCED KPI FIELDS (Calculated) ---
  totalKm: number;
  totalShops: number;
  totalWeight: number; // Legacy
  totalDeliveredWeight: number; // 🔹 NEW
  totalBirdsDelivered: number; // 🔹 NEW
  totalMortality: number; // Legacy
  totalMortalityCount: number; // 🔹 NEW
  totalMortalityWeight: number; // 🔹 NEW
  weightLoss: number; // 🔹 NEW
  survivalRate: number; // 🔹 NEW

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
}