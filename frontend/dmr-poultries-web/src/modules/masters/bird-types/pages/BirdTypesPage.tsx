// D:\Development\DMR-Poultries-ERP\frontend\dmr-poultries-web\src\modules\masters\bird-types\pages\BirdTypesPage.tsx

import React, { useState, useMemo } from "react";
import DashboardLayout from "../../../../layouts/DashboardLayout/DashboardLayout";
import PageLayout from "../../../../components/common/PageLayout";
import BirdTypeTable from "../components/BirdTypeTable";
import BirdTypeDialog from "../dialogs/BirdTypeDialog";
import { useBirdTypes } from "../hooks/useBirdTypes";
import { useSafeNotification } from "../../../../hooks/useSafeNotification";
import { exportToPDF, exportToExcel } from "../../../../utils/exportUtils";
import { logAuditEvent } from "../../../../utils/securityUtils";

type BirdTypesPageProps = { embedded?: boolean };

const ITEMS_PER_PAGE = 10;

function BirdTypesPage({ embedded = false }: BirdTypesPageProps) {
  const [showDialog, setShowDialog] = useState(false);
  const [editingBirdType, setEditingBirdType] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const { showNotification } = useSafeNotification();
  const { birdTypes, saveBirdTypes } = useBirdTypes();

  // Reset to page 1 whenever search keyword changes
  const handleSearchChange = (value: string) => {
    setSearch(value);
    setCurrentPage(1);
  };

  const filteredBirdTypes = useMemo(() => {
    const keyword = search.toLowerCase();
    return birdTypes.filter(
      (bt) =>
        bt.birdType.toLowerCase().includes(keyword) ||
        bt.description?.toLowerCase().includes(keyword)
    );
  }, [birdTypes, search]);

  // Pagination Calculations
  const totalPages = Math.ceil(filteredBirdTypes.length / ITEMS_PER_PAGE) || 1;
  const paginatedBirdTypes = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredBirdTypes.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredBirdTypes, currentPage]);

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
    logAuditEvent("EXPORT_PDF", "BirdTypes", undefined, { count: filteredBirdTypes.length });
    showNotification("PDF exported successfully!", "success");
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
    logAuditEvent("EXPORT_EXCEL", "BirdTypes", undefined, { count: filteredBirdTypes.length });
    showNotification("Excel exported successfully!", "success");
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
      logAuditEvent("UPDATE_BIRD_TYPE", "BirdTypes", editingBirdType.id);
      showNotification("Bird Type updated successfully!", "success");
    } else {
      const newBirdType = {
        id: Date.now(),
        birdTypeNo: birdTypes.length + 1,
        ...birdType,
      };
      saveBirdTypes([...birdTypes, newBirdType]);
      logAuditEvent("CREATE_BIRD_TYPE", "BirdTypes", newBirdType.id);
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
    logAuditEvent("DELETE_BIRD_TYPE", "BirdTypes", id);
    showNotification("Bird Type deleted successfully!", "success");
  };

  const content = (
    <div className="w-full space-y-2 birdtype-page-container">
      <style>{`
        .birdtype-page-container button,
        [role="dialog"] button {
          transition: all 0.15s ease-in-out;
        }
        .birdtype-page-container button:hover,
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
                  placeholder="Search Bird Type..."
                  value={search}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="w-full pl-9 pr-4 py-1.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
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
                  setEditingBirdType(null);
                  setShowDialog(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-all shadow-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Bird Type
              </button>
            </div>
          </div>
        </div>

        {/* Status Counter Bar */}
        <div className="px-4 py-2 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-600 uppercase tracking-wider">
              Bird Types Directory
            </span>
            <span className="px-2 py-0.5 font-semibold text-blue-700 bg-blue-50 border border-blue-200/60 rounded-full">
              {filteredBirdTypes.length} records
            </span>
          </div>
          <p className="text-slate-500 font-medium">
            Showing {paginatedBirdTypes.length} of {filteredBirdTypes.length} Bird Types (Page {currentPage} of {totalPages})
          </p>
        </div>

        {/* Table Content */}
        <div className="p-0">
          <BirdTypeTable
            birdTypes={paginatedBirdTypes}
            onEdit={handleEditBirdType}
            onDelete={handleDeleteBirdType}
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
      <PageLayout className="!py-2 px-8 sm:px-12 lg:px-16 max-w-6xl mx-auto">
        {content}
      </PageLayout>
    </DashboardLayout>
  );
}

export default React.memo(BirdTypesPage);