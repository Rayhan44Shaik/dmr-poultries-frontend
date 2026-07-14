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

  const startEditing = (sale: ShopSale) => {
    if (editingId === sale.id) return;
    setEditingId(sale.id);
    setEditData({
      shopName: sale.shopName,
      totalBirds: sale.totalBirds,
      totalWeight: sale.totalWeight,
      rate: sale.rate,
    });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditData({});
  };

  const saveEditing = () => {
    if (!onUpdateSale || !editingId) return;
    const originalSale = sales.find((s) => s.id === editingId);
    if (!originalSale) return;

    const newShopName = editData.shopName ?? originalSale.shopName;
    const newBirds = editData.totalBirds ?? originalSale.totalBirds ?? 0;
    const newWeight = editData.totalWeight ?? originalSale.totalWeight ?? 0;
    const newRate = editData.rate ?? originalSale.rate ?? 0;

    const updatedSale: ShopSale = {
      ...originalSale,
      shopName: newShopName,
      totalBirds: newBirds,
      totalWeight: newWeight,
      rate: newRate,
      amount: newWeight * newRate,
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

  const editedSale = editingId ? sales.find((s) => s.id === editingId) : null;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header – matches Rate Entry style */}
      <div className="px-4 py-3 border-b bg-slate-50 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">Shop Sales</h3>
        <div className="flex items-center gap-2">
          {editingId && editedSale ? (
            <>
              <span className="text-xs text-blue-600 font-medium mr-1">Editing row</span>
              <button
                onClick={saveEditing}
                className="p-1.5 rounded-lg bg-green-100 hover:bg-green-200 text-green-700 transition-colors flex items-center gap-1 text-xs font-medium"
              >
                <Check size={14} /> Save
              </button>
              <button
                onClick={cancelEditing}
                className="p-1.5 rounded-lg bg-red-100 hover:bg-red-200 text-red-700 transition-colors flex items-center gap-1 text-xs font-medium"
              >
                <X size={14} /> Cancel
              </button>
            </>
          ) : (
            <span className="text-xs text-slate-400">Click a row to edit</span>
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
            </tr>
          </thead>
          <tbody>
            {sales.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-10 text-center text-slate-400 text-sm">
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

                return (
                  <tr
                    key={sale.id}
                    className={`border-t hover:bg-blue-50 transition-colors cursor-pointer ${
                      isEditing ? "bg-blue-100" : ""
                    }`}
                    onClick={() => startEditing(sale)}
                  >
                    <td className="px-3 py-2 text-center text-xs text-slate-600">{index + 1}</td>
                    <td className="px-3 py-2 font-semibold text-green-700 text-xs">{sale.tripNo}</td>
                    <td className="px-3 py-2 text-xs">{sale.tripDate}</td>

                    {/* Shop Name – dropdown when editing */}
                    <td className="px-3 py-2 text-xs font-medium text-slate-700">
                      {isEditing ? (
                        <select
                          value={currentShopName}
                          onChange={(e) => handleInputChange("shopName", e.target.value)}
                          className="w-full border border-blue-300 rounded-md px-2 py-1 text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                          className="w-20 text-center border border-blue-300 rounded-md px-2 py-1 text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                          className="w-24 text-center border border-blue-300 rounded-md px-2 py-1 text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                          className="w-24 text-center border border-blue-300 rounded-md px-2 py-1 text-xs font-bold text-violet-600 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                      ₹ {sale.amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                    </td>

                    <td className="px-3 py-2 text-xs">{sale.remark?.trim() || "-"}</td>
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