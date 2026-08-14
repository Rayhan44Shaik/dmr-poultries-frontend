import { Pencil, Trash2 } from "lucide-react";
import { useLanguage } from "../../../../providers/languageContext";
import type { Shop } from "../types/shop";

type ShopTableProps = {
  shops: Shop[];
  onEdit: (shop: Shop) => void;
  onDelete: (id: number) => void;
};

function ShopTable({ shops, onEdit, onDelete }: ShopTableProps) {
  const { t } = useLanguage();

  const th = (label: string) => (
    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">{label}</th>
  );
  const thCenter = (label: string) => (
    <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-slate-500">{label}</th>
  );
  const thRight = (label: string) => (
    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500">{label}</th>
  );

  return (
    <div className="overflow-x-auto rounded-xl bg-white shadow-sm border border-slate-200">
      <table className="min-w-full divide-y divide-slate-200">
        <thead className="bg-slate-50">
          <tr>
            {th(t("shops.shopNo"))}
            {th(t("shops.shopName"))}
            {th(t("shops.owner"))}
            {th(t("shops.village"))}
            {th(t("shops.phone"))}
            {thRight(t("shops.openingBalance"))}
            {th(t("common.status"))}
            {thCenter(t("common.actions"))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 bg-white">
          {[...shops]
            .sort((a, b) => (a.shopNo > b.shopNo ? 1 : -1))
            .map((shop) => (
              <tr key={shop.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 text-sm text-slate-600">{shop.shopNo}</td>
                <td className="px-4 py-3 text-sm font-medium text-slate-800">{shop.shopName}</td>
                <td className="px-4 py-3 text-sm text-slate-600">{shop.ownerName}</td>
                <td className="px-4 py-3 text-sm text-slate-600">{shop.village}</td>
                <td className="px-4 py-3 text-sm text-slate-600">{shop.phoneNumber}</td>
                <td className="px-4 py-3 text-right text-sm font-medium text-slate-700">
                  ₹{Number(shop.openingBalance || 0).toFixed(2)}
                </td>
                <td className="px-4 py-3 text-center">
                  <span
                    className={
                      "inline-block rounded-full px-3 py-0.5 text-xs font-medium " +
                      (shop.status === "Active" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700")
                    }
                  >
                    {shop.status === "Active" ? t("status.active") : t("status.inactive")}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={() => onEdit(shop)}
                      className="rounded p-1 text-blue-600 hover:bg-blue-50 transition-colors"
                      title={t("shops.edit")}
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => onDelete(shop.id)}
                      className="rounded p-1 text-red-600 hover:bg-red-50 transition-colors"
                      title={t("common.delete")}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          {shops.length === 0 && (
            <tr>
              <td colSpan={8} className="px-4 py-6 text-center text-sm text-slate-500">
                {t("common.noEntities")}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default ShopTable;
