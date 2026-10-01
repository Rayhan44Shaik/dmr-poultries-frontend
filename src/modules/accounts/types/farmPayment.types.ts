// D:\Development\DMR-Poultries-ERP\frontend\dmr-poultries-web\src\modules\accounts\types\farmPayment.types.ts

/**
 * Trip-linked farm payment, exactly as GET /api/accounts/farm-payments returns
 * it: one row per completed trip, carrying the cost of the birds that trip
 * picked up (dcWeight × rate) and how much of it has been settled.
 *
 * This is the figure the Account Analysis uses for its Farm Payment expense —
 * it is the cost the trip actually incurred, and it can be attributed to that
 * one trip. The Payment Register's "Farmer Payment" entries are the cash
 * settlements of the same obligation, so they are NOT added on top of it.
 */
export interface TripFarmPayment {
  id: number;
  tripId: number;
  tripNo: string;
  tripDate: string;
  farmId?: number;
  farmName?: string;
  birdType?: string;
  totalBirds?: number;
  dcWeight?: number;
  rate?: number;
  /** Total farm cost of the trip — payable whether settled yet or not. */
  amount: number;
  paidAmount: number;
  balance: number;
  status: 'Paid' | 'Partially Paid' | 'Pending';
  paymentDate?: string | null;
  paymentMode?: string | null;
  referenceNo?: string | null;
  vehicleNo?: string;
  supervisorName?: string;
  loads?: FarmPaymentLoad[];
}

export interface FarmPaymentLoad {
  load: number;
  farmName?: string | null;
  birdType?: string | null;
  totalBirds: number;
  dcWeight: number;
}

/** Money totals over a set of trip farm payments. */
export interface FarmPaymentTotals {
  /** Number of trips carrying a farm payment. */
  trips: number;
  /** Cost incurred (sum of `amount`). */
  payable: number;
  /** Settled so far (sum of `paidAmount`). */
  paid: number;
  /** Still owed to farmers (sum of `balance`). */
  balance: number;
}

export interface FarmPayment {
  id?: string;
  tripId: string;
  farmName?: string;
  birdType?: string;
  ratePerBird?: number;
  ratePerKg?: number;
  totalBirds?: number;
  dcWeight?: number;
  totalAmount?: number;
  amountPaid?: number;
  balance?: number;
  paymentStatus: 'Paid' | 'Partially Paid' | 'Unpaid';
  paymentMode?: 'Cash' | 'Bank Transfer' | 'UPI' | 'Cheque';
  paidDate?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
  loads?: FarmPaymentLoad[];
}
