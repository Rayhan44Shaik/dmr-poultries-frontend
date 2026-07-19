// src/modules/staff/components/performance/ShopLeaderboardTable.tsx

import { memo } from 'react';

interface ShopLeaderboard {
  shopName: string;
  trips: number;
  birds: number;
  weight: number;
  mortality: number;
}

interface ShopLeaderboardTableProps {
  data: ShopLeaderboard[];
  loading: boolean;
}

function ShopLeaderboardTable({ data, loading }: ShopLeaderboardTableProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm animate-pulse">
        <div className="h-4 bg-slate-200 rounded w-1/3 mb-4"></div>
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-8 bg-slate-100 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Top Delivered Shops</h3>
        <p className="text-slate-500 text-center py-6">No shop data available.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-700 mb-4">Top Delivered Shops</h3>
      <div className="overflow-x-auto -mx-4 sm:mx-0">
        <div className="inline-block min-w-full align-middle">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Shop Name</th>
                <th className="px-3 py-2 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">Trips</th>
                <th className="px-3 py-2 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">Birds</th>
                <th className="px-3 py-2 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">Weight (KG)</th>
                <th className="px-3 py-2 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">Mortality %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {data.map((shop, index) => (
                <tr key={index} className="hover:bg-slate-50 transition-colors">
                  <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-slate-800">
                    {index === 0 && '🏆 '}
                    {shop.shopName}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-sm text-slate-600 text-center">{shop.trips}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-sm text-slate-600 text-center">{shop.birds.toLocaleString()}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-sm text-slate-600 text-center">{shop.weight.toLocaleString()}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-center">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                        shop.mortality < 1.2
                          ? 'bg-green-100 text-green-700'
                          : shop.mortality < 1.5
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {shop.mortality}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default memo(ShopLeaderboardTable);