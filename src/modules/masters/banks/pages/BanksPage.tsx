import MasterListToolbar from "../../components/MasterListToolbar";
import MasterListSummary from "../../components/MasterListSummary";
import MasterPagination from "../../components/MasterPagination";
import "../../styles/masters.css";
import React, { useState } from "react";

import DashboardLayout from "../../../../layouts/DashboardLayout/DashboardLayout";
import PageLayout from "../../../../components/common/PageLayout";
import BankTable from "../components/BankTable";
import BankDialog from "../dialogs/BankDialog";
import { useBanks } from "../hooks/useBanks";
import { useSafeNotification } from "../../../../hooks/useSafeNotification";
import { exportToExcel } from "../../../../utils/exportUtils";

// BanksPage.tsx is inside banks/pages, while exportBankPdf is inside banks/utils.
import { exportBanksToPDF } from "../utils/exportBankPdf";
import { shouldShowPagination } from "../../../../shared/ui/paginationStyles";
import { logAuditEvent } from "../../../../utils/securityUtils";
import { handleApiError } from "../services/bankService";
import type { Bank } from "../types/bank";

type BanksPageProps = {
  embedded?: boolean;
};

const DEFAULT_PAGE_SIZE = 10;

function BanksPage({ embedded = false }: BanksPageProps) {
  const [showDialog, setShowDialog] = useState(false);

  const [editingBank, setEditingBank] = useState<Bank | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortOrder, setSortOrder] = useState("number");

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);

  const [deletingId, setDeletingId] = useState<number | null>(null);

  const { showNotification } = useSafeNotification();

  // This matches the API returned by your current useBanks hook.
  const {
    banks,
    loading,
    saving,
    error,
    reload,
    addBank,
    editBank,
    removeBank,
    total, page: serverPage, exportRows,
  } = useBanks({ page: currentPage, pageSize: pageSize, search, status: statusFilter, sort: sortOrder });

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setCurrentPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = serverPage;
  const paginatedBanks = banks;

  const handleExportPDF = async () => {
    try {
      const filteredBanks = await exportRows();

    if (filteredBanks.length === 0) {
      showNotification("No data to export.", "error");

      return;
    }

    const date = new Date().toISOString().split("T")[0];

    const filename = `Banks_${date}`;

    try {
      exportBanksToPDF(filteredBanks, filename);

      logAuditEvent("EXPORT_PDF", "Banks", undefined, {
        count: filteredBanks.length,
      });

      showNotification("PDF exported successfully!", "success");
    } catch (exportError) {
      console.error("Unable to export Bank PDF:", exportError);

      showNotification("Unable to export PDF. Please try again.", "error");
    }
  
    } catch (err) { showNotification(handleApiError(err), "error"); }
  };

  const handleExportExcel = async () => {
    try {
      const filteredBanks = await exportRows();

    if (filteredBanks.length === 0) {
      showNotification("No data to export.", "error");

      return;
    }

    const headers = [
      "Bank No",
      "Bank Name",
      "Branch",
      "Account Number",
      "IFSC Code",
      "UPI ID",
      "Status",
    ];

    const rows = filteredBanks.map((bank) => [
      String(bank.bankNo),
      bank.bankName,
      bank.branch,
      bank.accountNumber,
      bank.ifscCode,
      bank.upiId?.trim() || "-",
      bank.status,
    ]);

    const date = new Date().toISOString().split("T")[0];

    const filename = `Banks_${date}`;

    try {
      exportToExcel("Banks - Master List", headers, rows, filename);

      logAuditEvent("EXPORT_EXCEL", "Banks", undefined, {
        count: filteredBanks.length,
      });

      showNotification("Excel exported successfully!", "success");
    } catch (exportError) {
      console.error("Unable to export Bank Excel:", exportError);

      showNotification("Unable to export Excel. Please try again.", "error");
    }
  
    } catch (err) { showNotification(handleApiError(err), "error"); }
  };

  const validateBank = (bank: Partial<Bank>): string | null => {
    const bankName = bank.bankName?.trim() ?? "";

    const branch = bank.branch?.trim() ?? "";

    const accountNumber = bank.accountNumber?.trim() ?? "";

    const ifscCode = bank.ifscCode?.trim().toUpperCase() ?? "";

    const upiId = bank.upiId?.trim() ?? "";

    if (!bankName || !branch || !accountNumber || !ifscCode) {
      return "Please fill all required fields.";
    }

    if (!/^[A-Za-z0-9]{6,20}$/.test(accountNumber)) {
      return "Account Number must be 6-20 alphanumeric characters.";
    }

    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifscCode)) {
      return "IFSC must be 11 characters (e.g., SBIN0012345).";
    }

    if (upiId && !/^[a-zA-Z0-9._-]+@[a-zA-Z0-9]+$/.test(upiId)) {
      return "UPI ID must be in format username@bank (e.g., user@hdfc).";
    }

    const duplicateName = banks.some(
      (existingBank) =>
        existingBank.bankName.trim().toLowerCase() === bankName.toLowerCase() &&
        existingBank.id !== editingBank?.id,
    );

    if (duplicateName) {
      return "Bank Name already exists.";
    }

    const duplicateAccount = banks.some(
      (existingBank) =>
        existingBank.accountNumber.trim().toLowerCase() ===
          accountNumber.toLowerCase() && existingBank.id !== editingBank?.id,
    );

    if (duplicateAccount) {
      return "Account Number already exists.";
    }

    return null;
  };

  const handleSaveBank = async (bank: Partial<Bank>): Promise<boolean> => {
    const validationError = validateBank(bank);

    if (validationError) {
      showNotification(validationError, "error");

      return false;
    }

    const payload = {
      bankName: bank.bankName!.trim(),

      branch: bank.branch!.trim(),

      accountNumber: bank.accountNumber!.trim(),

      ifscCode: bank.ifscCode!.trim().toUpperCase(),

      upiId: bank.upiId?.trim() ?? "",

      status: bank.status ?? "Active",
    };

    try {
      if (editingBank) {
        await editBank(editingBank.id, {
          ...payload,
          bankNo: editingBank.bankNo,
        });

        logAuditEvent("UPDATE_BANK", "Banks", editingBank.id);

        showNotification("Bank updated successfully!", "success");
      } else {
        const updatedBanks = await addBank(payload);

        const createdBank = updatedBanks.find(
          (created) =>
            created.bankName === payload.bankName &&
            created.accountNumber === payload.accountNumber,
        );

        logAuditEvent("CREATE_BANK", "Banks", createdBank?.id);

        showNotification("Bank added successfully!", "success");
      }

      setEditingBank(null);
      setShowDialog(false);

      return true;
    } catch (saveError) {
      showNotification(handleApiError(saveError), "error");

      return false;
    }
  };

  const handleEditBank = (bank: Bank) => {
    setEditingBank(bank);
    setShowDialog(true);
  };

  const handleDeleteBank = async (id: number) => {
    const bankToDelete = banks.find((bank) => bank.id === id);

    if (!bankToDelete) {
      showNotification("Bank record was not found.", "error");

      return;
    }

    setDeletingId(id);

    try {
      await removeBank(id);

      logAuditEvent("DELETE_BANK", "Banks", id);

      showNotification("Bank deleted successfully!", "success");
    } catch (deleteError) {
      showNotification(handleApiError(deleteError), "error");
    } finally {
      setDeletingId(null);
    }
  };

  const handleOpenAddDialog = () => {
    setEditingBank(null);
    setShowDialog(true);
  };

  const handleCloseDialog = () => {
    setEditingBank(null);
    setShowDialog(false);
  };

  const content = (
    <div className="master-page w-full min-w-0 space-y-3 font-sans text-slate-700">
      <div className="w-full rounded-xl border border-slate-200/90 bg-white shadow-sm">
        <MasterListToolbar
          onRefresh={() => { void reload().catch(() => {}); }}
          status={statusFilter}
          onStatusChange={(value) => { setStatusFilter(value); setCurrentPage(1); }}
          sort={sortOrder}
          onSortChange={(value) => { setSortOrder(value); setCurrentPage(1); }}
          search={search}
          onSearchChange={handleSearchChange}
          searchPlaceholder="Search Bank..."
          addLabel="Add Bank"
          onAdd={handleOpenAddDialog}
          onExportPDF={handleExportPDF}
          onExportExcel={handleExportExcel}
          loading={loading}
          saving={saving}
        />

        <MasterListSummary
          title="Banks Directory"
          total={total}
          shown={paginatedBanks.length}
          page={safePage}
          totalPages={totalPages}
          loading={loading}
          saving={saving}
          deleting={deletingId !== null}
        />

        {error && !loading && (
          <div className="mx-4 mt-3 flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <span>{error}</span>

            <button
              type="button"
              onClick={() => {
                void reload().catch(() => undefined);
              }}
              className="shrink-0 text-xs font-semibold text-red-700 underline"
            >
              Retry
            </button>
          </div>
        )}

        <div className="relative min-h-[120px] p-0">
          {loading && banks.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-500">
              <p className="text-sm font-medium">Loading banks...</p>
            </div>
          ) : !loading && banks.length === 0 && !error ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-slate-500">
              <p className="text-sm font-medium text-slate-700">
                No banks found.
              </p>

              <p className="text-xs">Add a bank to get started.</p>
            </div>
          ) : (
            <BankTable
              banks={paginatedBanks}
              onEdit={handleEditBank}
              onDelete={handleDeleteBank}
              emptyMessage={
                search.trim() ? "No banks matching your search." : undefined
              }
            />
          )}
        </div>

        {shouldShowPagination(total) && (
          <MasterPagination
            page={safePage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            disabled={loading}
            pageSize={pageSize}
            onPageSizeChange={(next) => {
              setPageSize(next);
              setCurrentPage(1); // a new page size invalidates the current page
            }}
          />
        )}
      </div>

      <BankDialog
        open={showDialog}
        onClose={handleCloseDialog}
        onSave={handleSaveBank}
        bank={editingBank}
      />
    </div>
  );

  if (embedded) {
    return content;
  }

  return (
    <DashboardLayout>
      <PageLayout className="mx-auto max-w-6xl px-8 !py-2 sm:px-12 lg:px-16">
        {content}
      </PageLayout>
    </DashboardLayout>
  );
}

export default React.memo(BanksPage);
