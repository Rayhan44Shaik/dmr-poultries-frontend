// src/modules/operations/mortality/components/TripDeliveryOutput.tsx
// SHOP-WISE DELIVERY OUTPUT for one completed trip — a simple, full-width table.
//
// The column headings are written ONCE in the header, so no glyph and no label
// is repeated on every shop line; the TOTAL row is pinned to the bottom and the
// header is pinned to the top, so a trip that delivered to two shops and one
// that delivered to forty read exactly the same way.
//
// Kept as its own component because it is the one part of the expanded trip
// panel that is pure presentation: given the rows, it renders them.

import { Scale, Store } from "lucide-react";
import type { MortalityDelivery } from "../services/mortalityAnalysisApi";
import { formatNumber, formatWeight } from "../../../../utils/format";
import { useI18n } from "../../../../i18n";

interface TripDeliveryOutputProps {
  deliveries: MortalityDelivery[];
  loading?: boolean;
}

export default function TripDeliveryOutput({ deliveries, loading = false }: TripDeliveryOutputProps) {
  const { t } = useI18n();
  const birdsTotal = deliveries.reduce((sum, row) => sum + (row.birds || 0), 0);
  const weightTotal = deliveries.reduce((sum, row) => sum + (row.weight || 0), 0);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/60 px-4 py-2">
        <h4 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
          <Store size={13} className="text-sky-500" aria-hidden="true" />
          {t("ops.mortality.detail.delivery_output")}
        </h4>
        {/* The count is server truth for this trip, so it is only claimed once
            the rows have landed — never as a "(0 shops)" placeholder. */}
        {!loading && deliveries.length > 0 && (
          <span className="rounded-full border border-sky-100 bg-white px-2 py-[1px] text-[10px] font-bold tabular-nums text-sky-700">
            {t(
              deliveries.length === 1 ? "ops.mortality.detail.shop_count_one" : "ops.mortality.detail.shop_count",
              { count: formatNumber(deliveries.length) }
            )}
          </span>
        )}
      </div>

      {loading ? (
        <div className="space-y-1.5 p-4">
          {[0, 1, 2].map((rowIndex) => (
            <div key={rowIndex} className="h-6 w-full animate-pulse rounded-md bg-slate-100" />
          ))}
        </div>
      ) : deliveries.length === 0 ? (
        <p className="px-4 py-3 text-[13px] text-slate-400">{t("ops.mortality.detail.no_deliveries")}</p>
      ) : (
        <div className="max-h-[320px] overflow-y-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur">
              <tr className="text-[11px] uppercase tracking-wider text-slate-500">
                <th className="w-12 px-3 py-2 text-center font-bold">#</th>
                <th className="px-3 py-2 text-left font-bold">{t("common.shop")}</th>
                <th className="px-3 py-2 text-right font-bold">{t("common.birds")}</th>
                <th className="px-3 py-2 text-right font-bold">{t("common.weight")}</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {deliveries.map((delivery, index) => (
                <tr key={delivery.id} className="odd:bg-white even:bg-slate-50/40">
                  <td className="px-3 py-1.5 text-center tabular-nums text-slate-400">
                    {delivery.serialNo ?? index + 1}
                  </td>
                  <td className="px-3 py-1.5 font-medium text-slate-700" title={delivery.shopName}>
                    {delivery.shopName}
                  </td>
                  <td className="px-3 py-1.5 text-right font-semibold tabular-nums text-sky-700">
                    {formatNumber(delivery.birds || 0)}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-slate-700">
                    {formatWeight(delivery.weight)}
                  </td>
                </tr>
              ))}
            </tbody>

            <tfoot className="sticky bottom-0 bg-sky-50/95 text-sky-800 backdrop-blur">
              <tr className="border-t border-sky-100 font-bold">
                <td className="px-3 py-2">
                  <Scale size={12} className="mx-auto text-sky-500" aria-hidden="true" />
                </td>
                <td className="px-3 py-2 text-[11px] uppercase tracking-wider">
                  {t("ops.mortality.detail.total_delivery")}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{formatNumber(birdsTotal)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatWeight(weightTotal)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
