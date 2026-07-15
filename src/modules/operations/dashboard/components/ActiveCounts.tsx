import { Car, Users, Store, Building2 } from "lucide-react";

interface ActiveCountsProps {
  vehicles: number;
  drivers: number;
  helpers: number;
  shops: number;
  farms: number;
}

export default function ActiveCounts({ vehicles, drivers, helpers, shops, farms }: ActiveCountsProps) {
  const items = [
    { label: "Active Vehicles", value: vehicles || 0, icon: Car, color: "text-blue-600" },
    { label: "Active Drivers", value: drivers || 0, icon: Users, color: "text-green-600" },
    { label: "Active Helpers", value: helpers || 0, icon: Users, color: "text-orange-600" },
    { label: "Total Shops", value: shops || 0, icon: Store, color: "text-purple-600" },
    { label: "Total Farms", value: farms || 0, icon: Building2, color: "text-emerald-600" },
  ];

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-700 mb-3">Active Counts</h3>
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.label} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <item.icon size={16} className={item.color} />
              <span className="text-sm text-slate-600">{item.label}</span>
            </div>
            <span className="text-sm font-bold text-slate-800">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}