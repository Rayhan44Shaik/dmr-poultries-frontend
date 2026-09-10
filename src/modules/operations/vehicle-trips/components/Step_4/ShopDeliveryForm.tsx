import React from "react";
import {
  X,
  ShoppingCart,
  Bird,
  Box,
  Scale,
  Store,
  Truck,
  MessageSquare,
  AlertCircle,
  Clock,
  PackageCheck,
  Tag,
  CheckCircle2,
} from "lucide-react";
import { SearchDropdown, MultiSearchDropdown, type DropdownOption } from "../WizardControls";
import type { ShopDelivery, BoxDetail } from "../../types/trip";
import { useI18n } from "../../../../../i18n";

export interface Props {
  mode: "box" | "weight";
  setMode: (mode: "box" | "weight") => void;
  formData: any;
  setFormData: React.Dispatch<React.SetStateAction<any>>;
  validationErrors: any;

  farmBirds: number;
  farmWeight: number;
  boxCount: number;
  weightModeTotals: { birds: number; weight: number };
  mortKg: number;
  deliveredBirds: number;
  deliveredWeight: number;

  usedBoxIds: number[];
  safeBoxDetails: any[];
  readOnly: boolean;
  autoCaptureTime: string;

  editingId: number | null;
  editingShopId?: number | null;

  onClose: () => void;
  onSubmit: () => void;
  handleShopSelect: (selected: any) => void;
  handleBirdSelect: (selected: any) => void;
  handleBoxSelection: (ids: number[]) => void;
  handleFormChange: (field: string, value: any) => void;
  handlePerBoxChange: (index: number, field: "birds" | "weight", value: number) => void;

  shopOptions: any[];
  birdOptions: any[];
  isFormValid: boolean;

  rows?: ShopDelivery[];
  setRows?: React.Dispatch<React.SetStateAction<ShopDelivery[]>>;
  shops?: any[];
  birdTypes?: any[];
  boxDetails?: BoxDetail[];
  tripDate?: string;
  [key: string]: any;
}

/* ─── Small presentational helpers (local only, no logic changes) ─────── */

/** Field heading with a small coloured logo chip, matching the wizard style. */
function FormLabel({ icon: Icon, tone, children, required }: {
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
  tone: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label className="text-xs font-semibold text-slate-600 flex items-center gap-2 mb-1.5">
      <span className={`h-6 w-6 rounded-lg flex items-center justify-center shrink-0 ${tone}`}>
        <Icon size={13} />
      </span>
      <span className="truncate">{children}</span>
      {required && <span className="text-rose-500">*</span>}
    </label>
  );
}

