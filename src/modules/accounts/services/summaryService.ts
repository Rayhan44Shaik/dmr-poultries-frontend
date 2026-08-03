// src/modules/accounts/services/summaryService.ts

import { tripService } from '../../operations/vehicle-trips/services/tripService';
import { collectionService } from '../../operations/collections/services/collectionService';
import { shopSalesService } from '../../operations/shop-sales/services/shopSalesService';
import { FarmPaymentService } from './FarmPaymentService';
import type { Trip } from '../../operations/vehicle-trips/types/trip';
import type { ShopSale } from '../../operations/shop-sales/types/shopSale';
import type { Collection } from '../../operations/collections/types/collection';
import type { FarmPayment } from '../types/farmPayment.types';
import type { WeeklyMetrics, ExpenseBreakdown } from '../types/summary.types';

// ----- Internal helpers (typed) -----

const getCompletedTrips = (): Trip[] => {
  return tripService.getAll().filter(trip => trip.status === 'Completed');
};

const getApprovedCollections = (): Collection[] => {
  return collectionService.getCollections().filter(c => c.status === 'Approved');
};

const getFarmPayments = (): FarmPayment[] => {
  return FarmPaymentService.getAll();
};

// ----- Exported functions with types -----

export const summaryService = {
  getCompletedTrips,
  getApprovedCollections,
  getFarmPayments,

  getCompletedTripsByDateRange(start: Date, end: Date): Trip[] {
    return getCompletedTrips().filter(trip => {
      const d = new Date(trip.tripDate);
      return d >= start && d <= end;
    });
  },

  getApprovedCollectionsByDateRange(start: Date, end: Date): Collection[] {
    return getApprovedCollections().filter(c => {
      const d = new Date(c.collectionDate);
      return d >= start && d <= end;
    });
  },

  getFarmPaymentsByDateRange(start: Date, end: Date): FarmPayment[] {
    return getFarmPayments().filter(p => {
      const dateStr = p.paidDate || p.createdAt || '';
      if (!dateStr) return false;
      const d = new Date(dateStr);
      return d >= start && d <= end;
    });
  },

  /**
   * Compute WeeklyMetrics from a list of trips and collections.
   */
  computeMetrics(trips: Trip[], collections: Collection[]): WeeklyMetrics {
    let birds = 0,
      weight = 0,
      mortality = 0,
      sales = 0;
    trips.forEach(trip => {
      birds += trip.totalBirds || 0;
      weight += trip.totalWeight || 0;
      mortality += trip.totalMortality || 0;
      (trip.deliveries || []).forEach(d => {
        const rate = (d as any).rate || 14;
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
      sales,
      collection,
      pending: Math.max(0, pending),
    };
  },

  /**
   * Compute ExpenseBreakdown for a given date range from farm payments and other payments.
   */
  computeExpenses(startDate: Date, endDate: Date, farmPayments: FarmPayment[]): ExpenseBreakdown {
    // Start with farm payments within this range
    const farmTotal = farmPayments
      .filter(p => {
        const d = new Date(p.paidDate || p.createdAt || '');
        return d >= startDate && d <= endDate;
      })
      .reduce((sum, p) => sum + (p.totalAmount || 0), 0);

    // Other expenses from 'dmr-payments' (your Payment Book)
    let fuel = 0,
      trip = 0,
      salary = 0,
      maintenance = 0,
      office = 0;
    try {
      const raw = localStorage.getItem('dmr-payments');
      if (raw) {
        const payments = JSON.parse(raw);
        const filtered = payments.filter((p: any) => {
          const d = new Date(p.paymentDate);
          return d >= startDate && d <= endDate && p.status === 'Approved';
        });
        filtered.forEach((p: any) => {
          const cat = p.category?.toLowerCase() || 'office';
          if (cat.includes('fuel')) fuel += p.amount;
          else if (cat.includes('trip')) trip += p.amount;
          else if (cat.includes('salary')) salary += p.amount;
          else if (cat.includes('maintenance') || cat.includes('repair')) maintenance += p.amount;
          else office += p.amount;
        });
      }
    } catch {
      // ignore
    }

    return { farm: farmTotal, fuel, trip, salary, maintenance, office };
  },

  /**
   * Get all expenses for each week (grouped).
   */
  getWeeklyExpenses(
    weeklyTrips: { trips: Trip[]; startDate: Date; endDate: Date }[],
    farmPayments: FarmPayment[]
  ): ExpenseBreakdown[] {
    return weeklyTrips.map(({ startDate, endDate }) =>
      this.computeExpenses(startDate, endDate, farmPayments)
    );
  },

  /**
   * Get the current week's Monday and Sunday.
   */
  getCurrentWeek(): { start: Date; end: Date } {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const start = new Date(now.getFullYear(), now.getMonth(), diff);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { start, end };
  },
};