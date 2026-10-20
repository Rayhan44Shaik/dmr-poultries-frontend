// src/modules/collections/pages/CollectionEntryPage.tsx

import { useState } from "react";
import { useMemo } from "react";
import useCollectionEntry from "../hooks/useCollectionEntry";
import CollectionInformation from "../components/entry/CollectionInformation";
import OutstandingSummary from "../components/entry/OutstandingSummary";
import CollectionAmount from "../components/entry/CollectionAmount";
import RecentCollectionsTable from "../components/entry/RecentCollectionsTable";
import type { Collection, RecentCollection } from "../types/collection";
import { EditCollectionModal } from "../components/pending/EditCollectionModal";
import { CAPABILITIES, useCan } from "../../../auth/permissions";

type Props = {
  embedded?: boolean;
};

export default function CollectionEntryPage({ embedded: _embedded = false }: Props) {
  const vm = useCollectionEntry();
  // Entry-only roles (supervisor) never receive approve / delete affordances.
  const can = useCan();

  const [selectedShop, setSelectedShop] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editMode, setEditMode] = useState<"view" | "edit">("view");
  /**
   * The row highlighted in the recent table. Keeping it here lets the view
   * modal open on exactly the entry the user selected — by mouse, Enter or
   * the arrow keys — instead of defaulting to the shop's latest collection.
   */
  const [selectedRow, setSelectedRow] = useState<RecentCollection | null>(null);
  const latestShopTransaction = useMemo(() => {
    if (!vm.entry.shopName) return null;
    return [...(vm.allCollections || [])]
      .filter((collection: Collection) => collection.shopName === vm.entry.shopName && collection.status !== "Deleted")
      .sort((a: Collection, b: Collection) =>
        b.collectionDate.localeCompare(a.collectionDate) || Number(b.numericId ?? 0) - Number(a.numericId ?? 0)
      )[0] ?? null;
  }, [vm.allCollections, vm.entry.shopName]);

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
    const saved = await vm.saveCollection();
    if (saved) {
      // Saving begins a fresh collection-entry cycle. Keep keyboard users in
      // the form instead of letting focus fall through into the results table.
      window.requestAnimationFrame(() => {
        document.getElementById("collection-entry-date")?.focus({ preventScroll: true });
      });
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
        latestTransaction={latestShopTransaction}
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
            collectionWeekStart={vm.collectionWeekStart}
            collectionWeekEnd={vm.collectionWeekEnd}
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
        onApprove={can(CAPABILITIES.COLLECTION_APPROVE) ? vm.approveCollection : undefined}
        onReject={can(CAPABILITIES.COLLECTION_REJECT) ? vm.rejectCollection : undefined}
        onDelete={can(CAPABILITIES.COLLECTION_DELETE) ? vm.deleteCollection : undefined}
        onEdit={vm.editCollection}
        onViewShop={handleViewShop}
        onRefresh={vm.reloadCollections}
        refreshing={vm.loading}
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
        allowDelete={can(CAPABILITIES.COLLECTION_DELETE)}
      />
    </div>
  );

  return content;
}
