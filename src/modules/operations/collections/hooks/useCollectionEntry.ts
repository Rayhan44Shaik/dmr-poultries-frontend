import { useEffect, useMemo, useState, useCallback } from "react";
import type {
  CollectionEntry,
  CollectionErrors,
  PendingCollection,
  RecentCollection,
  PaymentMode,
  Collection,
  CollectionLegacyStatus,
  CollectionWeeklySummary,
  CollectionWeekBounds,
} from "../types/collection";
import { collectionService } from "../services/collectionService";
import { loadShops, shopService } from "../../../masters/shops/services/shopService";
import { getEmployees, loadEmployees } from "../../../masters/employees/services/employeeService";
import { getBanks, loadBanks } from "../../../masters/banks/services/bankService";
import { useSafeNotification } from "../../../../hooks/useSafeNotification";
import { translate } from "../../../../i18n";
import { confirmDialog } from "../../../../ui/confirm/confirmStore";
import { onShopDataChanged } from "../../../../shared/events/shopDataEvents";

const EMPTY_WEEKLY: CollectionWeeklySummary = {
  shopId: 0,
  shopName: "",
  weekStart: "",
  weekEnd: "",
  previousWeekEnd: "",
  openingBalance: 0,
  balance: 0,
  closingBalance: 0,
  weeklySales: 0,
  pendingSales: 0,
  salesCount: 0,
  approvedCollections: 0,
  pendingCollections: 0,
  approvedCollectionsCount: 0,
  pendingCollectionsCount: 0,
  isCurrentWeek: false,
};

