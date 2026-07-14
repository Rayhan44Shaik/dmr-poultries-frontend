import React, { useState } from "react";
import DashboardLayout from "../../../../layouts/DashboardLayout/DashboardLayout";
import ShopToolbar from "../components/ShopToolbar";
import ShopTable from "../components/ShopTable";
import ShopDialog from "../dialogs/ShopDialog";
import { useShops } from "../hooks/useShops";
import { useSafeNotification } from "../../../../hooks/useSafeNotification";
import { exportToPDF, exportToExcel } from "../../../../utils/exportUtils";

type ShopsPageProps = { embedded?: boolean };

function ShopsPage({ embedded = false }: ShopsPageProps) {
  const [showDialog, setShowDialog] = useState(false);
  const [editingShop, setEditingShop] = useState<any>(null);
  const [search, setSearch] = useState("");
  const { showNotification } = useSafeNotification();
  const { shops, saveShops } = useShops();

  const filteredShops = shops.filter((shop) => {
    const keyword = search.toLowerCase();
    return (
      shop.shopName.toLowerCase().includes(keyword) ||
      shop.ownerName.toLowerCase().includes(keyword) ||
      shop.village.toLowerCase().includes(keyword) ||
      shop.phoneNumber.includes(keyword)
    );
  });

  const handleExportPDF = () => {
    if (filteredShops.length === 0) {
      showNotification("No data to export.", "error");
      return;
    }
    const headers = ["Shop No", "Shop Name", "Owner", "Village", "Phone", "Status"];
    const rows = filteredShops.map((shop) => [
      shop.shopNo.toString(),
      shop.shopName,
      shop.ownerName,
      shop.village,
      shop.phoneNumber,
      shop.status,
    ]);
    const filename = `Shops_${new Date().toISOString().split("T")[0]}`;
    exportToPDF("Shops - Master List", headers, rows, filename);
  };

  const handleExportExcel = () => {
    if (filteredShops.length === 0) {
      showNotification("No data to export.", "error");
      return;
    }
    const headers = ["Shop No", "Shop Name", "Owner", "Village", "Phone", "Status"];
    const rows = filteredShops.map((shop) => [
      shop.shopNo.toString(),
      shop.shopName,
      shop.ownerName,
      shop.village,
      shop.phoneNumber,
      shop.status,
    ]);
    const filename = `Shops_${new Date().toISOString().split("T")[0]}`;
    exportToExcel("Shops - Master List", headers, rows, filename);
  };

  const handleSaveShop = (shop: any) => {
    const duplicateShop = shops.some(
      (s) =>
        s.shopName.trim().toLowerCase() === shop.shopName.trim().toLowerCase() &&
        s.id !== editingShop?.id
    );
    if (duplicateShop) {
      showNotification("Shop Name already exists.", "error");
      return;
    }
    const duplicatePhone = shops.some(
      (s) =>
        s.phoneNumber === shop.phoneNumber &&
        s.id !== editingShop?.id
    );
    if (duplicatePhone) {
      showNotification("Phone Number already exists.", "error");
      return;
    }

    if (editingShop) {
      saveShops(
        shops.map((s) =>
          s.id === editingShop.id ? { ...s, ...shop } : s
        )
      );
      showNotification("Shop updated successfully!", "success");
    } else {
      const newShop = {
        id: Date.now(),
        shopNo: shops.length + 1,
        ...shop,
      };
      saveShops([...shops, newShop]);
      showNotification("Shop added successfully!", "success");
    }
    setEditingShop(null);
    setShowDialog(false);
  };

  const handleEditShop = (shop: any) => {
    setEditingShop(shop);
    setShowDialog(true);
  };

  const handleDeleteShop = (id: number) => {
    if (!window.confirm("Are you sure you want to delete this shop?")) return;
    saveShops(shops.filter((shop) => shop.id !== id));
    showNotification("Shop deleted successfully!", "success");
  };

  const content = (
    <div className="space-y-6 pt-6">
      <ShopToolbar
        search={search}
        onSearchChange={setSearch}
        onAddShop={() => {
          setEditingShop(null);
          setShowDialog(true);
        }}
        onExportPDF={handleExportPDF}
        onExportExcel={handleExportExcel}
      />
      <p className="text-sm text-slate-500">
        Showing {filteredShops.length} of {shops.length} Shops
      </p>
      <ShopTable
        shops={filteredShops}
        onEdit={handleEditShop}
        onDelete={handleDeleteShop}
      />
      <ShopDialog
        open={showDialog}
        onClose={() => {
          setEditingShop(null);
          setShowDialog(false);
        }}
        onSave={handleSaveShop}
        shop={editingShop}
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

export default React.memo(ShopsPage);