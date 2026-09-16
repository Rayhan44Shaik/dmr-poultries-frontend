import assert from 'node:assert/strict';
import test from 'node:test';
import { approvedExpenses } from './approvedExpenses';
import { summaryCalculations } from '../services/summaryCalculations';
import type { Payment } from '../types/payment.types';
import type { Collection } from '../../operations/collections/types/collection';
import type { Trip } from '../../operations/vehicle-trips/types/trip';
const start = new Date(2026, 8, 14), end = new Date(2026, 8, 20, 23, 59, 59, 999);
const payment = (id: string, type: string, amount: number, extra: Partial<Payment> = {}): Payment => ({
  id, paymentType: type, amount, paymentDate: '2026-09-16', status: 'Approved', category: '', ...extra,
} as Payment);

test('only Approved register payments contribute, each ID counted once', () => {
  const approved = payment('1', 'Vehicle Maintenance', 120);
  const result = approvedExpenses([approved, approved,
    payment('2', 'Vehicle Maintenance', 500, {status: 'Paid'}),
    payment('3', 'Fuel Payment', 1000, {status: 'Draft'}),
    payment('4', 'Fuel Payment', 2000, {status: 'Cancelled'}),
    {...payment('5', 'Fuel Payment', 2000), deleted: true} as Payment,
    payment('6', 'Fuel Payment', 1000, {paymentDate: '2026-09-13'}),
  ], start, end);
  assert.deepEqual(result, {farm: 0, fuel: 0, trip: 0, salary: 0, maintenance: 120, office: 0});
});
test('all expense sectors include the first and last selected dates', () => {
  const types = ['Farmer Payment', 'Diesel', 'Toll', 'Salary Payment', 'Vehicle Maintenance', 'Office Expense'];
  const result = approvedExpenses(types.map((type, index) => payment(String(index), type, 100, {paymentDate: index % 2 ? '2026-09-14' : '2026-09-20'})), start, end);
  assert.deepEqual(result, {farm: 100, fuel: 100, trip: 100, salary: 100, maintenance: 100, office: 100});
});
test('pending is selected-period sales minus collections, never negative', () => {
  const trips = [{deliveries: [{weight: 10, rate: 100}]}] as Trip[];
  assert.equal(summaryCalculations.computeMetrics(trips, [{amount: 400}] as Collection[]).pending, 600);
  assert.equal(summaryCalculations.computeMetrics(trips, [{amount: 1400}] as Collection[]).pending, 0);
});
