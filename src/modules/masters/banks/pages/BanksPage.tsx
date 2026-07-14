import React, { useState } from "react";
import DashboardLayout from "../../../../layouts/DashboardLayout/DashboardLayout";
import BankToolbar from "../components/BankToolbar";
import BankTable from "../components/BankTable";
import BankDialog from "../dialogs/BankDialog";
import { useBanks } from "../hooks/useBanks";
import { useSafeNotification } from "../../../../hooks/useSafeNotification";
import { exportToPDF, exportToExcel } from "../../../../utils/exportUtils";

type BanksPageProps = { embedded?: boolean };

function BanksPage({ embedded = false }: BanksPageProps) {
  const [showDialog, setShowDialog] = useState(false);
  const [editingBank, setEditingBank] = useState<any>(null);
  const [search, setSearch] = useState("");
  const { showNotification } = useSafeNotification();
  const { banks, saveBanks } = useBanks();

  const filteredBanks = banks.filter((bank) => {
    const keyword = search.toLowerCase();
    return (
      bank.bankName.toLowerCase().includes(keyword) ||
      bank.branch.toLowerCase().includes(keyword) ||
      bank.accountNumber.includes(keyword) ||
      bank.ifscCode.toLowerCase().includes(keyword) ||
      bank.upiId?.toLowerCase().includes(keyword)
    );
  });

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
  };

  const handleSaveBank = (bank: any) => {
    const duplicate = banks.some(
      (b) =>
        b.bankName.trim().toLowerCase() === bank.bankName.trim().toLowerCase() &&
        b.id !== editingBank?.id
    );
    if (duplicate) {
      showNotification("Bank Name already exists.", "error");
      return;
    }

    const duplicateAccount = banks.some(
      (b) =>
        b.accountNumber === bank.accountNumber &&
        b.id !== editingBank?.id
    );
    if (duplicateAccount) {
      showNotification("Account Number already exists.", "error");
      return;
    }

    if (editingBank) {
      saveBanks(
        banks.map((b) =>
          b.id === editingBank.id ? { ...b, ...bank } : b
        )
      );
      showNotification("Bank updated successfully!", "success");
    } else {
      const newBank = {
        id: Date.now(),
        bankNo: banks.length + 1,
        ...bank,
      };
      saveBanks([...banks, newBank]);
      showNotification("Bank added successfully!", "success");
    }

    setEditingBank(null);
    setShowDialog(false);
  };

  const handleEditBank = (bank: any) => {
    setEditingBank(bank);
    setShowDialog(true);
  };

  const handleDeleteBank = (id: number) => {
    if (!window.confirm("Are you sure you want to delete this bank?")) return;
    saveBanks(banks.filter((b) => b.id !== id));
    showNotification("Bank deleted successfully!", "success");
  };

  const content = (
    <div className="space-y-6 pt-6">
      <BankToolbar
        search={search}
        onSearchChange={setSearch}
        onAddBank={() => {
          setEditingBank(null);
          setShowDialog(true);
        }}
        onExportPDF={handleExportPDF}
        onExportExcel={handleExportExcel}
      />
      <p className="text-sm text-slate-500">
        Showing {filteredBanks.length} of {banks.length} Banks
      </p>
      <BankTable
        banks={filteredBanks}
        onEdit={handleEditBank}
        onDelete={handleDeleteBank}
      />
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {content}
      </div>
    </DashboardLayout>
  );
}

export default React.memo(BanksPage);