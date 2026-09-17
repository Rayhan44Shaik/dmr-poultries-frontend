import MasterStatusBadge from "../../components/MasterStatusBadge";
import {
  Hash,
  Store,
  User,
  Phone,
  MapPin,
  Link2,
  Percent,
  IndianRupee,
  Wallet,
  ToggleLeft,
  Settings2,
} from "lucide-react";
import type { Shop } from "../types/shop";
import { useI18n } from "../../../../i18n";
import { localizeTripViewText } from "../../../operations/vehicle-trips/utils/tripViewLocalization";
import {
  MasterTable,
  MasterThead,
  MasterTh,
  MasterLoadingRow,
  MasterEmptyRow,
  MasterEditButton,
} from "../../components/MasterDirectory";
import {
  masterTdClass,
  masterNameTdClass,
  masterRowClass,
  masterRowStyle,
  masterHeadTint as tint,
} from "../../components/masterTableStyles";

type ShopTableProps = {
  shops: Shop[];
  onEdit: (shop: Shop) => void;
  /** Offset of the first row in the full (filtered) list, so S.No stays global across pages. */
  startIndex?: number;
  emptyMessage?: string;
  loading?: boolean;
};

const inrFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatInr(value: number | null | undefined): string {
  return inrFormatter.format(Number(value ?? 0));
}

const COLS = 11;

function ShopTable({
  shops,
  onEdit,
  startIndex = 0,
  emptyMessage,
  loading = false,
}: ShopTableProps) {
  const { t, language } = useI18n();
  // Telugu reaches the record text too; stored values stay untouched.
  const shown = (value: string | null | undefined) =>
    localizeTripViewText(value ?? "", language);
  const showLoadingRow = loading && shops.length === 0;

  return (
    <MasterTable minWidth="min-w-[80rem]">
      <colgroup>
        <col className="w-[3.5rem]" />
        <col className="w-[14rem]" />
        <col className="w-[9rem]" />
        <col className="w-[8rem]" />
        <col className="w-[7.5rem]" />
        <col className="w-[8rem]" />
        <col className="w-[6rem]" />
        <col className="w-[10rem]" />
        <col className="w-[9.5rem]" />
        <col className="w-[6.5rem]" />
        <col className="w-[5rem]" />
      </colgroup>
      <MasterThead>
        <MasterTh
          icon={Hash}
          iconClass={tint.number}
          label={t("masters.shops.table.s_no")}
          align="center"
        />
        <MasterTh
          icon={Store}
          iconClass={tint.name}
          label={t("masters.shops.table.shop_name")}
        />
        <MasterTh
          icon={User}
          iconClass={tint.person}
          label={t("masters.shops.table.owner")}
        />
        <MasterTh
          icon={Phone}
          iconClass={tint.phone}
          label={t("masters.shops.table.mobile")}
        />
        <MasterTh
          icon={MapPin}
          iconClass={tint.place}
          label={t("masters.shops.table.city")}
        />
        <MasterTh
          icon={Link2}
          iconClass={tint.tag}
          label={t("masters.shops.table.association")}
        />
        <MasterTh
          icon={Percent}
          iconClass={tint.rate}
          label={t("masters.shops.table.paper_rate")}
          align="center"
        />
        <MasterTh
          icon={IndianRupee}
          iconClass={tint.money}
          label={t("masters.shops.table.opening_balance")}
          align="right"
        />
        <MasterTh
          icon={Wallet}
          iconClass={tint.balance}
          label={t("masters.shops.table.current_balance")}
          align="right"
        />
        <MasterTh
          icon={ToggleLeft}
          iconClass={tint.status}
          label={t("masters.shops.table.status")}
          align="center"
        />
        <MasterTh
          icon={Settings2}
          iconClass={tint.action}
          label={t("masters.shops.table.action")}
          align="center"
        />
      </MasterThead>
      <tbody className="divide-y divide-slate-100">
        {showLoadingRow && (
          <MasterLoadingRow colSpan={COLS} label={t("masters.shops.loading")} />
        )}
        {!showLoadingRow && shops.length === 0 && (
          <MasterEmptyRow
            colSpan={COLS}
            label={emptyMessage ?? t("masters.shops.no_shops_found")}
          />
        )}
        {shops.map((shop, index) => {
          const hasAssociation = Boolean(shop.associationType?.trim());
          const liveBalance = Number(shop.currentBalance ?? 0);
          return (
            <tr
              key={shop.id}
              className={masterRowClass(index, loading)}
              style={masterRowStyle(index)}
            >
              <td
                className={`${masterTdClass} text-center tabular-nums text-slate-500`}
              >
                {startIndex + index + 1}
              </td>
              <td className={masterNameTdClass}>
                <span className="block truncate">{shown(shop.shopName)}</span>
                {shop.shopNumber ? (
                  <span className="block text-[11px] tabular-nums text-emerald-600">
                    {shop.shopNumber}
                  </span>
                ) : null}
              </td>
              <td className={masterTdClass}>
                <span className="block truncate">
                  {shown(shop.ownerName) || "—"}
                </span>
              </td>
              <td className={`${masterTdClass} whitespace-nowrap tabular-nums`}>
                {shop.phoneNumber || "—"}
              </td>
              <td className={masterTdClass}>
                <span className="block truncate">
                  {shown(shop.city) || "—"}
                </span>
              </td>
              <td className={masterTdClass}>
                {hasAssociation ? (
                  <span className="inline-flex max-w-full items-center rounded-md bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700 ring-1 ring-inset ring-indigo-200">
                    <span className="truncate">
                      {shown(shop.associationType)}
                    </span>
                  </span>
                ) : (
                  <span className="text-slate-300">—</span>
                )}
              </td>
              <td className={`${masterTdClass} text-center tabular-nums`}>
                <span
                  className={
                    shop.paperRate >= 1 ? "text-slate-700" : "text-slate-300"
                  }
                >
                  {shop.paperRate}
                </span>
              </td>
              <td
                className={`${masterTdClass} whitespace-nowrap text-right tabular-nums`}
              >
                {formatInr(shop.openingBalance)}
              </td>
              <td
                className={`${masterTdClass} whitespace-nowrap text-right tabular-nums font-medium ${
                  liveBalance > 0 ? "text-emerald-700" : "text-slate-700"
                }`}
              >
                {formatInr(liveBalance)}
              </td>
              <td className={`${masterTdClass} text-center`}>
                <MasterStatusBadge status={shop.status} />
              </td>
              <td className={`${masterTdClass} text-center`}>
                <MasterEditButton
                  onClick={() => onEdit(shop)}
                  ariaLabel={t("masters.shops.table.edit_tooltip")}
                />
              </td>
            </tr>
          );
        })}
      </tbody>
    </MasterTable>
  );
}

export default ShopTable;
