import { useMemo, useState } from 'react';
import { startOfMonth, endOfMonth, format } from 'date-fns';
import { useVehicles } from '../../masters/vehicles/hooks/useVehicles';
import useTrips from '../../operations/vehicle-trips/hooks/useTrips';
import { getMaintenance, getFastagTransactions, getEMIRecords } from '../services/storage';

interface MaintenanceRecord {
  id: string;
  vehicleId: string;
  date: string;
  currentKM: number;
  maintenanceType: string;
  serviceType: string;
  garage?: string;
  mechanic?: string;
  nextServiceKM?: number;
  totalCost: number;
  parts: any[];
  remarks?: string;
}

interface ExpenseRow {
  vehicle: any;
  fuelCost: number;
  tollCost: number;
  maintCost: number;
  emiCost: number;
  otherCost: number;
  totalCost: number;
}

const dummyNotify = () => {};

export function useExpenseReportData() {
  const { vehicles } = useVehicles();
  const tripsData = useTrips(dummyNotify);
  const allTrips = tripsData?.allTrips || [];
  const maintenance = useMemo(() => getMaintenance() as MaintenanceRecord[], []);
  const fastagTransactions = useMemo(() => getFastagTransactions(), []);
  const emiRecords = useMemo(() => getEMIRecords(), []);

  const today = new Date();
  const [fromDate, setFromDate] = useState(format(startOfMonth(today), 'yyyy-MM-dd'));
  const [toDate, setToDate] = useState(format(endOfMonth(today), 'yyyy-MM-dd'));
  const [selectedVehicle, setSelectedVehicle] = useState('all');

  const reportData = useMemo((): ExpenseRow[] => {
    const from = new Date(fromDate);
    const to = new Date(toDate);

    const filteredTrips = allTrips.filter((t: any) => {
      const d = new Date(t.tripDate);
      return d >= from && d <= to;
    });

    return vehicles.map((v: any) => {
      const vTrips = filteredTrips.filter((t: any) => t.vehicleNo === v.vehicleNumber);
      
      const fuelCost = vTrips.reduce((sum: number, t: any) => sum + (t.expense || 0), 0);
      const tollCost = fastagTransactions
        .filter((t: any) => new Date(t.date) >= from && new Date(t.date) <= to)
        .reduce((sum: number, t: any) => sum + t.amount, 0) / (vehicles.length || 1);
      const maintCost = maintenance
        .filter((m: MaintenanceRecord) => m.vehicleId === v.id && new Date(m.date) >= from && new Date(m.date) <= to)
        .reduce((sum: number, m: MaintenanceRecord) => sum + m.totalCost, 0);
      const emiCost = emiRecords
        .filter((e: any) => e.vehicleId === v.id && e.status !== 'paid')
        .reduce((sum: number, e: any) => sum + e.emiAmount, 0);
      const otherCost = 0;
      const totalCost = fuelCost + tollCost + maintCost + emiCost + otherCost;
      
      return { 
        vehicle: v, 
        fuelCost, 
        tollCost, 
        maintCost, 
        emiCost, 
        otherCost, 
        totalCost 
      };
    });
  }, [vehicles, allTrips, maintenance, fastagTransactions, emiRecords, fromDate, toDate]);

  const filtered = useMemo((): ExpenseRow[] => {
    return selectedVehicle === 'all' 
      ? reportData 
      : reportData.filter((r: ExpenseRow) => r.vehicle.id === selectedVehicle);
  }, [reportData, selectedVehicle]);

  const totals = useMemo(() => {
    return filtered.reduce(
      (acc: any, r: ExpenseRow) => {
        acc.fuelCost += r.fuelCost;
        acc.tollCost += r.tollCost;
        acc.maintCost += r.maintCost;
        acc.emiCost += r.emiCost;
        acc.otherCost += r.otherCost;
        acc.totalCost += r.totalCost;
        return acc;
      },
      { fuelCost: 0, tollCost: 0, maintCost: 0, emiCost: 0, otherCost: 0, totalCost: 0 }
    );
  }, [filtered]);

  const summary = useMemo(() => {
    const highest = filtered.reduce((max: ExpenseRow, r: ExpenseRow) => 
      r.totalCost > max.totalCost ? r : max, 
      filtered[0] || { totalCost: 0, vehicle: { vehicleNumber: 'N/A' } }
    );
    const lowest = filtered.reduce((min: ExpenseRow, r: ExpenseRow) => 
      r.totalCost < min.totalCost ? r : min, 
      filtered[0] || { totalCost: 0, vehicle: { vehicleNumber: 'N/A' } }
    );
    const avg = filtered.length > 0 ? totals.totalCost / filtered.length : 0;
    return { highest, lowest, avg };
  }, [filtered, totals]);

  return {
    fromDate,
    setFromDate,
    toDate,
    setToDate,
    selectedVehicle,
    setSelectedVehicle,
    filtered,
    totals,
    summary,
  };
}