// src/modules/order/components/OrderForm.tsx
// New Order entry form with strong validation and a searchable shop selector.
// Selecting a shop immediately shows its full address + GPS (requirement #4).

import { useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import type { OrderDraft, OrderPriority, OrderShop, RequirementType } from "../types/orderTypes";
import { BIRD_TYPES, DEADLINE_PRESETS, PRIORITIES, REQUIREMENT_TYPES, validateOrderDraft } from "../utils/orderValidation";
import GPSStatus from "./GPSStatus";
import { ORDER_SHOPS } from "../data/orderMockData";

interface OrderFormProps {
  initialDraft?: OrderDraft;
  onSubmit: (draft: OrderDraft) => void;
  onCancel: () => void;
}

const DEFAULT_DRAFT: OrderDraft = {
  shopId: "",
  birdType: "Broiler",
  requirementType: "Birds",
  birds: 0,
  boxes: 0,
  expectedWeightKg: null,
  remarks: "",
  priority: "Normal",
  importantCustomer: false,
  deliveryDate: "",
  deadlineTime: "12:00",
  deadlineLabel: "Before 12:00",
  deliveryWindow: null,
};

export default function OrderForm({ initialDraft, onSubmit, onCancel }: OrderFormProps) {
  const [draft, setDraft] = useState<OrderDraft>(initialDraft ?? DEFAULT_DRAFT);
  const [errors, setErrors] = useState<ReturnType<typeof validateOrderDraft>["errors"]>({});
  const [shopQuery, setShopQuery] = useState("");
  const [shopOpen, setShopOpen] = useState(false);
  const shopBoxRef = useRef<HTMLDivElement>(null);

  const selectedShop = ORDER_SHOPS.find((s) => s.id === draft.shopId) ?? null;

  const filteredShops = useMemo(() => {
    const q = shopQuery.trim().toLowerCase();
    if (!q) return ORDER_SHOPS;
    return ORDER_SHOPS.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.location.toLowerCase().includes(q) ||
        s.gpsStatus.toLowerCase().includes(q),
    );
  }, [shopQuery]);

  const set = <K extends keyof OrderDraft>(key: K, value: OrderDraft[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const selectShop = (shop: OrderShop) => {
    set("shopId", shop.id);
    setShopQuery(shop.name);
    setShopOpen(false);
  };

  const selectDeadline = (label: string, time: string) => {
    set("deadlineTime", time);
    set("deadlineLabel", label);
  };

  const handleSubmit = () => {
    const result = validateOrderDraft(draft);
    setErrors(result.errors);
    if (result.valid) onSubmit(draft);
  };

  const fieldError = (key: keyof OrderDraft) =>
    errors[key] ? <p className="mt-1 text-[11px] font-medium text-rose-600">{errors[key]}</p> : null;

  const labelClass = "mb-1 block text-xs font-semibold text-slate-600";
  const inputClass =
    "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20";

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
      <h2 className="mb-5 text-base font-bold text-slate-800">New Shop Order</h2>

      {/* Shop selector */}
      <div className="mb-5">
        <label className={labelClass}>Shop *</label>
        <div ref={shopBoxRef} className="relative">
          <div className="relative">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={shopQuery}
              onFocus={() => setShopOpen(true)}
              onChange={(e) => {
                setShopQuery(e.target.value);
                setShopOpen(true);
                set("shopId", "");
              }}
              placeholder="Search shop by name or location…"
              className={`${inputClass} pl-9 pr-9`}
            />
            <ChevronDown size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
          </div>

          {shopOpen && (
            <div className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-pop">
              {filteredShops.length === 0 ? (
                <p className="px-3 py-4 text-center text-xs text-slate-400">No matching shops.</p>
              ) : (
                filteredShops.map((shop) => (
                  <button
                    key={shop.id}
                    type="button"
                    onClick={() => selectShop(shop)}
                    className="flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors hover:bg-slate-50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-800">{shop.name}</p>
                      <p className="text-[11px] text-slate-400">{shop.location}</p>
                    </div>
                    {draft.shopId === shop.id && <Check size={15} className="mt-0.5 shrink-0 text-brand-600" />}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
        {fieldError("shopId")}
      </div>

      {/* Selected shop details */}
      {selectedShop && (
        <div className="mb-5 rounded-xl border border-brand-200/70 bg-brand-50/50 p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-brand-700">Shop Details</p>
          <p className="mt-1 text-sm font-bold text-slate-800">{selectedShop.name}</p>
          <p className="text-xs text-slate-500">
            {selectedShop.address.line1}
            {selectedShop.address.area ? `, ${selectedShop.address.area}` : ""}
          </p>
          <p className="text-xs text-slate-500">
            {[selectedShop.address.city, selectedShop.address.state, selectedShop.address.pinCode].filter(Boolean).join(", ")}
          </p>
          <div className="mt-2">
            <GPSStatus gps={selectedShop.gps} status={selectedShop.gpsStatus} label="GPS" showDetails />
          </div>
        </div>
      )}

      {/* Bird type + requirement type */}
      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Bird Type *</label>
          <select value={draft.birdType} onChange={(e) => set("birdType", e.target.value)} className={inputClass}>
            {BIRD_TYPES.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
          {fieldError("birdType")}
        </div>
        <div>
          <label className={labelClass}>Requirement Type</label>
          <select
            value={draft.requirementType}
            onChange={(e) => set("requirementType", e.target.value as RequirementType)}
            className={inputClass}
          >
            {REQUIREMENT_TYPES.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Quantities */}
      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label className={labelClass}>Number of Birds</label>
          <input
            type="number"
            min={0}
            step={1}
            value={draft.birds === 0 ? "" : draft.birds}
            onChange={(e) => set("birds", e.target.value === "" ? 0 : Math.floor(Number(e.target.value)))}
            className={inputClass}
            placeholder="0"
          />
          {fieldError("birds")}
        </div>
        <div>
          <label className={labelClass}>Number of Boxes</label>
          <input
            type="number"
            min={0}
            step={1}
            value={draft.boxes === 0 ? "" : draft.boxes}
            onChange={(e) => set("boxes", e.target.value === "" ? 0 : Math.floor(Number(e.target.value)))}
            className={inputClass}
            placeholder="0"
          />
          {fieldError("boxes")}
        </div>
        <div>
          <label className={labelClass}>Expected Weight (kg)</label>
          <input
            type="number"
            min={0}
            step={0.1}
            value={draft.expectedWeightKg == null ? "" : draft.expectedWeightKg}
            onChange={(e) => set("expectedWeightKg", e.target.value === "" ? null : Number(e.target.value))}
            className={inputClass}
            placeholder="Optional"
          />
          {fieldError("expectedWeightKg")}
        </div>
      </div>

      {/* Priority */}
      <div className="mb-5">
        <label className={labelClass}>Priority *</label>
        <div className="grid grid-cols-3 gap-2">
          {(PRIORITIES as OrderPriority[]).map((p) => {
            const active = draft.priority === p;
            const activeClass =
              p === "Urgent"
                ? "border-rose-300 bg-rose-50 text-rose-700"
                : p === "Important"
                  ? "border-amber-300 bg-amber-50 text-amber-700"
                  : "border-slate-300 bg-slate-50 text-slate-700";
            return (
              <button
                key={p}
                type="button"
                onClick={() => set("priority", p)}
                className={`rounded-lg border px-3 py-2.5 text-sm font-semibold transition-colors ${active ? activeClass : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"}`}
              >
                {p}
              </button>
            );
          })}
        </div>
        {fieldError("priority")}
      </div>

      {/* Important customer toggle */}
      <div className="mb-5">
        <label className="mb-1 flex items-center gap-2 text-xs font-semibold text-slate-600">
          <input
            type="checkbox"
            checked={draft.importantCustomer}
            onChange={(e) => set("importantCustomer", e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
          />
          Important Customer
        </label>
        <p className="text-[11px] text-slate-400">
          Separate from priority — gives the customer higher consideration during route planning.
        </p>
      </div>

      {/* Delivery date / deadline / window */}
      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label className={labelClass}>Delivery Date *</label>
          <input type="date" value={draft.deliveryDate} onChange={(e) => set("deliveryDate", e.target.value)} className={inputClass} />
          {fieldError("deliveryDate")}
        </div>
        <div>
          <label className={labelClass}>Deadline *</label>
          <select
            value={draft.deadlineTime}
            onChange={(e) => {
              const preset = DEADLINE_PRESETS.find((p) => p.time === e.target.value);
              if (preset) selectDeadline(preset.label, preset.time);
            }}
            className={inputClass}
          >
            {DEADLINE_PRESETS.map((p) => (
              <option key={p.time} value={p.time}>{p.label}</option>
            ))}
          </select>
          {fieldError("deadlineTime")}
        </div>
        <div>
          <label className={labelClass}>Delivery Window (optional)</label>
          <input
            type="text"
            value={draft.deliveryWindow ?? ""}
            onChange={(e) => set("deliveryWindow", e.target.value === "" ? null : e.target.value)}
            className={inputClass}
            placeholder="e.g. 10:00 – 14:00"
          />
        </div>
      </div>

      {/* Remarks */}
      <div className="mb-6">
        <label className={labelClass}>Remarks</label>
        <textarea
          value={draft.remarks}
          onChange={(e) => set("remarks", e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
          placeholder="Optional notes"
        />
      </div>

      {errors.form && (
        <p className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
          {errors.form}
        </p>
      )}

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50"
        >
          <X size={14} />
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-brand-700"
        >
          <Check size={14} />
          Save Order
        </button>
      </div>
    </div>
  );
}
