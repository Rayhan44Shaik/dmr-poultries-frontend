import { memo } from 'react';

interface TopPerformersTableProps {
  performers: any[];
}

const TopPerformersTable = ({ performers }: TopPerformersTableProps) => {
  if (!performers || performers.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400 text-sm">
        No data available
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Vehicle
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Mileage (km/l)
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Distance (KM)
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Fuel (Ltrs)
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {performers.map((vehicle) => (
            <tr key={vehicle.id} className="hover:bg-gray-50">
              <td className="px-4 py-3 font-medium text-gray-900">
                {vehicle.vehicleNumber}
              </td>
              <td className="px-4 py-3 text-right font-medium text-green-600">
                {vehicle.mileage.toFixed(2)}
              </td>
              <td className="px-4 py-3 text-right text-gray-600">
                {vehicle.dist.toFixed(0)}
              </td>
              <td className="px-4 py-3 text-right text-gray-600">
                {vehicle.fuel.toFixed(1)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default memo(TopPerformersTable);