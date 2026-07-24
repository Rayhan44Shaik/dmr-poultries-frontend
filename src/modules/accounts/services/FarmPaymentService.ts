// src/modules/accounts/services/FarmPaymentService.ts

import type { FarmPayment } from '../types/farmPayment.types';

const STORAGE_KEY = 'dmr-farm-payments';

function loadPayments(): FarmPayment[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
}

function savePayments(payments: FarmPayment[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payments));
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
}

export const FarmPaymentService = {
  getAll(): FarmPayment[] {
    return loadPayments().sort((a, b) => b.tripDate.localeCompare(a.tripDate));
  },

  getByTripId(tripId: number): FarmPayment | undefined {
    return loadPayments().find((p) => p.tripId === tripId);
  },

  getPaymentById(id: string): FarmPayment | undefined {
    return loadPayments().find((p) => p.id === id);
  },

  save(payment: Omit<FarmPayment, 'id' | 'createdAt' | 'updatedAt'>): FarmPayment {
    const existing = this.getByTripId(payment.tripId);
    const now = new Date().toISOString();

    let newPayment: FarmPayment;
    const payments = loadPayments();

    if (existing) {
      newPayment = {
        ...existing,
        ...payment,
        updatedAt: now,
      };
      const index = payments.findIndex((p) => p.id === existing.id);
      if (index !== -1) payments[index] = newPayment;
    } else {
      newPayment = {
        ...payment,
        id: generateId(),
        createdAt: now,
        updatedAt: now,
      };
      payments.push(newPayment);
    }

    savePayments(payments);
    return newPayment;
  },

  markPaymentsAsPaid(paymentIds: string[]): void {
    const payments = loadPayments();
    const updated = payments.map((p) => {
      if (paymentIds.includes(p.id) && p.status !== 'Paid') {
        return { ...p, status: 'Paid' as const, updatedAt: new Date().toISOString() };
      }
      return p;
    });
    savePayments(updated);
  },

  delete(id: string): void {
    const payments = loadPayments().filter((p) => p.id !== id);
    savePayments(payments);
  },

  deleteByTripId(tripId: number): void {
    const payments = loadPayments().filter((p) => p.tripId !== tripId);
    savePayments(payments);
  },

  clear(): void {
    localStorage.removeItem(STORAGE_KEY);
  },
};