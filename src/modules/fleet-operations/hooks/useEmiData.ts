import { useMemo } from 'react';
import { addDays, isAfter, isBefore } from 'date-fns';
import { useVehicles } from '../../masters/vehicles/hooks/useVehicles';
import { getEMIRecords } from '../services/storage';

export function useEmiData() {
  const { vehicles } = useVehicles();
  const emiRecords = useMemo(() => getEMIRecords(), []);

  const now = new Date();
  const nextMonth = addDays(now, 30);

  // Summary stats
  const stats = useMemo(() => {
    const totalLoan = emiRecords.reduce((sum: number, e: any) => sum + e.loanAmount, 0);
    const monthlyEMI = emiRecords.reduce((sum: number, e: any) => sum + e.emiAmount, 0);
    const paidThisMonth = emiRecords.filter((e: any) => e.status === 'paid').length;
    const pendingThisMonth = emiRecords.filter((e: any) => e.status === 'active' || e.status === 'overdue').length;
    const nextDue = emiRecords
      .filter((e: any) => isAfter(new Date(e.nextEMIDate), now))
      .sort((a: any, b: any) => new Date(a.nextEMIDate).getTime() - new Date(b.nextEMIDate).getTime())[0];
    return { totalLoan, monthlyEMI, paidThisMonth, pendingThisMonth, nextDue };
  }, [emiRecords, now]);

  // Chart data: Paid vs Pending
  const chartData = [
    { name: 'Paid', value: stats.paidThisMonth },
    { name: 'Pending', value: stats.pendingThisMonth }
  ];

  // Upcoming EMIs (next 30 days)
  const upcoming = useMemo(() => {
    return emiRecords
      .filter((e: any) => 
        isBefore(new Date(e.nextEMIDate), nextMonth) && 
        isAfter(new Date(e.nextEMIDate), now) &&
        e.status !== 'paid'
      )
      .sort((a: any, b: any) => new Date(a.nextEMIDate).getTime() - new Date(b.nextEMIDate).getTime());
  }, [emiRecords, nextMonth, now]);

  return {
    emiRecords,
    vehicles,
    stats,
    chartData,
    upcoming,
  };
}