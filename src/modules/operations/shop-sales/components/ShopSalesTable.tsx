// src/modules/operations/shop-sales/components/ShopSalesTable.tsx

import React, { useState } from "react";
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
} from "lucide-react";
import type { ShopSale } from "../types/shopSale";

interface Props {
  sales: ShopSale[];
  isLoading?: boolean;
  shopNames: string[];
  onUpdateSale?: (updatedSale: ShopSale) => void;
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
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center">
        <div className="text-slate-400">Loading shop sales...</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b bg-slate-50 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">Shop Sales</h3>
        <div className="flex items-center gap-2">
          {editingId ? (
            <span className="text-xs text-blue-600 font-medium mr-1">Editing row</span>
          ) : (
            <span className="text-xs text-slate-400">Click the edit button on a row to edit</span>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 border-b">
            <tr className="text-slate-700 whitespace-nowrap">
              <th className="px-3 py-2 text-center text-[10px] font-medium uppercase tracking-wider">
                <div className="flex items-center justify-center gap-1">
                  <Hash size={14} className="text-slate-400" />
                  S.No
                </div>
              </th>
              <th className="px-3 py-2 text-left text-[10px] font-medium uppercase tracking-wider">
                <div className="flex items-center gap-1">
                  <Truck size={14} className="text-indigo-600" />
                  Trip No
                </div>
              </th>
              <th className="px-3 py-2 text-left text-[10px] font-medium uppercase tracking-wider">
                <div className="flex items-center gap-1">
                  <Calendar size={14} className="text-blue-500" />
                  Date
                </div>
              </th>
              <th className="px-3 py-2 text-left text-[10px] font-medium uppercase tracking-wider">
                <div className="flex items-center gap-1">
                  <Store size={14} className="text-amber-600" />
                  Shop Name
                </div>
              </th>
              <th className="px-3 py-2 text-center text-[10px] font-medium uppercase tracking-wider">
                <div className="flex items-center justify-center gap-1">
                  <Bird size={14} className="text-cyan-600" />
                  Birds
                </div>
              </th>
              <th className="px-3 py-2 text-center text-[10px] font-medium uppercase tracking-wider">
                <div className="flex items-center justify-center gap-1">
                  <Scale size={14} className="text-orange-600" />
                  Weight
                </div>
              </th>
              <th className="px-3 py-2 text-center text-[10px] font-bold uppercase tracking-wider">
                <div className="flex items-center justify-center gap-1">
                  <IndianRupee size={14} className="text-violet-600" />
                  Rate
                </div>
              </th>
              <th className="px-3 py-2 text-center text-[10px] font-medium uppercase tracking-wider">
                <div className="flex items-center justify-center gap-1">
                  <DollarSign size={14} className="text-green-600" />
                  Amount
                </div>
              </th>
              <th className="px-3 py-2 text-left text-[10px] font-medium uppercase tracking-wider">
                <div className="flex items-center gap-1">
                  <FileText size={14} className="text-slate-400" />
                  Remark
                </div>
              </th>
              <th className="px-3 py-2 text-center text-[10px] font-medium uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {sales.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-10 text-center text-slate-400 text-sm">
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
                
                // Calculate live amount when editing
                const displayAmount = isEditing
                  ? (Number(currentWeight) || 0) * (Number(currentRate) || 0)
                  : sale.amount;

                return (
                  <tr
                    key={sale.id}
                    className={`border-t transition-colors ${
                      isEditing ? "bg-blue-50" : "hover:bg-slate-50/60"
                    }`}
                  >
                    <td className="px-3 py-2 text-center text-xs text-slate-600">{index + 1}</td>
                    <td className="px-3 py-2 font-semibold text-green-700 text-xs">{sale.tripNo}</td>
                    <td className="px-3 py-2 text-xs">{sale.tripDate}</td>

                    {/* Shop Name */}
                    <td className="px-3 py-2 text-xs font-medium text-slate-700">
                      {isEditing ? (
                        <select
                          value={currentShopName}
                          onChange={(e) => handleInputChange("shopName", e.target.value)}
                          className="w-full border border-blue-300 rounded-md px-2 py-1 text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                        >
                          {shopNames.map((name) => (
                            <option key={name} value={name}>
                              {name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span>{sale.shopName}</span>
                      )}
                    </td>

                    {/* Birds */}
                    <td className="px-3 py-2 text-center text-xs">
                      {isEditing ? (
                        <input
                          type="number"
                          value={currentBirds ?? 0}
                          onChange={(e) =>
                            handleInputChange("totalBirds", parseFloat(e.target.value) || 0)
                          }
                          className="w-20 text-center border border-blue-300 rounded-md px-2 py-1 text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                          min="0"
                          step="1"
                        />
                      ) : (
                        <span className="font-semibold text-blue-700">
                          {sale.totalBirds.toLocaleString()}
                        </span>
                      )}
                    </td>

                    {/* Weight */}
                    <td className="px-3 py-2 text-center text-xs">
                      {isEditing ? (
                        <input
                          type="number"
                          value={currentWeight ?? 0}
                          onChange={(e) =>
                            handleInputChange("totalWeight", parseFloat(e.target.value) || 0)
                          }
                          className="w-24 text-center border border-blue-300 rounded-md px-2 py-1 text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                          min="0"
                          step="0.01"
                        />
                      ) : (
                        <span className="font-semibold text-orange-600">
                          {sale.totalWeight.toFixed(2)}
                        </span>
                      )}
                    </td>

                    {/* Rate */}
                    <td className="px-3 py-2 text-center text-xs">
                      {isEditing ? (
                        <input
                          type="number"
                          value={currentRate ?? 0}
                          onChange={(e) =>
                            handleInputChange("rate", parseFloat(e.target.value) || 0)
                          }
                          className="w-24 text-center border border-blue-300 rounded-md px-2 py-1 text-xs font-bold text-violet-600 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                          min="0"
                          step="0.01"
                        />
                      ) : (
                        <span className="font-bold text-violet-600">
                          ₹ {sale.rate?.toFixed(2) ?? "0.00"}
                        </span>
                      )}
                    </td>

                    {/* Amount */}
                    <td className="px-3 py-2 text-center text-xs font-bold text-green-700">
                      ₹ {displayAmount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                    </td>

                    {/* Remark */}
                    <td className="px-3 py-2 text-xs">
                      {isEditing ? (
                        <input
                          type="text"
                          value={currentRemark ?? ""}
                          onChange={(e) => handleInputChange("remark", e.target.value)}
                          placeholder="Add remark..."
                          className="w-full border border-blue-300 rounded-md px-2 py-1 text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                        />
                      ) : (
                        <span>{sale.remark?.trim() || "-"}</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-3 py-2 text-center whitespace-nowrap">
                      {isEditing ? (
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={saveEditing}
                            className="p-1.5 rounded-lg bg-green-100 hover:bg-green-200 text-green-700 transition-colors flex items-center gap-1 text-xs font-medium"
                            title="Save"
                          >
                            <Check size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={cancelEditing}
                            className="p-1.5 rounded-lg bg-red-100 hover:bg-red-200 text-red-700 transition-colors flex items-center gap-1 text-xs font-medium"
                            title="Cancel"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => startEditing(sale, e)}
                          className="p-1.5 rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-blue-600 transition shadow-sm inline-flex items-center justify-center"
                          title="Edit row"
                        >
                          <Edit2 size={13} />
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