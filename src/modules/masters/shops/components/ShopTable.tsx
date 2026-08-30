import { Pencil } from "lucide-react";
import type { Shop } from "../types/shop";
import { useI18n } from "../../../../i18n";

type ShopTableProps = {
  shops: Shop[];
  onEdit: (shop: Shop) => void;
};

function ShopTable({ shops, onEdit }: ShopTableProps) {
  const { t } = useI18n();
  return (
    <div className="overflow-x-auto rounded-xl bg-white shadow-sm border border-slate-200">
      <table className="min-w-full divide-y divide-slate-200">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-slate-500 w-12">
              {t("masters.shops.table.s_no")}
            </th>
            <th className="px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
              {t("masters.shops.table.shop_name")}
            </th>
            <th className="px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
              {t("masters.shops.table.owner")}
            </th>
            <th className="px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
              {t("masters.shops.table.mobile_no")}
            </th>
            <th className="px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-slate-500 hidden md:table-cell">
              {t("masters.shops.table.city")}
            </th>
            <th className="px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-slate-500 hidden lg:table-cell">
              {t("masters.shops.table.association_type")}
            </th>
            <th className="px-3 py-2.5 text-center text-xs font-medium uppercase tracking-wider text-slate-500 w-24">
              {t("masters.shops.table.paper_rate")}
            </th>
            <th className="px-3 py-2.5 text-right text-xs font-medium uppercase tracking-wider text-slate-500 w-36">
              {t("masters.shops.table.opening_balance")}
            </th>
            <th className="px-3 py-2.5 text-center text-xs font-medium uppercase tracking-wider text-slate-500 w-24">
              {t("masters.shops.table.status")}
            </th>
            <th className="px-3 py-2.5 text-center text-xs font-medium uppercase tracking-wider text-slate-500 w-16">
              {t("masters.shops.table.action")}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 bg-white">
          {[...shops]
            .sort((a, b) => (a.shopNo > b.shopNo ? 1 : -1))
            .map((shop, index) => (
            <tr key={shop.id} className="hover:bg-slate-50 transition-colors">
              <td className="px-3 py-2.5 text-sm text-slate-500">{index + 1}</td>
              <td className="px-3 py-2.5 text-sm font-medium text-slate-800">{shop.shopName}</td>
              <td className="px-3 py-2.5 text-sm text-slate-600">{shop.ownerName}</td>
              <td className="px-3 py-2.5 text-sm text-slate-600 font-mono">{shop.phoneNumber}</td>
              <td className="px-3 py-2.5 text-sm text-slate-600 hidden md:table-cell">{shop.city}</td>
              <td className="px-3 py-2.5 text-sm text-slate-600 hidden lg:table-cell">{shop.associationType || "—"}</td>
              <td className="px-3 py-2.5 text-center text-sm font-medium text-slate-700">{shop.paperRate}</td>
              <td className="px-3 py-2.5 text-right text-sm font-medium text-slate-700">
                ₹{Number(shop.openingBalance || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
              <td className="px-3 py-2.5 text-center">
                <span
                  className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    shop.status === "Active"
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {shop.status}
                </span>
              </td>
              <td className="px-3 py-2.5 text-center">
                <button
                  onClick={() => onEdit(shop)}
                  className="rounded p-1.5 text-blue-600 hover:bg-blue-50 transition-colors"
                  title={t("masters.shops.table.edit_tooltip") || "Edit Shop"}
                >
                  <Pencil size={14} />
                </button>
              </td>
            </tr>
          ))}
          {shops.length === 0 && (
            <tr>
              <td colSpan={10} className="px-4 py-6 text-center text-sm text-slate-500">
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