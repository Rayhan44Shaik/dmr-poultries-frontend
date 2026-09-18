// src/modules/fleet-operations/components/analytics/AttentionSection.tsx
// ---------------------------------------------------------------------------
// Fleet Insights — presented the same way as the Cost Analysis card:
// summary tiles up top, then ranked insight rows with a number chip, a share
// ring (each percentage computed live from the same stats slice), the detail
// line and a value pill on the right.
// ---------------------------------------------------------------------------
import { memo, useMemo } from 'react';
import { CheckCircle2, Fuel, Gauge, Truck, Wrench } from 'lucide-react';
import type { AnalyticsVehicleStat } from '../../types/analytics';
import { formatCurrencyCompact } from '../../utils/formatters';
import { formatVehicleNumber } from '../../../../utils/format';
import ShareRing from './ShareRing';

interface AttentionItem {
  id: string;
  icon: typeof Truck;
  /** Share shown inside the ring — always derived from the same stats. */
  percent: number;
  ringColor: string;
  chipTone: string;
  pillTone: string;
  title: string;
  detail: string;
  value: string;
}

interface AttentionSectionProps {
  stats: AnalyticsVehicleStat[];
}

const AttentionSection = ({ stats }: AttentionSectionProps) => {
  const { items, idleCount, lowMileageCount } = useMemo(() => {
    const list: AttentionItem[] = [];

    const withActivity = stats.filter((row) => row.trips > 0 || row.distance > 0);

    const idle = stats
      .filter((row) => row.trips === 0 && row.distance === 0)
      .sort((a, b) => a.vehicleNumber.localeCompare(b.vehicleNumber));
    const idleTop = idle.slice(0, 4);
    if (idleTop.length > 0) {
      list.push({
        id: 'low-utilization',
        icon: Truck,
        percent: stats.length > 0 ? (idle.length / stats.length) * 100 : 0,
        ringColor: '#64748b',
        chipTone: 'bg-slate-100 text-slate-600 ring-slate-200',
        pillTone: 'bg-slate-100 text-slate-600 ring-slate-200',
        title: `${idleTop.length} vehicle${idleTop.length === 1 ? '' : 's'} with no trips`,
        detail: idleTop.map((row) => formatVehicleNumber(row.vehicleNumber)).join(', '),
        value: 'No activity',
      });
    }

    const active = withActivity.filter((row) => row.distance > 0 && row.fuelLitres > 0);
    const fleetAvg =
      active.length > 0 ? active.reduce((sum, row) => sum + row.mileage, 0) / active.length : 0;
    let belowAvgCount = 0;
    if (fleetAvg > 0) {
      const low = active
        .filter((row) => row.mileage > 0 && row.mileage < fleetAvg)
        .sort((a, b) => a.mileage - b.mileage);
      belowAvgCount = low.length;
      const lowTop = low.slice(0, 4);
      if (lowTop.length > 0) {
        list.push({
          id: 'low-mileage',
          icon: Gauge,
          percent: active.length > 0 ? (low.length / active.length) * 100 : 0,
          ringColor: '#f59e0b',
          chipTone: 'bg-amber-50 text-amber-700 ring-amber-100',
          pillTone: 'bg-amber-50 text-amber-700 ring-amber-100',
          title: `${lowTop.length} vehicle${lowTop.length === 1 ? '' : 's'} below fleet-average mileage`,
          detail: `${lowTop.map((row) => formatVehicleNumber(row.vehicleNumber)).join(', ')} (fleet avg ${fleetAvg.toFixed(2)} km/l)`,
          value: 'Efficiency',
        });
      }
    }

    const totalFuelCost = stats.reduce((sum, row) => sum + (row.fuelCost || 0), 0);
    const highFuel = [...stats]
      .filter((row) => row.fuelCost > 0)
      .sort((a, b) => b.fuelCost - a.fuelCost)
      .slice(0, 3);
    if (highFuel.length > 0) {
      list.push({
        id: 'high-fuel',
        icon: Fuel,
        percent: totalFuelCost > 0 ? (highFuel[0].fuelCost / totalFuelCost) * 100 : 0,
        ringColor: '#0ea5e9',
        chipTone: 'bg-sky-50 text-sky-700 ring-sky-100',
        pillTone: 'bg-sky-50 text-sky-700 ring-sky-100',
        title: 'Highest fuel spend',
        detail: highFuel
          .map((row) => `${formatVehicleNumber(row.vehicleNumber)} (${formatCurrencyCompact(row.fuelCost)})`)
          .join(', '),
        value: formatCurrencyCompact(highFuel[0].fuelCost),
      });
    }

    const totalMaintCost = stats.reduce((sum, row) => sum + (row.maintenanceCost || 0), 0);
    const highMaint = [...stats]
      .filter((row) => row.maintenanceCost > 0)
      .sort((a, b) => b.maintenanceCost - a.maintenanceCost)
      .slice(0, 3);
    if (highMaint.length > 0) {
      list.push({
        id: 'high-maintenance',
        icon: Wrench,
        percent: totalMaintCost > 0 ? (highMaint[0].maintenanceCost / totalMaintCost) * 100 : 0,
        ringColor: '#8b5cf6',
        chipTone: 'bg-violet-50 text-violet-700 ring-violet-100',
        pillTone: 'bg-violet-50 text-violet-700 ring-violet-100',
        title: 'Highest maintenance cost',
        detail: highMaint
          .map((row) => `${formatVehicleNumber(row.vehicleNumber)} (${formatCurrencyCompact(row.maintenanceCost)})`)
          .join(', '),
        value: formatCurrencyCompact(highMaint[0].maintenanceCost),
      });
    }

    return { items: list, idleCount: idle.length, lowMileageCount: belowAvgCount };
  }, [stats]);

  if (stats.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 py-10 text-sm font-medium text-slate-400">
        No fleet data to review.
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4">
        <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-emerald-600" />
        <p className="text-sm font-semibold text-emerald-800">All clear</p>
      </div>
    );
  }

  const tiles: Array<[string, string, string, string]> = [
    ['Insights', String(items.length), 'border-violet-200 bg-violet-50/70 text-violet-700', 'Attention items spotted'],
    ['Idle', String(idleCount), 'border-slate-200 bg-slate-50/80 text-slate-700', 'Vehicles with no trips'],
    ['Below Avg', String(lowMileageCount), 'border-amber-200 bg-amber-50/70 text-amber-700', 'Vehicles below fleet-average mileage'],
  ];

  return (
    <div className="flex h-full flex-col">
      <div className="grid grid-cols-3 gap-1.5">
        {tiles.map(([label, value, tone, tip]) => (
          <div key={label} className={`min-w-0 rounded-lg border px-2 py-1 text-center ${tone}`} title={tip}>
            <span className="block truncate text-[8.5px] font-black uppercase tracking-wide opacity-60">
              {label}
            </span>
            <strong className="block truncate text-[12.5px] font-black tabular-nums">{value}</strong>
          </div>
        ))}
      </div>

      <div className="mt-2 space-y-1.5">
        {items.map((item, index) => (
          <article
            key={item.id}
            className="share-card-in group relative min-w-0 rounded-xl border border-slate-100 bg-gradient-to-r from-white to-slate-50/60 px-2.5 py-1.5 shadow-xs transition-colors duration-150 hover:from-slate-50/70 hover:to-white"
            style={{ animationDelay: `${index * 80}ms` }}
            title={`${item.title} — ${item.detail}`}
          >
            <div className="grid min-w-0 grid-cols-[1.35rem_3.65rem_minmax(0,1fr)_auto] items-center gap-1.5">
              <span
                className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full text-[9.5px] font-black tabular-nums ring-1 ring-inset ${item.chipTone}`}
              >
                {index + 1}
              </span>
              <ShareRing value={item.percent} color={item.ringColor} />
              <div className="min-w-0">
                <p className="flex min-w-0 items-center gap-1 truncate text-[12.5px] font-medium leading-tight text-slate-700 transition-colors group-hover:text-slate-900">
                  <item.icon className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                  <span className="truncate">{item.title}</span>
                </p>
                <p className="mt-0.5 truncate text-[10px] font-semibold tabular-nums text-slate-500">
                  {item.detail}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-1.5 py-1 text-[10.5px] font-black tabular-nums ring-1 ring-inset ${item.pillTone}`}
              >
                {item.value}
              </span>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
};

export default memo(AttentionSection);
