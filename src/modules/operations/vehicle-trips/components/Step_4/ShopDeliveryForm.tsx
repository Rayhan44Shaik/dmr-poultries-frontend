import React from "react";
import {
  X,
  ShoppingCart,
  Layers,
  Box,
  Scale,
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

function SectionLabel({ icon: Icon, tone, children, required }: {
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
  tone: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
      <span className={`h-5 w-5 rounded-md flex items-center justify-center shrink-0 ${tone}`}>
        <Icon size={12} />
      </span>
      {children}
      {required && <span className="text-rose-500 -ml-0.5">*</span>}
    </label>
  );
}

function ReadOnlyMetric({ label, icon: Icon, tone, value, valueTone = "text-slate-800", accentBar }: {
  label: string;
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
  tone: string;
  value: React.ReactNode;
  valueTone?: string;
  accentBar?: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-3 shadow-2xs">
      {accentBar && <span className={`absolute inset-x-0 top-0 h-[3px] ${accentBar}`} />}
      <div className="text-[10px] uppercase font-semibold text-slate-400 flex items-center gap-1.5 mb-1">
        <span className={`h-5 w-5 rounded-md flex items-center justify-center shrink-0 ${tone}`}>
          <Icon size={12} />
        </span>
        <span className="truncate">{label}</span>
      </div>
      <div className={`text-sm font-bold truncate ${valueTone}`}>{value}</div>
    </div>
  );
}

function MetricInput({ label, icon: Icon, tone, invalid, invalidHint, children }: {
  label: string;
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
  tone: string;
  invalid?: boolean;
  invalidHint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-[10px] uppercase font-semibold text-slate-400 flex items-center gap-1.5 mb-1">
        <span className={`h-5 w-5 rounded-md flex items-center justify-center shrink-0 ${tone}`}>
          <Icon size={12} />
        </span>
        <span className="truncate">{label}</span>
      </label>
      {children}
      {invalid && invalidHint && (
        <p className="text-[10px] text-rose-600 mt-1 flex items-center gap-1 font-medium">
          <AlertCircle size={10} /> {invalidHint}
        </p>
      )}
    </div>
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

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg shadow-slate-200/50">
      {/* ─── Header band ─────────────────────────────────────────────── */}
      <div className="relative bg-gradient-to-r from-emerald-600 via-emerald-600 to-teal-600 px-5 py-4">
        <div className="absolute inset-0 opacity-[0.08]" aria-hidden>
          <div className="absolute -right-6 -top-10 h-36 w-36 rounded-full bg-white" />
          <div className="absolute -right-2 -bottom-16 h-28 w-28 rounded-full bg-white" />
        </div>
        <div className="relative flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center shrink-0 text-white backdrop-blur-sm">
              {isEditing ? <CheckCircle2 size={20} /> : <ShoppingCart size={20} />}
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-white tracking-tight truncate">
                {isEditing ? t("ops.trip.edit_shop_delivery") : t("ops.trip.add_new_shop_delivery")}
              </h3>
              {isEditing && (
                <p className="text-[11px] text-emerald-50/90 flex items-center gap-1.5 mt-0.5">
                  <Clock size={11} className="text-emerald-100" />
                  {t("ops.trip.auto_captured")}:
                  <span className="font-semibold text-white">{autoCaptureTime}</span>
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-lg bg-white/10 hover:bg-white/20 border border-white/15 flex items-center justify-center text-white transition-colors shrink-0"
            aria-label={t("common.close")}
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* ─── Body ────────────────────────────────────────────────────── */}
      <div className="p-5 space-y-5">
        {/* Delivery mode + bird type row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <SectionLabel icon={Box} tone="bg-emerald-100 text-emerald-700">
              {t("ops.trip.delivery_mode")}
            </SectionLabel>
            <div className="grid grid-cols-2 gap-1.5 bg-slate-100 p-1.5 rounded-xl border border-slate-200/70">
              <button
                type="button"
                onClick={() => setMode("box")}
                className={`flex items-center justify-center gap-1.5 rounded-lg text-xs font-semibold transition-all h-[36px] whitespace-nowrap ${
                  mode === "box"
                    ? "bg-white text-emerald-700 shadow-sm border border-emerald-200/70"
                    : "text-slate-500 hover:text-slate-800 border border-transparent"
                }`}
              >
                <Box size={14} />
                {t("ops.trip.box_mode")}
              </button>
              <button
                type="button"
                onClick={() => setMode("weight")}
                className={`flex items-center justify-center gap-1.5 rounded-lg text-xs font-semibold transition-all h-[36px] whitespace-nowrap ${
                  mode === "weight"
                    ? "bg-white text-emerald-700 shadow-sm border border-emerald-200/70"
                    : "text-slate-500 hover:text-slate-800 border border-transparent"
                }`}
              >
                <Scale size={14} />
                {t("ops.trip.weight_mode")}
              </button>
            </div>
          </div>

          <div>
            <SectionLabel icon={Layers} tone="bg-sky-100 text-sky-700" required>
              {t("operations.bird_type")}
            </SectionLabel>
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
        </div>

        {/* Shop name */}
        <div>
          <SectionLabel icon={ShoppingCart} tone="bg-indigo-100 text-indigo-700" required>
            {t("operations.shop_name")}
          </SectionLabel>
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
          <span className="text-[10px] text-slate-400 mt-1 block">
            {t("ops.trip.shops_available", { count: shopDropdownOptions.length })}
          </span>
        </div>

        {/* Box selector */}
        <div>
          <SectionLabel icon={PackageCheck} tone="bg-amber-100 text-amber-700">
            {t("ops.trip.select_available_boxes")}
          </SectionLabel>
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
            <div className="border border-slate-200 rounded-xl p-2 bg-slate-50 text-center flex items-center justify-center gap-1.5 h-[40px]">
              <AlertCircle size={14} className="text-slate-400" />
              <p className="text-xs text-slate-500">{t("ops.trip.no_boxes_from_pickup")}</p>
            </div>
          )}
        </div>

        {/* Mode-specific breakdown */}
        {mode === "box" ? (
          <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-4 space-y-4">
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                {t("ops.trip.box_mode")}
              </span>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <ReadOnlyMetric
                label={t("ops.trip.selected_boxes")}
                icon={Box}
                tone="bg-blue-100 text-blue-600"
                value={boxCount}
                accentBar="bg-blue-400"
              />
              <ReadOnlyMetric
                label={t("ops.trip.farm_birds")}
                icon={Layers}
                tone="bg-slate-100 text-slate-600"
                value={farmBirds}
                accentBar="bg-slate-300"
              />
              <MetricInput
                label={t("ops.trip.mortality_birds")}
                icon={AlertCircle}
                tone="bg-rose-100 text-rose-600"
                invalid={validationErrors.birdsExceed}
                invalidHint={`Max: ${farmBirds}`}
              >
                <input
                  type="number"
                  value={formData.mortality || ""}
                  onChange={(e) => handleFormChange("mortality", Number(e.target.value))}
                  placeholder="0"
                  min="0"
                  className={`w-full rounded-lg border px-3 text-xs font-semibold outline-none transition-all h-[40px] no-spinner ${
                    validationErrors.birdsExceed
                      ? "border-rose-400 bg-rose-50 text-rose-900 focus:ring-2 focus:ring-rose-300"
                      : "border-slate-200 bg-white text-slate-800 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200/60"
                  }`}
                />
              </MetricInput>
              <ReadOnlyMetric
                label={t("ops.trip.delivered_birds")}
                icon={PackageCheck}
                tone="bg-emerald-100 text-emerald-700"
                value={deliveredBirds}
                valueTone="text-emerald-700"
                accentBar="bg-emerald-400"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-start">
              <div>
                <label className="text-[10px] uppercase font-semibold text-slate-400 flex items-center gap-1.5 mb-1">
                  <span className="h-5 w-5 rounded-md bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                    <Tag size={12} />
                  </span>
                  {t("ops.trip.box_nos_list")}
                </label>
                <div className="p-2 bg-white border border-slate-200 rounded-xl min-h-[40px] max-h-[88px] overflow-y-auto flex flex-wrap gap-1">
                  {selectedBoxIds.length > 0 ? (
                    selectedBoxIds.map((id) => (
                      <span
                        key={id}
                        className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200/80 rounded-md text-[10px] font-bold flex items-center gap-1 shrink-0 shadow-2xs"
                      >
                        <Tag size={9} className="text-blue-500" />
                        #{id}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-slate-400 italic self-center">{t("ops.trip.none_selected")}</span>
                  )}
                </div>
              </div>

              <ReadOnlyMetric
                label={t("ops.trip.farm_weight_kg")}
                icon={Scale}
                tone="bg-slate-100 text-slate-600"
                value={farmWeight.toFixed(2)}
                accentBar="bg-slate-300"
              />
              <ReadOnlyMetric
                label={t("ops.trip.mortality_weight_kg")}
                icon={Scale}
                tone="bg-rose-100 text-rose-600"
                value={mortKg > 0 ? mortKg.toFixed(2) : "0.00"}
                valueTone={mortKg > 0 ? "text-rose-700" : "text-slate-800"}
                accentBar="bg-rose-300"
              />
              <ReadOnlyMetric
                label={t("ops.trip.delivered_weight_kg")}
                icon={Scale}
                tone="bg-emerald-100 text-emerald-700"
                value={deliveredWeight > 0 ? deliveredWeight.toFixed(2) : "0.00"}
                valueTone="text-emerald-700"
                accentBar="bg-emerald-400"
              />
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-4 space-y-4">
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-purple-500" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                {t("ops.trip.weight_mode")}
              </span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-2xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-gradient-to-r from-slate-50 to-slate-100/70 border-b border-slate-200 text-slate-500 font-bold uppercase">
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
                        <td className="px-3 py-2 font-bold text-slate-800">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="h-6 w-6 rounded-md bg-purple-100 text-purple-700 flex items-center justify-center text-[10px] font-bold">
                              #{item.boxNo}
                            </span>
                          </span>
                        </td>
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
                                : "border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200/60"
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
                                : "border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200/60"
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
              <MetricInput
                label={t("ops.trip.mortality_birds")}
                icon={AlertCircle}
                tone="bg-rose-100 text-rose-600"
              >
                <input
                  type="number"
                  value={formData.mortality || ""}
                  onChange={(e) => handleFormChange("mortality", Number(e.target.value))}
                  placeholder="0"
                  min="0"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200/60 h-[40px] no-spinner"
                />
              </MetricInput>
              <MetricInput
                label={t("ops.trip.mortality_weight_kg")}
                icon={Scale}
                tone="bg-rose-100 text-rose-600"
              >
                <input
                  type="number"
                  step="0.01"
                  value={formData.mortWeight || ""}
                  onChange={(e) => handleFormChange("mortWeight", Number(e.target.value))}
                  placeholder="0.00"
                  min="0"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200/60 h-[40px] no-spinner"
                />
              </MetricInput>
            </div>
          </div>
        )}

        {/* Remarks */}
        <div>
          <SectionLabel icon={MessageSquare} tone="bg-violet-100 text-violet-700">
            {t("common.remarks")}
          </SectionLabel>
          <input
            value={formData.remarks || ""}
            onChange={(e) => handleFormChange("remarks", e.target.value)}
            placeholder={t("ops.trip.optional_delivery_notes")}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200/60 h-[40px] transition-all placeholder:text-slate-400"
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
                ? "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-md shadow-emerald-500/25"
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
