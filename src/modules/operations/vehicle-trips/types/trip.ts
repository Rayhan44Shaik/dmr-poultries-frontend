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
}

export type TripStatus = "Draft" | "Pending" | "Completed" | "Deleted";

export type TripStepStatus = "completed" | "saved" | "not_started";

export interface TripStepStatuses {
  start: TripStepStatus;
  farm: TripStepStatus;
  pickup: TripStepStatus;
  deliveries: TripStepStatus;
  expenses: TripStepStatus;
}

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
  startStepSubmittedAt?: string;

  sourceFarmId: number;
  sourceFarm: string;
  reachedTime: string;
  destMeter: number;
  pickupTolls: number;  
  farmStepSubmitted: boolean;
  farmStepSubmittedAt?: string;
  farmAddress?: string;
  avgBirdWeight?: number;

  dcWeight: number;
  totalBirds: number;
  boxes: number;
  avgWeight: number;
  pickupLoadTime: string;
  pickupStepSubmitted: boolean; 
  pickupStepSubmittedAt?: string;
  boxNo: number;
  birds: number;
  weight: number; 
  boxDetails: BoxDetail[];

  deliveries: ShopDelivery[];
  deliveryStepSubmitted: boolean;
  deliveriesStepSubmittedAt?: string;

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
  expensesStepSubmittedAt?: string;

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
  driverBata?: number;
  totalTripExpense?: number;
  remarks: string;
  status: TripStatus;
  rateCompleted?: boolean;
  
  createdAt?: string;
  updatedAt?: string;
  deleted?: boolean;
  deletedReason?: string;
  dcPhotoKey?: string;
  dcPhotoMime?: string;
  dcPhotoData?: string;
  approvedBy?: string;
  stepStatuses?: TripStepStatuses;
}

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