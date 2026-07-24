// src/modules/accounts/types/farmPayment.types.ts

export interface FarmPayment {
  id: string;
  tripId: number;
  tripNo: string;
  tripDate: string;
  vehicleNo: string;
  farmName: string;
  dcWeight: number;
  totalBirds: number;
  rate: number;
  amount: number;
  remarks?: string;
  status: 'Unpaid' | 'Paid';
  createdAt: string;
  updatedAt: string;
}