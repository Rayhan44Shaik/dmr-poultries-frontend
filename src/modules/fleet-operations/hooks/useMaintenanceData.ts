import { useMemo, useState } from 'react';
import { startOfYear, endOfYear, isWithinInterval } from 'date-fns';
import { useVehicles } from '../../masters/vehicles/hooks/useVehicles';
import { useFuelExpenses } from '../../operations/fuel-expenses/hooks/useFuelExpenses'; 
import { getMaintenance } from '../services/storage';
import { MaintenanceTypeEnum } from '../types';

interface MaintenanceRecord {
  id: string;
  vehicleId: string;
  date: string;
  currentKM: number;
  maintenanceType: typeof MaintenanceTypeEnum[number];
  serviceType: string;
  garage?: string;
  mechanic?: string;
  nextServiceKM: number;
  totalCost: number;
  parts: any[];
  remarks?: string;
}

interface UpcomingService {
  vehicle: any;
  lastMaint: MaintenanceRecord | null;
  nextKM: number;
  dueKM: number;
  isDue: boolean;
  liveCurrentKM: number;
}

export function useMaintenanceData() {
  const { vehicles } = useVehicles();
  
  // Safe dummy notification wrapper to satisfy the hook argument parameter requirement 
  const dummyNotify = () => {};
  const { filteredData: fuelExpenses } = useFuelExpenses(dummyNotify);
  
  const maintenance = useMemo(() => {
    const raw = getMaintenance() as any[];
    return raw.map((item: any) => ({
      ...item,
      nextServiceKM: item.nextServiceKM ?? 0,
    })) as MaintenanceRecord[];
  }, []);
  
  const [selectedVehicle, setSelectedVehicle] = useState<string>('all');

  const now = new Date();
  const yearStart = startOfYear(now);
  const yearEnd = endOfYear(now);

  const filtered = useMemo(() => {
    if (!selectedVehicle || selectedVehicle === 'all') return maintenance;
    return maintenance.filter((m: MaintenanceRecord) => {
      const linkedVehicle = vehicles.find(v => String(v.id) === String(m.vehicleId));
      return (
        String(m.vehicleId) === String(selectedVehicle) || 
        (linkedVehicle && linkedVehicle.vehicleNumber === selectedVehicle)
      );
    });
  }, [maintenance, selectedVehicle, vehicles]);

  const stats = useMemo(() => {
    const yearEvents = filtered.filter((m: MaintenanceRecord) => 
      isWithinInterval(new Date(m.date), { start: yearStart, end: yearEnd })
    );
    const total = yearEvents.length;
    const totalCost = yearEvents.reduce((sum: number, m: MaintenanceRecord) => sum + m.totalCost, 0);
    const totalDistance = yearEvents.reduce((sum: number, m: MaintenanceRecord) => sum + m.currentKM, 0);
    
    const sortedFiltered = [...filtered].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const lastService = sortedFiltered.length > 0 ? sortedFiltered[0] : null;
    
    return { total, totalCost, totalDistance, lastService };
  }, [filtered, yearStart, yearEnd]);

  // Compute live odometer status limits based on raw fuel logs array extraction
  const upcomingServices = useMemo((): UpcomingService[] => {
    return vehicles
      .map((v: any) => {
        // Find historical maintenance records
        const vehicleMaintenances = maintenance.filter((m: MaintenanceRecord) => String(m.vehicleId) === String(v.id));
        const lastMaint = vehicleMaintenances.sort((a: MaintenanceRecord, b: MaintenanceRecord) => 
          new Date(b.date).getTime() - new Date(a.date).getTime()
        )[0] || null;

        // Trace the absolute highest entry from current fuel meter logs matching vehicle text number
        const vehicleFuelLogs = (fuelExpenses || []).filter((f: any) => String(f.vehicleNo) === String(v.vehicleNumber));
        const maxFuelKM = vehicleFuelLogs.reduce((max: number, log: any) => Math.max(max, Number(log.meterReading) || 0), 0);
        
        // Final live calculated current metrics selection fallback sequence
        const liveCurrentKM = Math.max(Number(v.currentKM) || 0, maxFuelKM, lastMaint?.currentKM || 0);
        
        // Target metric thresholds
        const nextKM = lastMaint?.nextServiceKM && lastMaint.nextServiceKM > 0 
          ? lastMaint.nextServiceKM 
          : liveCurrentKM + 5000; 
          
        const dueKM = nextKM - liveCurrentKM;
        
        return {
          vehicle: v,
          lastMaint,
          nextKM,
          dueKM,
          isDue: dueKM <= 1000, 
          liveCurrentKM
        };
      })
      .sort((a: UpcomingService, b: UpcomingService) => a.dueKM - b.dueKM);
  }, [vehicles, maintenance, fuelExpenses]);

  return {
    vehicles,
    maintenance,
    filtered,
    stats,
    upcomingServices,
    selectedVehicle,
    setSelectedVehicle,
  };
}