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

export type TripStatus =
  | "Pending"
  | "Completed";

export interface Trip {

  id: number;

  // Trip
  tripNo: string;
  tripDate: string;

  // Vehicle
  vehicleId: number;
  vehicleNo: string;

  // Driver
  driverId: number;
  driverName: string;

  // Supervisor
  supervisorId: number;
  supervisorName: string;

  // Farm
  sourceFarmId: number;
  sourceFarm: string;

  // KM Details
  openingMeter: number;
  closingMeter: number;
  totalKm: number;

  // Expenses
  fuel: number;
  expense: number;

  // Remarks
  remarks: string;

  // Summary
  totalShops: number;
  totalBirds: number;
  totalWeight: number;
  totalMortality: number;

  // Last Delivered Shop
  lastShop: string;

  // Status
  status: TripStatus;

  // Rate Entry Status
  rateCompleted?: boolean;

  // Delivery Details
  deliveries: ShopDelivery[];

  // Audit
  createdAt?: string;
  updatedAt?: string;

}