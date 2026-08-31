import { Pencil } from "lucide-react";
import type { Shop } from "../types/shop";
import { useI18n } from "../../../../i18n";

type ShopTableProps = {
  shops: Shop[];
  onEdit: (shop: Shop) => void;
  /** Offset of the first row in the full (filtered) list, so S.No stays global across pages. */
  startIndex?: number;
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

function ShopTable({ shops, onEdit, startIndex = 0 }: ShopTableProps) {
  const { t } = useI18n();

  // Rows arrive already ordered and paginated from ShopsPage; render as given
  // so S.No lines up with the global position in the filtered list.
  const orderedShops = shops;

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full min-w-[1180px] border-collapse">
        <colgroup>
          <col style={{ width: "56px" }} />
          <col style={{ width: "132px" }} />
          <col style={{ width: "auto" }} />
          <col style={{ width: "180px" }} />
          <col style={{ width: "196px" }} />
          <col style={{ width: "144px" }} />
          <col style={{ width: "130px" }} />
          <col style={{ width: "92px" }} />
          <col style={{ width: "152px" }} />
          <col style={{ width: "112px" }} />
          <col style={{ width: "72px" }} />
        </colgroup>
        <thead className="bg-slate-50">
          <tr className="border-b border-slate-200">
            <th className={`${thBase} text-center`}>{t("masters.shops.table.s_no")}</th>
            <th className={thBase}>{t("masters.shops.table.shop_number")}</th>
            <th className={thBase}>{t("masters.shops.table.shop_name")}</th>
            <th className={thBase}>{t("masters.shops.table.owner")}</th>
            <th className={thBase}>{t("masters.shops.table.mobile")}</th>
            <th className={thBase}>{t("masters.shops.table.city")}</th>
            <th className={thBase}>{t("masters.shops.table.association")}</th>
            <th className={`${thBase} text-center`}>{t("masters.shops.table.paper_rate")}</th>
            <th className={`${thBase} text-right`}>{t("masters.shops.table.opening_balance")}</th>
            <th className={`${thBase} text-center`}>{t("masters.shops.table.status")}</th>
            <th className={`${thBase} text-center`}>{t("masters.shops.table.action")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {orderedShops.map((shop, index) => {
            const isActive = shop.status === "Active";
            const hasAssociation = Boolean(shop.associationType?.trim());
            const hasSecondary = Boolean(shop.secondaryPhoneNumber?.trim());
            const hasEmail = Boolean(shop.email?.trim());
            return (
              <tr key={shop.id} className="h-[60px] transition-colors hover:bg-slate-50/70">
                <td className={`${tdBase} text-center tabular-nums text-slate-400`}>
                  {startIndex + index + 1}
                </td>

                <td className={`${tdBase} whitespace-nowrap`}>
                  <span className="font-mono text-[13px] font-semibold text-slate-700">
                    {shop.shopNumber || "—"}
                  </span>
                </td>

                <td className={tdBase}>
                  <span
                    className="block max-w-[280px] truncate font-semibold text-slate-800"
                    title={shop.shopName}
                  >
                    {shop.shopName}
                  </span>
                </td>

                <td className={tdBase}>
                  <span className="block max-w-[170px] truncate" title={shop.ownerName}>
                    {shop.ownerName || "—"}
                  </span>
                </td>

                <td className={tdBase}>
                  <span className="block whitespace-nowrap font-mono text-[13px] text-slate-700">
                    {shop.phoneNumber || "—"}
                  </span>
                  {(hasSecondary || hasEmail) && (
                    <span className="mt-0.5 flex flex-col gap-0.5 text-[11px] leading-tight text-slate-400">
                      {hasSecondary && (
                        <span className="whitespace-nowrap font-mono">
                          {t("masters.shops.table.secondary_mobile")}: {shop.secondaryPhoneNumber}
                        </span>
                      )}
                      {hasEmail && (
                        <span className="block max-w-[184px] truncate" title={shop.email}>
                          {shop.email}
                        </span>
                      )}
                    </span>
                  )}
                </td>

                <td className={tdBase}>
                  <span className="block max-w-[132px] truncate" title={shop.city}>
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

                <td className={`${tdBase} whitespace-nowrap text-right font-medium tabular-nums text-slate-700`}>
                  {formatOpeningBalance(shop.openingBalance)}
                </td>

                <td className={`${tdBase} text-center`}>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      isActive
                        ? "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200"
                        : "bg-slate-100 text-slate-500 ring-1 ring-inset ring-slate-200"
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        isActive ? "bg-emerald-500" : "bg-slate-400"
                      }`}
                    />
                    {shop.status}
                  </span>
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
              <td colSpan={11} className="px-4 py-6 text-center text-sm text-slate-500">
                {t("masters.shops.no_shops_found")}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default ShopTable;
