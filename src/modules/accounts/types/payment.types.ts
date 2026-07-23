// src/modules/accounts/payment-book/payment.types.ts

export interface PaymentAttachment {
  id: string;
  paymentId: string;
  fileName: string;
  filePath: string; // base64 or URL
  fileSize: number;
  uploadedAt: string;
}

export interface PaymentAudit {
  id: string;
  paymentId: string;
  action: string;
  oldValue?: string;
  newValue?: string;
  performedBy: string;
  performedAt: string;
}

export interface Payment {
  id: string;
  paymentNo: string;           // e.g. PAY-20260720-001
  paymentDate: string;         // YYYY-MM-DD
  paymentType: string;         // Farmer Payment, Fuel Payment, etc.
  paymentMode: string;         // Cash, Bank Transfer, UPI, etc.
  paidTo: string;
  amount: number;
  referenceNo: string;         // unique
  category: string;            // Farmer, Fuel, Maintenance, etc.
  remarks?: string;
  status: 'Draft' | 'Approved' | 'Paid' | 'Cancelled';
  createdBy: string;
  createdAt: string;
  updatedAt?: string;
  attachments?: PaymentAttachment[];
}