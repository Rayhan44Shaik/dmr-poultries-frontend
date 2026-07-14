import useCollectionEntry from "../hooks/useCollectionEntry";
import CollectionInformation from "../components/entry/CollectionInformation";
import OutstandingSummary from "../components/entry/OutstandingSummary";
import CollectionAmount from "../components/entry/CollectionAmount";
import RecentCollectionsTable from "../components/entry/RecentCollectionsTable";

export default function CollectionEntryPage() {
  const vm = useCollectionEntry();

  return (
    <div className="w-full p-6">
      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        {/* Collection Information */}
        <div className="border-b border-slate-200 p-3">
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

        {/* Outstanding Summary & Collection Amount */}
        <div className="mt-5 grid grid-cols-10 gap-5 items-stretch px-3">
          <div className="col-span-4 min-w-0">
            <OutstandingSummary
              openingBalance={vm.openingBalance}
              weeklySales={vm.weeklySales}          // ✅ changed
              weeklyCollections={vm.weeklyCollections} // ✅ changed
              currentPending={vm.currentPending}
              showSummary={vm.showSummary}
              shopName={vm.entry.shopName}
              dateRange={vm.weekRangeFormatted}
            />
          </div>
          <div className="col-span-6 min-w-0">
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

        {/* Recent Collections */}
        <div className="border-b border-slate-200 p-3">
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
          />
        </div>
      </div>
    </div>
  );
}