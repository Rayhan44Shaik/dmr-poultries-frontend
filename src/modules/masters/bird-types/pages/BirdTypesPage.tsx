import React, { useState } from "react";
import DashboardLayout from "../../../../layouts/DashboardLayout/DashboardLayout";
import BirdTypeToolbar from "../components/BirdTypeToolbar";
import BirdTypeTable from "../components/BirdTypeTable";
import BirdTypeDialog from "../dialogs/BirdTypeDialog";
import { useBirdTypes } from "../hooks/useBirdTypes";
import { useSafeNotification } from "../../../../hooks/useSafeNotification";
import { exportToPDF, exportToExcel } from "../../../../utils/exportUtils";

type BirdTypesPageProps = { embedded?: boolean };

function BirdTypesPage({ embedded = false }: BirdTypesPageProps) {
  const [showDialog, setShowDialog] = useState(false);
  const [editingBirdType, setEditingBirdType] = useState<any>(null);
  const [search, setSearch] = useState("");
  const { showNotification } = useSafeNotification();
  const { birdTypes, saveBirdTypes } = useBirdTypes();

  const filteredBirdTypes = birdTypes.filter((bt) => {
    const keyword = search.toLowerCase();
    return (
      bt.birdType.toLowerCase().includes(keyword) ||
      bt.description?.toLowerCase().includes(keyword)
    );
  });

  const handleExportPDF = () => {
    if (filteredBirdTypes.length === 0) {
      showNotification("No data to export.", "error");
      return;
    }
    const headers = ["Bird Type No", "Bird Type", "Average Weight (kg)", "Description", "Status"];
    const rows = filteredBirdTypes.map((bt) => [
      bt.birdTypeNo.toString(),
      bt.birdType,
      bt.averageWeight.toString(),
      bt.description || "-",
      bt.status,
    ]);
    const filename = `BirdTypes_${new Date().toISOString().split("T")[0]}`;
    exportToPDF("Bird Types - Master List", headers, rows, filename);
  };

  const handleExportExcel = () => {
    if (filteredBirdTypes.length === 0) {
      showNotification("No data to export.", "error");
      return;
    }
    const headers = ["Bird Type No", "Bird Type", "Average Weight (kg)", "Description", "Status"];
    const rows = filteredBirdTypes.map((bt) => [
      bt.birdTypeNo.toString(),
      bt.birdType,
      bt.averageWeight.toString(),
      bt.description || "-",
      bt.status,
    ]);
    const filename = `BirdTypes_${new Date().toISOString().split("T")[0]}`;
    exportToExcel("Bird Types - Master List", headers, rows, filename);
  };

  const handleSaveBirdType = (birdType: any) => {
    const duplicate = birdTypes.some(
      (bt) =>
        bt.birdType.trim().toLowerCase() === birdType.birdType.trim().toLowerCase() &&
        bt.id !== editingBirdType?.id
    );
    if (duplicate) {
      showNotification("Bird Type already exists.", "error");
      return;
    }

    if (editingBirdType) {
      saveBirdTypes(
        birdTypes.map((bt) =>
          bt.id === editingBirdType.id ? { ...bt, ...birdType } : bt
        )
      );
      showNotification("Bird Type updated successfully!", "success");
    } else {
      const newBirdType = {
        id: Date.now(),
        birdTypeNo: birdTypes.length + 1,
        ...birdType,
      };
      saveBirdTypes([...birdTypes, newBirdType]);
      showNotification("Bird Type added successfully!", "success");
    }

    setEditingBirdType(null);
    setShowDialog(false);
  };

  const handleEditBirdType = (birdType: any) => {
    setEditingBirdType(birdType);
    setShowDialog(true);
  };

  const handleDeleteBirdType = (id: number) => {
    if (!window.confirm("Are you sure you want to delete this bird type?")) return;
    saveBirdTypes(birdTypes.filter((bt) => bt.id !== id));
    showNotification("Bird Type deleted successfully!", "success");
  };

  const content = (
    <div className="space-y-6 pt-6">
      <BirdTypeToolbar
        search={search}
        onSearchChange={setSearch}
        onAddBirdType={() => {
          setEditingBirdType(null);
          setShowDialog(true);
        }}
        onExportPDF={handleExportPDF}
        onExportExcel={handleExportExcel}
      />
      <p className="text-sm text-slate-500">
        Showing {filteredBirdTypes.length} of {birdTypes.length} Bird Types
      </p>
      <BirdTypeTable
        birdTypes={filteredBirdTypes}
        onEdit={handleEditBirdType}
        onDelete={handleDeleteBirdType}
      />
      <BirdTypeDialog
        open={showDialog}
        onClose={() => {
          setEditingBirdType(null);
          setShowDialog(false);
        }}
        onSave={handleSaveBirdType}
        birdType={editingBirdType}
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

export default React.memo(BirdTypesPage);