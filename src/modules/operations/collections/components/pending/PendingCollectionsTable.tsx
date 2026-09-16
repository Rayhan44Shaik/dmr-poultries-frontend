import React from "react";
import {
  ArrowDown, ArrowUp, Calendar, Clock3, CreditCard, Eye, Hash, LoaderCircle,
  ShoppingBag, TrendingUp,
} from "lucide-react";
import type {
  PendingOverallTotals,
  PendingReportRow,
  PendingShopSortDir,
  PendingShopSortKey,
} from "../../types/collection";
import { useI18n } from "../../../../../i18n";
import { localizeTripViewText } from "../../../vehicle-trips/utils/tripViewLocalization";

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(amount);

const formatDate = (dateStr: string | null | undefined) => {
  if (!dateStr || dateStr === "-") return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
};

const formatBalance = (amount: number) => {
  const abs = Math.abs(amount);
  const formatted = formatCurrency(abs);
  if (amount > 0) return `+ ${formatted}`;
  if (amount < 0) return `- ${formatted}`;
  return formatted;
};

/** The Trip List table's sort affordance: one arrow pair, emerald when live. */
function SortArrows({ active, dir }: { active: boolean; dir: PendingShopSortDir }) {
  const base = "h-3.5 w-3.5 shrink-0 transition-colors";
  const on = "text-emerald-600";
  const off = "text-slate-300 group-hover/sort:text-slate-500";
  return (
    <span className="inline-flex shrink-0 items-center gap-0.5" aria-hidden="true">
      <ArrowUp size={13} strokeWidth={2.7} className={`${base} ${active && dir === "asc" ? on : off}`} />
      <ArrowDown size={13} strokeWidth={2.7} className={`${base} ${active && dir === "desc" ? on : off}`} />
    </span>
  );
}

interface Props {
  data: PendingReportRow[];
  selectedShopName: string | null;
  onSelectShop: (shopName: string | null) => void;
  onView: (shopName: string) => void;
  totalShops: number;
  isLoading?: boolean;
  /** Active column order — the same state the filter bar's Sort By reads. */
  sortBy: PendingShopSortKey | null;
  sortDir: PendingShopSortDir;
  /** Ascending → descending → clear, exactly like a Trip List header. */
  onSortChange: (key: PendingShopSortKey) => void;
  /**
   * Overall cumulative for the WHOLE filtered set. Rendered as the table's
   * last row so the totals close the register rather than the page.
   */
  overall?: PendingOverallTotals | null;
}

/**
 * Pending Collections results table.
 *
 * Three behaviours are worth stating because they are deliberate:
 *
 *   • LOADING — the card header (logo + title + shop count) is rendered before
 *     the loading branch, so a refresh shows the spinner INSIDE the table body
 *     and the card keeps its identity. Rate Entry and Trip List behave the same
 *     way; the page around it never blanks.
 *
 *   • READ-ONLY ROWS — a row offers View only. Owner name and mobile live in
 *     the shop view, not as two more columns here, and nothing on this table
 *     can delete a shop's collection. Deletion stays in the shop view, where
 *     the record being removed is visible and confirmable.
 *
 *   • CUMULATIVE — the closing row totals the filtered set, not the page, so
 *     "overall" keeps its meaning at every page size and on every page.
 */
