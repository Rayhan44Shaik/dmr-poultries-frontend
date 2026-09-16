// src/modules/accounts/services/summaryService.ts

import { summaryCalculations } from './summaryCalculations';
import { tripService } from '../../operations/vehicle-trips/services/tripService';
import { collectionService } from '../../operations/collections/services/collectionService';
import { FarmPaymentService } from './FarmPaymentService';
import type { Trip } from '../../operations/vehicle-trips/types/trip';
import type { Collection } from '../../operations/collections/types/collection';
import type { FarmPayment } from '../types/farmPayment.types';

// ---- Core Data Fetchers ----
const getCompletedTrips = (): Trip[] => {
  // Pulls only trips that are formally Completed (or Approved)
  return tripService.getAll().filter(trip => trip.status === 'Completed' || (trip as any).status === 'Approved');
};

const getApprovedCollections = (): Collection[] => {
  return collectionService.getCollections().filter(c => c.status === 'Approved');
};

const getFarmPayments = (): FarmPayment[] => {
  return FarmPaymentService.getAll();
};

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

  ...summaryCalculations,
};
