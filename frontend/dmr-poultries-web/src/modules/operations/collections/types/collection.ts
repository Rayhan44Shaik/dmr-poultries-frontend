/* ==========================================================
   COLLECTION STATUS
========================================================== */

export type CollectionStatus =
  | "Pending"
  | "Approved";

/* ==========================================================
   PAYMENT MODE
========================================================== */

export interface PaymentMode {

  id: string;

  name: string;

}

/* ==========================================================
   COLLECTOR
========================================================== */

export interface Collector {



  employeeName: string;

}

/* ==========================================================
   COLLECTION ENTRY
========================================================== */

export interface CollectionEntry {

  collectionId: string;

  collectionNo: string;

  collectionDate: string;

  shopName: string;

  collectorName: string;

  paymentModeName: string;

  referenceNo: string;

  amount: number;

  remarks: string;

}

/* ==========================================================
   COLLECTION TRANSACTION
========================================================== */

export interface Collection {

  id: string;

  collectionNo: string;

  collectionDate: string;

  shopName: string;

  collectorName: string;

  paymentModeName: string;

  referenceNo: string;

  amount: number;

  remarks: string;

  status: CollectionStatus;

  createdDate: string;

  createdBy: string;

  approvedDate?: string;

  approvedBy?: string;

  modifiedDate?: string;

  modifiedBy?: string;

}

/* ==========================================================
   PENDING SHOP
========================================================== */

export interface PendingCollection {


  shopName: string;

  openingBalance: number;

  totalSales: number;

  totalCollections: number;

  currentPending: number;

  overdueDays: number;

  lastCollectionDate: string;

}

/* ==========================================================
   RECENT COLLECTION
========================================================== */

export interface RecentCollection {

  id: string;

  collectionNo: string;

  collectionDate: string;

  shopName: string;

  collectorName: string;

  paymentModeName: string;

  referenceNo: string;

  amount: number;

  remarks: string;

  status: CollectionStatus;

  approvedBy?: string;

  approvedDate?: string;

}

/* ==========================================================
   ENTRY VALIDATION
========================================================== */

export interface CollectionErrors {

  collectionDate?: string;

  shopName?: string;

  collectorName?: string;

  paymentModeName?: string;

  referenceNo?: string;

  amount?: string;

  remarks?: string;

}

/* ==========================================================
   COLLECTION FILTER
========================================================== */

export interface CollectionFilter {

  fromDate: string;

  toDate: string;

  shopName: string;

  collectorName: string;

  paymentModeName: string;

  status: string;

}

/* ==========================================================
   PAGINATION
========================================================== */

export interface Pagination {

  page: number;

  pageSize: number;

  totalRecords: number;

  totalPages: number;

}

/* ==========================================================
   COLLECTOR SUMMARY
========================================================== */

export interface CollectorSummary {

  collectorId: string;

  collectorName: string;

  totalCollections: number;

  totalAmount: number;

}

/* ==========================================================
   PAYMENT MODE SUMMARY
========================================================== */

export interface PaymentModeSummary {

  paymentModeName: string;

  totalCollections: number;

  totalAmount: number;

  percentage: number;

}

/* ==========================================================
   COLLECTION DASHBOARD
========================================================== */

export interface CollectionDashboardSummary {

  totalPendingShops: number;

  totalPendingAmount: number;

  pendingApproval: number;

  approvedCollections: number;

}