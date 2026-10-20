import React from "react";
import { RotateCcw, BookOpen, Loader2, Calendar, UserCog, CreditCard, Hash, Store, History } from "lucide-react";
import type { Collection, CollectionEntry, CollectionErrors, PaymentMode } from "../../types/collection";
import { DatePicker } from "../../../../../components/common/DatePicker";
import {
  opsFilterCardClass,
  opsFilterLabelClass,
  opsInputClass,
  opsSecondaryButtonClass,
} from "../../../../../shared/ui/operationsStyles";
import { useI18n } from "../../../../../i18n";
import { localizeTripViewText } from "../../../vehicle-trips/utils/tripViewLocalization";
import MasterDropdown, { type MasterDropdownOption } from "../../../../masters/components/MasterDropdown";

interface Props {
  entry: CollectionEntry;
  errors: CollectionErrors;
  shops: string[];
  collectors: string[];
  paymentModes: PaymentMode[];
  onDateChange: (value: string) => void;
  onShopChange: (value: string) => void;
  onCollectorChange: (value: string) => void;
  onPaymentModeChange: (value: string) => void;
  onReferenceChange: (value: string) => void;
  onViewLedger: () => void;
  onReset: () => void;
  ledgerLoading?: boolean;
  latestTransaction?: Collection | null;
}

/**
 * Collection Entry filter bar.
 *
 * Presented as a plain filter card — no section heading or icon tile — so it
 * reads exactly like the Trip List toolbar sitting above its results.
 */
