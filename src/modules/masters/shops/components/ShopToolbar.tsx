import React, { useRef } from "react";
import { Search, Plus, FileText, FileSpreadsheet, Upload } from "lucide-react";
import * as XLSX from "xlsx";
import type { ShopInput } from "../services/shopService";

type ShopToolbarProps = {
  search: string;
  onSearchChange: (value: string) => void;
  onAddShop: () => void;
  onExportPDF: () => void;
  onExportExcel: () => void;
  onUploadExcel: (shops: ShopInput[]) => void;
};

function ShopToolbar({
  search,
  onSearchChange,
  onAddShop,
  onExportPDF,
  onExportExcel,
  onUploadExcel,
}: ShopToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const data = event.target?.result;
      const workbook = XLSX.read(data, { type: "binary" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      const jsonData = XLSX.utils.sheet_to_json(worksheet);
      
      const parsedShops: ShopInput[] = jsonData.map((row: any) => ({
        shopNo: Number(row["Shop No"]) || 0,
        shopName: String(row["Shop Name"] || ""),
        ownerName: String(row["Owner Name"] || ""),
        phoneNumber: String(row["Phone"] || row["Mobile Number"] || row["Phone Number"] || ""),
        village: String(row["Village"] || ""),
        address: String(row["Address"] || ""),
        status: (row["Status"] === "Inactive" ? "Inactive" : "Active") as "Active" | "Inactive",
        openingBalance: Number(row["Opening Balance"] || row["Balance"]) || 0,
      }));

      onUploadExcel(parsedShops);
    };
    
    reader.readAsBinaryString(file);
    
    // Reset input so the same file can be uploaded again if needed
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
      <div className="relative w-full sm:w-96">
        <Search
          size={18}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
        />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search Shop..."
          className="w-full rounded-lg border border-slate-300 pl-10 pr-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
        />
      </div>
      <div className="flex gap-2 flex-wrap">
        {/* Export Buttons */}
        <button
          onClick={onExportPDF}
          className="inline-flex items-center gap-2 rounded-lg border border-red-600 px-4 py-2.5 text-sm font-medium text-red-600 shadow-sm hover:bg-red-50 transition-colors"
          title="Export to PDF"
        >
          <FileText size={18} />
          PDF
        </button>
        <button
          onClick={onExportExcel}
          className="inline-flex items-center gap-2 rounded-lg border border-green-600 px-4 py-2.5 text-sm font-medium text-green-600 shadow-sm hover:bg-green-50 transition-colors"
          title="Export to Excel"
        >
          <FileSpreadsheet size={18} />
          Excel
        </button>

        {/* Upload Button */}
        <input
          type="file"
          accept=".xlsx, .xls"
          className="hidden"
          ref={fileInputRef}
          onChange={handleFileUpload}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center gap-2 rounded-lg border border-indigo-600 px-4 py-2.5 text-sm font-medium text-indigo-600 shadow-sm hover:bg-indigo-50 transition-colors"
        >
          <Upload size={18} />
          Upload
        </button>

        {/* Add Shop Button */}
        <button
          onClick={onAddShop}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition-colors"
        >
          <Plus size={18} />
          Add Shop
        </button>
      </div>
    </div>
  );
}

export default ShopToolbar;