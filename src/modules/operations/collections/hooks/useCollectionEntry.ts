import { useEffect, useMemo, useState } from "react";
import type {
  CollectionEntry,
  CollectionErrors,
  PendingCollection,
  RecentCollection,
  PaymentMode
} from "../types/collection";
import { collectionService } from "../services/collectionService";
import { shopService } from "../../../masters/shops/services/shopService";
import { getEmployees } from "../../../masters/employees/services/employeeService";
import { getBanks } from "../../../masters/banks/services/bankService";

export default function useCollectionEntry() {
  // ---- All useState hooks ----
  const [shops, setShops] = useState<string[]>([]);
  const [collectors, setCollectors] = useState<string[]>([]);
  const [paymentModes, setPaymentModes] = useState<PaymentMode[]>([]);
  const [pendingCollections, setPendingCollections] = useState<PendingCollection[]>([]);
  const [recentCollections, setRecentCollections] = useState<RecentCollection[]>([]);
  const [pendingShop, setPendingShop] = useState<PendingCollection | null>(null);
  const [showSummary, setShowSummary] = useState(false);

  const [entry, setEntry] = useState<CollectionEntry>({
    collectionId: "",
    collectionNo: "",
    collectionDate: new Date().toISOString().split("T")[0],
    shopName: "",
    collectorName: "",
    paymentModeName: "Cash",
    referenceNo: "",
    amount: 0,
    remarks: ""
  });

  const [errors, setErrors] = useState<CollectionErrors>({});
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"Pending" | "Approved" | "All">("Pending");
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 25;

  const today = useMemo(() => new Date().toLocaleDateString("en-GB"), []);
  const dashboard = useMemo(() => collectionService.getDashboardSummary(), []);

  function loadMasterData() {
    setLoading(true);
    try {
      const shopNames = shopService.getAll().map((s) => s.shopName).sort();
      setShops(shopNames);
      const collectorNames = getEmployees()
        .filter((emp) => (emp.department ?? "").toLowerCase() === "collection")
        .map((emp) => emp.employeeName)
        .sort();
      setCollectors(collectorNames);
      const modes: PaymentMode[] = [{ id: "cash", name: "Cash" }];
      getBanks().forEach((bank) => modes.push({ id: bank.bankName, name: bank.bankName }));
      setPaymentModes(modes);
      setPendingCollections(collectionService.getPendingCollections());
      setRecentCollections(collectionService.getRecentCollections("Pending"));
    } catch (error) {
      console.error("Failed to load master data:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMasterData();
  }, []);

  // ❌ REMOVED auto‑select useEffect – no automatic shop selection on load

  function findPendingShop(shopName: string): PendingCollection | null {
    return pendingCollections.find((shop) => shop.shopName === shopName) ?? null;
  }

  function getShopSales(shopName: string) {
    try {
      const raw = localStorage.getItem("shopSales");
      if (!raw) return [];
      const sales = JSON.parse(raw);
      return sales.filter((s: any) => s.shopName === shopName);
    } catch {
      return [];
    }
  }

  function computeShopTotals(shopName: string) {
    const sales = getShopSales(shopName);
    const totalSales = sales.reduce((sum: number, s: any) => sum + (Number(s.amount) || 0), 0);
    const collections = collectionService.getCollectionsForShop(shopName);
    const totalCollections = collections.reduce((sum: number, c: any) => sum + (Number(c.amount) || 0), 0);
    const currentPending = Math.max(0, totalSales - totalCollections);
    return { totalSales, totalCollections, currentPending };
  }

  function selectShop(shopName: string) {
    const shop = findPendingShop(shopName);
    const { totalSales, totalCollections, currentPending } = computeShopTotals(shopName);
    const updatedShop = shop
      ? { ...shop, totalSales, totalCollections, currentPending: Math.max(0, currentPending) }
      : null;
    setPendingShop(updatedShop);
    setEntry((prev) => ({
      ...prev,
      shopName,
      amount: updatedShop?.currentPending ?? 0,
      remarks: ""
    }));
    setShowSummary(false); // hide summary when shop changes
  }

  function changeShop(shopName: string) {
    selectShop(shopName);
  }

  function resetEntry() {
    setPendingShop(null);
    setEntry({
      collectionId: "",
      collectionNo: "",
      collectionDate: new Date().toISOString().split("T")[0],
      shopName: "",
      collectorName: "",
      paymentModeName: "Cash",
      referenceNo: "",
      amount: 0,
      remarks: ""
    });
    setErrors({});
    setIsEditing(false);
    setShowSummary(false);
  }

  function viewLedger() {
    if (!pendingShop) {
      alert("Please select a shop first.");
      return;
    }
    // Recompute totals to get fresh data
    const { totalSales, totalCollections, currentPending } = computeShopTotals(pendingShop.shopName);
    setPendingShop(prev => prev ? { ...prev, totalSales, totalCollections, currentPending } : null);
    setShowSummary(true);
    console.log("Open Shop Ledger", pendingShop.shopName);
  }

  const openingBalance = useMemo(() => pendingShop?.currentPending ?? 0, [pendingShop]);
  const totalSales = useMemo(() => pendingShop?.totalSales ?? 0, [pendingShop]);
  const totalCollections = useMemo(() => pendingShop?.totalCollections ?? 0, [pendingShop]);
  const currentPending = useMemo(() => pendingShop?.currentPending ?? 0, [pendingShop]);

  const todayCollection = useMemo(() => Number(entry.amount || 0), [entry.amount]);
  const remainingBalance = useMemo(() => {
    const bal = currentPending - todayCollection;
    return bal < 0 ? 0 : bal;
  }, [currentPending, todayCollection]);

  const collectionProgress = useMemo(() => {
    if (openingBalance <= 0) return 0;
    return Number(((todayCollection / openingBalance) * 100).toFixed(2));
  }, [openingBalance, todayCollection]);

  const pageSummary = useMemo(
    () => ({
      openingBalance,
      totalSales,
      totalCollections,
      currentPending,
      todayCollection,
      remainingBalance,
      collectionProgress,
      pendingShops: dashboard.totalPendingShops,
      pendingAmount: dashboard.totalPendingAmount,
      pendingApproval: dashboard.pendingApproval,
      approvedCollections: dashboard.approvedCollections
    }),
    [
      openingBalance,
      totalSales,
      totalCollections,
      currentPending,
      todayCollection,
      remainingBalance,
      collectionProgress,
      dashboard
    ]
  );

  const disableSave = useMemo(() => {
    if (!pendingShop) return true;
    if (!entry.shopName) return true;
    if (!entry.collectorName) return true;
    if (!entry.paymentModeName) return true;
    if (Number(entry.amount) <= 0) return true;
    if (Number(entry.amount) > currentPending) return true;
    return false;
  }, [pendingShop, entry, currentPending]);

  function updateEntry<K extends keyof CollectionEntry>(field: K, value: CollectionEntry[K]) {
    setEntry((prev) => ({ ...prev, [field]: value }));
    setErrors({});
  }

  function changeCollector(collectorName: string) {
    updateEntry("collectorName", collectorName);
  }
  function changePaymentMode(paymentModeName: string) {
    updateEntry("paymentModeName", paymentModeName);
    if (paymentModeName === "Cash") updateEntry("referenceNo", "");
  }
  function changeReference(referenceNo: string) {
    updateEntry("referenceNo", referenceNo);
  }
  function changeAmount(amount: number) {
    if (amount < 0) amount = 0;
    updateEntry("amount", amount);
  }
  function changeRemarks(remarks: string) {
    updateEntry("remarks", remarks);
  }
  function changeCollectionDate(collectionDate: string) {
    updateEntry("collectionDate", collectionDate);
  }

  const isCashPayment = useMemo(() => entry.paymentModeName === "Cash", [entry.paymentModeName]);
  const requiresReference = useMemo(() => !isCashPayment, [isCashPayment]);

  function validateEntry(): boolean {
    const validation: CollectionErrors = {};
    if (!entry.shopName.trim()) validation.shopName = "Please select a shop.";
    if (!entry.collectorName.trim()) validation.collectorName = "Please select a collector.";
    if (!entry.collectionDate.trim()) validation.collectionDate = "Collection date is required.";
    if (!entry.paymentModeName.trim()) validation.paymentModeName = "Please select payment mode.";

    if (Number(entry.amount) <= 0) {
      validation.amount = "Collection amount should be greater than zero.";
    }
    if (Number(entry.amount) > currentPending) {
      validation.amount = "Collection amount cannot exceed pending amount.";
    }
    if (requiresReference && !entry.referenceNo.trim()) {
      validation.referenceNo = "Reference number is required.";
    }
    setErrors(validation);
    return Object.keys(validation).length === 0;
  }

  async function saveCollection() {
    if (!validateEntry()) return;
    try {
      setIsSaving(true);
      const success = collectionService.saveCollection(entry);
      if (!success) return;
      const pending = collectionService.getPendingCollections();
      setPendingCollections(pending);
      setRecentCollections(collectionService.getRecentCollections(statusFilter));
      resetEntry();
      if (pending.length > 0) selectShop(pending[0].shopName);
      else setPendingShop(null);
    } catch (error) {
      console.error("Failed to save collection.", error);
    } finally {
      setIsSaving(false);
    }
  }

  function cancelCollection() {
    resetEntry();
    if (pendingCollections.length > 0) selectShop(pendingCollections[0].shopName);
  }

  function changeStatusFilter(status: "Pending" | "Approved" | "All") {
    setStatusFilter(status);
    setCurrentPage(1);
    setRecentCollections(collectionService.getRecentCollections(status));
  }

  function approveCollection(id: string) {
    const success = collectionService.approveCollection(id, "Admin");
    if (!success) return;
    refreshPage();
  }

  function deleteCollection(id: string) {
    const success = collectionService.deleteCollection(id);
    if (!success) {
      alert("This collection can no longer be deleted.");
      return;
    }
    refreshPage();
  }

  function refreshPage() {
    const pending = collectionService.getPendingCollections();
    setPendingCollections(pending);
    setRecentCollections(collectionService.getRecentCollections(statusFilter));
    if (pending.length > 0) {
      const selected = pending.find((shop) => shop.shopName === entry.shopName);
      if (selected) setPendingShop(selected);
    }
  }

  function reloadCollections() {
    loadMasterData();
  }

  function editCollection(collection: RecentCollection) {
    const shop = findPendingShop(collection.shopName);
    setPendingShop(shop);
    setEntry({
      collectionId: collection.id,
      collectionNo: collection.collectionNo,
      collectionDate: collection.collectionDate,
      shopName: collection.shopName,
      collectorName: collection.collectorName,
      paymentModeName: collection.paymentModeName,
      referenceNo: collection.referenceNo,
      amount: Number(collection.amount),
      remarks: collection.remarks
    });
    setErrors({});
    setIsEditing(true);
  }

  async function updateExistingCollection() {
    if (!validateEntry()) return;
    const collections = collectionService.getCollections();
    const existing = collections.find((row) => row.id === entry.collectionId);
    if (!existing) return;
    const success = collectionService.updateCollection({
      ...existing,
      collectionDate: entry.collectionDate,
      shopName: entry.shopName,
      collectorName: entry.collectorName,
      paymentModeName: entry.paymentModeName,
      referenceNo: entry.referenceNo,
      amount: Number(entry.amount),
      remarks: entry.remarks
    });
    if (!success) {
      alert("Edit is allowed only within 10 days.");
      return;
    }
    refreshPage();
    resetEntry();
    setIsEditing(false);
  }

  async function saveOrUpdateCollection() {
    if (entry.collectionId) {
      await updateExistingCollection();
    } else {
      await saveCollection();
    }
  }

  const hasPendingCollections = pendingCollections.length > 0;
  const hasRecentCollections = recentCollections.length > 0;
  const pendingApprovalCount = useMemo(() => collectionService.getPendingApprovalCount(), [recentCollections]);
  const approvedCount = useMemo(() => collectionService.getApprovedCount(), [recentCollections]);
  const noPendingShops = pendingCollections.length === 0;
  const noRecentCollections = recentCollections.length === 0;
  const pageReady = useMemo(() => !loading, [loading]);

  const totalPendingShops = pendingCollections.length;
  const totalPendingAmount = useMemo(
    () => pendingCollections.reduce((total, shop) => total + shop.currentPending, 0),
    [pendingCollections]
  );

  const selectedShopCollections = useMemo(() => {
    if (!pendingShop) return [];
    return recentCollections.filter((row) => row.shopName === pendingShop.shopName);
  }, [pendingShop, recentCollections]);

  const selectedPaymentMode = useMemo(
    () => paymentModes.find((mode) => mode.name === entry.paymentModeName) ?? null,
    [paymentModes, entry.paymentModeName]
  );

  const formStatus = useMemo(() => {
    if (!pendingShop) return { title: "No Shop Selected", message: "Select a pending shop.", status: "empty" };
    if (remainingBalance === 0) {
      return { title: "Collection Complete", message: "Outstanding amount fully collected.", status: "completed" };
    }
    return { title: "Pending Collection", message: "Outstanding balance available.", status: "pending" };
  }, [pendingShop, remainingBalance]);

  const footerState = useMemo(
    () => ({
      loading,
      isSaving,
      disableSave,
      pendingApprovalCount,
      approvedCount
    }),
    [loading, isSaving, disableSave, pendingApprovalCount, approvedCount]
  );

  const totalCollectionToday = useMemo(
    () =>
      recentCollections
        .filter((row) => row.collectionDate === entry.collectionDate)
        .reduce((total, row) => total + Number(row.amount), 0),
    [recentCollections, entry.collectionDate]
  );

  const recentCollectionCount = useMemo(() => recentCollections.length, [recentCollections]);

  const totalPages = useMemo(() => {
    if (recentCollections.length === 0) return 1;
    return Math.ceil(recentCollections.length / PAGE_SIZE);
  }, [recentCollections]);

  const paginatedCollections = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return recentCollections.slice(start, start + PAGE_SIZE);
  }, [recentCollections, currentPage]);

  function changePage(page: number) {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
  }

  const actions = {
    saveCollection: saveOrUpdateCollection,
    cancelCollection,
    approveCollection,
    deleteCollection,
    editCollection,
    refreshPage,
    reloadCollections,
    viewLedger,
    resetEntry
  };

  const statistics = useMemo(
    () => ({
      totalPendingShops,
      totalPendingAmount,
      pendingApprovalCount,
      approvedCount,
      totalCollectionToday,
      recentCollectionCount
    }),
    [
      totalPendingShops,
      totalPendingAmount,
      pendingApprovalCount,
      approvedCount,
      totalCollectionToday,
      recentCollectionCount
    ]
  );

  return {
    today,
    dashboard,
    statistics,
    pageReady,
    shops,
    collectors,
    paymentModes,
    pendingCollections,
    pendingShop,
    totalPendingShops,
    totalPendingAmount,
    entry,
    errors,
    isEditing,
    updateEntry,
    changeShop,
    changeCollector,
    changePaymentMode,
    changeReference,
    changeAmount,
    changeRemarks,
    changeCollectionDate,
    resetEntry,
    openingBalance,
    totalSales,
    totalCollections,
    currentPending,
    todayCollection,
    remainingBalance,
    collectionProgress,
    pageSummary,
    showSummary, // ✅ exposed
    recentCollections: paginatedCollections,
    selectedShopCollections,
    statusFilter,
    changeStatusFilter,
    pendingApprovalCount,
    approvedCount,
    recentCollectionCount,
    currentPage,
    totalPages,
    changePage,
    formStatus,
    disableSave,
    loading,
    isSaving,
    footerState,
    saveCollection: saveOrUpdateCollection,
    cancelCollection,
    approveCollection,
    deleteCollection,
    editCollection,
    viewLedger,
    refreshPage,
    reloadCollections,
    selectedPaymentMode,
    isCashPayment,
    requiresReference,
    hasPendingCollections,
    hasRecentCollections,
    noPendingShops,
    noRecentCollections,
    actions
  };
}