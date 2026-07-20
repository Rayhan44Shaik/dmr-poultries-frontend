import { useMemo } from 'react';
import { addDays, isAfter, isBefore, addMonths, isToday, isPast } from 'date-fns';
import { useVehicles } from '../../masters/vehicles/hooks/useVehicles';
import { getEMIRecords } from '../services/storage';

interface EMI {
  id: string;
  vehicleId: string;
  financeCompany: string;
  loanAmount: number;
  emiAmount: number;
  startDate: string;
  endDate: string;
  nextEMIDate: string;
  status: 'active' | 'paid' | 'overdue';
  paidEMIs: number;
  totalEMIs: number;
}

export function useEmiData() {
  const { vehicles } = useVehicles();

  // Auto-update EMI statuses
  const emiRecords = useMemo(() => {
    const records = getEMIRecords() as EMI[];
    let updated = false;

    const updatedRecords = records.map((emi) => {
      if (emi.status === 'paid') return emi;

      const nextDate = new Date(emi.nextEMIDate);
      if (isPast(nextDate) || isToday(nextDate)) {
        const newPaid = (emi.paidEMIs || 0) + 1;
        const total = emi.totalEMIs || 0;
        let newStatus: 'active' | 'paid' | 'overdue' = emi.status;
        let newNextDate = emi.nextEMIDate;

        if (newPaid >= total) {
          newStatus = 'paid';
        } else {
          const nextMonthDate = addMonths(nextDate, 1);
          newNextDate = nextMonthDate.toISOString();
        }

        updated = true;
        return {
          ...emi,
          paidEMIs: newPaid,
          status: newStatus,
          nextEMIDate: newNextDate,
        };
      }
      return emi;
    });

    if (updated) {
      localStorage.setItem('dmr-vehicle-emi', JSON.stringify(updatedRecords));
      return updatedRecords;
    }

    return records;
  }, []);

  const now = new Date();
  const nextMonth = addDays(now, 30);

  const stats = useMemo(() => {
    const totalLoan = emiRecords.reduce((sum, e) => sum + e.loanAmount, 0);
    const monthlyEMI = emiRecords.reduce((sum, e) => sum + e.emiAmount, 0);
    const paidThisMonth = emiRecords.filter((e) => e.status === 'paid').length;
    const pendingThisMonth = emiRecords.filter((e) => e.status === 'active' || e.status === 'overdue').length;
    const nextDue = emiRecords
      .filter((e) => isAfter(new Date(e.nextEMIDate), now) && e.status !== 'paid')
      .sort((a, b) => new Date(a.nextEMIDate).getTime() - new Date(b.nextEMIDate).getTime())[0] || null;
    return { totalLoan, monthlyEMI, paidThisMonth, pendingThisMonth, nextDue };
  }, [emiRecords, now]);

  const chartData = [
    { name: 'Paid', value: stats.paidThisMonth },
    { name: 'Pending', value: stats.pendingThisMonth }
  ];

  const upcoming = useMemo(() => {
    return emiRecords
      .filter((e) => 
        isBefore(new Date(e.nextEMIDate), nextMonth) && 
        isAfter(new Date(e.nextEMIDate), now) &&
        e.status !== 'paid'
      )
      .sort((a, b) => new Date(a.nextEMIDate).getTime() - new Date(b.nextEMIDate).getTime());
  }, [emiRecords, nextMonth, now]);

  return {
    emiRecords,
    vehicles,
    stats,
    chartData,
    upcoming,
  };
}