const EMPTY_WEEK_BOUNDS: CollectionWeekBounds = {
  asOfDate: "",
  weekStart: "",
  weekEnd: "",
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
  const [allCollections, setAllCollections] = useState<Collection[]>([]);
  const [pendingShop, setPendingShop] = useState<PendingCollection | null>(null);
  const [weeklySummary, setWeeklySummary] = useState<CollectionWeeklySummary>(EMPTY_WEEKLY);
  const [weekBounds, setWeekBounds] = useState<CollectionWeekBounds>(EMPTY_WEEK_BOUNDS);
  const [showSummary, setShowSummary] = useState(false);
  const [ledgerLoaded, setLedgerLoaded] = useState(false);
  const [ledgerLoading, setLedgerLoading] = useState(false);

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
  const [statusFilter, setStatusFilter] = useState<"Pending" | "Approved" | "Deleted">("Pending");

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
        // Collector is strictly the Collection department from the Employee
        // master. There is deliberately NO fallback to the full employee list:
        // offering drivers/loaders here would let a collection be booked
        // against someone who never collects money.
        const collectorNames = getEmployees()
          .filter((emp) => (emp.department ?? "").toLowerCase() === "collection")
          .map((emp) => emp.employeeName)
          .sort();
        setCollectors(collectorNames);
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
        showNotification(translate("ops.collection.failed_load_master"), "error");
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
        setWeekBounds(bounds);
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
    // Clear ledger state when shop changes - require explicit View Shop Ledger click
    setShowSummary(false);
    setLedgerLoaded(false);
    setWeeklySummary(EMPTY_WEEKLY);
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
    setLedgerLoaded(false);
    setWeeklySummary(EMPTY_WEEKLY);
  }

  async function viewLedger() {
    if (!entry.shopName.trim()) {
      showNotification(translate("ops.collection.select_shop_first"), "error");
      return;
    }
    if (!entry.collectorName.trim()) {
      showNotification(translate("validation.select_collector"), "error");
      return;
    }
    if (!entry.paymentModeName.trim()) {
      showNotification(translate("ops.collection.select_payment_mode"), "error");
      return;
    }

    const shopId = collectionService.getShopIdForName(entry.shopName);
    if (!shopId) {
      showNotification(translate("ops.collection.invalid_shop_selection"), "error");
      return;
    }

    setLedgerLoading(true);
    try {
      const summary = await collectionService.fetchWeeklySummary(shopId, entry.collectionDate);
      setWeeklySummary(summary);
      setShowSummary(true);
      setLedgerLoaded(true);
    } catch (error) {
      showNotification(translate("ops.collection.failed_load_ledger"), "error");
      setWeeklySummary(EMPTY_WEEKLY);
      setShowSummary(false);
      setLedgerLoaded(false);
    } finally {
      setLedgerLoading(false);
    }
  }

  // Invalidate ledger when collector or payment mode changes
  const handleCollectorChange = useCallback((collectorName: string) => {
    updateEntry("collectorName", collectorName);
    if (ledgerLoaded) {
      setShowSummary(false);
      setLedgerLoaded(false);
      setWeeklySummary(EMPTY_WEEKLY);
    }
  }, [ledgerLoaded]);

  const handlePaymentModeChange = useCallback((paymentModeName: string) => {
    updateEntry("paymentModeName", paymentModeName);
    if (paymentModeName === "Cash") updateEntry("referenceNo", "");
    if (ledgerLoaded) {
      setShowSummary(false);
      setLedgerLoaded(false);
      setWeeklySummary(EMPTY_WEEKLY);
    }
  }, [ledgerLoaded]);

  // Invalidate ledger when shop changes (already handled in selectShop)
  const handleShopChange = useCallback((shopName: string) => {
    selectShop(shopName);
  }, []);

  const shopId = pendingShop?.shopId ?? collectionService.getShopIdForName(entry.shopName);

  const [ledgerNonce, setLedgerNonce] = useState(0);

  // Only auto-fetch weekly summary if ledger has been explicitly loaded
  useEffect(() => {
    if (!ledgerLoaded || !shopId || !entry.collectionDate) {
      if (!ledgerLoaded) {
        setWeeklySummary(EMPTY_WEEKLY);
      }
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
  }, [shopId, entry.collectionDate, ledgerLoaded, ledgerNonce]);

  /**
   * Balances also move outside this page — an approval, a delete from Pending
   * Collections, another tab. Whoever wrote it, this page re-reads the register
   * and refetches the open shop's ledger, so the Outstanding Summary and the
   * preview never quote a balance the backend has already moved past.
   */
  useEffect(
    () =>
      onShopDataChanged((detail) => {
        refreshPage();
        if (!ledgerLoaded) return;
        // A change to a different shop leaves this shop's ledger untouched.
        if (detail.shopId != null && shopId != null && detail.shopId !== shopId) return;
        setLedgerNonce((nonce) => nonce + 1);
      }),
    [ledgerLoaded, shopId],
  );

  const fmtWeekDate = (iso: string) => {
    if (!iso) return "";
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
  };

  // Week range from week bounds (always available, independent of ledgerLoaded).
  // The two dates are joined with an en dash, not the word "to": the range is
  // rendered verbatim in the summary subtitle, so an English joining word here
  // would survive into a Telugu session. The dash matches every other range in
  // the app (pagination, trip list) and reads the same in both languages.
  const weekRangeFormatted = weekBounds.weekStart
    ? `${fmtWeekDate(weekBounds.weekStart)} – ${fmtWeekDate(weekBounds.weekEnd)}`
    : "";

  // Also compute week range from weeklySummary when ledger is loaded (for backward compat)
  const ledgerWeekRangeFormatted = weeklySummary.weekStart
    ? `${fmtWeekDate(weeklySummary.weekStart)} – ${fmtWeekDate(weeklySummary.weekEnd)}`
    : "";

  // Only show financial data if ledger is loaded.
  //   openingBalance = last week's closing balance, carried forward
  //   balance        = Current Outstanding (live shop balance)
  // Opening Balance is read straight from the backend rather than back-solved
  // from the closing balance: the arithmetic form broke whenever a back-dated
  // sale or collection landed outside the current week.
  const currentOutstanding = ledgerLoaded ? weeklySummary.balance : 0;
  const approvedSales = ledgerLoaded ? weeklySummary.weeklySales : 0;
  const approvedCollections = ledgerLoaded ? weeklySummary.approvedCollections : 0;
  const pendingApproval = ledgerLoaded ? weeklySummary.pendingCollections : 0;
  const openingBalance = ledgerLoaded ? weeklySummary.openingBalance : 0;
  const previousWeekEnd = ledgerLoaded ? weeklySummary.previousWeekEnd : "";
  // Context figures: shown to explain the balance, never part of it.
  const pendingSales = ledgerLoaded ? weeklySummary.pendingSales : 0;
  const salesCount = ledgerLoaded ? weeklySummary.salesCount : 0;
  const approvedCollectionsCount = ledgerLoaded ? weeklySummary.approvedCollectionsCount : 0;
  const pendingCollectionsCount = ledgerLoaded ? weeklySummary.pendingCollectionsCount : 0;
  const weekStart = ledgerLoaded ? weeklySummary.weekStart : "";
  const weekEnd = ledgerLoaded ? weeklySummary.weekEnd : "";

  const todayCollection = useMemo(() => Number(entry.amount || 0), [entry.amount]);

  // Projected balance after this collection is approved
  const projectedBalance = useMemo(() => {
    return currentOutstanding - todayCollection;
  }, [currentOutstanding, todayCollection]);

  const collectionProgress = useMemo(() => {
    if (currentOutstanding <= 0) return 0;
    return Number(((todayCollection / currentOutstanding) * 100).toFixed(2));
  }, [currentOutstanding, todayCollection]);

  const pageSummary = useMemo(
    () => ({
      balance: currentOutstanding,
      totalSales: approvedSales,
      totalCollections: approvedCollections,
      currentPending: currentOutstanding,
      todayCollection,
      remainingBalance: projectedBalance,
      collectionProgress,
      pendingShops: dashboard.totalPendingShops,
      pendingAmount: dashboard.totalPendingAmount,
      pendingApproval: dashboard.pendingApproval,
      approvedCollections: dashboard.approvedCollections,
      weeklyPending: pendingApproval,
    }),
    [
      currentOutstanding,
      approvedSales,
      approvedCollections,
      todayCollection,
      projectedBalance,
      collectionProgress,
      dashboard,
      pendingApproval,
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
    handleCollectorChange(collectorName);
  }
  function changePaymentMode(paymentModeName: string) {
    handlePaymentModeChange(paymentModeName);
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
    if (!entry.shopName.trim()) validation.shopName = translate("validation.select_shop");
    if (!entry.collectorName.trim()) validation.collectorName = translate("validation.select_collector");
    if (!entry.collectionDate.trim()) validation.collectionDate = translate("ops.collection.date_required");
    if (!entry.paymentModeName.trim()) validation.paymentModeName = translate("ops.collection.select_payment_mode");

    if (Number(entry.amount) <= 0) {
      validation.amount = translate("ops.collection.amount_greater_zero");
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
        showNotification(translate("ops.collection.failed_save"), "error");
        return;
      }
      showNotification(translate("ops.collection.saved_success"), "success");

      // After save, switch to Pending tab to show the newly created collection
      setStatusFilter("Pending");
      setPendingCollections(collectionService.getPendingCollections());
      setRecentCollections(collectionService.getRecentCollections("Pending"));
      setAllCollections(collectionService.getCollections());

      resetEntry();
      setErrors({});
      setIsEditing(false);
    } catch (error) {
      showNotification(translate("ops.collection.failed_save"), "error");
    } finally {
      setIsSaving(false);
    }
  }

  function cancelCollection() {
    resetEntry();
  }

  function changeStatusFilter(status: "Pending" | "Approved" | "Deleted") {
    setStatusFilter(status);
    setRecentCollections(collectionService.getRecentCollections(status));
  }

  async function approveCollection(id: string) {
    const result = await collectionService.approveCollection(id, "Admin");
    if (result.success) {
      showNotification(translate("ops.collection.approved_success"), "success");
      if (result.balance != null) {
        setWeeklySummary((prev) => ({ ...prev, balance: result.balance as number }));
        setPendingShop((prev) =>
          prev ? { ...prev, currentPending: result.balance as number } : prev
        );
      }
      refreshPage();
    } else {
      showNotification(translate("ops.collection.failed_approve"), "error");
    }
  }

  async function deleteCollection(id: string) {
    const success = await collectionService.deleteCollection(id);
    if (success) {
      showNotification(translate("ops.collection.deleted_success"), "success");
      refreshPage();
    } else {
      showNotification(translate("ops.collection.no_longer_deletable"), "error");
    }
  }

  async function rejectCollection(id: string) {
    // Global confirmation dialog instead of the blocking native
    // `window.confirm`. `rejectCollection` was already async, so the guard
    // keeps its exact linear shape and the reject call below is unchanged.
    const confirmed = await confirmDialog({
      title: translate("common.reject"),
      message: translate("ops.collection.confirm_reject"),
      confirmLabel: translate("common.reject"),
      cancelLabel: translate("common.cancel"),
      tone: "danger",
    });
    if (!confirmed) return;
    const success = await collectionService.rejectCollection(id, "Admin");
    if (success) {
      showNotification(translate("ops.collection.rejected_success"), "success");
      refreshPage();
    } else {
      showNotification(translate("ops.collection.failed_reject"), "error");
    }
  }

  function refreshPage() {
    const pending = collectionService.getPendingCollections();
    const all = collectionService.getCollections();
    setPendingCollections(pending);
    setRecentCollections(collectionService.getRecentCollections(statusFilter));
    setAllCollections(all);
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
    showNotification(translate("ops.collection.reloaded"), "info");
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
    // When editing, ledger is considered loaded since we're viewing existing collection data
    setLedgerLoaded(true);
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
      showNotification(translate("ops.collection.edit_failed_locked"), "error");
      return;
    }
    showNotification(translate("ops.collection.updated_success"), "success");
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
    if (!pendingShop) return { title: translate("ops.collection.no_shop_selected"), message: translate("ops.collection.select_pending_shop"), status: "empty" };
    const rem = projectedBalance;
    if (rem < 0) {
      return { title: translate("ops.collection.overpaid"), message: translate("ops.collection.overpaid_msg"), status: "overpaid" };
    }
    if (rem === 0) {
      return { title: translate("ops.collection.complete"), message: translate("ops.collection.complete_msg"), status: "completed" };
    }
    return { title: translate("ops.collection.pending"), message: translate("ops.collection.pending_msg"), status: "pending" };
  }, [pendingShop, projectedBalance]);

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
    changeShop: handleShopChange,
    changeCollector,
    changePaymentMode,
    changeReference,
    changeAmount,
    changeRemarks,
    changeCollectionDate,
    resetEntry,
    // New correct naming for balance calculations
    openingBalance,
    previousWeekEnd,
    pendingSales,
    salesCount,
    approvedCollectionsCount,
    pendingCollectionsCount,
    weekStart,
    weekEnd,
    approvedSales,
    approvedCollections,
    pendingApproval,
    currentOutstanding,
    todayCollection,
    projectedBalance,
    collectionProgress,
    pageSummary,
    showSummary,
    // Legacy names for backward compatibility (can be removed after all consumers updated)
    balance: currentOutstanding,
    totalSales: approvedSales,
    totalCollections: approvedCollections,
    currentPending: currentOutstanding,
    remainingBalance: projectedBalance,
    weeklySales: approvedSales,
    weeklyCollections: approvedCollections,
    weeklyPending: pendingApproval,
    weekRangeFormatted,
    weekBounds,
    ledgerWeekRangeFormatted,
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
    allCollections,
    ledgerLoaded,
    ledgerLoading,
  };
}