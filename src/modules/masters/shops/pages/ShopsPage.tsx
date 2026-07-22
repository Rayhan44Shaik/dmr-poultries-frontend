// D:\Development\DMR-Poultries-ERP\frontend\dmr-poultries-web\src\modules\masters\shops\pages\ShopsPage.tsx

import React, { useState, useMemo } from "react";
import DashboardLayout from "../../../../layouts/DashboardLayout/DashboardLayout";
import PageLayout from "../../../../components/common/PageLayout";
import ShopToolbar from "../components/ShopToolbar";
import ShopTable from "../components/ShopTable";
import ShopDialog from "../dialogs/ShopDialog";
import { useShops } from "../hooks/useShops";
import { useSafeNotification } from "../../../../hooks/useSafeNotification";
import { exportToPDF, exportToExcel } from "../../../../utils/exportUtils";
import { logAuditEvent } from "../../../../utils/securityUtils";

type ShopsPageProps = { embedded?: boolean };

const ITEMS_PER_PAGE = 10;

function ShopsPage({ embedded = false }: ShopsPageProps) {
  const [showDialog, setShowDialog] = useState(false);
  const [editingShop, setEditingShop] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const { showNotification } = useSafeNotification();
  const { shops, saveShops } = useShops();

  // Reset to page 1 whenever search keyword changes
  const handleSearchChange = (value: string) => {
    setSearch(value);
    setCurrentPage(1);
  };

  const filteredShops = useMemo(() => {
    const keyword = search.toLowerCase();
    return shops.filter(
      (shop) =>
        shop.shopName.toLowerCase().includes(keyword) ||
        shop.ownerName.toLowerCase().includes(keyword) ||
        shop.village.toLowerCase().includes(keyword) ||
        shop.phoneNumber.includes(keyword)
    );
  }, [shops, search]);

  // Pagination Calculations
  const totalPages = Math.ceil(filteredShops.length / ITEMS_PER_PAGE) || 1;
  const paginatedShops = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredShops.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredShops, currentPage]);

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
    logAuditEvent("EXPORT_PDF", "Shops", undefined, { count: filteredShops.length });
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
    logAuditEvent("EXPORT_EXCEL", "Shops", undefined, { count: filteredShops.length });
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
      logAuditEvent("UPDATE_SHOP", "Shops", editingShop.id);
      showNotification("Shop updated successfully!", "success");
    } else {
      const newShop = {
        id: Date.now(),
        shopNo: shops.length + 1,
        ...shop,
      };
      saveShops([...shops, newShop]);
      logAuditEvent("CREATE_SHOP", "Shops", newShop.id);
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
    logAuditEvent("DELETE_SHOP", "Shops", id);
    showNotification("Shop deleted successfully!", "success");
  };

  const content = (
    <div className="w-full space-y-2 shop-page-container">
      <style>{`
        .shop-page-container button,
        [role="dialog"] button {
          transition: all 0.15s ease-in-out;
        }
        .shop-page-container button:hover,
        [role="dialog"] button:hover {
          transform: translateY(-1px);
        }
      `}</style>

      {/* Main Container */}
      <div className="w-full bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden">
        {/* Compact Search & Action Toolbar */}
        <div className="p-3 border-b border-slate-100 bg-slate-50/40">
          <ShopToolbar
            search={search}
            onSearchChange={handleSearchChange}
            onAddShop={() => {
              setEditingShop(null);
              setShowDialog(true);
            }}
            onExportPDF={handleExportPDF}
            onExportExcel={handleExportExcel}
          />
        </div>

        {/* Status Counter Bar */}
        <div className="px-4 py-2 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-600 uppercase tracking-wider">
              Outlets Directory
            </span>
            <span className="px-2 py-0.5 font-semibold text-blue-700 bg-blue-50 border border-blue-200/60 rounded-full">
              {filteredShops.length} records
            </span>
          </div>
          <p className="text-slate-500 font-medium">
            Showing {paginatedShops.length} of {filteredShops.length} Shops (Page {currentPage} of {totalPages})
          </p>
        </div>

        {/* Table Content */}
        <div className="p-0">
          <ShopTable
            shops={paginatedShops}
            onEdit={handleEditShop}
            onDelete={handleDeleteShop}
          />
        </div>

        {/* Pagination Controls - Bottom Right Aligned */}
        <div className="px-4 py-2.5 bg-slate-50/60 border-t border-slate-100 flex items-center justify-end gap-2 text-xs">
          <button
            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className="px-2.5 py-1 rounded-md border border-slate-200 bg-white font-medium text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
          >
            Previous
          </button>

          <div className="flex items-center gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
              <button
                key={pageNum}
                onClick={() => setCurrentPage(pageNum)}
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
            disabled={currentPage === totalPages}
            className="px-2.5 py-1 rounded-md border border-slate-200 bg-white font-medium text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
          >
            Next
          </button>
        </div>
      </div>

      {/* Modal Dialog */}
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
      <PageLayout className="!py-2 px-8 sm:px-12 lg:px-16 max-w-6xl mx-auto">
        {content}
      </PageLayout>
    </DashboardLayout>
  );
}

export default React.memo(ShopsPage);