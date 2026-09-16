// src/modules/operations/mortality/components/TripDeliveryOutput.tsx
// SHOP-WISE DELIVERY OUTPUT for one completed trip.
//
// A dense table, not a stack of badges. The column headings are written ONCE in
// the header, so no glyph and no label is repeated on every shop line — forty
// shops stay scannable and the panel stays short. The header pins while the body
// scrolls and the TOTAL row pins to the bottom, so the same layout works for a
// trip that delivered to two shops and one that delivered to forty.
//
// Kept as its own component because it is the one part of the expanded trip
// panel that is pure presentation: given the rows, it renders them.

import { Scale } from "lucide-react";
import type { MortalityDelivery } from "../services/mortalityAnalysisApi";
import { formatNumber, formatWeight } from "../../../../utils/format";
import { useI18n } from "../../../../i18n";

interface TripDeliveryOutputProps {
  deliveries: MortalityDelivery[];
}

export default function TripDeliveryOutput({ deliveries }: TripDeliveryOutputProps) {
  const { t } = useI18n();
  const birdsTotal = deliveries.reduce((sum, row) => sum + (row.birds || 0), 0);
  const weightTotal = deliveries.reduce((sum, row) => sum + (row.weight || 0), 0);

  return (
    <div className="max-h-[210px] overflow-y-auto rounded-lg border border-slate-100">
      <table className="w-full border-collapse text-[12px]">
        <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur">
          <tr className="text-[10px] uppercase tracking-wider text-slate-500">
            <th className="w-7 px-2 py-1.5 text-center font-bold">#</th>
            <th className="px-2 py-1.5 text-left font-bold">{t("common.shop")}</th>
            <th className="px-2 py-1.5 text-right font-bold">{t("common.birds")}</th>
            <th className="px-2 py-1.5 text-right font-bold">{t("common.weight")}</th>
          </tr>
        </thead>

        <tbody className="divide-y divide-slate-100">
          {deliveries.map((delivery, index) => (
            <tr key={delivery.id} className="odd:bg-white even:bg-slate-50/40">
              <td className="px-2 py-1 text-center tabular-nums text-slate-400">
                {delivery.serialNo ?? index + 1}
              </td>
              <td className="max-w-[150px] truncate px-2 py-1 font-medium text-slate-700" title={delivery.shopName}>
                {delivery.shopName}
              </td>
              <td className="px-2 py-1 text-right font-semibold tabular-nums text-sky-700">
                {formatNumber(delivery.birds || 0)}
              </td>
              <td className="px-2 py-1 text-right tabular-nums text-slate-700">
                {formatWeight(delivery.weight)}
              </td>
            </tr>
          ))}
        </tbody>

        <tfoot className="sticky bottom-0 bg-sky-50/95 text-sky-800 backdrop-blur">
          <tr className="border-t border-sky-100 font-bold">
            <td className="px-2 py-1.5">
              <Scale size={11} className="mx-auto text-sky-500" aria-hidden="true" />
            </td>
            <td className="px-2 py-1.5 text-[10px] uppercase tracking-wider">
              {t("ops.mortality.detail.total_delivery")}
            </td>
            <td className="px-2 py-1.5 text-right tabular-nums">{formatNumber(birdsTotal)}</td>
            <td className="px-2 py-1.5 text-right tabular-nums">{formatWeight(weightTotal)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
