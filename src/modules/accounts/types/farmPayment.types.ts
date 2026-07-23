// src/modules/accounts/types/farmPayment.types.ts

export interface FarmPayment {
  id: string;
  tripId: number;
  tripNo: string;
  tripDate: string;
  vehicleNo: string;
  dcWeight: number;          // ← DC weight from trip (not total delivery weight)
  totalBirds: number;        // total birds from trip
  rate: number;              // rate per kg
  amount: number;            // dcWeight * rate
  remarks: string;
  status: 'Pending' | 'Paid' | 'Approved';
  createdAt: string;
  updatedAt: string;
}