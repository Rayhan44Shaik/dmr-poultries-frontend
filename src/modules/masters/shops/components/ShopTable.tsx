import MasterStatusBadge from "../../components/MasterStatusBadge";
import {
  Pencil,
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
import { uiActionIconMotionClass } from "../../../../shared/ui/uiTokens";

type ShopTableProps = {
  shops: Shop[];
  onEdit: (shop: Shop) => void;
  /** Offset of the first row in the full (filtered) list, so S.No stays global across pages. */
  startIndex?: number;
  /** Message shown when the list is empty (e.g. active search with no matches). */
  emptyMessage?: string;
  /** Only the record surface loads — the card, header and filters stay put. */
  loading?: boolean;
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

/* Trip List table anatomy: slate-50/80 head band, 12px bold uppercase heads
   with a glyph, 13px cells, py-5 row rhythm, zebra + hover. Heads may wrap
   to a second line at 150% / Telugu instead of clipping a fixed column. */
const thBase =
  "px-4 py-4 text-[12px] font-bold uppercase tracking-wider leading-tight align-middle";
const tdBase = "px-4 py-5 align-middle text-[13px] text-slate-600";
const COLS = 11;

function Head({
  icon,
  label,
  align = "left",
}: {
  icon: React.ReactNode;
  label: string;
  align?: "left" | "center" | "right";
}) {
  const justify =
    align === "center"
      ? "justify-center"
      : align === "right"
        ? "justify-end"
        : "";
  return (
    <div className={`flex items-center gap-1.5 ${justify}`}>
      <span className="text-slate-400 flex-shrink-0">{icon}</span>
      <span>{label}</span>
    </div>
  );
}

function ShopTable({
  shops,
  onEdit,
  startIndex = 0,
  emptyMessage,
  loading = false,
}: ShopTableProps) {
  const { t, language } = useI18n();

  // Telugu reaches the record text too, not just the chrome: shop names, owner
  // names, cities and association types are transliterated on the way out. The
  // stored values stay untouched (search, exports and sorting keep working on
  // the API data), and number-only cells are passed through unchanged.
  const shown = (value: string | null | undefined) =>
    localizeTripViewText(value ?? "", language);

  const showLoadingRow = loading && shops.length === 0;

  return (
    <div className="w-full overflow-x-auto">
      <table className="min-w-[80rem] w-full table-fixed text-[13px] text-left border-collapse">
        {/* rem widths scale with the font-size setting, so at 150% the columns
            grow with the text instead of squeezing it. */}
        <colgroup>
          <col className="w-[3.5rem]" />
          <col className="w-[14rem]" />
          <col className="w-[9rem]" />
          <col className="w-[8rem]" />
          <col className="w-[7.5rem]" />
          <col className="w-[8rem]" />
          <col className="w-[6rem]" />
          <col className="w-[9.5rem]" />
          <col className="w-[9.5rem]" />
          <col className="w-[6.5rem]" />
          <col className="w-[5rem]" />
        </colgroup>
        <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600">
          <tr>
            <th className={`${thBase} text-center`}>
              <Head
                icon={<Hash size={14} />}
                label={t("masters.shops.table.s_no")}
                align="center"
              />
            </th>
            <th className={thBase}>
              <Head
                icon={<Store size={14} />}
                label={t("masters.shops.table.shop_name")}
              />
            </th>
            <th className={thBase}>
              <Head
                icon={<User size={14} />}
                label={t("masters.shops.table.owner")}
              />
            </th>
            <th className={thBase}>
              <Head
                icon={<Phone size={14} />}
                label={t("masters.shops.table.mobile")}
              />
            </th>
            <th className={thBase}>
              <Head
                icon={<MapPin size={14} />}
                label={t("masters.shops.table.city")}
              />
            </th>
            <th className={thBase}>
              <Head
                icon={<Link2 size={14} />}
                label={t("masters.shops.table.association")}
              />
            </th>
            <th className={`${thBase} text-center`}>
              <Head
                icon={<Percent size={14} />}
                label={t("masters.shops.table.paper_rate")}
                align="center"
              />
            </th>
            <th className={`${thBase} text-right`}>
              <Head
                icon={<IndianRupee size={14} />}
                label={t("masters.shops.table.opening_balance")}
                align="right"
              />
            </th>
            <th className={`${thBase} text-right`}>
              <Head
                icon={<Wallet size={14} />}
                label={t("masters.shops.table.current_balance")}
                align="right"
              />
            </th>
            <th className={`${thBase} text-center`}>
              <Head
                icon={<ToggleLeft size={14} />}
                label={t("masters.shops.table.status")}
                align="center"
              />
            </th>
            <th className={`${thBase} text-center`}>
              <Head
                icon={<Settings2 size={14} />}
                label={t("masters.shops.table.action")}
                align="center"
              />
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {showLoadingRow && (
            <tr>
              <td
                colSpan={COLS}
                className="py-16 text-center text-sm font-medium text-slate-400"
              >
                <span
                  className="inline-flex items-center gap-2.5"
                  role="status"
                  aria-live="polite"
                >
                  <span
                    className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-emerald-600"
                    aria-hidden="true"
                  />
                  {t("masters.shops.loading")}
                </span>
              </td>
            </tr>
          )}
          {!showLoadingRow && shops.length === 0 && (
            <tr>
              <td
                colSpan={COLS}
                className="py-12 text-center text-slate-400 text-[13px] font-medium"
              >
                {emptyMessage ?? t("masters.shops.no_shops_found")}
              </td>
            </tr>
          )}
          {shops.map((shop, index) => {
            const hasAssociation = Boolean(shop.associationType?.trim());
            // The shop's live balance — the figure collections move.
            const liveBalance = Number(shop.currentBalance ?? 0);
            return (
              <tr
                key={shop.id}
                className={`transition-colors duration-150 hover:bg-slate-50/60 motion-safe:animate-[var(--animate-fade-in-up)] ${
                  index % 2 === 0 ? "bg-white" : "bg-slate-50/20"
                } ${loading ? "opacity-60" : ""}`}
                style={{ animationDelay: `${Math.min(index, 12) * 24}ms` }}
              >
                <td
                  className={`${tdBase} text-center tabular-nums font-medium text-slate-500`}
                >
                  {startIndex + index + 1}
                </td>

                <td className={tdBase}>
                  <span
                    className="block truncate font-bold text-slate-900"
                    title={shown(shop.shopName)}
                  >
                    {shown(shop.shopName)}
                  </span>
                  {shop.shopNumber ? (
                    <span className="block text-[11px] font-semibold tabular-nums text-emerald-600">
                      {shop.shopNumber}
                    </span>
                  ) : null}
                </td>

                <td className={`${tdBase} font-medium text-slate-700`}>
                  <span
                    className="block truncate"
                    title={shown(shop.ownerName)}
                  >
                    {shown(shop.ownerName) || "—"}
                  </span>
                </td>

                <td
                  className={`${tdBase} whitespace-nowrap tabular-nums font-medium text-slate-700`}
                >
                  {shop.phoneNumber || "—"}
                </td>

                <td className={`${tdBase} font-medium text-slate-700`}>
                  <span className="block truncate" title={shown(shop.city)}>
                    {shown(shop.city) || "—"}
                  </span>
                </td>

                <td className={tdBase}>
                  {hasAssociation ? (
                    <span
                      className="inline-flex max-w-full items-center rounded-md bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 ring-1 ring-inset ring-indigo-200"
                      title={shown(shop.associationType)}
                    >
                      <span className="truncate">
                        {shown(shop.associationType)}
                      </span>
                    </span>
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </td>

                <td className={`${tdBase} text-center tabular-nums`}>
                  <span
                    className={
                      shop.paperRate >= 1
                        ? "font-bold text-slate-800"
                        : "text-slate-300"
                    }
                  >
                    {shop.paperRate}
                  </span>
                </td>

                <td
                  className={`${tdBase} whitespace-nowrap text-right font-semibold tabular-nums text-slate-600`}
                >
                  {formatOpeningBalance(shop.openingBalance)}
                </td>

                <td
                  className={`${tdBase} whitespace-nowrap text-right font-bold tabular-nums ${
                    liveBalance > 0 ? "text-emerald-700" : "text-slate-800"
                  }`}
                >
                  {formatOpeningBalance(liveBalance)}
                </td>

                <td className={`${tdBase} text-center`}>
                  <MasterStatusBadge status={shop.status} />
                </td>

                <td className={`${tdBase} text-center`}>
                  <button
                    type="button"
                    onClick={() => onEdit(shop)}
                    className="group inline-flex h-8 w-8 items-center justify-center rounded-lg border border-blue-100 bg-blue-50/70 text-blue-600 transition-all hover:-translate-y-0.5 hover:bg-blue-100 hover:shadow-sm active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
                    title={t("masters.shops.table.edit_tooltip")}
                    aria-label={t("masters.shops.table.edit_tooltip")}
                  >
                    <span
                      className={`inline-flex ${uiActionIconMotionClass.edit}`}
                    >
                      <Pencil size={14} />
                    </span>
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default ShopTable;
