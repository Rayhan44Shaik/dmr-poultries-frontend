// src/modules/operations/shop-sales/components/ShopSalesTable.tsx

import { useState } from "react";
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
  Trash2,
  Lock,
  Warehouse,
} from "lucide-react";
import type { ShopSale, ShopSaleUpdateInput } from "../types/shopSale";

interface Props {
  sales: ShopSale[];
  isLoading?: boolean;
  onUpdateSale?: (id: number, patch: ShopSaleUpdateInput) => Promise<unknown>;
  onDeleteSale?: (id: number) => Promise<unknown>;
}

const STATUS_STYLES: Record<string, string> = {
  Approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  "Pending Approval": "bg-amber-50 text-amber-700 border-amber-200",
  Draft: "bg-slate-100 text-slate-600 border-slate-200",
  Rejected: "bg-rose-50 text-rose-700 border-rose-200",
  Deleted: "bg-rose-50 text-rose-500 border-rose-200",
};

function ShopSalesTable({ sales, isLoading = false, onUpdateSale, onDeleteSale }: Props) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editData, setEditData] = useState<Partial<ShopSale>>({});
  const [busyId, setBusyId] = useState<number | null>(null);

  const startEditing = (sale: ShopSale, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!sale.editable || editingId === sale.id) return;
    setEditingId(sale.id);
    setEditData({
      birds: sale.birds,
      weight: sale.weight,
      rate: sale.rate,
      remarks: sale.remarks,
    });
  };

  const cancelEditing = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingId(null);
    setEditData({});
  };

  const saveEditing = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!onUpdateSale || editingId == null) return;
    setBusyId(editingId);
    try {
      await onUpdateSale(editingId, {
        birds: editData.birds,
        weight: editData.weight,
        rate: editData.rate,
        remarks: editData.remarks,
      });
      setEditingId(null);
      setEditData({});
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (sale: ShopSale, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!onDeleteSale || !sale.editable) return;
    if (!window.confirm(`Delete Shop Sale ${sale.saleNo} for ${sale.shopName}? This cannot be undone.`)) {
      return;
    }
    setBusyId(sale.id);
    try {
      await onDeleteSale(sale.id);
    } finally {
      setBusyId(null);
    }
  };

  const handleInputChange = (field: keyof ShopSale, value: string | number) => {
    setEditData((prev) => ({ ...prev, [field]: value }));
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
      <div className="px-5 py-3.5 border-b border-slate-100 bg-gradient-to-r from-slate-50/80 via-white to-slate-50/80 flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-800 tracking-tight">Shop Sales</h3>
        <span className="text-xs text-slate-400 font-medium">
          {editingId ? "Editing row" : "Click the edit button on a row to edit"}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-xs md:text-sm">
          <thead className="bg-slate-50/80 border-b border-slate-200/70">
            <tr className="text-slate-700 whitespace-nowrap">
              <th className="px-3.5 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <div className="flex items-center justify-center gap-1.5"><Hash size={14} className="text-slate-400" />#</div>
              </th>
              <th className="px-3.5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-700">Sale No</th>
              <th className="px-3.5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-700">
                <div className="flex items-center gap-1.5"><Truck size={14} className="text-indigo-600" />Trip No</div>
              </th>
              <th className="px-3.5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-700">
                <div className="flex items-center gap-1.5"><Calendar size={14} className="text-blue-500" />Date</div>
              </th>
              <th className="px-3.5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-700">
                <div className="flex items-center gap-1.5"><Store size={14} className="text-amber-600" />Shop</div>
              </th>
              <th className="px-3.5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-700">Vehicle</th>
              <th className="px-3.5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-700">
                <div className="flex items-center gap-1.5"><Warehouse size={14} className="text-teal-600" />Farm</div>
              </th>
              <th className="px-3.5 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-slate-700">
                <div className="flex items-center justify-center gap-1.5"><Bird size={14} className="text-cyan-600" />Birds</div>
              </th>
              <th className="px-3.5 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-slate-700">
                <div className="flex items-center justify-center gap-1.5"><Scale size={14} className="text-orange-600" />Weight</div>
              </th>
              <th className="px-3.5 py-3 text-center text-[11px] font-extrabold uppercase tracking-wider text-slate-700">
                <div className="flex items-center justify-center gap-1.5"><IndianRupee size={14} className="text-violet-600" />Rate</div>
              </th>
              <th className="px-3.5 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-slate-700">
                <div className="flex items-center justify-center gap-1.5"><DollarSign size={14} className="text-green-600" />Amount</div>
              </th>
              <th className="px-3.5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-700">
                <div className="flex items-center gap-1.5"><FileText size={14} className="text-slate-400" />Remarks</div>
              </th>
              <th className="px-3.5 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-slate-700">Status</th>
              <th className="px-3.5 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-slate-700">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sales.length === 0 ? (
              <tr>
                <td colSpan={13} className="py-12 text-center text-slate-400 text-sm font-medium">
                  No shop sales found.
                </td>
              </tr>
            ) : (
              sales.map((sale, index) => {
                const isEditing = editingId === sale.id;
                const currentBirds = isEditing ? (editData.birds ?? sale.birds) : sale.birds;
                const currentWeight = isEditing ? (editData.weight ?? sale.weight) : sale.weight;
                const currentRate = isEditing ? (editData.rate ?? sale.rate) : sale.rate;
                const currentRemarks = isEditing ? (editData.remarks ?? sale.remarks) : sale.remarks;
                const displayAmount = isEditing
                  ? (Number(currentWeight) || 0) * (Number(currentRate) || 0)
                  : sale.amount;
                const isBusy = busyId === sale.id;

                return (
                  <tr
                    key={sale.id}
                    className={`transition-colors group ${
                      isEditing ? "bg-blue-50/70 shadow-inner" : "hover:bg-slate-50/80"
                    } ${sale.deleted ? "opacity-50" : ""}`}
                  >
                    <td className="px-3.5 py-3 text-center text-xs font-semibold text-slate-500">{index + 1}</td>
                    <td className="px-3.5 py-3 font-mono text-[11px] font-semibold text-slate-700">{sale.saleNo}</td>
                    <td className="px-3.5 py-3 font-medium text-slate-700 text-xs">{sale.tripNo}</td>
                    <td className="px-3.5 py-3 text-xs text-slate-600 font-medium">{sale.saleDate}</td>
                    <td className="px-3.5 py-3 text-xs font-semibold text-slate-700">
                      <span className="font-medium text-slate-800">{sale.shopName}</span>
                    </td>
                    <td className="px-3.5 py-3 text-xs text-slate-600">{sale.vehicleNo || "-"}</td>
                    <td className="px-3.5 py-3 text-xs text-slate-600">{sale.farmName || "-"}</td>

                    <td className="px-3.5 py-3 text-center text-xs">
                      {isEditing ? (
                        <input
                          type="number"
                          value={currentBirds ?? 0}
                          onChange={(e) => handleInputChange("birds", parseFloat(e.target.value) || 0)}
                          className="w-24 text-center border border-blue-300 rounded-lg px-2.5 py-2 text-xs font-bold text-blue-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white shadow-2xs outline-none transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          min="0"
                          step="1"
                        />
                      ) : (
                        <span className="font-bold text-blue-700 inline-block">{sale.birds.toLocaleString()}</span>
                      )}
                    </td>

                    <td className="px-3.5 py-3 text-center text-xs">
                      {isEditing ? (
                        <input
                          type="number"
                          value={currentWeight ?? 0}
                          onChange={(e) => handleInputChange("weight", parseFloat(e.target.value) || 0)}
                          className="w-24 text-center border border-blue-300 rounded-lg px-2.5 py-2 text-xs font-bold text-orange-600 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white shadow-2xs outline-none transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          min="0"
                          step="0.01"
                        />
                      ) : (
                        <span className="font-bold text-orange-600 inline-block">{sale.weight.toFixed(2)}</span>
                      )}
                    </td>

                    <td className="px-3.5 py-3 text-center text-xs">
                      {isEditing ? (
                        <input
                          type="number"
                          value={currentRate ?? 0}
                          onChange={(e) => handleInputChange("rate", parseFloat(e.target.value) || 0)}
                          className="w-24 text-center border border-blue-300 rounded-lg px-2.5 py-2 text-xs font-bold text-violet-600 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white shadow-2xs outline-none transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          min="0"
                          step="0.01"
                        />
                      ) : (
                        <span className="font-bold text-violet-600 inline-block">₹ {sale.rate?.toFixed(2) ?? "0.00"}</span>
                      )}
                    </td>

                    <td className="px-3.5 py-3 text-center text-xs font-bold text-slate-700">
                      <span className="inline-block">₹ {displayAmount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span>
                    </td>

                    <td className="px-3.5 py-3 text-xs text-slate-600">
                      {isEditing ? (
                        <input
                          type="text"
                          value={currentRemarks ?? ""}
                          onChange={(e) => handleInputChange("remarks", e.target.value)}
                          placeholder="Add remark..."
                          className="w-full border border-blue-300 rounded-lg px-2.5 py-2 text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white shadow-2xs outline-none transition-all"
                        />
                      ) : (
                        <span className="text-slate-700 font-medium">{sale.remarks?.trim() || "-"}</span>
                      )}
                    </td>

                    <td className="px-3.5 py-3 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          STATUS_STYLES[sale.status] ?? "bg-slate-100 text-slate-600 border-slate-200"
                        }`}
                      >
                        {sale.status}
                      </span>
                      {sale.tripDeleted && (
                        <div className="text-[10px] text-rose-500 font-semibold mt-0.5">Trip Deleted</div>
                      )}
                    </td>

                    <td className="px-3.5 py-3 text-center whitespace-nowrap">
                      {!sale.editable ? (
                        <span
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-400 text-[11px] font-semibold"
                          title={
                            sale.windowExpiresAt
                              ? `Locked — edit window closed on ${sale.windowExpiresAt.slice(0, 10)}`
                              : "Locked"
                          }
                        >
                          <Lock size={12} /> Locked
                        </span>
                      ) : isEditing ? (
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={saveEditing}
                            disabled={isBusy}
                            className="p-1.5 rounded-lg bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white transition-all flex items-center justify-center shadow-xs cursor-pointer"
                            title="Save"
                          >
                            <Check size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={cancelEditing}
                            disabled={isBusy}
                            className="p-1.5 rounded-lg bg-red-100 hover:bg-red-200 disabled:opacity-50 text-red-700 transition-all flex items-center justify-center shadow-xs cursor-pointer"
                            title="Cancel"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => startEditing(sale, e)}
                            className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-xs inline-flex items-center gap-1.5 text-xs font-medium cursor-pointer"
                            title="Edit row"
                          >
                            <Edit2 size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDelete(sale, e)}
                            disabled={isBusy}
                            className="px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white transition-all shadow-xs inline-flex items-center gap-1.5 text-xs font-medium cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
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

export default ShopSalesTable;
