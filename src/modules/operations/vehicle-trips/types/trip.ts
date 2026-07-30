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
  openingMeter: number;
  startStepSubmitted: boolean;

  sourceFarmId: number;
  sourceFarm: string;
  reachedTime: string;
  destMeter: number;
  pickupTolls: number;
  farmStepSubmitted: boolean;
  farmAddress?: string;

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
  endStepSubmitted?: boolean;

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

export interface PerBoxDelivery {
  boxNo: number;
  birds: number;
  weight: number;
}