// D:\Development\DMR-Poultries-ERP\frontend\dmr-poultries-web\src\modules\masters\banks\pages\BanksPage.tsx

import React, { useState, useMemo } from "react";
import DashboardLayout from "../../../../layouts/DashboardLayout/DashboardLayout";
import PageLayout from "../../../../components/common/PageLayout";
import BankTable from "../components/BankTable";
import BankDialog from "../dialogs/BankDialog";
import { useBanks } from "../hooks/useBanks";
import { useSafeNotification } from "../../../../hooks/useSafeNotification";
import { exportToPDF, exportToExcel } from "../../../../utils/exportUtils";
import { logAuditEvent } from "../../../../utils/securityUtils";
import { handleApiError } from "../services/bankService";
import type { Bank } from "../types/bank";

type BanksPageProps = { embedded?: boolean };

const ITEMS_PER_PAGE = 10;

function BanksPage({ embedded = false }: BanksPageProps) {
  const [showDialog, setShowDialog] = useState(false);
  const [editingBank, setEditingBank] = useState<Bank | null>(null);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const { showNotification } = useSafeNotification();
  const {
    banks,
    loading,
    saving,
    error,
    reload,
    addBank,
    editBank,
    removeBank,
  } = useBanks();

  // Reset to page 1 whenever search keyword changes
  const handleSearchChange = (value: string) => {
    setSearch(value);
    setCurrentPage(1);
  };

  const filteredBanks = useMemo(() => {
    const keyword = search.toLowerCase();
    return banks.filter(
      (bank) =>
        bank.bankName.toLowerCase().includes(keyword) ||
        bank.branch.toLowerCase().includes(keyword) ||
        bank.accountNumber.includes(keyword) ||
        bank.ifscCode.toLowerCase().includes(keyword) ||
        bank.upiId?.toLowerCase().includes(keyword)
    );
  }, [banks, search]);

  // Pagination Calculations
  const totalPages = Math.ceil(filteredBanks.length / ITEMS_PER_PAGE) || 1;
  const paginatedBanks = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredBanks.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredBanks, currentPage]);

  const handleExportPDF = () => {
    if (filteredBanks.length === 0) {
      showNotification("No data to export.", "error");
      return;
    }
    const headers = ["Bank No", "Bank Name", "Branch", "Account Number", "IFSC Code", "UPI ID", "Status"];
    const rows = filteredBanks.map((bank) => [
      bank.bankNo.toString(),
      bank.bankName,
      bank.branch,
      bank.accountNumber,
      bank.ifscCode,
      bank.upiId || "-",
      bank.status,
    ]);
    const filename = `Banks_${new Date().toISOString().split("T")[0]}`;
    exportToPDF("Banks - Master List", headers, rows, filename);
    logAuditEvent("EXPORT_PDF", "Banks", undefined, { count: filteredBanks.length });
    showNotification("PDF exported successfully!", "success");
  };

  const handleExportExcel = () => {
    if (filteredBanks.length === 0) {
      showNotification("No data to export.", "error");
      return;
    }
    const headers = ["Bank No", "Bank Name", "Branch", "Account Number", "IFSC Code", "UPI ID", "Status"];
    const rows = filteredBanks.map((bank) => [
      bank.bankNo.toString(),
      bank.bankName,
      bank.branch,
      bank.accountNumber,
      bank.ifscCode,
      bank.upiId || "-",
      bank.status,
    ]);
    const filename = `Banks_${new Date().toISOString().split("T")[0]}`;
    exportToExcel("Banks - Master List", headers, rows, filename);
    logAuditEvent("EXPORT_EXCEL", "Banks", undefined, { count: filteredBanks.length });
    showNotification("Excel exported successfully!", "success");
  };

  const validateBank = (bank: Partial<Bank>): string | null => {
    const bankName = bank.bankName?.trim() ?? "";
    const branch = bank.branch?.trim() ?? "";
    const accountNumber = bank.accountNumber?.trim() ?? "";
    const ifscCode = bank.ifscCode?.trim() ?? "";
    const upiId = bank.upiId?.trim() ?? "";

    if (!bankName || !branch || !accountNumber || !ifscCode) {
      return "Please fill all required fields.";
    }
    if (!/^[A-Za-z0-9]{6,20}$/.test(accountNumber)) {
      return "Account Number must be 6-20 alphanumeric characters.";
    }
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifscCode.toUpperCase())) {
      return "IFSC must be 11 characters (e.g., SBIN0012345).";
    }
    if (upiId && !/^[a-zA-Z0-9._-]+@[a-zA-Z0-9]+$/.test(upiId)) {
      return "UPI ID must be in format username@bank (e.g., user@hdfc).";
    }

    const duplicate = banks.some(
      (b) =>
        b.bankName.trim().toLowerCase() === bankName.toLowerCase() &&
        b.id !== editingBank?.id
    );
    if (duplicate) {
      return "Bank Name already exists.";
    }

    const duplicateAccount = banks.some(
      (b) => b.accountNumber === accountNumber && b.id !== editingBank?.id
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
        await editBank(editingBank.id, { ...payload, bankNo: editingBank.bankNo });
        logAuditEvent("UPDATE_BANK", "Banks", editingBank.id);
        showNotification("Bank updated successfully!", "success");
      } else {
        const list = await addBank(payload);
        const created = list.find(
          (b) =>
            b.bankName === payload.bankName &&
            b.accountNumber === payload.accountNumber
        );
        logAuditEvent("CREATE_BANK", "Banks", created?.id);
        showNotification("Bank added successfully!", "success");
      }

      setEditingBank(null);
      setShowDialog(false);
      return true;
    } catch (err) {
      showNotification(handleApiError(err), "error");
      return false;
    }
  };

  const handleEditBank = (bank: Bank) => {
    setEditingBank(bank);
    setShowDialog(true);
  };

  const handleDeleteBank = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this bank?")) return;
    setDeletingId(id);
    try {
      await removeBank(id);
      logAuditEvent("DELETE_BANK", "Banks", id);
      showNotification("Bank deleted successfully!", "success");
    } catch (err) {
      showNotification(handleApiError(err), "error");
    } finally {
      setDeletingId(null);
    }
  };

  const content = (
    <div className="w-full space-y-2 bank-page-container">
      <style>{`
        .bank-page-container button,
        [role="dialog"] button {
          transition: all 0.15s ease-in-out;
        }
        .bank-page-container button:hover,
        [role="dialog"] button:hover {
          transform: translateY(-1px);
        }
      `}</style>

      {/* Main Container */}
      <div className="w-full bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden">
        {/* Toolbar - Search on LEFT, Buttons on RIGHT in same line */}
        <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50/40">
          <div className="flex items-center justify-between gap-4">
            {/* Search Bar - Left Side */}
            <div className="flex-1 max-w-md">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search Bank..."
                  value={search}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="w-full pl-9 pr-4 py-1.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  disabled={loading}
                />
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
            </div>

            {/* Action Buttons - Right Side */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={handleExportPDF}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 hover:border-red-300 transition-all"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                  <path fillRule="evenodd" d="M8 11a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1zm0 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1zm0 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" clipRule="evenodd" />
                </svg>
                PDF
              </button>
              
              <button
                onClick={handleExportExcel}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-green-600 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 hover:border-green-300 transition-all"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1H3a1 1 0 01-1-1V4zm6 0a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1H9a1 1 0 01-1-1V4zm6 0a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
                </svg>
                Excel
              </button>
              
              <button
                onClick={() => {
                  setEditingBank(null);
                  setShowDialog(true);
                }}
                disabled={loading}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-all shadow-sm disabled:opacity-50"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Bank
              </button>
            </div>
          </div>
        </div>

        {/* Status Counter Bar */}
        <div className="px-4 py-2 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-600 uppercase tracking-wider">
              Banks Directory
            </span>
            <span className="px-2 py-0.5 font-semibold text-blue-700 bg-blue-50 border border-blue-200/60 rounded-full">
              {filteredBanks.length} records
            </span>
            {(loading || saving || deletingId !== null) && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 font-medium text-slate-600 bg-slate-100 border border-slate-200 rounded-full">
                <svg className="animate-spin h-3 w-3 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                {loading ? "Loading..." : "Saving..."}
              </span>
            )}
          </div>
          <p className="text-slate-500 font-medium">
            Showing {paginatedBanks.length} of {filteredBanks.length} Banks (Page {currentPage} of {totalPages})
          </p>
        </div>

        {error && !loading && (
          <div className="mx-4 mt-3 px-3 py-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between gap-3">
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

        {/* Table Content */}
        <div className="p-0 relative min-h-[120px]">
          {loading && banks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500 gap-3">
              <svg className="animate-spin h-8 w-8 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <p className="text-sm font-medium">Loading banks...</p>
            </div>
          ) : !loading && banks.length === 0 && !error ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500 gap-2">
              <p className="text-sm font-medium text-slate-700">No banks found.</p>
              <p className="text-xs text-slate-500">Add a bank to get started.</p>
            </div>
          ) : (
            <BankTable
              banks={paginatedBanks}
              onEdit={handleEditBank}
              onDelete={(id) => {
                void handleDeleteBank(id);
              }}
            />
          )}
        </div>

        {/* Pagination Controls - Bottom Right Aligned */}
        <div className="px-4 py-2.5 bg-slate-50/60 border-t border-slate-100 flex items-center justify-end gap-2 text-xs">
          <button
            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
            disabled={currentPage === 1 || loading}
            className="px-2.5 py-1 rounded-md border border-slate-200 bg-white font-medium text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
          >
            Previous
          </button>

          <div className="flex items-center gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
              <button
                key={pageNum}
                onClick={() => setCurrentPage(pageNum)}
                disabled={loading}
                className={`w-7 h-7 rounded-md text-xs font-semibold flex items-center justify-center ${
                  currentPage === pageNum
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                }`}
              >
                {pageNum}
              </button>
            ))}
          </div>

          <button
            onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages || loading}
            className="px-2.5 py-1 rounded-md border border-slate-200 bg-white font-medium text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
          >
            Next
          </button>
        </div>
      </div>

      {/* Modal Dialog */}
      <BankDialog
        open={showDialog}
        onClose={() => {
          setEditingBank(null);
          setShowDialog(false);
        }}
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
      <PageLayout className="!py-2 px-8 sm:px-12 lg:px-16 max-w-6xl mx-auto">
        {content}
      </PageLayout>
    </DashboardLayout>
  );
}

export default React.memo(BanksPage);