function CollectionInformation({
  entry,
  errors,
  shops,
  collectors,
  paymentModes,
  onDateChange,
  onShopChange,
  onCollectorChange,
  onPaymentModeChange,
  onReferenceChange,
  onViewLedger,
  onReset,
  ledgerLoading = false,
  latestTransaction = null,
}: Props) {
  const { t, language } = useI18n();

  // Payment modes are master-data values, so they localise through the same
  // helper the Trip View uses: Telugu script in Telugu, the stored value (and
  // every numeric figure) untouched.
  const modeLabel = (mode: string) => localizeTripViewText(mode, language) || mode;
  const compactDate = (value: string) => {
    const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
    return match ? `${match[3]}-${match[2]}-${match[1].slice(-2)}` : value || "—";
  };

  // Same option contract the Trip List filters use, so every dropdown on this
  // page gets the shared search / clear / keyboard behaviour.
  const shopOptions: MasterDropdownOption[] = shops.map((shop) => ({ value: shop, label: shop }));
  const collectorOptions: MasterDropdownOption[] = collectors.map((name) => ({ value: name, label: name }));
  const paymentModeOptions: MasterDropdownOption[] = paymentModes.map((mode) => ({
    value: mode.name,
    label: modeLabel(mode.name),
  }));

  const isLedgerEnabled =
    entry.shopName.trim().length > 0 &&
    entry.collectorName.trim().length > 0 &&
    entry.paymentModeName.trim().length > 0;

  return (
    <div className={`${opsFilterCardClass} relative overflow-visible border-emerald-100 shadow-sm focus-within:z-20`}>
      {/* Row 1 — the four compact entry fields, in capture order. */}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className={opsFilterLabelClass}>
            <Calendar size={17} className="text-emerald-500 flex-shrink-0" />
            <span>{t("operations.collection_date")}</span>
          </label>
          <DatePicker
            id="collection-entry-date"
            value={entry.collectionDate}
            onChange={onDateChange}
            placeholder={t("placeholder.enter_date")}
            className="w-full text-xs font-medium"
            openOnFocus={false}
          />
          {errors.collectionDate && (
            <p className="mt-1 text-xs text-red-600">{errors.collectionDate}</p>
          )}
        </div>

        <div>
          <label className={opsFilterLabelClass}>
            <UserCog size={17} className="text-emerald-500 flex-shrink-0" />
            <span>
              {t("common.collector")} <span className="text-red-500">*</span>
            </span>
          </label>
          <MasterDropdown
            hideLabel
            label={t("common.collector")}
            value={entry.collectorName}
            options={collectorOptions}
            onChange={onCollectorChange}
            placeholder={t("operations.select_collector")}
            error={errors.collectorName}
            searchable
            allowClear
            className="w-full"
          />
        </div>

        <div>
          <label className={opsFilterLabelClass}>
            <CreditCard size={17} className="text-emerald-500 flex-shrink-0" />
            <span>
              {t("operations.payment_mode")} <span className="text-red-500">*</span>
            </span>
          </label>
          <MasterDropdown
            hideLabel
            label={t("operations.payment_mode")}
            value={entry.paymentModeName}
            options={paymentModeOptions}
            onChange={onPaymentModeChange}
            placeholder={t("ops.collection.select_payment_mode")}
            error={errors.paymentModeName}
            searchable
            allowClear
            className="w-full"
          />
        </div>

        <div>
          <label className={opsFilterLabelClass}>
            <Store size={17} className="text-amber-500 flex-shrink-0" />
            <span>
              {t("operations.shop_name")} <span className="text-red-500">*</span>
            </span>
          </label>
          <MasterDropdown
            hideLabel
            label={t("operations.shop_name")}
            value={entry.shopName}
            options={shopOptions}
            onChange={onShopChange}
            placeholder={t("operations.select_shop")}
            error={errors.shopName}
            searchable
            searchFromStart
            allowClear
            className="w-full"
          />
        </div>
      </div>

      {/* Row 2 — Shop Name is searchable and holds long trading names, so it
        * spans the width of the four fields above, with the actions alongside. */}
      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-12 items-end pt-1">
        <div className="lg:col-span-3">
          <label className={opsFilterLabelClass}>
            <Hash size={17} className="text-slate-400 flex-shrink-0" />
            <span>{t("operations.reference_no")}</span>
          </label>
          <input
            id="referenceNo"
            type="text"
            value={entry.referenceNo}
            onChange={(e) => onReferenceChange(e.target.value)}
            placeholder={t("placeholder.enter_reference")}
            disabled={entry.paymentModeName === "Cash"}
            className={`${opsInputClass} disabled:bg-slate-100 disabled:text-slate-400`}
            aria-describedby={errors.referenceNo ? "referenceNo-error" : undefined}
          />
          {errors.referenceNo && <p id="referenceNo-error" className="mt-1 text-xs text-red-600">{errors.referenceNo}</p>}
        </div>

        <div className="lg:col-span-6 min-w-0">
          <span className={opsFilterLabelClass}>
            <History size={17} className="shrink-0 text-blue-500" />
            {t("ops.collection.recent_collections")}
          </span>
          <div className="flex h-9 min-w-0 w-full items-center gap-2 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 px-3 text-[13px] font-bold text-slate-800">
            {latestTransaction ? (
              <>
                <span className="shrink-0">{modeLabel(latestTransaction.paymentModeName || "Cash")}</span>
                <span className="text-slate-400">·</span>
                <span className="shrink-0 tabular-nums">₹{Number(latestTransaction.amount || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span>
                <span className="text-slate-400">·</span>
                <span className="shrink-0 tabular-nums">{compactDate(latestTransaction.collectionDate)}</span>
                <span className="text-slate-400">—</span>
                <span className={latestTransaction.status === "Approved" ? "text-emerald-700" : "text-orange-700"}>{latestTransaction.status}</span>
              </>
            ) : (
              <span className="text-slate-400">No recent transaction</span>
            )}
          </div>
        </div>

        <div className="lg:col-span-3 flex items-center justify-end gap-2 flex-wrap">
        <button
          type="button"
          onClick={onViewLedger}
          disabled={!isLedgerEnabled || ledgerLoading}
          className={`group relative inline-flex h-9 items-center gap-2 rounded-lg px-4 text-sm font-semibold text-white shadow-sm transition ${
            isLedgerEnabled && !ledgerLoading
              ? "bg-emerald-600 hover:bg-emerald-700"
              : "cursor-not-allowed bg-slate-400"
          }`}
          // No hover tooltip on this page by design. The accessible name still
          // explains WHY the button is unavailable, so the reason reaches
          // assistive tech even though nothing pops up on hover.
          aria-label={
            !isLedgerEnabled
              ? t("ops.collection.select_shop_collector_mode")
              : ledgerLoading
                ? t("common.loading")
                : t("ops.collection.view_shop_ledger")
          }
        >
          {ledgerLoading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              {t("common.loading")}
            </>
          ) : (
            <>
              <span
                className={`inline-flex ${
                  isLedgerEnabled ? "motion-safe:group-hover:animate-[var(--animate-action-view)]" : ""
                }`}
              >
                <BookOpen size={16} />
              </span>
              {t("ops.collection.view_shop_ledger")}
            </>
          )}
        </button>
        <button
          type="button"
          onClick={onReset}
          className={`group relative ${opsSecondaryButtonClass}`}
          aria-label={t("common.reset")}
        >
          <span className="inline-flex motion-safe:group-hover:animate-[var(--animate-action-reset)]">
            <RotateCcw size={14} />
          </span>
          {t("common.reset")}
        </button>
        </div>
      </div>
    </div>
  );
}

export default React.memo(CollectionInformation);
