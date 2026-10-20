import { Activity, Bird, Calendar, HeartPulse, IndianRupee, Package, Scale, Store, X } from "lucide-react";
import type { ShopSale } from "../types/shopSale";
import { formatTripListDay } from "../../vehicle-trips/utils/formatTripListDay";
import { cleanDeliveryShopName } from "../../vehicle-trips/utils/shopDisplayName";
import { formatSaleAmount, formatSaleRate, formatSaleWeight } from "../utils/shopSaleFormat";
import AppShellModal from "../../../../ui/AppShellModal";

interface Props {
  sale: ShopSale | null;
  deliveries: ShopSale[];
  onClose: () => void;
}

export default function ShopDeliveryTripViewModal({ sale, deliveries, onClose }: Props) {
  if (!sale) return null;
  const birds = deliveries.reduce((sum, row) => sum + Number(row.totalBirds || 0), 0);
  const weight = deliveries.reduce((sum, row) => sum + Number(row.totalWeight || 0), 0);
  const amount = deliveries.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const mortality = deliveries.reduce((sum, row) => sum + Number(row.mortality || 0), 0);
  const boxCount = deliveries.reduce((sum, row) => sum + (row.deliveryMode === "box" ? Number(row.selectedBoxCount || 0) : 0), 0);
  const modes = new Set(deliveries.map((row) => row.deliveryMode === "weight" ? "Weight" : "Box"));
  const deliveryMode = modes.size > 1 ? "Mixed" : (modes.values().next().value ?? "Box");
  const averageWeight = birds > 0 ? weight / birds : 0;

  return (
    <AppShellModal open onClose={onClose} panelClassName="bg-white">
      <section className="flex h-full w-full flex-col overflow-hidden rounded-2xl bg-white" aria-modal="true" role="dialog" aria-label={`Shop deliveries for ${sale.tripNo}`}>
        <header className="flex items-center justify-between border-b border-slate-200 bg-gradient-to-r from-emerald-50 via-white to-blue-50 px-5 py-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">Read-only · Step 4 Shop Delivery</p>
            <h2 className="mt-1 text-xl font-extrabold text-slate-900">Trip {sale.tripNo}</h2>
            <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-slate-500"><Calendar size={13} />{formatTripListDay(sale.tripDate)} · {deliveries.length} deliveries</p>
          </div>
          <button type="button" onClick={onClose} className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50" aria-label="Close"><X size={18} /></button>
        </header>

        <div className="grid grid-cols-2 gap-3 border-b border-slate-100 bg-slate-50/60 p-4 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-8">
          {[
            { label: "Shops", value: deliveries.length, Icon: Store, tone: "text-amber-600" },
            { label: "Birds", value: birds.toLocaleString(), Icon: Bird, tone: "text-cyan-600" },
            { label: "Weight", value: `${formatSaleWeight(weight)} KG`, Icon: Scale, tone: "text-orange-600" },
            { label: "Mortality", value: mortality.toLocaleString(), Icon: HeartPulse, tone: "text-rose-600" },
            { label: "Delivery Mode", value: deliveryMode, Icon: Package, tone: "text-indigo-600" },
            { label: "Boxes", value: boxCount.toLocaleString(), Icon: Package, tone: "text-blue-600" },
            { label: "Avg Weight / Bird", value: `${averageWeight.toFixed(2)} KG`, Icon: Activity, tone: "text-cyan-600" },
            { label: "Amount", value: formatSaleAmount(amount), Icon: IndianRupee, tone: "text-emerald-600" },
          ].map(({ label, value, Icon, tone }) => <div key={label} className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500"><Icon size={14} className={tone}/>{label}</div><div className="mt-1 text-lg font-extrabold text-slate-900">{value}</div></div>)}
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          <table className="min-w-full border-separate border-spacing-0 text-[13px]">
            <thead className="sticky top-0 z-20 text-[11px] font-bold uppercase tracking-wider text-slate-600 shadow-sm"><tr>{["#", "Shop", "Sub Shop", "Mode", "Boxes", "Birds", "Weight (KG)", "Avg Wt / Bird", "Mortality", "Rate", "Amount", "Remark"].map((heading, index) => <th key={heading} className={`border-b border-slate-200 bg-slate-50 px-4 py-3.5 ${index === 1 || index === 2 || index === 11 ? "text-left" : "text-center"}`}>{heading}</th>)}</tr></thead>
            <tbody>{deliveries.map((row, index) => { const rowBirds = Number(row.totalBirds || 0); const rowWeight = Number(row.totalWeight || 0); const isBox = row.deliveryMode !== "weight"; return <tr key={row.id} className="hover:bg-slate-50/70"><td className="border-b border-slate-100 px-4 py-4 text-center text-slate-500">{index + 1}</td><td className="border-b border-slate-100 px-4 py-4 font-bold text-slate-800">{cleanDeliveryShopName(row.shopName) || "—"}</td><td className="border-b border-slate-100 px-4 py-4 font-medium text-indigo-600">{row.subShopName?.trim() || "—"}</td><td className="border-b border-slate-100 px-4 py-4 text-center"><span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${isBox ? "bg-blue-50 text-blue-700" : "bg-violet-50 text-violet-700"}`}>{isBox ? "Box" : "Weight"}</span></td><td className="border-b border-slate-100 px-4 py-4 text-center font-bold text-blue-700">{isBox ? Number(row.selectedBoxCount || 0).toLocaleString() : "—"}</td><td className="border-b border-slate-100 px-4 py-4 text-center font-bold text-cyan-700">{rowBirds.toLocaleString()}</td><td className="border-b border-slate-100 px-4 py-4 text-center font-bold text-orange-600">{formatSaleWeight(rowWeight)}</td><td className="border-b border-slate-100 px-4 py-4 text-center font-bold text-cyan-700">{rowBirds > 0 ? `${(rowWeight / rowBirds).toFixed(2)} KG` : "—"}</td><td className="border-b border-slate-100 px-4 py-4 text-center font-bold text-rose-600"><div className="flex flex-col items-center justify-center leading-tight"><span>{Number(row.mortality || 0).toLocaleString()}</span>{isBox && Number(row.mortalityWeight || 0) > 0 ? <span className="mt-1 text-[10px] font-semibold text-rose-500">{formatSaleWeight(Number(row.mortalityWeight))} KG</span> : null}</div></td><td className="border-b border-slate-100 px-4 py-4 text-center font-bold text-violet-600">{formatSaleRate(row.rate)}</td><td className="border-b border-slate-100 px-4 py-4 text-center font-bold text-slate-800">{formatSaleAmount(row.amount)}</td><td className="max-w-[240px] border-b border-slate-100 px-4 py-4 text-slate-600">{row.remark?.trim() || "—"}</td></tr>; })}</tbody>
          </table>
        </div>
      </section>
    </AppShellModal>
  );
}
