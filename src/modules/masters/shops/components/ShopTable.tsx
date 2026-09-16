import MasterStatusBadge from "../../components/MasterStatusBadge";
import { Pencil } from "lucide-react";
import type { Shop } from "../types/shop";
import { useI18n } from "../../../../i18n";

type ShopTableProps = {
  shops: Shop[];
  onEdit: (shop: Shop) => void;
  /** Offset of the first row in the full (filtered) list, so S.No stays global across pages. */
  startIndex?: number;
  /** Message shown when the list is empty (e.g. active search with no matches). */
  emptyMessage?: string;
};

const inrFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatOpeningBalance(value: number | null | undefined): string {
  return inrFormatter.format(Number(value ?? 0));
}

const thBase =
  "px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap";
const tdBase = "px-3 py-2.5 align-middle text-sm text-slate-600";

function ShopTable({
  shops,
  onEdit,
  startIndex = 0,
  emptyMessage,
}: ShopTableProps) {
  const { t } = useI18n();

  // Rows arrive already ordered and paginated from ShopsPage; render as given
  // so S.No lines up with the global position in the filtered list.
  const orderedShops = shops;

  return (
    <div className="master-table master-table--shops">
      <table className="w-full min-w-[1144px] table-fixed border-collapse">
        {/* Fixed, readable minimum column widths keep numbers, status badges and
            actions aligned. Narrow screens scroll the table, not the page. */}
        <colgroup>
          <col style={{ width: 56 }} />
          <col style={{ width: 200 }} />
          <col style={{ width: 144 }} />
          <col style={{ width: 120 }} />
          <col style={{ width: 104 }} />
          <col style={{ width: 112 }} />
          <col style={{ width: 96 }} />
          <col style={{ width: 144 }} />
          <col style={{ width: 104 }} />
          <col style={{ width: 64 }} />
        </colgroup>
        <thead className="bg-slate-50">
          <tr className="border-b border-slate-200">
            <th className={`${thBase} text-center`}>
              {t("masters.shops.table.s_no")}
            </th>
            <th className={thBase}>{t("masters.shops.table.shop_name")}</th>
            <th className={thBase}>{t("masters.shops.table.owner")}</th>
            <th className={thBase}>{t("masters.shops.table.mobile")}</th>
            <th className={thBase}>{t("masters.shops.table.city")}</th>
            <th className={thBase}>{t("masters.shops.table.association")}</th>
            <th className={`${thBase} text-center`}>
              {t("masters.shops.table.paper_rate")}
            </th>
            {/* Balance, not just the opening figure: the current balance is
              * what collections move, so it leads — the opening balance it was
              * computed from stays underneath as the audit trail. */}
            <th className={`${thBase} text-right`}>
              {t("masters.shops.table.balance")}
            </th>
            <th className={`${thBase} text-center`}>
              {t("masters.shops.table.status")}
            </th>
            <th className={`${thBase} text-center`}>
              {t("masters.shops.table.action")}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {orderedShops.map((shop, index) => {
            const hasAssociation = Boolean(shop.associationType?.trim());
            // The shop's live balance — the figure collections move.
            const liveBalance = Number(shop.currentBalance ?? 0);
            return (
              <tr
                key={shop.id}
                className="h-[60px] transition-colors hover:bg-slate-50/70"
              >
                <td
                  className={`${tdBase} text-center tabular-nums text-slate-400`}
                >
                  {startIndex + index + 1}
                </td>

                <td className={tdBase}>
                  <span
                    className="block truncate font-semibold text-slate-800"
                    title={shop.shopName}
                  >
                    {shop.shopName}
                  </span>
                </td>

                <td className={tdBase}>
                  <span className="block truncate" title={shop.ownerName}>
                    {shop.ownerName || "—"}
                  </span>
                </td>

                <td className={tdBase}>
                  <span className="block whitespace-nowrap tabular-nums text-[13px] text-slate-700">
                    {shop.phoneNumber || "—"}
                  </span>
                </td>

                <td className={tdBase}>
                  <span className="block truncate" title={shop.city}>
                    {shop.city || "—"}
                  </span>
                </td>

                <td className={tdBase}>
                  {hasAssociation ? (
                    <span className="inline-flex items-center rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 ring-1 ring-inset ring-indigo-200">
                      {shop.associationType}
                    </span>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>

                <td className={`${tdBase} text-center`}>
                  <span
                    className={
                      shop.paperRate >= 1
                        ? "font-medium text-slate-700"
                        : "text-slate-400"
                    }
                  >
                    {shop.paperRate}
                  </span>
                </td>

                <td className={`${tdBase} whitespace-nowrap text-right tabular-nums`}>
                  <span
                    className={`block font-semibold ${
                      liveBalance > 0 ? "text-emerald-700" : "text-slate-700"
                    }`}
                    title={t("masters.shops.table.current_balance")}
                  >
                    {formatOpeningBalance(liveBalance)}
                  </span>
                  <span className="block text-[11px] font-medium text-slate-400">
                    {t("masters.shops.table.opening_short")} {formatOpeningBalance(shop.openingBalance)}
                  </span>
                </td>

                <td className={`${tdBase} text-center`}>
                  <MasterStatusBadge status={shop.status} />
                </td>

                <td className={`${tdBase} text-center`}>
                  <button
                    type="button"
                    onClick={() => onEdit(shop)}
                    className="rounded-md p-1.5 text-blue-600 transition-colors hover:bg-blue-50"
                    title={t("masters.shops.table.edit_tooltip")}
                    aria-label={t("masters.shops.table.edit_tooltip")}
                  >
                    <Pencil size={14} />
                  </button>
                </td>
              </tr>
            );
          })}
          {orderedShops.length === 0 && (
            <tr>
              <td
                colSpan={10}
                className="px-4 py-6 text-center text-sm text-slate-500"
              >
                {emptyMessage ?? t("masters.shops.no_shops_found")}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default ShopTable;
