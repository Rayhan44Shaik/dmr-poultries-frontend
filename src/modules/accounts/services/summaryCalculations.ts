import type { Trip } from '../../operations/vehicle-trips/types/trip';
import type { Collection } from '../../operations/collections/types/collection';
import type { WeeklyMetrics } from '../types/summary.types';

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
      weightLoss += (trip as Trip & { weightLoss?: number }).weightLoss || 0;
      
      // Sales: sum of deliveries weight * rate
      (trip.deliveries || []).forEach(d => {
        const rate = (d as unknown as { rate?: number }).rate || 0;
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
};