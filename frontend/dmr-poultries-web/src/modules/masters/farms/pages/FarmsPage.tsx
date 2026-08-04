// D:\Development\DMR-Poultries-ERP\frontend\dmr-poultries-web\src\modules\masters\farms\pages\FarmsPage.tsx

import React, { useState, useMemo } from "react";
import DashboardLayout from "../../../../layouts/DashboardLayout/DashboardLayout";
import PageLayout from "../../../../components/common/PageLayout";
import FarmToolbar from "../components/FarmToolbar";
import FarmTable from "../components/FarmTable";
import FarmDialog from "../dialogs/FarmDialog";
import { useFarms } from "../hooks/useFarms";
import { useSafeNotification } from "../../../../hooks/useSafeNotification";
import { exportToExcel } from "../../../../utils/exportUtils";
import { logAuditEvent } from "../../../../utils/securityUtils";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type FarmsPageProps = { embedded?: boolean };

const ITEMS_PER_PAGE = 10;

function FarmsPage({ embedded = false }: FarmsPageProps) {
  const [showDialog, setShowDialog] = useState(false);
  const [editingFarm, setEditingFarm] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const { showNotification } = useSafeNotification();
  const { farms, saveFarms } = useFarms();

  // Reset to page 1 whenever search keyword changes
  const handleSearchChange = (value: string) => {
    setSearch(value);
    setCurrentPage(1);
  };

  const filteredFarms = useMemo(() => {
    const keyword = search.toLowerCase();
    return farms.filter(
      (farm) =>
        farm.farmName.toLowerCase().includes(keyword) ||
        farm.ownerName.toLowerCase().includes(keyword) ||
        farm.supervisorName.toLowerCase().includes(keyword) ||
        farm.village.toLowerCase().includes(keyword) ||
        farm.phoneNumber.includes(keyword)
    );
  }, [farms, search]);

  // Pagination Calculations
  const totalPages = Math.ceil(filteredFarms.length / ITEMS_PER_PAGE) || 1;
  const paginatedFarms = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredFarms.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredFarms, currentPage]);

  const handleExportPDF = () => {
    if (filteredFarms.length === 0) {
      showNotification("No data to export.", "error");
      return;
    }

    // Initialize jsPDF in Landscape ('l') orientation with exact dimensions
    const doc = new jsPDF("l", "mm", "a4");
    const pageWidth = doc.internal.pageSize.getWidth(); // 297mm for A4 Landscape
    const margin = 14;
    const usableWidth = pageWidth - (margin * 2);

    // Adjusted weights to ensure total sum maps precisely to usableWidth without clipping right borders
    // [Farm No, Farm Name, Owner, Supervisor, Village, Phone, Status]
    const relativeWeights = [0.09, 0.23, 0.18, 0.18, 0.16, 0.08, 0.08];
    const columnStylesConfig: { [key: number]: { cellWidth: number; halign?: "center" | "left" | "right" } } = {};

    const headers = ["Farm No", "Farm Name", "Owner", "Supervisor", "Village", "Phone", "Status"];
    headers.forEach((_, index) => {
      const computedWidth = usableWidth * relativeWeights[index];
      const isCentered = index === 0 || index === headers.length - 1;
      columnStylesConfig[index] = {
        cellWidth: computedWidth,
        halign: isCentered ? "center" : "left",
      };
    });

    // Document Header Block
    doc.setFontSize(16);
    doc.setTextColor(30, 41, 59);
    doc.text("Farms - Master List", margin, 15);

    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`Generated On: ${new Date().toLocaleDateString()}`, margin, 21);

    const rows = filteredFarms.map((farm) => [
      farm.farmNo.toString(),
      farm.farmName,
      farm.ownerName,
      farm.supervisorName,
      farm.village,
      farm.phoneNumber,
      farm.status,
    ]);

    // Render AutoTable with precise explicit table width bounds to prevent right-side clipping
    autoTable(doc, {
      startY: 26,
      head: [headers],
      body: rows,
      theme: "grid",
      tableWidth: usableWidth,
      margin: { left: margin, right: margin, bottom: 18 },
      styles: {
        fontSize: 8.5,
        cellPadding: 3.5,
        valign: "middle",
        overflow: "linebreak",
      },
      headStyles: {
        fillColor: [37, 99, 235],
        textColor: 255,
        fontStyle: "bold",
        halign: "center",
      },
      bodyStyles: {
        textColor: [51, 65, 85],
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      columnStyles: columnStylesConfig,
      didDrawPage: (data) => {
        const pageCount = (doc as any).internal.getNumberOfPages();
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text(
          `Confidential Business Report • Page ${data.pageNumber} of ${pageCount}`,
          margin,
          doc.internal.pageSize.height - 10
        );
      },
    });

    const filename = `Farms_${new Date().toISOString().split("T")[0]}`;
    doc.save(`${filename}.pdf`);
    logAuditEvent("EXPORT_PDF", "Farms", undefined, { count: filteredFarms.length });
    showNotification("PDF exported successfully!", "success");
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
    logAuditEvent("EXPORT_EXCEL", "Farms", undefined, { count: filteredFarms.length });
    showNotification("Excel exported successfully!", "success");
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
      logAuditEvent("UPDATE_FARM", "Farms", editingFarm.id);
      showNotification("Farm updated successfully!", "success");
    } else {
      const newFarm = {
        id: Date.now(),
        farmNo: farms.length + 1,
        ...farm,
      };
      saveFarms([...farms, newFarm]);
      logAuditEvent("CREATE_FARM", "Farms", newFarm.id);
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
    logAuditEvent("DELETE_FARM", "Farms", id);
    showNotification("Farm deleted successfully!", "success");
  };

  const content = (
    <div className="w-full space-y-2 farm-page-container">
      <style>{`
        .farm-page-container button,
        [role="dialog"] button {
          transition: all 0.15s ease-in-out;
        }
        .farm-page-container button:hover,
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
                  placeholder="Search Farm..."
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
                  setEditingFarm(null);
                  setShowDialog(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-all shadow-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Farm
              </button>
            </div>
          </div>
        </div>

        {/* Status Counter Bar */}
        <div className="px-4 py-2 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-600 uppercase tracking-wider">
              Farms Directory
            </span>
            <span className="px-2 py-0.5 font-semibold text-blue-700 bg-blue-50 border border-blue-200/60 rounded-full">
              {filteredFarms.length} records
            </span>
          </div>
          <p className="text-slate-500 font-medium">
            Showing {paginatedFarms.length} of {filteredFarms.length} Farms (Page {currentPage} of {totalPages})
          </p>
        </div>

        {/* Table Content */}
        <div className="p-0">
          <FarmTable
            farms={paginatedFarms}
            onEdit={handleEditFarm}
            onDelete={handleDeleteFarm}
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
      <PageLayout className="!py-2 px-8 sm:px-12 lg:px-16 max-w-6xl mx-auto">
        {content}
      </PageLayout>
    </DashboardLayout>
  );
}

export default React.memo(FarmsPage);