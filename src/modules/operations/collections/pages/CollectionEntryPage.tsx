// CollectionEntryPage.tsx (unchanged)
import { useState } from "react";
import useCollectionEntry from "../hooks/useCollectionEntry";
import CollectionInformation from "../components/entry/CollectionInformation";
import OutstandingSummary from "../components/entry/OutstandingSummary";
import CollectionAmount from "../components/entry/CollectionAmount";
import RecentCollectionsTable from "../components/entry/RecentCollectionsTable";
import { EditCollectionModal } from "../components/pending/EditCollectionModal";

export default function CollectionEntryPage() {
  const vm = useCollectionEntry();

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

  const content = (
    <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 p-2">
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
        />
      </div>

      <div className="grid grid-cols-10 gap-5 items-stretch px-2 pt-2">
        <div className="col-span-5 min-w-0">
          <OutstandingSummary
            openingBalance={vm.openingBalance}
            weeklySales={vm.weeklySales}
            weeklyCollections={vm.weeklyCollections}
            weeklyPending={vm.weeklyPending}
            currentPending={vm.currentPending}
            showSummary={vm.showSummary}
            shopName={vm.entry.shopName}
            dateRange={vm.weekRangeFormatted}
          />
        </div>
        <div className="col-span-5 min-w-0">
          <CollectionAmount
            amount={vm.entry.amount}
            remarks={vm.entry.remarks}
            previousBalance={vm.currentPending}
            receivedToday={vm.todayCollection}
            remainingBalance={vm.remainingBalance}
            showSummary={vm.showSummary}
            amountError={vm.errors?.amount}
            onAmountChange={vm.changeAmount}
            onRemarksChange={vm.changeRemarks}
            onSave={vm.saveCollection}
            onCancel={vm.cancelCollection}
            isSaving={vm.isSaving}
            disableSave={vm.disableSave}
          />
        </div>
      </div>

      <div className="border-t border-slate-200 p-2">
        <RecentCollectionsTable
          collections={vm.recentCollections}
          statusFilter={vm.statusFilter}
          pendingApprovalCount={vm.pendingApprovalCount}
          currentPage={vm.currentPage}
          totalPages={vm.totalPages}
          onStatusChange={vm.changeStatusFilter}
          onPageChange={vm.changePage}
          onApprove={vm.approveCollection}
          onEdit={vm.editCollection}
          onDelete={vm.deleteCollection}
          onViewShop={handleViewShop}
        />
      </div>

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

  return <div className="p-2">{content}</div>;
}