// src/modules/collections/pages/CollectionEntryPage.tsx

import { useState } from "react";
import useCollectionEntry from "../hooks/useCollectionEntry";
import CollectionInformation from "../components/entry/CollectionInformation";
import OutstandingSummary from "../components/entry/OutstandingSummary";
import CollectionAmount from "../components/entry/CollectionAmount";
import RecentCollectionsTable from "../components/entry/RecentCollectionsTable";
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

  const handleViewShop = (shopName: string) => {
    setSelectedShop(shopName);
    setEditMode("view");
    setIsEditModalOpen(true);
  };

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
        onRefresh={vm.reloadCollections}
        ledgerLoading={vm.ledgerLoading}
        refreshing={vm.loading}
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
        onDelete={vm.deleteCollection}
        onViewShop={handleViewShop}
      />

      <EditCollectionModal
        isOpen={isEditModalOpen}
        onClose={closeModal}
        shopName={selectedShop || ""}
        mode={editMode}
        allCollections={vm.allCollections || []}
        onRefresh={vm.refreshPage}
      />
    </div>
  );

  return content;
}