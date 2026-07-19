// src/modules/staff/components/performance/DriverPerformanceKPIs.tsx

import { memo } from 'react';
import {
  Truck,
  Calendar,
  Wrench,
  MapPin,
  Bird,
  Weight,
  AlertTriangle,
  Fuel,
  TrendingDown,
} from 'lucide-react';
import type { DriverPerformance } from '../../types/staffDashboard';

interface DriverPerformanceKPIsProps {
  data: DriverPerformance | null;
  loading: boolean;
}

function DriverPerformanceKPIs({ data, loading }: DriverPerformanceKPIsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        {[...Array(9)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm animate-pulse">
            <div className="h-4 bg-slate-200 rounded w-2/3 mb-2"></div>
            <div className="h-6 bg-slate-200 rounded w-1/2"></div>
          </div>
        ))}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center text-slate-500 py-6">No performance data available.</div>
    );
  }

  const kpis = [
    {
      label: 'Total Trips',
      value: data.totalTrips,
      icon: <Truck className="w-5 h-5" />,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      label: 'Delivery Days',
      value: data.deliveryDays,
      icon: <Calendar className="w-5 h-5" />,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      label: 'Repair Days',
      value: data.repairDays,
      icon: <Wrench className="w-5 h-5" />,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
    },
    {
      label: 'Total Distance (KM)',
      value: data.totalDistance.toLocaleString(),
      icon: <MapPin className="w-5 h-5" />,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
    {
      label: 'Total Birds',
      value: data.totalBirds.toLocaleString(),
      icon: <Bird className="w-5 h-5" />,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50',
    },
    {
      label: 'Total Weight (KG)',
      value: data.totalWeight.toLocaleString(),
      icon: <Weight className="w-5 h-5" />,
      color: 'text-cyan-600',
      bgColor: 'bg-cyan-50',
    },
    {
      label: 'Mortality Rate',
      value: `${data.mortalityRate}%`,
      icon: <AlertTriangle className="w-5 h-5" />,
      color: data.mortalityRate > 2 ? 'text-red-600' : 'text-green-600',
      bgColor: data.mortalityRate > 2 ? 'bg-red-50' : 'bg-green-50',
    },
    {
      label: 'Fuel Used (LTR)',
      value: data.fuelUsed.toLocaleString(),
      icon: <Fuel className="w-5 h-5" />,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
    },
    {
      label: 'Avg Weight/Trip (KG)',
      value: data.avgWeightPerTrip.toLocaleString(),
      icon: <TrendingDown className="w-5 h-5" />,
      color: 'text-rose-600',
      bgColor: 'bg-rose-50',
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
      {kpis.map((kpi, index) => (
        <div
          key={index}
          className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition-all duration-200"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                {kpi.label}
              </p>
              <p className="text-lg font-bold text-slate-800 mt-1">{kpi.value}</p>
            </div>
            <div className={`${kpi.bgColor} p-2 rounded-lg`}>
              <div className={kpi.color}>{kpi.icon}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default memo(DriverPerformanceKPIs);