export interface FuelExpense {
  id: string;
  billNo: string;               // BILL-YYYYMMDD-XXX
  date: string;                 // YYYY-MM-DD
  vehicleId: number;
  vehicleNo: string;
  driverId: number;
  driverName: string;
  supervisorId: number;
  supervisorName: string;
  meterReading: number;         // Current KM
  amount: number;               // ₹
  rate: number;                 // ₹/Litre
  litres: number;               // amount / rate (auto-calc)
  petrolBunk: string;
  remarks?: string;
  status: "Pending" | "Approved";
  createdDate: string;
  createdBy: string;
  approvedDate?: string;
  approvedBy?: string;
  updatedDate?: string;
}