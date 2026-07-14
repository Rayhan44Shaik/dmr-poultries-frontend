import { useState } from "react";
import DashboardLayout from "../../../../layouts/DashboardLayout/DashboardLayout";
import VehicleToolbar from "../components/VehicleToolbar";
import VehicleTable from "../components/VehicleTable";
import VehicleDialog from "../dialogs/VehicleDialog";
import { useVehicles } from "../hooks/useVehicles";
import { useSafeNotification } from "../../../../hooks/useSafeNotification"; // ✅ use safe
import { exportToPDF, exportToExcel } from "../../../../utils/exportUtils";

type MasterVehiclesPageProps = {
  embedded?: boolean;
};

function MasterVehiclesPage({ embedded = false }: MasterVehiclesPageProps) {
  const [showDialog, setShowDialog] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<any>(null);
  const [search, setSearch] = useState("");
  const { showNotification } = useSafeNotification();
  const { vehicles, saveVehicles } = useVehicles();

  const filteredVehicles = vehicles.filter((vehicle) => {
    const keyword = search.toLowerCase();
    return (
      vehicle.vehicleNumber?.toLowerCase().includes(keyword) ||
      vehicle.vehicleType?.toLowerCase().includes(keyword) ||
      vehicle.trackingId?.toLowerCase().includes(keyword) ||
      vehicle.fastagBank?.toLowerCase().includes(keyword) ||
      vehicle.engineNumber?.toLowerCase().includes(keyword) ||
      vehicle.chassisNumber?.toLowerCase().includes(keyword)
    );
  });

  const handleExportPDF = () => {
    if (filteredVehicles.length === 0) {
      showNotification("No data to export.", "error");
      return;
    }
    const headers = ["Vehicle No", "Vehicle Number", "Type", "Boxes", "Bird Capacity", "Status"];
    const rows = filteredVehicles.map((v) => [
      v.vehicleNo?.toString() || "",
      v.vehicleNumber || "",
      v.vehicleType || "",
      v.noOfBoxes?.toString() || "0",
      v.birdCapacity?.toString() || "0",
      v.status || "",
    ]);
    const filename = `Vehicles_${new Date().toISOString().split("T")[0]}`;
    exportToPDF("Vehicles - Master List", headers, rows, filename);
  };

  const handleExportExcel = () => {
    if (filteredVehicles.length === 0) {
      showNotification("No data to export.", "error");
      return;
    }
    const headers = ["Vehicle No", "Vehicle Number", "Type", "Boxes", "Bird Capacity", "Status"];
    const rows = filteredVehicles.map((v) => [
      v.vehicleNo?.toString() || "",
      v.vehicleNumber || "",
      v.vehicleType || "",
      v.noOfBoxes?.toString() || "0",
      v.birdCapacity?.toString() || "0",
      v.status || "",
    ]);
    const filename = `Vehicles_${new Date().toISOString().split("T")[0]}`;
    exportToExcel("Vehicles - Master List", headers, rows, filename);
  };

  const handleSaveVehicle = (vehicle: any) => {
    const duplicate = vehicles.some(
      (v) =>
        v.vehicleNumber?.trim().toLowerCase() === vehicle.vehicleNumber?.trim().toLowerCase() &&
        v.id !== editingVehicle?.id
    );
    if (duplicate) {
      showNotification("Vehicle Number already exists.", "error");
      return;
    }

    if (editingVehicle) {
      saveVehicles(
        vehicles.map((v) =>
          v.id === editingVehicle.id ? { ...v, ...vehicle } : v
        )
      );
      showNotification("Vehicle updated successfully!", "success");
    } else {
      const newVehicle = {
        id: Date.now(),
        vehicleNo: vehicles.length + 1,
        ...vehicle,
      };
      saveVehicles([...vehicles, newVehicle]);
      showNotification("Vehicle added successfully!", "success");
    }
    setEditingVehicle(null);
    setShowDialog(false);
  };

  const handleEditVehicle = (vehicle: any) => {
    setEditingVehicle(vehicle);
    setShowDialog(true);
  };

  const handleDeleteVehicle = (id: number) => {
    if (!window.confirm("Are you sure you want to delete this vehicle?")) return;
    saveVehicles(vehicles.filter((v) => v.id !== id));
    showNotification("Vehicle deleted successfully!", "success");
  };

  const content = (
    <div className="space-y-6 pt-6">
      <VehicleToolbar
        search={search}
        onSearchChange={setSearch}
        onAddVehicle={() => {
          setEditingVehicle(null);
          setShowDialog(true);
        }}
        onExportPDF={handleExportPDF}
        onExportExcel={handleExportExcel}
      />
      <p className="text-sm text-slate-500">
        Showing {filteredVehicles.length} of {vehicles.length} Vehicles
      </p>
      <VehicleTable
        vehicles={filteredVehicles}
        onEdit={handleEditVehicle}
        onDelete={handleDeleteVehicle}
      />
      <VehicleDialog
        open={showDialog}
        onClose={() => {
          setEditingVehicle(null);
          setShowDialog(false);
        }}
        onSave={handleSaveVehicle}
        vehicle={editingVehicle}
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

export default MasterVehiclesPage;