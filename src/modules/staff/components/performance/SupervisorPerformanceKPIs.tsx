// src/modules/staff/components/performance/SupervisorPerformanceKPIs.tsx

import { memo } from 'react';
import {
  Truck,
  Building2,
  Store,
  Target,
  AlertTriangle,
  // ✅ Removed unused TrendingUp
} from 'lucide-react';
import type { SupervisorPerformance } from '../../types/staffDashboard';

interface SupervisorPerformanceKPIsProps {
  data: SupervisorPerformance | null;
  loading: boolean;
}

function SupervisorPerformanceKPIs({ data, loading }: SupervisorPerformanceKPIsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        {[...Array(5)].map((_, i) => (
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
      label: 'Trips Managed',
      value: data.tripsManaged,
      icon: <Truck className="w-5 h-5" />,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      label: 'Farms Visited',
      value: data.farmsVisited,
      icon: <Building2 className="w-5 h-5" />,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      label: 'Shops Delivered',
      value: data.shopsDelivered,
      icon: <Store className="w-5 h-5" />,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
    {
      label: 'Delivery Accuracy',
      value: `${data.deliveryAccuracy}%`,
      icon: <Target className="w-5 h-5" />,
      color: data.deliveryAccuracy > 95 ? 'text-green-600' : 'text-amber-600',
      bgColor: data.deliveryAccuracy > 95 ? 'bg-green-50' : 'bg-amber-50',
    },
    {
      label: 'Mortality Verified',
      value: `${data.mortalityVerified}%`,
      icon: <AlertTriangle className="w-5 h-5" />,
      color: data.mortalityVerified < 2 ? 'text-green-600' : 'text-red-600',
      bgColor: data.mortalityVerified < 2 ? 'bg-green-50' : 'bg-red-50',
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

export default memo(SupervisorPerformanceKPIs);