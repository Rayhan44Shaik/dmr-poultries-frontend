import React, { useState } from "react";
import DashboardLayout from "../../../../layouts/DashboardLayout/DashboardLayout";
import FarmToolbar from "../components/FarmToolbar";
import FarmTable from "../components/FarmTable";
import FarmDialog from "../dialogs/FarmDialog";
import { useFarms } from "../hooks/useFarms";
import { useSafeNotification } from "../../../../hooks/useSafeNotification";
import { exportToPDF, exportToExcel } from "../../../../utils/exportUtils";

type FarmsPageProps = { embedded?: boolean };

function FarmsPage({ embedded = false }: FarmsPageProps) {
  const [showDialog, setShowDialog] = useState(false);
  const [editingFarm, setEditingFarm] = useState<any>(null);
  const [search, setSearch] = useState("");
  const { showNotification } = useSafeNotification();
  const { farms, saveFarms } = useFarms();

  const filteredFarms = farms.filter((farm) => {
    const keyword = search.toLowerCase();
    return (
      farm.farmName.toLowerCase().includes(keyword) ||
      farm.ownerName.toLowerCase().includes(keyword) ||
      farm.supervisorName.toLowerCase().includes(keyword) ||
      farm.village.toLowerCase().includes(keyword) ||
      farm.phoneNumber.includes(keyword)
    );
  });

  const handleExportPDF = () => {
    if (filteredFarms.length === 0) {
      showNotification("No data to export.", "error");
      return;
    }
    const headers = ["Farm No", "Farm Name", "Owner", "Supervisor", "Village", "Phone", "Status"];
    const rows = filteredFarms.map((farm) => [
      farm.farmNo.toString(),
      farm.farmName,
      farm.ownerName,
      farm.supervisorName,
      farm.village,
      farm.phoneNumber,
      farm.status,
    ]);
    const filename = `Farms_${new Date().toISOString().split("T")[0]}`;
    exportToPDF("Farms - Master List", headers, rows, filename);
  };

  const handleExportExcel = () => {
    if (filteredFarms.length === 0) {
      showNotification("No data to export.", "error");
      return;
    }
    const headers = ["Farm No", "Farm Name", "Owner", "Supervisor", "Village", "Phone", "Status"];
    const rows = filteredFarms.map((farm) => [
      farm.farmNo.toString(),
      farm.farmName,
      farm.ownerName,
      farm.supervisorName,
      farm.village,
      farm.phoneNumber,
      farm.status,
    ]);
    const filename = `Farms_${new Date().toISOString().split("T")[0]}`;
    exportToExcel("Farms - Master List", headers, rows, filename);
  };

  const handleSaveFarm = (farm: any) => {
    const duplicateFarm = farms.some(
      (f) =>
        f.farmName.trim().toLowerCase() === farm.farmName.trim().toLowerCase() &&
        f.id !== editingFarm?.id
    );
    if (duplicateFarm) {
      showNotification("Farm Name already exists.", "error");
      return;
    }

    const duplicatePhone = farms.some(
      (f) =>
        f.phoneNumber === farm.phoneNumber &&
        f.id !== editingFarm?.id
    );
    if (duplicatePhone) {
      showNotification("Phone Number already exists.", "error");
      return;
    }

    if (editingFarm) {
      saveFarms(
        farms.map((f) =>
          f.id === editingFarm.id ? { ...f, ...farm } : f
        )
      );
      showNotification("Farm updated successfully!", "success");
    } else {
      const newFarm = {
        id: Date.now(),
        farmNo: farms.length + 1,
        ...farm,
      };
      saveFarms([...farms, newFarm]);
      showNotification("Farm added successfully!", "success");
    }

    setEditingFarm(null);
    setShowDialog(false);
  };

  const handleEditFarm = (farm: any) => {
    setEditingFarm(farm);
    setShowDialog(true);
  };

  const handleDeleteFarm = (id: number) => {
    if (!window.confirm("Are you sure you want to delete this farm?")) return;
    saveFarms(farms.filter((f) => f.id !== id));
    showNotification("Farm deleted successfully!", "success");
  };

  const content = (
    <div className="space-y-6 pt-6">
      <FarmToolbar
        search={search}
        onSearchChange={setSearch}
        onAddFarm={() => {
          setEditingFarm(null);
          setShowDialog(true);
        }}
        onExportPDF={handleExportPDF}
        onExportExcel={handleExportExcel}
      />
      <p className="text-sm text-slate-500">
        Showing {filteredFarms.length} of {farms.length} Farms
      </p>
      <FarmTable
        farms={filteredFarms}
        onEdit={handleEditFarm}
        onDelete={handleDeleteFarm}
      />
      <FarmDialog
        open={showDialog}
        onClose={() => {
          setEditingFarm(null);
          setShowDialog(false);
        }}
        onSave={handleSaveFarm}
        farm={editingFarm}
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

export default React.memo(FarmsPage);