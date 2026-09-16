import { parseBusinessDate } from '../../../utils/businessDate';
import type { Trip } from '../../operations/vehicle-trips/types/trip';
import type { Collection } from '../../operations/collections/types/collection';
import type { Payment } from '../types/payment.types';
import type { FarmPayment } from '../types/farmPayment.types';
import type { WeeklyMetrics, ExpenseBreakdown } from '../types/summary.types';
import { paymentExpenseSector } from '../utils/paymentRegister';

// ---- Trip Expense Extractor ----
const getExpensesFromTrip = (trip: Trip): ExpenseBreakdown => {
  // 1. Primary Modern Trip Fields
  const tripExpense = Number(trip.expense || 0);
  const pickupTolls = Number(trip.pickupTolls || 0);
  const deliveryTolls = Number(trip.deliveryTolls || 0);
  const totalTripExp = tripExpense + pickupTolls + deliveryTolls;

  // 2. Legacy Fallbacks (In case older trips used dynamic meal fields)
  const meals = Number((trip as any).meals || 0);
  const loading = Number((trip as any).loading || 0);
  const mealsTiffin = Number((trip as any).mealsTiffin || 0);
  const othersRC = Number((trip as any).othersRC || 0);
  const legacyTripExp = meals + loading + mealsTiffin + othersRC;

  const vehicleMaintenance = Number((trip as any).vehicleMaintenance || 0) + Number((trip as any).maintenance || 0);
  const farmPayment = Number((trip as any).farmPayment || 0);
  const salary = Number((trip as any).salary || 0);
  const office = Number((trip as any).office || 0);

  return {
    farm: farmPayment,
    fuel: 0, // ✅ EXPLICITLY IGNORING FUEL FROM TRIPS AS REQUESTED
    trip: totalTripExp > 0 ? totalTripExp : legacyTripExp,
    salary: salary,
    maintenance: vehicleMaintenance,
    office: office,
  };
};

export const summaryCalculations = {
  /**
   * Compute Metrics for Trips & Collections
   */
  computeMetrics(trips: Trip[], collections: Collection[]): WeeklyMetrics {
    let birds = 0, weight = 0, mortality = 0, weightLoss = 0, sales = 0;
    
    trips.forEach(trip => {
      birds += trip.totalBirds || 0;
      weight += trip.totalWeight || 0;
      mortality += trip.totalMortality || 0;
      weightLoss += (trip as any).weightLoss || 0;
      
      // Sales: sum of deliveries weight * rate
      (trip.deliveries || []).forEach(d => {
        const rate = (d as any).rate || 0;
        sales += (d.weight || 0) * rate;
      });
    });
    
    const collection = collections.reduce((sum, c) => sum + c.amount, 0);
    const pending = sales - collection;
    
    return {
      trips: trips.length,
      birds,
      weight,
      mortality,
      weightLoss,
      sales,
      collection,
      pending: Math.max(0, pending),
    };
  },

  /**
   * ✅ COMBINED EXPENSES
   * Aggregates Trip Expenses + Farm Payments + Global Operational Ledger
   */
  computeCombinedExpenses(trips: Trip[], startDate: Date, endDate: Date, farmPayments: FarmPayment[], ledger?: readonly Payment[]): ExpenseBreakdown {
    const total: ExpenseBreakdown = { farm: 0, fuel: 0, trip: 0, salary: 0, maintenance: 0, office: 0 };

    // 1. Direct Completed Trip Expenses
    trips.forEach(trip => {
      const exp = getExpensesFromTrip(trip);
      total.farm += exp.farm;
      total.fuel += exp.fuel; // Will remain 0 from trips based on the logic above
      total.trip += exp.trip;
      total.salary += exp.salary;
      total.maintenance += exp.maintenance;
      total.office += exp.office;
    });

    // 2. Direct Farm Payments
    farmPayments.forEach(p => {
      const value = p.paidDate || p.createdAt || '';
      const d = parseBusinessDate(value) ?? new Date(value);
      if (d >= startDate && d <= endDate) {
        total.farm += Number(p.amountPaid ?? (p.paymentStatus === 'Paid' ? p.totalAmount : 0) ?? 0);
      }
    });

    // 3. Operational Ledger (dmr-payments)
    try {
      const raw = ledger ? null : localStorage.getItem('dmr-payments');
      if (ledger || raw) {
        const payments = ledger ?? JSON.parse(raw!);
        const filtered = payments.filter((p: any) => {
          const d = parseBusinessDate(p.paymentDate) ?? new Date(p.paymentDate);
          return d >= startDate && d <= endDate && (p.status === 'Approved' || p.status === 'Paid');
        });

        filtered.forEach((p: any) => {
          const amt = Number(p.amount || 0);
          const sector = paymentExpenseSector(p.paymentType, p.category);
          total[sector] += amt;
        });
      }
    } catch {
      // Safely ignore parsing issues
    }

    return total;
  }
};