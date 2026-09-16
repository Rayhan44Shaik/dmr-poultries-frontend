import type { Collection, CollectionApiEntry, CollectionLegacyStatus } from '../types/collection';
function mapStatus(status: string): CollectionLegacyStatus {
  if (status === "Deleted") return "Deleted";
  if (status === "Approved") return "Approved";
  return "Pending";
}

export function mapEntryToCollection(e: CollectionApiEntry): Collection {
  return {
    id: String(e.id),
    collectionNo: e.collectionNo,
    collectionDate: e.collectionDate,
    shopName: e.shopName,
    collectorName: e.collector,
    paymentModeName: e.paymentMode,
    referenceNo: e.referenceNo,
    amount: Number(e.amount),
    remarks: e.remarks,
    status: mapStatus(e.status),
    createdDate: e.createdAt ?? e.collectionDate,
    createdBy: e.createdBy,
    approvedDate: e.approvedAt ?? undefined,
    approvedBy: e.approvedBy ?? undefined,
    numericId: e.id,
    numericShopId: e.shopId,
  };
}

export function mapRawEntry(raw: Record<string, unknown>): CollectionApiEntry {
  const deleted = raw.deleted === true || raw.deleted === 1 || raw.deleted === "true";
  const sourceStatus = String(raw.status ?? "") as CollectionApiEntry["status"];

  return {
    id: Number(raw.id),
    collectionNo: String(raw.collectionNo ?? raw.collection_no ?? ""),
    collectionDate: String(raw.collectionDate ?? raw.collection_date ?? ""),
    shopId: raw.shopId == null ? null : Number(raw.shopId ?? raw.shop_id),
    shopName: String(raw.shopName ?? raw.shop_name ?? ""),
    tripId: raw.tripId == null ? null : Number(raw.tripId ?? raw.trip_id),
    amountDue: Number(raw.amountDue ?? raw.amount_due ?? 0),
    amount: Number(raw.amount ?? raw.amountCollected ?? raw.amount_collected ?? 0),
    amountCollected: Number(raw.amountCollected ?? raw.amount_collected ?? 0),
    collector: String(raw.collector ?? ""),
    paymentMode: String(raw.paymentMode ?? raw.payment_mode ?? "Cash"),
    referenceNo: String(raw.referenceNo ?? raw.reference_no ?? ""),
    remarks: String(raw.remarks ?? ""),
    // A soft-deleted row can retain its former database status (often
    // Approved). The UI contract is unambiguous: deleted always renders and
    // filters as Deleted while keeping the same permanent collection number.
    status: deleted ? "Deleted" : sourceStatus || "Pending Approval",
    deleted,
    deletedBy: raw.deletedBy != null ? String(raw.deletedBy) : (raw.deleted_by != null ? String(raw.deleted_by) : null),
    deletedAt: raw.deletedAt != null ? String(raw.deletedAt) : (raw.deleted_at != null ? String(raw.deleted_at) : null),
    isFinancial: Boolean(raw.isFinancial ?? raw.is_financial),
    openingBalance: raw.openingBalance == null ? null : Number(raw.openingBalance ?? raw.opening_balance),
    closingBalance: raw.closingBalance == null ? null : Number(raw.closingBalance ?? raw.closing_balance),
    approvedBy: raw.approvedBy != null ? String(raw.approvedBy) : (raw.approved_by != null ? String(raw.approved_by) : null),
    approvedAt: raw.approvedAt != null ? String(raw.approvedAt) : (raw.approved_at != null ? String(raw.approved_at) : null),
    createdBy: String(raw.createdBy ?? raw.created_by ?? ""),
    createdAt: raw.createdAt != null ? String(raw.createdAt) : (raw.created_at != null ? String(raw.created_at) : null),
    updatedAt: raw.updatedAt != null ? String(raw.updatedAt) : (raw.updated_at != null ? String(raw.updated_at) : null),
    canDelete: raw.canDelete == null ? undefined : Boolean(raw.canDelete),
  };
}

