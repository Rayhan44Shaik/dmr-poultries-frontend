import { useEffect, useMemo, useState } from "react";
import type {
  CollectionEntry,
  CollectionErrors,
  PendingCollection,
  RecentCollection,
  PaymentMode,
  Collection,
  CollectionLegacyStatus,
  CollectionWeeklySummary,
} from "../types/collection";
import { collectionService } from "../services/collectionService";
import { loadShops, shopService } from "../../../masters/shops/services/shopService";
import { getEmployees, loadEmployees } from "../../../masters/employees/services/employeeService";
import { getBanks, loadBanks } from "../../../masters/banks/services/bankService";
import { useSafeNotification } from "../../../../hooks/useSafeNotification";

const EMPTY_WEEKLY: CollectionWeeklySummary = {
  shopId: 0,
  shopName: "",
  weekStart: "",
  weekEnd: "",
  balance: 0,
  weeklySales: 0,
  approvedCollections: 0,
  pendingCollections: 0,
  isCurrentWeek: false,
};

export default function useCollectionEntry() {
  const { showNotification } = useSafeNotification();

  // ---- All useState hooks ----
  const [shops, setShops] = useState<string[]>([]);
  const [collectors, setCollectors] = useState<string[]>([]);
  const [paymentModes, setPaymentModes] = useState<PaymentMode[]>([]);
  const [pendingCollections, setPendingCollections] = useState<PendingCollection[]>([]);
  const [recentCollections, setRecentCollections] = useState<RecentCollection[]>([]);
  const [allCollections, setAllCollections] = useState<Collection[]>([]); // new
  const [pendingShop, setPendingShop] = useState<PendingCollection | null>(null);
  const [weeklySummary, setWeeklySummary] = useState<CollectionWeeklySummary>(EMPTY_WEEKLY);
  const [showSummary, setShowSummary] = useState(false);

  const [entry, setEntry] = useState<CollectionEntry>({
    collectionId: "",
    collectionNo: "",
    collectionDate: "",
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

  const today = useMemo(() => new Date().toLocaleDateString("en-GB"), []);
  const dashboard = useMemo(() => collectionService.getDashboardSummary(), []);

  function loadMasterData() {
    setLoading(true);
    Promise.all([
      loadShops(),
      loadEmployees(),
      loadBanks(),
      collectionService.refreshFromBackend(),
    ])
      .then(() => {
        const shopNames = shopService.getAll().map((s) => s.shopName).sort();
        setShops(shopNames);
        const allEmployees = getEmployees();
        const collectorNames = allEmployees
          .filter((emp) => (emp.department ?? "").toLowerCase() === "collection")
          .map((emp) => emp.employeeName)
          .sort();
        // Fall back to all employees when no one is tagged "Collection" yet.
        setCollectors(collectorNames.length > 0 ? collectorNames : allEmployees.map((e) => e.employeeName).sort());
        const modes: PaymentMode[] = [{ id: "cash", name: "Cash" }];
        getBanks()
          .slice()
          .sort((a, b) => a.bankName.localeCompare(b.bankName))
          .forEach((bank) => modes.push({ id: bank.bankName, name: bank.bankName }));
        setPaymentModes(modes);
        setPendingCollections(collectionService.getPendingCollections());
        setRecentCollections(collectionService.getRecentCollections("Pending"));
        setAllCollections(collectionService.getCollections());
      })
      .catch(() => {
        showNotification("Failed to load master data.", "error");
      })
      .finally(() => {
        setLoading(false);
      });
  }

  useEffect(() => {
    loadMasterData();
    collectionService
      .fetchWeekBounds()
      .then((bounds) => {
        setEntry((prev) =>
          prev.collectionDate ? prev : { ...prev, collectionDate: bounds.asOfDate }
        );
      })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function findPendingShop(shopName: string): PendingCollection | null {
    return pendingCollections.find((shop) => shop.shopName === shopName) ?? null;
  }

  function selectShop(shopName: string) {
    const shop = findPendingShop(shopName);
    const shopId = collectionService.getShopIdForName(shopName);
    const updatedShop: PendingCollection = shop
      ? { ...shop, shopId: shop.shopId ?? shopId ?? undefined }
      : {
          shopId: shopId ?? undefined,
          shopName,
          totalSales: 0,
          totalCollections: 0,
          currentPending: 0,
          overdueDays: 0,
          lastCollectionDate: entry.collectionDate,
        };
    setPendingShop(updatedShop);
    setEntry((prev) => ({
      ...prev,
      shopName,
      amount: 0,
      remarks: ""
    }));
    setShowSummary(true);
  }

  function changeShop(shopName: string) {
    selectShop(shopName);
  }

  function resetEntry() {
    setPendingShop(null);
    setEntry((prev) => ({
      collectionId: "",
      collectionNo: "",
      collectionDate: prev.collectionDate,
      shopName: "",
      collectorName: "",
      paymentModeName: "Cash",
      referenceNo: "",
      amount: 0,
      remarks: ""
    }));
    setErrors({});
    setIsEditing(false);
    setShowSummary(false);
    setWeeklySummary(EMPTY_WEEKLY);
  }

  function viewLedger() {
    if (!pendingShop) {
      showNotification("Please select a shop first.", "error");
      return;
    }
    setShowSummary(true);
  }

  const shopId = pendingShop?.shopId ?? collectionService.getShopIdForName(entry.shopName);

  useEffect(() => {
    if (!shopId || !entry.collectionDate) {
      setWeeklySummary(EMPTY_WEEKLY);
      return;
    }
    let cancelled = false;
    collectionService
      .fetchWeeklySummary(shopId, entry.collectionDate)
      .then((summary) => {
        if (!cancelled) setWeeklySummary(summary);
      })
      .catch(() => {
        if (!cancelled) setWeeklySummary(EMPTY_WEEKLY);
      });
    return () => {
      cancelled = true;
    };
  }, [shopId, entry.collectionDate, pendingCollections, recentCollections, allCollections]);

  const fmtWeekDate = (iso: string) => {
    if (!iso) return "";
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
  };
  const weekRangeFormatted = weeklySummary.weekStart
    ? `${fmtWeekDate(weeklySummary.weekStart)} to ${fmtWeekDate(weeklySummary.weekEnd)}`
    : "";

  // Authoritative live shop balance — the shop's persistent outstanding,
  // owned by the backend (shops.current_balance). NEVER a weekly figure and
  // never reset when the week changes. The frontend only displays it.
  const balance = weeklySummary.balance;
  const weeklySales = weeklySummary.weeklySales;
  const weeklyCollections = weeklySummary.approvedCollections;
  const weeklyPending = weeklySummary.pendingCollections;
  const currentPending = weeklySummary.balance;
  const totalSales = weeklySummary.weeklySales;
  const totalCollections = weeklySummary.approvedCollections;

  const todayCollection = useMemo(() => Number(entry.amount || 0), [entry.amount]);

  const remainingBalance = useMemo(() => {
    return currentPending - todayCollection;
  }, [currentPending, todayCollection]);

  const collectionProgress = useMemo(() => {
    if (balance <= 0) return 0;
    return Number(((todayCollection / balance) * 100).toFixed(2));
  }, [balance, todayCollection]);

  const pageSummary = useMemo(
    () => ({
      balance,
      totalSales,
      totalCollections,
      currentPending,
      todayCollection,
      remainingBalance,
      collectionProgress,
      pendingShops: dashboard.totalPendingShops,
      pendingAmount: dashboard.totalPendingAmount,
      pendingApproval: dashboard.pendingApproval,
      approvedCollections: dashboard.approvedCollections,
      weeklyPending,
    }),
    [
      balance,
      totalSales,
      totalCollections,
      currentPending,
      todayCollection,
      remainingBalance,
      collectionProgress,
      dashboard,
      weeklyPending,
    ]
  );

  const disableSave = useMemo(() => {
    if (!pendingShop) return true;
    if (!entry.shopName) return true;
    if (!entry.collectorName) return true;
    if (!entry.paymentModeName) return true;
    if (Number(entry.amount) <= 0) return true;
    return false;
  }, [pendingShop, entry]);

  const canSaveOnServer = useMemo(() => {
    if (!entry.shopName) return false;
    return collectionService.getShopIdForName(entry.shopName) != null;
  }, [entry.shopName]);

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

    setErrors(validation);
    return Object.keys(validation).length === 0;
  }

  async function saveCollection() {
    if (!validateEntry()) return;
    try {
      setIsSaving(true);
      const success = await collectionService.saveCollection(entry);
      if (!success) {
        showNotification("Failed to save collection.", "error");
        return;
      }
      showNotification("Collection saved successfully!", "success");

      setPendingCollections(collectionService.getPendingCollections());
      setRecentCollections(collectionService.getRecentCollections(statusFilter));
      setAllCollections(collectionService.getCollections());

      resetEntry();
      setErrors({});
      setIsEditing(false);
    } catch (error) {
      showNotification("Failed to save collection.", "error");
    } finally {
      setIsSaving(false);
    }
  }

  function cancelCollection() {
    resetEntry();
  }

  function changeStatusFilter(status: CollectionLegacyStatus | "All") {
    setStatusFilter(status as "Pending" | "Approved" | "All");
    setRecentCollections(collectionService.getRecentCollections(status));
  }

  async function approveCollection(id: string) {
    const result = await collectionService.approveCollection(id, "Admin");
    if (result.success) {
      showNotification("Collection approved successfully!", "success");
      // The backend returns the authoritative updated shop balance — apply it
      // to the UI immediately so Balance converges without a page reload.
      if (result.balance != null) {
        setWeeklySummary((prev) => ({ ...prev, balance: result.balance as number }));
        setPendingShop((prev) =>
          prev ? { ...prev, currentPending: result.balance as number } : prev
        );
      }
      refreshPage();
    } else {
      showNotification("Failed to approve collection.", "error");
    }
  }

  async function deleteCollection(id: string) {
    const success = await collectionService.deleteCollection(id);
    if (success) {
      showNotification("Collection deleted successfully!", "success");
      refreshPage();
    } else {
      showNotification("This collection can no longer be deleted.", "error");
    }
  }

  async function rejectCollection(id: string) {
    const confirmed = window.confirm("Reject this collection? The amount will not be adjusted.");
    if (!confirmed) return;
    const success = await collectionService.rejectCollection(id, "Admin");
    if (success) {
      showNotification("Collection rejected successfully!", "success");
      refreshPage();
    } else {
      showNotification("Failed to reject collection.", "error");
    }
  }

  // ✅ REFRESH – now updates allCollections
  function refreshPage() {
    const pending = collectionService.getPendingCollections();
    const all = collectionService.getCollections();
    setPendingCollections(pending);
    setRecentCollections(collectionService.getRecentCollections(statusFilter));
    setAllCollections(all); // ← key fix
    if (pending.length > 0) {
      const selected = pending.find((shop) => shop.shopName === entry.shopName);
      if (selected) {
        setPendingShop({
          ...selected,
          shopId: selected.shopId ?? collectionService.getShopIdForName(selected.shopName) ?? undefined,
        });
      }
    }
  }

  function reloadCollections() {
    loadMasterData();
    showNotification("Collections reloaded.", "info");
  }

  function editCollection(collection: RecentCollection) {
    const shopId = collection.numericShopId ?? collectionService.getShopIdForName(collection.shopName);
    const existingShop = findPendingShop(collection.shopName);
    const updatedShop: PendingCollection = existingShop
      ? { ...existingShop, shopId: existingShop.shopId ?? shopId ?? undefined }
      : {
          shopId: shopId ?? undefined,
          shopName: collection.shopName,
          totalSales: 0,
          totalCollections: 0,
          currentPending: 0,
          overdueDays: 0,
          lastCollectionDate: collection.collectionDate,
        };

    setPendingShop(updatedShop);

    setEntry({
      collectionId: String(collection.numericId ?? collection.id),
      collectionNo: collection.collectionNo,
      collectionDate: collection.collectionDate,
      shopName: collection.shopName,
      collectorName: collection.collectorName,
      paymentModeName: collection.paymentModeName,
      referenceNo: collection.referenceNo,
      amount: Number(collection.amount),
      remarks: collection.remarks,
    });

    setErrors({});
    setIsEditing(true);
    setShowSummary(true);
  }

  async function updateExistingCollection() {
    if (!validateEntry()) return;
    const collections = collectionService.getCollections();
    const existing = collections.find((row) => row.id === entry.collectionId);
    if (!existing) return;
    const success = await collectionService.updateCollection({
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
      showNotification("Edit failed. The collection may be locked.", "error");
      return;
    }
    showNotification("Collection updated successfully!", "success");
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
    const rem = remainingBalance;
    if (rem < 0) {
      return { title: "Overpaid", message: "Shop has paid more than outstanding.", status: "overpaid" };
    }
    if (rem === 0) {
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

  const actions = {
    saveCollection: saveOrUpdateCollection,
    cancelCollection,
    approveCollection,
    rejectCollection,
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
    balance,
    totalSales,
    totalCollections,
    currentPending,
    todayCollection,
    remainingBalance,
    collectionProgress,
    pageSummary,
    showSummary,
    weeklySales,
    weeklyCollections,
    weeklyPending,
    weekRangeFormatted,
    recentCollections,
    selectedShopCollections,
    statusFilter,
    changeStatusFilter,
    pendingApprovalCount,
    approvedCount,
    recentCollectionCount,
    formStatus,
    disableSave,
    loading,
    isSaving,
    footerState,
    saveCollection: saveOrUpdateCollection,
    cancelCollection,
    approveCollection,
    rejectCollection,
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
    canSaveOnServer,
    actions,
    allCollections, // ← exposed
  };
}