/** Uniform metric tile so every box lines up (equal height, vertically centred). */
function MetricTile({
  icon: Icon,
  tone,
  tint,
  label,
  children,
}: {
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
  tone: string;
  tint: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded-xl border p-3 min-h-[94px] flex flex-col justify-center ${tint}`}>
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className={`h-6 w-6 rounded-lg flex items-center justify-center shrink-0 ${tone}`}>
          <Icon size={13} />
        </span>
        <span className="text-[11px] uppercase font-semibold text-slate-500 truncate">{label}</span>
      </div>
      {children}
    </div>
  );
}

/** Plain, neutral metric tile — no green/red accents. */
function SimpleMetric({ icon, tone, tint, label, value }: {
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
  tone: string;
  tint: string;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <MetricTile icon={icon} tone={tone} tint={tint} label={label}>
      <div className="text-sm font-bold text-slate-800 truncate">{value}</div>
    </MetricTile>
  );
}

export default function ShopDeliveryForm({
  mode,
  setMode,
  formData,
  validationErrors,
  farmBirds,
  farmWeight,
  boxCount,
  mortKg,
  deliveredBirds,
  deliveredWeight,
  usedBoxIds,
  safeBoxDetails,
  readOnly,
  autoCaptureTime,
  editingId,
  onClose,
  onSubmit,
  handleShopSelect,
  handleBirdSelect,
  handleBoxSelection,
  handleFormChange,
  handlePerBoxChange,
  shopOptions,
  birdOptions,
  isFormValid,
}: Props) {
  const { t } = useI18n();
  const selectedBoxIds: number[] = formData.selectedBoxIds || [];
  const isEditing = editingId !== null;

  // Wizard-native (Salary-Register / Shop-Register style) dropdown options —
  // the same searchable dropdowns used by Step 1 / Step 2.
  const shopDropdownOptions: DropdownOption[] = shopOptions
    .filter((o: any) => o && Number(o.value) > 0 && !o.isDisabled)
    .map((o: any) => ({ value: String(o.value), label: o.label }));

  const birdDropdownOptions: DropdownOption[] = birdOptions
    .filter((o: any) => o && Number(o.value) > 0 && !o.isDisabled)
    .map((o: any) => ({ value: String(o.value), label: o.label }));

  // Same availability rule as the old BoxSelector: boxes already consumed by
  // another delivery stay hidden unless they are currently selected.
  const availableBoxDetails = (safeBoxDetails || []).filter(
    (b: any) => !usedBoxIds.includes(b.boxNo) || selectedBoxIds.includes(b.boxNo)
  );
  const boxDropdownOptions: DropdownOption[] = availableBoxDetails.map((b: any) => ({
    value: String(b.boxNo),
    label: `#${b.boxNo} · ${b.birds} ${t("common.birds")} · ${Number(b.weight).toFixed(2)} kg`,
  }));

  const neutralInputClass = (invalid?: boolean) =>
    `w-full rounded-xl border px-3 text-xs font-semibold outline-none transition-all h-[40px] no-spinner ${
      invalid
        ? "border-rose-400 bg-rose-50 text-rose-900 focus:ring-2 focus:ring-rose-300"
        : "border-slate-200 bg-white text-slate-800 focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
    }`;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* ─── Header — title · bird type · mode toggle ─────────────────── */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 px-5 py-4 border-b border-slate-100">
        <div className="flex items-center gap-3 min-w-0 mr-auto">
          <div className="h-10 w-10 rounded-xl bg-blue-600 text-white shadow-md shadow-blue-600/20 flex items-center justify-center shrink-0">
            {isEditing ? <CheckCircle2 size={20} /> : <Store size={20} />}
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-slate-800 tracking-tight truncate">
              {isEditing ? t("ops.trip.edit_shop_delivery") : t("ops.trip.add_new_shop_delivery")}
            </h3>
            {isEditing && (
              <p className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                <Clock size={11} className="text-slate-400" />
                {t("ops.trip.auto_captured")}:
                <span className="font-semibold text-slate-600">{autoCaptureTime}</span>
              </p>
            )}
          </div>
        </div>

        {/* Bird type (unlabeled) — beside the mode toggle */}
        <div className="w-56 shrink-0">
          <SearchDropdown
            value={formData.birdTypeId ? String(formData.birdTypeId) : ""}
            options={birdDropdownOptions}
            placeholder={birdOptions.length > 0 ? t("ops.trip.select_bird") : t("ops.trip.no_bird_types_available")}
            searchPlaceholder={t("ops.trip.search_bird_type")}
            disabled={birdOptions.length === 0 || birdOptions[0]?.isDisabled}
            onChange={(value) => {
              if (!value) {
                handleBirdSelect(null);
                return;
              }
              const opt = birdOptions.find((o: any) => String(o.value) === value);
              handleBirdSelect(opt ? { value: opt.value, label: opt.label } : null);
            }}
          />
        </div>

        {/* Mode toggle — coloured per mode, no label */}
        <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setMode("box")}
              className={`flex items-center justify-center gap-1.5 rounded-lg text-xs font-semibold transition-all h-[32px] px-3.5 whitespace-nowrap ${
                mode === "box"
                  ? "bg-blue-600 text-white shadow-sm border border-blue-600"
                  : "text-slate-500 hover:text-slate-800 border border-transparent"
              }`}
            >
              <Box size={14} />
              {t("ops.trip.box_mode")}
            </button>
            <button
              type="button"
              onClick={() => setMode("weight")}
              className={`flex items-center justify-center gap-1.5 rounded-lg text-xs font-semibold transition-all h-[32px] px-3.5 whitespace-nowrap ${
                mode === "weight"
                  ? "bg-purple-600 text-white shadow-sm border border-purple-600"
                  : "text-slate-500 hover:text-slate-800 border border-transparent"
              }`}
            >
              <Scale size={14} />
              {t("ops.trip.weight_mode")}
            </button>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="h-8 w-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors shrink-0"
          aria-label={t("common.close")}
        >
          <X size={16} />
        </button>
      </div>

      {/* ─── Body ────────────────────────────────────────────────────── */}
      <div className="p-5 space-y-5">
        {/* Shop name + select boxes (side by side) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <FormLabel icon={ShoppingCart} tone="bg-sky-50 text-sky-600" required>
              {t("operations.shop_name")}
            </FormLabel>
            <SearchDropdown
              value={formData.shopId ? String(formData.shopId) : ""}
              options={shopDropdownOptions}
              placeholder={shopOptions.length > 0 ? t("ops.trip.select_shop_ellipsis") : t("ops.trip.no_shops_available")}
              searchPlaceholder={t("ops.trip.search_shop_bird")}
              disabled={shopOptions.length === 0 || shopOptions[0]?.isDisabled}
              onChange={(value) => {
                if (!value) {
                  handleShopSelect(null);
                  return;
                }
                const opt = shopOptions.find((o: any) => String(o.value) === value);
                handleShopSelect(opt ? { value: opt.value, label: opt.label } : null);
              }}
            />
          </div>

          <div>
            <FormLabel icon={PackageCheck} tone="bg-emerald-50 text-emerald-600">
              {t("ops.trip.select_available_boxes")}
            </FormLabel>
            {safeBoxDetails.length > 0 ? (
              <MultiSearchDropdown
                selected={formData.selectedBoxIds.map(String)}
                options={boxDropdownOptions}
                placeholder={t("ops.trip.select_boxes_from_pickup")}
                searchPlaceholder={t("ops.trip.search_box_number")}
                disabled={readOnly}
                onChange={(values) => handleBoxSelection(values.map(Number))}
              />
            ) : (
              <div className="border border-slate-200 rounded-xl p-2 bg-slate-50 text-center flex items-center justify-center gap-1.5 h-[42px]">
                <AlertCircle size={14} className="text-slate-400" />
                <p className="text-xs text-slate-500">{t("ops.trip.no_boxes_from_pickup")}</p>
              </div>
            )}
          </div>
        </div>

        {/* Selected boxes + box list (side by side) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <FormLabel icon={Box} tone="bg-blue-50 text-blue-600">
              {t("ops.trip.selected_boxes")}
            </FormLabel>
            <div className="flex h-[42px] items-center rounded-xl border border-slate-200 bg-slate-50/60 px-4 text-sm font-bold text-slate-800">
              {boxCount}
            </div>
          </div>

          <div>
            <FormLabel icon={Tag} tone="bg-indigo-50 text-indigo-600">
              {t("ops.trip.box_nos_list")}
            </FormLabel>
            <div className="flex min-h-[42px] flex-wrap items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2">
              {selectedBoxIds.length > 0 ? (
                selectedBoxIds.map((id) => (
                  <span
                    key={id}
                    className="px-2 py-0.5 bg-white text-slate-700 border border-slate-200 rounded-md text-[10px] font-semibold shrink-0"
                  >
                    #{id}
                  </span>
                ))
              ) : (
                <span className="text-xs text-slate-400 italic">{t("ops.trip.none_selected")}</span>
              )}
            </div>
          </div>
        </div>

        {/* Mode-specific breakdown */}
        {mode === "box" ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Farm — birds above weight */}
            <div className="space-y-3">
              <SimpleMetric
                icon={Bird}
                tone="bg-sky-50 text-sky-600"
                tint="bg-sky-50/50 border-sky-100"
                label={t("ops.trip.farm_birds")}
                value={farmBirds}
              />
              <SimpleMetric
                icon={Scale}
                tone="bg-blue-50 text-blue-600"
                tint="bg-blue-50/50 border-blue-100"
                label={t("ops.trip.farm_weight_kg")}
                value={farmWeight.toFixed(2)}
              />
            </div>

            {/* Delivered — birds above weight */}
            <div className="space-y-3">
              <SimpleMetric
                icon={Truck}
                tone="bg-emerald-50 text-emerald-600"
                tint="bg-emerald-50/50 border-emerald-100"
                label={t("ops.trip.delivered_birds")}
                value={deliveredBirds}
              />
              <SimpleMetric
                icon={Scale}
                tone="bg-teal-50 text-teal-600"
                tint="bg-teal-50/50 border-teal-100"
                label={t("ops.trip.delivered_weight_kg")}
                value={deliveredWeight > 0 ? deliveredWeight.toFixed(2) : "0.00"}
              />
            </div>

            {/* Mortality — birds above weight */}
            <div className="space-y-3">
              <MetricTile
                icon={AlertCircle}
                tone="bg-rose-50 text-rose-600"
                tint="bg-rose-50/50 border-rose-100"
                label={t("ops.trip.mortality_birds")}
              >
                <input
                  type="number"
                  value={formData.mortality || ""}
                  onChange={(e) => handleFormChange("mortality", Number(e.target.value))}
                  placeholder="0"
                  min="0"
                  className={neutralInputClass(validationErrors.birdsExceed)}
                />
                {validationErrors.birdsExceed && (
                  <p className="text-[10px] text-rose-600 mt-1 flex items-center gap-1 font-medium">
                    <AlertCircle size={10} /> Max: {farmBirds}
                  </p>
                )}
              </MetricTile>
              <SimpleMetric
                icon={Scale}
                tone="bg-amber-50 text-amber-600"
                tint="bg-amber-50/50 border-amber-100"
                label={t("ops.trip.mortality_weight_kg")}
                value={mortKg > 0 ? mortKg.toFixed(2) : "0.00"}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase">
                  <tr>
                    <th className="px-3 py-2.5">{t("ops.trip.box_no")}</th>
                    <th className="px-3 py-2.5">{t("ops.trip.farm_birds")}</th>
                    <th className="px-3 py-2.5">
                      {t("ops.trip.delivered_birds")} <span className="text-rose-500">*</span>
                    </th>
                    <th className="px-3 py-2.5">{t("ops.trip.farm_weight_kg")}</th>
                    <th className="px-3 py-2.5">
                      {t("ops.trip.delivered_weight_kg")} <span className="text-rose-500">*</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {formData.perBoxData.map((item: any, index: number) => {
                    const farmBox = safeBoxDetails.find((b) => b.boxNo === item.boxNo);
                    const birdsError = validationErrors.perBoxBirdsErrors[index] || false;
                    const weightError = validationErrors.perBoxWeightErrors[index] || false;
                    return (
                      <tr key={item.boxNo} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-3 py-2 font-bold text-slate-800">#{item.boxNo}</td>
                        <td className="px-3 py-2 font-medium">{farmBox?.birds || 0}</td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            value={item.birds || ""}
                            onChange={(e) => {
                              const raw = e.target.value;
                              const parsed = raw === "" ? 0 : Number(raw);
                              handlePerBoxChange(index, "birds", Number.isFinite(parsed) ? parsed : 0);
                            }}
                            placeholder="0"
                            min="0"
                            className={`w-20 rounded-lg border px-2 py-1.5 text-xs outline-none transition-all no-spinner ${
                              birdsError
                                ? "border-rose-400 bg-rose-50 focus:ring-2 focus:ring-rose-300"
                                : "border-slate-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                            }`}
                          />
                        </td>
                        <td className="px-3 py-2 font-medium">{farmBox?.weight?.toFixed(2) || "0.00"}</td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            step="0.01"
                            value={item.weight || ""}
                            onChange={(e) => {
                              const raw = e.target.value;
                              const parsed = raw === "" ? 0 : Number(raw);
                              handlePerBoxChange(index, "weight", Number.isFinite(parsed) ? parsed : 0);
                            }}
                            placeholder="0.00"
                            min="0"
                            className={`w-24 rounded-lg border px-2 py-1.5 text-xs outline-none transition-all no-spinner ${
                              weightError
                                ? "border-rose-400 bg-rose-50 focus:ring-2 focus:ring-rose-300"
                                : "border-slate-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                            }`}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <FormLabel icon={AlertCircle} tone="bg-rose-50 text-rose-600">
                  {t("ops.trip.mortality_birds")}
                </FormLabel>
                <input
                  type="number"
                  value={formData.mortality || ""}
                  onChange={(e) => handleFormChange("mortality", Number(e.target.value))}
                  placeholder="0"
                  min="0"
                  className={neutralInputClass()}
                />
              </div>
              <div>
                <FormLabel icon={Scale} tone="bg-amber-50 text-amber-600">
                  {t("ops.trip.mortality_weight_kg")}
                </FormLabel>
                <input
                  type="number"
                  step="0.01"
                  value={formData.mortWeight || ""}
                  onChange={(e) => handleFormChange("mortWeight", Number(e.target.value))}
                  placeholder="0.00"
                  min="0"
                  className={neutralInputClass()}
                />
              </div>
            </div>
          </div>
        )}

        {/* Remarks */}
        <div>
          <FormLabel icon={MessageSquare} tone="bg-violet-50 text-violet-600">
            {t("common.remarks")}
          </FormLabel>
          <input
            value={formData.remarks || ""}
            onChange={(e) => handleFormChange("remarks", e.target.value)}
            placeholder={t("ops.trip.optional_delivery_notes")}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-800 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 h-[40px] transition-all placeholder:text-slate-400"
          />
        </div>
      </div>

      {/* ─── Footer actions ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-slate-100 bg-slate-50/60">
        <span className="text-[11px] text-slate-400 hidden sm:block">
          {isFormValid
            ? t("ops.trip.ready_to_save")
            : t("ops.trip.complete_required_fields")}
        </span>
        <div className="flex items-center gap-2 ml-auto">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-800 text-xs font-semibold transition-all active:scale-95"
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={!isFormValid}
            className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 ${
              isFormValid
                ? "bg-slate-800 hover:bg-slate-900 text-white shadow-sm"
                : "bg-slate-200 text-slate-400 cursor-not-allowed"
            }`}
          >
            <CheckCircle2 size={15} />
            {isEditing ? t("ops.trip.update_delivery") : t("ops.trip.save_delivery")}
          </button>
        </div>
      </div>
    </div>
  );
}
