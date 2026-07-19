import type { Collection, CollectionEntry, PendingCollection, RecentCollection, CollectorSummary, PaymentModeSummary, CollectionDashboardSummary } from "../types/collection";
import type { ShopSale } from "../../shop-sales/types/shopSale";
import { calculateCollectedAmount, calculatePendingAmount, calculateCollectorSummary, calculatePaymentModeSummary, canEditCollection, canDeleteCollection } from "../utils/collectionCalculation";

const COLLECTION_STORAGE = "dmr-collections";
const SHOPSALE_STORAGE = "shopSales";

// --- Helpers ---
function getShopSales(): ShopSale[] {
  try { return JSON.parse(localStorage.getItem(SHOPSALE_STORAGE) || '[]'); } catch { return []; }
}
function getCollections(): Collection[] {
  try { return JSON.parse(localStorage.getItem(COLLECTION_STORAGE) || '[]'); } catch { return []; }
}
function saveCollections(collections: Collection[]): void {
  localStorage.setItem(COLLECTION_STORAGE, JSON.stringify(collections));
}
function getNextCollectionNumber(): string {
  const count = getCollections().length + 1;
  return `COL-${String(count).padStart(6, "0")}`;
}

// --- Pending Collections ---
function getPendingCollections(): PendingCollection[] {
  const shopSales = getShopSales();
  const collections = getCollections();
  const shopMap = new Map<string, PendingCollection>();

  shopSales.forEach(sale => {
    if (!shopMap.has(sale.shopName)) {
      shopMap.set(sale.shopName, {
        shopName: sale.shopName,
        openingBalance: 0,
        totalSales: 0,
        totalCollections: 0,
        currentPending: 0,
        overdueDays: 0,
        lastCollectionDate: "-"
      });
    }
    shopMap.get(sale.shopName)!.totalSales += Number(sale.amount);
  });

  shopMap.forEach(shop => {
    const approvedCollections = collections.filter(c => c.shopName === shop.shopName && c.status === "Approved");
    shop.totalCollections = calculateCollectedAmount(approvedCollections);
    shop.currentPending = calculatePendingAmount(shop.totalSales, shop.totalCollections);
    shop.openingBalance = shop.currentPending;

    if (approvedCollections.length > 0) {
      const latest = approvedCollections.sort((a, b) => b.collectionDate.localeCompare(a.collectionDate))[0];
      shop.lastCollectionDate = latest.collectionDate;
      const days = Math.floor((new Date().getTime() - new Date(latest.collectionDate).getTime()) / (1000 * 60 * 60 * 24));
      shop.overdueDays = days < 0 ? 0 : days;
    }
  });

  // ✅ REMOVED the filter that excluded zero/negative balances
  return Array.from(shopMap.values()).sort((a, b) => b.currentPending - a.currentPending);
}

// --- CRUD Operations ---
function saveCollection(entry: CollectionEntry): boolean {
  try {
    const collections = getCollections();
    const collection: Collection = {
      id: Date.now().toString(),
      collectionNo: getNextCollectionNumber(),
      collectionDate: entry.collectionDate,
      shopName: entry.shopName,
      collectorName: entry.collectorName,
      paymentModeName: entry.paymentModeName,
      referenceNo: entry.referenceNo || "",
      amount: Number(entry.amount),
      remarks: entry.remarks || "",
      status: "Pending",
      createdDate: new Date().toISOString(),
      createdBy: "Admin"
    };
    collections.unshift(collection);
    saveCollections(collections);
    console.log("✅ Collection saved:", collection);
    return true;
  } catch (error) {
    console.error("❌ Failed to save collection:", error);
    return false;
  }
}

function updateCollection(collection: Collection): boolean {
  if (!canEditCollection(collection.createdDate)) return false;
  const collections = getCollections();
  const index = collections.findIndex(row => row.id === collection.id);
  if (index === -1) return false;
  collections[index] = { ...collection, modifiedDate: new Date().toISOString(), modifiedBy: "Admin" };
  saveCollections(collections);
  return true;
}

function deleteCollection(id: string): boolean {
  const collections = getCollections();
  const row = collections.find(item => item.id === id);
  if (!row || !canDeleteCollection(row.createdDate)) return false;
  saveCollections(collections.filter(item => item.id !== id));
  return true;
}

function approveCollection(id: string, approvedBy: string = "Admin"): boolean {
  const collections = getCollections();
  const index = collections.findIndex(row => row.id === id);
  if (index === -1) return false;
  collections[index].status = "Approved";
  collections[index].approvedBy = approvedBy;
  collections[index].approvedDate = new Date().toISOString();
  saveCollections(collections);
  return true;
}

// --- Recent Collections ---
function getRecentCollections(status: "Pending" | "Approved" | "All" = "Pending"): RecentCollection[] {
  const collections = getCollections();
  const filtered = status === "All" ? collections : collections.filter(row => row.status === status);
  return filtered
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === "Pending" ? -1 : 1;
      return b.collectionDate.localeCompare(a.collectionDate);
    })
    .map(row => ({
      id: row.id,
      collectionNo: row.collectionNo,
      collectionDate: row.collectionDate,
      shopName: row.shopName,
      collectorName: row.collectorName,
      paymentModeName: row.paymentModeName,
      referenceNo: row.referenceNo,
      amount: row.amount,
      remarks: row.remarks,
      status: row.status,
      approvedBy: row.approvedBy,
      approvedDate: row.approvedDate
    }));
}

function getPendingApprovalCount(): number {
  return getCollections().filter(row => row.status === "Pending").length;
}
function getApprovedCount(): number {
  return getCollections().filter(row => row.status === "Approved").length;
}

// --- Reports & Summaries ---
function getCollectorSummary(): CollectorSummary[] {
  return calculateCollectorSummary(getCollections().filter(row => row.status === "Approved"));
}
function getPaymentModeSummary(): PaymentModeSummary[] {
  return calculatePaymentModeSummary(getCollections().filter(row => row.status === "Approved"));
}
function getDashboardSummary(): CollectionDashboardSummary {
  const pendingColl = getPendingCollections();
  return {
    totalPendingShops: pendingColl.length,
    totalPendingAmount: pendingColl.reduce((total, row) => total + row.currentPending, 0),
    pendingApproval: getPendingApprovalCount(),
    approvedCollections: getCollections().filter(row => row.status === "Approved").length
  };
}
function refreshCollections() {
  return {
    pendingCollections: getPendingCollections(),
    recentCollections: getRecentCollections(),
    collectorSummary: getCollectorSummary(),
    paymentModeSummary: getPaymentModeSummary(),
    dashboardSummary: getDashboardSummary()
  };
}

function getCollectionsForShop(shopName: string): Collection[] {
  const all = getCollections();
  return all.filter(c => c.shopName === shopName);
}

export const collectionService = {
  getShopSales,
  getCollections,
  saveCollections,
  getNextCollectionNumber,
  getPendingCollections,
  saveCollection,
  updateCollection,
  deleteCollection,
  approveCollection,
  getRecentCollections,
  getPendingApprovalCount,
  getApprovedCount,
  getCollectorSummary,
  getPaymentModeSummary,
  getDashboardSummary,
  refreshCollections,
  getCollectionsForShop
};