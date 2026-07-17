import { useMemo, useState } from 'react';
import { startOfYear, endOfYear, isWithinInterval } from 'date-fns';
import { useVehicles } from '../../masters/vehicles/hooks/useVehicles';
import { getMaintenance } from '../services/storage';
import { MaintenanceTypeEnum } from '../types';

// Define the maintenance record type matching the actual data
interface MaintenanceRecord {
  id: string;
  vehicleId: string;
  date: string;
  currentKM: number;
  maintenanceType: typeof MaintenanceTypeEnum[number];
  serviceType: string;
  garage?: string;
  mechanic?: string;
  nextServiceKM: number; // Make it required with default 0
  totalCost: number;
  parts: any[];
  remarks?: string;
}

// Define the upcoming service type
interface UpcomingService {
  vehicle: any;
  lastMaint: MaintenanceRecord | null;
  nextKM: number;
  dueKM: number;
  isDue: boolean;
}

export function useMaintenanceData() {
  const { vehicles } = useVehicles();
  const maintenance = useMemo(() => {
    const raw = getMaintenance() as any[];
    // Ensure nextServiceKM has a default value
    return raw.map((item: any) => ({
      ...item,
      nextServiceKM: item.nextServiceKM ?? 0,
    })) as MaintenanceRecord[];
  }, []);
  
  const [selectedVehicle, setSelectedVehicle] = useState<string>('all');

  const now = new Date();
  const yearStart = startOfYear(now);
  const yearEnd = endOfYear(now);

  // Filter by vehicle
  const filtered = useMemo(() => {
    return selectedVehicle === 'all' 
      ? maintenance 
      : maintenance.filter((m: MaintenanceRecord) => m.vehicleId === selectedVehicle);
  }, [maintenance, selectedVehicle]);

  // Stats for the year
  const stats = useMemo(() => {
    const yearEvents = filtered.filter((m: MaintenanceRecord) => 
      isWithinInterval(new Date(m.date), { start: yearStart, end: yearEnd })
    );
    const total = yearEvents.length;
    const totalCost = yearEvents.reduce((sum: number, m: MaintenanceRecord) => sum + m.totalCost, 0);
    const totalDistance = yearEvents.reduce((sum: number, m: MaintenanceRecord) => sum + m.currentKM, 0);
    const lastService = filtered.length > 0 ? filtered[filtered.length - 1] : null;
    return { total, totalCost, totalDistance, lastService };
  }, [filtered, yearStart, yearEnd]);

  // Upcoming services - properly typed
  const upcomingServices = useMemo((): UpcomingService[] => {
    return vehicles
      .map((v: any) => {
        const lastMaint = maintenance
          .filter((m: MaintenanceRecord) => m.vehicleId === v.id)
          .sort((a: MaintenanceRecord, b: MaintenanceRecord) => 
            new Date(b.date).getTime() - new Date(a.date).getTime()
          )[0] || null;
        
        // Get next service KM with fallback
        const nextKM = lastMaint?.nextServiceKM ?? v.currentKM ?? 0;
        const dueKM = nextKM - (v.currentKM ?? 0);
        
        return {
          vehicle: v,
          lastMaint,
          nextKM,
          dueKM,
          isDue: dueKM <= 0,
        };
      })
      .filter((item: UpcomingService) => item.isDue)
      .sort((a: UpcomingService, b: UpcomingService) => a.dueKM - b.dueKM)
      .slice(0, 5);
  }, [vehicles, maintenance]);

  return {
    maintenance,
    filtered,
    stats,
    upcomingServices,
    selectedVehicle,
    setSelectedVehicle,
  };
}