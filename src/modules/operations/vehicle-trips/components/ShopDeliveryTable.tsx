import React, { useCallback } from "react";
import { Plus, Trash2 } from "lucide-react";
import Select from "react-select";
import type { ShopDelivery } from "../types/trip";

interface Props {
  rows: ShopDelivery[];
  setRows: React.Dispatch<React.SetStateAction<ShopDelivery[]>>;
  shops: any[];
  birdTypes: any[];
}

function ShopDeliveryTable({ rows, setRows, shops, birdTypes }: Props) {
  const safeRows = rows ?? [];
  const safeShops = shops ?? [];
  const safeBirdTypes = birdTypes ?? [];

  // ✅ 1. New rows added at the TOP
  // ✅ 5. Permanent serial numbers
  const addRow = useCallback(() => {
    const maxSerial = safeRows.reduce(
      (max, r) => Math.max(max, r.serialNo || 0),
      0
    );
    const nextSerial = maxSerial + 1;

    setRows((prev) => [
      {
        id: Date.now(),
        serialNo: nextSerial,
        shopId: 0,
        boxNo: 0,
        shopName: "",
        birdTypeId: 0,
        birdType: "",
        birds: 0,
        weight: 0,
        mortality: 0,
        rate: null,
        amount: 0,
        remarks: "",
      },
      ...prev,
    ]);
  }, [safeRows, setRows]);

  const updateRow = useCallback(
    (id: number, field: keyof ShopDelivery, value: any) => {
      setRows((prev) =>
        prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
      );
    },
    [setRows]
  );

  const deleteRow = useCallback(
    (id: number) => {
      setRows((prev) => prev.filter((x) => x.id !== id));
    },
    [setRows]
  );

  const handleShopChange = useCallback(
    (rowId: number, selected: any) => {
      if (!selected) return;
      setRows((prev) =>
        prev.map((r) =>
          r.id === rowId
            ? { ...r, shopId: selected.value, shopName: selected.label }
            : r
        )
      );
    },
    [setRows]
  );

  const handleBirdChange = useCallback(
    (rowId: number, birdId: number) => {
      const bird = safeBirdTypes.find((b: any) => b.id === birdId);
      if (!bird) return;
      setRows((prev) =>
        prev.map((r) =>
          r.id === rowId
            ? { ...r, birdTypeId: bird.id, birdType: bird.birdType }
            : r
        )
      );
    },
    [safeBirdTypes, setRows]
  );

  // ✅ 2. Prevent duplicate shops
  const getSelectedShopIds = (currentRowId: number) => {
    return safeRows
      .filter((r) => r.id !== currentRowId && r.shopId && r.shopId > 0)
      .map((r) => r.shopId);
  };

  // ✅ 4. Birds must be integer
  const handleBirdInputChange = (rowId: number, value: string) => {
    const num = parseFloat(value);
    if (!isNaN(num)) {
      const intVal = Math.floor(num);
      updateRow(rowId, "birds", intVal);
    } else {
      updateRow(rowId, "birds", 0);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mt-8">
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200 bg-slate-50">
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
          Unloading
        </span>
        <button
          onClick={addRow}
          className="inline-flex items-center gap-1 rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 transition-colors"
        >
          <Plus size={14} />
          Add Row
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr className="text-slate-700">
              <th className="px-3 py-2 text-center text-[10px] font-medium uppercase tracking-wider">S.No</th>
              {/* ✅ 3. Changed label */}
              <th className="px-3 py-2 text-center text-[10px] font-medium uppercase tracking-wider">
                No. of Boxes <span className="text-red-500">*</span>
              </th>
              <th className="px-3 py-2 text-center text-[10px] font-medium uppercase tracking-wider">
                Shop Name <span className="text-red-500">*</span>
              </th>
              <th className="px-3 py-2 text-center text-[10px] font-medium uppercase tracking-wider">
                Bird Type <span className="text-red-500">*</span>
              </th>
              <th className="px-3 py-2 text-center text-[10px] font-medium uppercase tracking-wider">
                Birds <span className="text-red-500">*</span>
              </th>
              <th className="px-3 py-2 text-center text-[10px] font-medium uppercase tracking-wider">
                Kg's <span className="text-red-500">*</span>
              </th>
              <th className="px-3 py-2 text-center text-[10px] font-medium uppercase tracking-wider">Remarks</th>
              <th className="px-3 py-2 text-center text-[10px] font-medium uppercase tracking-wider">Action</th>
            </tr>
          </thead>
          <tbody>
            {safeRows.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center py-8 text-slate-400 text-sm">
                  No shops added yet. Click <b>Add Row</b> to begin.
                </td>
              </tr>
            )}
            {safeRows.map((row) => {
              const selectedIds = getSelectedShopIds(row.id);

              return (
                <tr key={row.id} className="border-t hover:bg-slate-50 transition-colors">
                  <td className="px-3 py-2 text-center text-xs font-medium">{row.serialNo}</td>
                  <td className="px-3 py-2 text-center">
                    <input
                      type="number"
                      value={row.boxNo || ""}
                      onChange={(e) => updateRow(row.id, "boxNo", Number(e.target.value))}
                      className="w-16 border rounded-lg px-2 py-1 text-center text-xs"
                      required
                    />
                  </td>
                  <td className="px-3 py-2 min-w-[280px]">
                    <Select
                      menuPortalTarget={document.body}
                      menuPosition="fixed"
                      value={row.shopId ? { value: row.shopId, label: row.shopName } : null}
                      options={safeShops.map((shop: any) => ({ value: shop.id, label: shop.shopName }))}
                      placeholder="Search Shop..."
                      isSearchable
                      className="min-w-[240px]"
                      onChange={(selected) => handleShopChange(row.id, selected)}
                      isOptionDisabled={(option) => selectedIds.includes(option.value)}
                      styles={{
                        control: (base) => ({ ...base, minHeight: 32, borderRadius: 8, fontSize: 12 }),
                        menu: (base) => ({ ...base, zIndex: 999 }),
                      }}
                    />
                  </td>
                  <td className="px-3 py-2 min-w-[180px]">
                    <select
                      value={row.birdTypeId || ""}
                      className="w-full border rounded-lg px-2 py-1 text-xs"
                      onChange={(e) => handleBirdChange(row.id, Number(e.target.value))}
                      required
                    >
                      <option value="">Select Bird</option>
                      {safeBirdTypes.map((bird: any) => (
                        <option key={bird.id} value={bird.id}>
                          {bird.birdType}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      step="1"
                      min="0"
                      value={row.birds || ""}
                      className="w-full border rounded-lg px-2 py-1 text-center text-xs"
                      onChange={(e) => handleBirdInputChange(row.id, e.target.value)}
                      required
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      value={row.weight || ""}
                      className="w-full border rounded-lg px-2 py-1 text-center text-xs"
                      onChange={(e) => updateRow(row.id, "weight", Number(e.target.value))}
                      required
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      value={row.remarks || ""}
                      placeholder="Optional"
                      className="w-full border rounded-lg px-2 py-1 text-xs"
                      onChange={(e) => updateRow(row.id, "remarks", e.target.value)}
                    />
                  </td>
                  <td className="text-center">
                    <button
                      onClick={() => deleteRow(row.id)}
                      className="h-7 w-7 rounded-full bg-red-50 hover:bg-red-100 flex items-center justify-center mx-auto"
                    >
                      <Trash2 size={14} className="text-red-600" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default React.memo(ShopDeliveryTable);