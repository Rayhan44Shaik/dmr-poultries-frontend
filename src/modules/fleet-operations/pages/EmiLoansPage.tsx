import { memo, useState, useMemo } from 'react';
import { useVehicles } from '../../masters/vehicles/hooks/useVehicles';
import { useFleetData } from '../hooks/useFleetData';
import ErrorBoundary from '../components/common/ErrorBoundary';
import EmiScheduleTable from '../components/emi/EmiScheduleTable';
import { Search, CreditCard } from 'lucide-react';

const EmiLoansPage = () => {
  const { vehicles } = useVehicles();
  const { emiRecords } = useFleetData();

  const [searchTerm, setSearchTerm] = useState('');

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return emiRecords;
    return emiRecords.filter((emi: any) => {
      const vehicle = vehicles.find((v) => v.id === emi.vehicleId);
      const vehicleNumber = vehicle?.vehicleNumber || '';
      return vehicleNumber.toLowerCase().includes(searchTerm.toLowerCase());
    });
  }, [emiRecords, vehicles, searchTerm]);

  const vehicleStatus = useMemo(() => {
    const statusMap: Record<string, 'pending' | 'completed'> = {};
    vehicles.forEach((v) => { statusMap[v.id] = 'completed'; });

    emiRecords.forEach((emi: any) => {
      if (emi.status === 'active' || emi.status === 'overdue') {
        statusMap[emi.vehicleId] = 'pending';
      }
    });

    let pendingVehicles = 0;
    let completedVehicles = 0;
    Object.values(statusMap).forEach((status) => {
      if (status === 'pending') pendingVehicles++;
      else completedVehicles++;
    });

    return { pendingVehicles, completedVehicles };
  }, [vehicles, emiRecords]);

  return (
    <ErrorBoundary>
      {/* 👇 Container updated with reduced padding and increased top spacing, background added */}
      <div className="px-1 md:px-3 py-6 md:py-8 space-y-6 max-w-7xl mx-auto bg-slate-50 min-h-screen">
        {/* Heading removed */}

        {/* Summary Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center gap-6">
            <div>
              <span className="text-sm text-gray-500">Pending Vehicles</span>
              <span className="ml-2 text-lg font-semibold text-amber-600">
                {vehicleStatus.pendingVehicles}
              </span>
            </div>
            <div>
              <span className="text-sm text-gray-500">Completed Vehicles</span>
              <span className="ml-2 text-lg font-semibold text-green-600">
                {vehicleStatus.completedVehicles}
              </span>
            </div>
            <div>
              <span className="text-sm text-gray-500">Total Vehicles</span>
              <span className="ml-2 text-lg font-semibold text-gray-700">
                {vehicles.length}
              </span>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by Vehicle Number..."
              className="pl-9 pr-4 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 w-64"
            />
          </div>
        </div>

        {/* Table with Icon in Header */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <CreditCard className="w-5 h-5 text-blue-500" />
            <h3 className="text-sm font-semibold text-gray-700">EMI Schedule</h3>
          </div>
          <EmiScheduleTable emiRecords={filteredRecords} vehicles={vehicles} simplified={true} pageSize={10} />
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default memo(EmiLoansPage);