// src/modules/collections/pages/CollectionEntryPage.tsx

import { useState } from "react";
import useCollectionEntry from "../hooks/useCollectionEntry";
import CollectionInformation from "../components/entry/CollectionInformation";
import OutstandingSummary from "../components/entry/OutstandingSummary";
import CollectionAmount from "../components/entry/CollectionAmount";
import RecentCollectionsTable from "../components/entry/RecentCollectionsTable";
import type { Collection, RecentCollection } from "../types/collection";
import { EditCollectionModal } from "../components/pending/EditCollectionModal";
import { useSafeNotification } from "../../../../hooks/useSafeNotification";
import { useI18n } from "../../../../i18n";

type Props = {
  embedded?: boolean;
};

export default function CollectionEntryPage({ embedded: _embedded = false }: Props) {
  const { t } = useI18n();
  const vm = useCollectionEntry();
  const { showNotification } = useSafeNotification();

  const [selectedShop, setSelectedShop] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editMode, setEditMode] = useState<"view" | "edit">("view");
  /**
   * The row highlighted in the recent table. Keeping it here lets the view
   * modal open on exactly the entry the user selected — by mouse, Enter or
   * the arrow keys — instead of defaulting to the shop's latest collection.
   */
  const [selectedRow, setSelectedRow] = useState<RecentCollection | null>(null);

  const handleViewShop = (shopName: string) => {
    setSelectedShop(shopName);
    setEditMode("view");
    setIsEditModalOpen(true);
  };

  /** Keyboard/mouse selection in the recent table drives the view target. */
  const handleSelectionChange = (row: RecentCollection | null) => {
    setSelectedRow(row);
    if (row) setSelectedShop(row.shopName);
  };

  /**
   * The selected recent row as a full Collection, so the modal can lead with
   * it. Matched by id against the page's collection cache; when the row is not
   * in the cache the modal falls back to the shop's latest entry as before.
   */
  const selectedCollection: Collection | null =
    selectedRow == null
      ? null
      : ((vm.allCollections || []).find((c: Collection) => String(c.id) === String(selectedRow.id)) ?? null);

  const closeModal = () => {
    setIsEditModalOpen(false);
    setSelectedShop(null);
  };

  const handleSaveCollection = async () => {
    try {
      await vm.saveCollection();
      showNotification(t("ops.collection.saved_success"), "success");
    } catch (err) {
      showNotification(t("ops.collection.failed_save_try_again"), "error");
    }
  };

  // Content matching the exact vertical layout and structure of RatesEntryPage
  const content = (
    <div className="w-full space-y-5">
      <CollectionInformation
        entry={vm.entry}
        errors={vm.errors}
        shops={vm.shops}
        collectors={vm.collectors}
        paymentModes={vm.paymentModes}
        onDateChange={vm.changeCollectionDate}
        onShopChange={vm.changeShop}
        onCollectorChange={vm.changeCollector}
        onPaymentModeChange={vm.changePaymentMode}
        onReferenceChange={vm.changeReference}
        onViewLedger={vm.viewLedger}
        onReset={vm.resetEntry}
        ledgerLoading={vm.ledgerLoading}
      />

      <div className="grid grid-cols-1 lg:grid-cols-10 gap-6 items-stretch">
        <div className="lg:col-span-5 min-w-0">
          <OutstandingSummary
            openingBalance={vm.openingBalance}
            approvedSales={vm.approvedSales}
            approvedCollections={vm.approvedCollections}
            pendingApproval={vm.pendingApproval}
            currentOutstanding={vm.currentOutstanding}
            showSummary={vm.showSummary}
            ledgerLoaded={vm.ledgerLoaded}
            shopName={vm.entry.shopName}
            periodLabel={vm.weekRangeFormatted}
            periodType="weekly"
            previousWeekEnd={vm.previousWeekEnd}
            pendingSales={vm.pendingSales}
            salesCount={vm.salesCount}
            approvedCollectionsCount={vm.approvedCollectionsCount}
            pendingCollectionsCount={vm.pendingCollectionsCount}
            weekStart={vm.weekStart}
            weekEnd={vm.weekEnd}
          />
        </div>
        <div className="lg:col-span-5 min-w-0">
          <CollectionAmount
            amount={vm.entry.amount}
            remarks={vm.entry.remarks}
            currentOutstanding={vm.currentOutstanding}
            receivedToday={vm.todayCollection}
            projectedBalance={vm.projectedBalance}
            showSummary={vm.showSummary}
            ledgerLoaded={vm.ledgerLoaded}
            amountError={vm.errors?.amount}
            onAmountChange={vm.changeAmount}
            onRemarksChange={vm.changeRemarks}
            onSave={handleSaveCollection}
            onCancel={vm.cancelCollection}
            isSaving={vm.isSaving}
            disableSave={vm.disableSave}
          />
        </div>
      </div>

      <RecentCollectionsTable
        collections={vm.recentCollections}
        isLoading={vm.loading}
        statusFilter={vm.statusFilter}
        onStatusChange={vm.changeStatusFilter}
        onApprove={vm.approveCollection}
        onReject={vm.rejectCollection}
        onEdit={vm.editCollection}
        onViewShop={handleViewShop}
        onSelectionChange={handleSelectionChange}
      />

      <EditCollectionModal
        isOpen={isEditModalOpen}
        onClose={closeModal}
        shopName={selectedShop || ""}
        mode={editMode}
        allCollections={vm.allCollections || []}
        collection={selectedCollection}
        onRefresh={vm.refreshPage}
      />
    </div>
  );

  return content;
}