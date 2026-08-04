// src/modules/operations/shop-sales/components/ShopSalesTable.tsx

import React, { useState, useRef, useEffect } from "react";
import {
  Hash,
  Truck,
  Calendar,
  Store,
  Bird,
  Scale,
  IndianRupee,
  DollarSign,
  FileText,
  Check,
  X,
  Edit2,
  Search,
  ChevronDown,
} from "lucide-react";
import type { ShopSale } from "../types/shopSale";

interface Props {
  sales: ShopSale[];
  isLoading?: boolean;
  shopNames: string[];
  onUpdateSale?: (updatedSale: ShopSale) => void;
}

// Custom Searchable Dropdown with fixed outside-click behavior
function CustomShopSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (val: string) => void;
  options: string[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const filteredOptions = options.filter((name) =>
    name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSearchTerm("");
      }
    }

    // Use mousedown with a slight defer or standard listener so it properly registers clicks outside
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className="relative min-w-[200px]" ref={containerRef}>
      {/* Dropdown Input Box */}
      <div
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full border border-blue-300 rounded-lg px-2.5 py-2 text-xs font-medium bg-white shadow-2xs cursor-pointer flex items-center justify-between focus:ring-2 focus:ring-blue-500"
      >
        <span className="truncate text-slate-800 font-semibold">{value || "Select Shop"}</span>
        <ChevronDown size={14} className="text-slate-400 shrink-0 ml-1" />
      </div>

      {/* Floating Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 top-full left-0 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
          {/* Search Box */}
          <div className="p-1.5 border-b border-slate-100 flex items-center gap-1 bg-slate-50">
            <Search size={12} className="text-slate-400 ml-1" />
            <input
              type="text"
              placeholder="Search shop..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full text-xs bg-transparent outline-none px-1 py-0.5"
              autoFocus
            />
          </div>

          {/* List restricted to max-h-40 (~5 items height) */}
          <div className="max-h-40 overflow-y-auto divide-y divide-slate-50">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-2 text-xs text-slate-400 text-center">
                No shops found
              </div>
            ) : (
              filteredOptions.map((name) => (
                <div
                  key={name}
                  onClick={() => {
                    onChange(name);
                    setIsOpen(false);
                    setSearchTerm("");
                  }}
                  className={`px-3 py-2 text-xs font-medium cursor-pointer transition-colors hover:bg-blue-50 ${
                    name === value ? "bg-blue-50/80 font-semibold text-blue-700" : "text-slate-700"
                  }`}
                >
                  {name}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ShopSalesTable({ sales, isLoading = false, shopNames, onUpdateSale }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<ShopSale>>({});

  const startEditing = (sale: ShopSale, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (editingId === sale.id) return;
    setEditingId(sale.id);
    setEditData({
      shopName: sale.shopName,
      totalBirds: sale.totalBirds,
      totalWeight: sale.totalWeight,
      rate: sale.rate,
      remark: sale.remark,
    });
  };

  const cancelEditing = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingId(null);
    setEditData({});
  };

  const saveEditing = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!onUpdateSale || !editingId) return;
    const originalSale = sales.find((s) => s.id === editingId);
    if (!originalSale) return;

    const newShopName = editData.shopName ?? originalSale.shopName;
    const newBirds = editData.totalBirds ?? originalSale.totalBirds ?? 0;
    const newWeight = editData.totalWeight ?? originalSale.totalWeight ?? 0;
    const newRate = editData.rate ?? originalSale.rate ?? 0;
    const newRemark = editData.remark !== undefined ? editData.remark : originalSale.remark;

    const updatedSale: ShopSale = {
      ...originalSale,
      shopName: newShopName,
      totalBirds: newBirds,
      totalWeight: newWeight,
      rate: newRate,
      amount: newWeight * newRate,
      remark: newRemark,
    };
    onUpdateSale(updatedSale);
    setEditingId(null);
    setEditData({});
  };

  const handleInputChange = (field: keyof ShopSale, value: string | number) => {
    setEditData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-12 text-center">
        <div className="inline-flex items-center gap-2 text-slate-400 text-sm font-medium">
          <div className="w-4 h-4 border-2 border-slate-300 border-t-blue-600 rounded-full animate-spin" />
          Loading shop sales...
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden transition-all">
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-slate-100 bg-gradient-to-r from-slate-50/80 via-white to-slate-50/80 flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-800 tracking-tight">Shop Sales</h3>
        <div className="flex items-center gap-2">
          {editingId ? (
            <span className="text-xs text-blue-700 font-semibold mr-1 bg-blue-50/80 px-2.5 py-1 rounded-full border border-blue-200/60 shadow-2xs">
              Editing row
            </span>
          ) : (
            <span className="text-xs text-slate-400 font-medium">Click the edit button on a row to edit</span>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-xs md:text-sm">
          <thead className="bg-slate-50/80 border-b border-slate-200/70">
            <tr className="text-slate-700 whitespace-nowrap">
              <th className="px-3.5 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <div className="flex items-center justify-center gap-1.5">
                  <Hash size={14} className="text-slate-400" />
                  S.No
                </div>
              </th>
              <th className="px-3.5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-700">
                <div className="flex items-center gap-1.5">
                  <Truck size={14} className="text-indigo-600" />
                  Trip No
                </div>
              </th>
              <th className="px-3.5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-700">
                <div className="flex items-center gap-1.5">
                  <Calendar size={14} className="text-blue-500" />
                  Date
                </div>
              </th>
              <th className="px-3.5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-700">
                <div className="flex items-center gap-1.5">
                  <Store size={14} className="text-amber-600" />
                  Shop Name
                </div>
              </th>
              <th className="px-3.5 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-slate-700">
                <div className="flex items-center justify-center gap-1.5">
                  <Bird size={14} className="text-cyan-600" />
                  Birds
                </div>
              </th>
              <th className="px-3.5 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-slate-700">
                <div className="flex items-center justify-center gap-1.5">
                  <Scale size={14} className="text-orange-600" />
                  Weight
                </div>
              </th>
              <th className="px-3.5 py-3 text-center text-[11px] font-extrabold uppercase tracking-wider text-slate-700">
                <div className="flex items-center justify-center gap-1.5">
                  <IndianRupee size={14} className="text-violet-600" />
                  Rate
                </div>
              </th>
              <th className="px-3.5 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-slate-700">
                <div className="flex items-center justify-center gap-1.5">
                  <DollarSign size={14} className="text-green-600" />
                  Amount
                </div>
              </th>
              <th className="px-3.5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-700">
                <div className="flex items-center gap-1.5">
                  <FileText size={14} className="text-slate-400" />
                  Remark
                </div>
              </th>
              <th className="px-3.5 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-slate-700">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sales.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-12 text-center text-slate-400 text-sm font-medium">
                  No shop sales found.
                </td>
              </tr>
            ) : (
              sales.map((sale, index) => {
                const isEditing = editingId === sale.id;
                const currentShopName = isEditing ? (editData.shopName ?? sale.shopName) : sale.shopName;
                const currentBirds = isEditing ? (editData.totalBirds ?? sale.totalBirds) : sale.totalBirds;
                const currentWeight = isEditing ? (editData.totalWeight ?? sale.totalWeight) : sale.totalWeight;
                const currentRate = isEditing ? (editData.rate ?? sale.rate) : sale.rate;
                const currentRemark = isEditing ? (editData.remark ?? sale.remark) : sale.remark;
                
                const displayAmount = isEditing
                  ? (Number(currentWeight) || 0) * (Number(currentRate) || 0)
                  : sale.amount;

                return (
                  <tr
                    key={sale.id}
                    className={`transition-colors group ${
                      isEditing ? "bg-blue-50/70 shadow-inner" : "hover:bg-slate-50/80"
                    }`}
                  >
                    <td className="px-3.5 py-3 text-center text-xs font-semibold text-slate-500">{index + 1}</td>
                    <td className="px-3.5 py-3 font-medium text-slate-700 text-xs">
                      {sale.tripNo}
                    </td>
                    <td className="px-3.5 py-3 text-xs text-slate-600 font-medium">{sale.tripDate}</td>

                    {/* Searchable Shop Name Dropdown */}
                    <td className="px-3.5 py-3 text-xs font-semibold text-slate-700">
                      {isEditing ? (
                        <CustomShopSelect
                          value={currentShopName}
                          onChange={(val) => handleInputChange("shopName", val)}
                          options={shopNames}
                        />
                      ) : (
                        <span className="font-medium text-slate-800">{sale.shopName}</span>
                      )}
                    </td>

                    {/* Birds */}
                    <td className="px-3.5 py-3 text-center text-xs">
                      {isEditing ? (
                        <input
                          type="number"
                          value={currentBirds ?? 0}
                          onChange={(e) =>
                            handleInputChange("totalBirds", parseFloat(e.target.value) || 0)
                          }
                          className="w-24 text-center border border-blue-300 rounded-lg px-2.5 py-2 text-xs font-bold text-blue-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white shadow-2xs outline-none transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          min="0"
                          step="1"
                        />
                      ) : (
                        <span className="font-bold text-blue-700 inline-block">
                          {sale.totalBirds.toLocaleString()}
                        </span>
                      )}
                    </td>

                    {/* Weight */}
                    <td className="px-3.5 py-3 text-center text-xs">
                      {isEditing ? (
                        <input
                          type="number"
                          value={currentWeight ?? 0}
                          onChange={(e) =>
                            handleInputChange("totalWeight", parseFloat(e.target.value) || 0)
                          }
                          className="w-24 text-center border border-blue-300 rounded-lg px-2.5 py-2 text-xs font-bold text-orange-600 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white shadow-2xs outline-none transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          min="0"
                          step="0.01"
                        />
                      ) : (
                        <span className="font-bold text-orange-600 inline-block">
                          {sale.totalWeight.toFixed(2)}
                        </span>
                      )}
                    </td>

                    {/* Rate */}
                    <td className="px-3.5 py-3 text-center text-xs">
                      {isEditing ? (
                        <input
                          type="number"
                          value={currentRate ?? 0}
                          onChange={(e) =>
                            handleInputChange("rate", parseFloat(e.target.value) || 0)
                          }
                          className="w-24 text-center border border-blue-300 rounded-lg px-2.5 py-2 text-xs font-bold text-violet-600 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white shadow-2xs outline-none transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          min="0"
                          step="0.01"
                        />
                      ) : (
                        <span className="font-bold text-violet-600 inline-block">
                          ₹ {sale.rate?.toFixed(2) ?? "0.00"}
                        </span>
                      )}
                    </td>

                    {/* Amount */}
                    <td className="px-3.5 py-3 text-center text-xs font-bold text-slate-700">
                      <span className="inline-block">
                        ₹ {displayAmount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                      </span>
                    </td>

                    {/* Remark */}
                    <td className="px-3.5 py-3 text-xs text-slate-600">
                      {isEditing ? (
                        <input
                          type="text"
                          value={currentRemark ?? ""}
                          onChange={(e) => handleInputChange("remark", e.target.value)}
                          placeholder="Add remark..."
                          className="w-full border border-blue-300 rounded-lg px-2.5 py-2 text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white shadow-2xs outline-none transition-all"
                        />
                      ) : (
                        <span className="text-slate-700 font-medium">{sale.remark?.trim() || "-"}</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-3.5 py-3 text-center whitespace-nowrap">
                      {isEditing ? (
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={saveEditing}
                            className="p-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white transition-all flex items-center justify-center shadow-xs cursor-pointer"
                            title="Save"
                          >
                            <Check size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={cancelEditing}
                            className="p-1.5 rounded-lg bg-red-100 hover:bg-red-200 text-red-700 transition-all flex items-center justify-center shadow-xs cursor-pointer"
                            title="Cancel"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => startEditing(sale, e)}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-xs inline-flex items-center gap-1.5 text-xs font-medium cursor-pointer"
                          title="Edit row"
                        >
                          <Edit2 size={12} />
                          Edit
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default React.memo(ShopSalesTable);