function PendingCollectionsTable({
  data,
  selectedShopName,
  onSelectShop,
  onView,
  totalShops,
  isLoading = false,
  sortBy,
  sortDir,
  onSortChange,
  overall = null,
}: Props) {
  const { t, language } = useI18n();
  // Record text (shop names) is transliterated for display only — selection,
  // view and the row keys keep the stored value.
  const shown = (value: string | null | undefined) =>
    localizeTripViewText(value ?? "", language);

  const handleRowClick = (shopName: string) => {
    if (selectedShopName === shopName) {
      onSelectShop(null);
    } else {
      onSelectShop(shopName);
    }
  };

  const selectedShop = data.find((s) => s.shopName === selectedShopName);

  /** One header cell: the Trip List's sortable-column pattern. */
  const sortable = (
    key: PendingShopSortKey,
    content: React.ReactNode,
    align: "left" | "right" | "center" = "left",
  ) => {
    const active = sortBy === key;
    return (
      <button
        type="button"
        onClick={() => onSortChange(key)}
        aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
        className={`group/sort flex w-full items-center gap-1.5 border-0 bg-transparent p-0 text-[11px] font-bold uppercase tracking-wider transition-colors hover:text-emerald-700 ${
          align === "right" ? "justify-end" : align === "center" ? "justify-center" : ""
        } ${active ? "text-emerald-700" : "text-slate-700"}`}
      >
        {content}
        <SortArrows active={active} dir={sortDir} />
      </button>
    );
  };

  const money = (value: number) => formatCurrency(value);
  const overallBalanceColor =
    (overall?.balance ?? 0) > 0 ? "text-red-700" :
    (overall?.balance ?? 0) < 0 ? "text-blue-700" :
    "text-slate-700";

  return (
    <>
      {/* Header — the Rate Entry / Trip List header, at the same size. */}
      <div className="flex items-center px-6 py-3 border-b border-slate-100 bg-gradient-to-r from-orange-50/60 via-white to-orange-50/40">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center text-orange-500 shadow-inner">
            <Clock3 className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-slate-800 tracking-tight">
            {t("operations.pending_collections")}
            <span className="ml-2 text-[11px] font-medium text-slate-500">
              {totalShops} {t("ops.collection.shops")}
            </span>
            {selectedShop && (
              <span className="ml-2 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/70 px-2 py-0.5 rounded-full align-middle">
                {shown(selectedShop.shopName)}
              </span>
            )}
          </h3>
        </div>
      </div>

      {isLoading ? (
        <div className="py-16 text-center text-sm font-medium text-slate-400">
          <span className="inline-flex items-center gap-2">
            <LoaderCircle size={16} className="animate-spin text-orange-500" aria-hidden="true" />
            {t("ops.collection.loading_pending")}
          </span>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs md:text-sm">
            <thead className="bg-slate-50/80 border-b border-slate-200/70">
              <tr className="text-slate-700 whitespace-nowrap">
                <th className="px-3.5 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <div className="flex items-center justify-center gap-1.5">
                    <Hash size={14} className="text-slate-400" />
                    {t("table.s_no")}
                  </div>
                </th>
                <th className="px-3.5 py-3 text-left">
                  {sortable("shopName", t("operations.shop_name"))}
                </th>
                <th className="px-3.5 py-3 text-right">
                  {sortable("balance", t("common.balance"), "right")}
                </th>
                <th className="px-3.5 py-3 text-right">
                  {sortable(
                    "weeklySales",
                    <span className="inline-flex items-center gap-1.5">
                      <ShoppingBag size={14} className="text-blue-600" />
                      {t("operations.recent_sales")}
                    </span>,
                    "right",
                  )}
                </th>
                <th className="px-3.5 py-3 text-right">
                  {sortable(
                    "weeklyApprovedCollections",
                    <span className="inline-flex items-center gap-1.5">
                      <CreditCard size={14} className="text-green-600" />
                      {t("operations.recent_collections")}
                    </span>,
                    "right",
                  )}
                </th>
                <th className="px-3.5 py-3 text-right">
                  {sortable(
                    "recoveryPercentage",
                    <span className="inline-flex items-center gap-1.5">
                      <TrendingUp size={14} className="text-purple-600" />
                      {t("ops.collection.recovery_pct")}
                    </span>,
                    "right",
                  )}
                </th>
                {/* Last Collection sits beside Recovery %: the two read together
                    as "how much came back / when it last came back". */}
                <th className="px-3.5 py-3 text-center">
                  {sortable(
                    "lastCollectionDate",
                    <span className="inline-flex items-center gap-1.5">
                      <Calendar size={14} className="text-blue-600" />
                      {t("ops.collection.last_collection")}
                    </span>,
                    "center",
                  )}
                </th>
                <th className="px-3.5 py-3 text-center">
                  {sortable("overdueDays", t("ops.collection.overdue"), "center")}
                </th>
                <th className="px-3.5 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-slate-700">
                  {t("table.actions")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400 text-sm font-medium">
                    {t("empty.no_shops")}
                  </td>
                </tr>
              ) : (
                data.map((shop, index) => {
                  const isSelected = selectedShopName === shop.shopName;
                  const balance = shop.balance;
                  const weeklySales = shop.weeklySales;
                  const weeklyCollections = shop.weeklyApprovedCollections;
                  const recovery = shop.recoveryPercentage;

                  const balanceColor =
                    balance > 0 ? "text-red-600" :
                    balance < 0 ? "text-blue-600" :
                    "text-slate-600";

                  const recoveryColor =
                    recovery >= 80 ? "text-green-600" :
                    recovery >= 50 ? "text-amber-600" :
                    "text-red-600";

                  return (
                    <tr
                      key={shop.shopId}
                      onClick={() => handleRowClick(shop.shopName)}
                      aria-selected={isSelected}
                      className={`transition-colors cursor-pointer ${
                        isSelected
                          ? "bg-emerald-50/70 shadow-[inset_3px_0_0_0_#10b981] hover:bg-emerald-50"
                          : "hover:bg-slate-50/80"
                      }`}
                    >
                      <td className="px-3.5 py-3 text-center text-xs font-semibold text-slate-500">
                        {isSelected && (
                          <span className="mr-1 inline-flex items-center justify-center">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          </span>
                        )}
                        {index + 1}
                      </td>
                      {/* One line per record: a long shop name used to wrap over
                          three lines and push the money columns out of
                          alignment. The table scrolls horizontally instead. */}
                      <td className="px-3.5 py-3 text-xs font-semibold whitespace-nowrap text-slate-700">
                        {shown(shop.shopName)}
                      </td>
                      <td className={`px-3.5 py-3 text-right text-xs font-bold whitespace-nowrap ${balanceColor}`}>{formatBalance(balance)}</td>
                      <td className="px-3.5 py-3 text-right text-xs font-bold whitespace-nowrap text-blue-600">{formatCurrency(weeklySales)}</td>
                      <td className="px-3.5 py-3 text-right text-xs font-bold whitespace-nowrap text-green-600">{formatCurrency(weeklyCollections)}</td>
                      <td className={`px-3.5 py-3 text-right text-xs font-bold whitespace-nowrap ${recoveryColor}`}>{recovery.toFixed(1)}%</td>
                      <td className="px-3.5 py-3 text-center text-xs font-medium whitespace-nowrap text-slate-600">{formatDate(shop.lastCollectionDate)}</td>
                      <td className="px-3.5 py-3 text-center">
                        {shop.overdueDays != null && shop.overdueDays > 0 ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-50 text-red-600 text-xs font-medium">
                            {shop.overdueDays}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-3.5 py-3 text-center">
                        <button
                          onClick={(e) => { e.stopPropagation(); onView(shop.shopName); }}
                          title={t("ops.collection.view_details")}
                          aria-label={t("ops.collection.view_details")}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-blue-600 hover:bg-blue-50 transition"
                        >
                          <Eye size={18} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {/* The cumulative that closes the register: every figure below is
                summed over the whole filtered set, never over this page. */}
            {overall && data.length > 0 && (
              <tfoot className="border-t-2 border-slate-300 bg-slate-50/90">
                <tr className="whitespace-nowrap text-xs font-extrabold text-slate-800">
                  <td className="px-3.5 py-3 text-center text-slate-400" aria-hidden="true">Σ</td>
                  <td className="px-3.5 py-3">
                    <span className="flex flex-col gap-0.5">
                      <span className="text-emerald-700">{t("ops.collection.overall_total")}</span>
                      <span className="text-[10px] font-semibold normal-case text-slate-500">
                        {overall.shops} {t("ops.collection.shops")} · {t("ops.collection.overall_scope")}
                      </span>
                    </span>
                  </td>
                  <td className={`px-3.5 py-3 text-right tabular-nums ${overallBalanceColor}`}>
                    {formatBalance(overall.balance)}
                  </td>
                  <td className="px-3.5 py-3 text-right tabular-nums text-blue-700">{money(overall.weeklySales)}</td>
                  <td className="px-3.5 py-3 text-right tabular-nums text-green-700">{money(overall.weeklyApprovedCollections)}</td>
                  <td className="px-3.5 py-3 text-right tabular-nums text-purple-700">{overall.recoveryPercentage.toFixed(1)}%</td>
                  <td className="px-3.5 py-3 text-center tabular-nums text-slate-700">{formatDate(overall.lastCollectionDate)}</td>
                  <td className="px-3.5 py-3 text-center">
                    {overall.overdueShops > 0 ? (
                      <span
                        title={`${overall.overdueShops} ${t("ops.collection.shops_overdue")}`}
                        className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-600"
                      >
                        {overall.overdueShops} {t("ops.collection.shops_overdue")}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-3.5 py-3" />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </>
  );
}

export default React.memo(PendingCollectionsTable);
