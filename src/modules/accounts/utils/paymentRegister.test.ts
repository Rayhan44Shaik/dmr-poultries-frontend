import { test } from 'node:test';
import assert from 'node:assert/strict';
import { weekRange } from '../../../utils/businessDate';
import { filterPayments, paymentCurrency } from './paymentRegister';
import type { Payment } from '../types/payment.types';

const base: Payment = {
  id: '1', paymentNo: 'Pay-10092026-001', paymentDate: '2026-09-10', paymentType: 'Fuel Payment',
  paymentMode: 'Cash', paidTo: 'Sample Vendor', amount: 1234.50, referenceNo: 'BILL-42', remarks: 'Diesel refill',
  category: 'Fuel Payment', status: 'Approved', createdBy: 'test', createdAt: '2026-09-10', updatedAt: '2026-09-10', attachments: [],
};
const payments = [base, { ...base, id: '2', paymentNo: 'LEGACY-42', paymentMode: 'UPI' }, { ...base, id: '3', paymentNo: 'Pay-14092026-001', paymentDate: '2026-09-14' }];
const filters = { from: '2026-09-07', to: '2026-09-13', type: '', mode: '', search: '' };

test('current week is Monday to Sunday, including Sunday and year boundaries', () => {
  for (const day of [7, 10, 13]) assert.deepEqual(weekRange(new Date(2026, 8, day)), { from: '2026-09-07', to: '2026-09-13' });
  assert.deepEqual(weekRange(new Date(2027, 0, 1)), { from: '2026-12-28', to: '2027-01-03' });
});
test('date, type, mode and search are ANDed without changing payment identities', () => {
  assert.deepEqual(filterPayments(payments, { ...filters, type: 'Fuel Payment', mode: 'Cash', search: 'bill-42' }), [base]);
  assert.equal(filterPayments(payments, { ...filters, type: 'Salary Payment', mode: 'Cash' }).length, 0);
  assert.equal(filterPayments(payments, filters)[1].paymentNo, 'LEGACY-42');
});
test('search covers number, type, payee, reference, remarks and raw/formatted amount', () => {
  for (const search of ['Pay-10092026-001', 'FUEL', ' vendor ', 'bill-42', 'refill', '1234.5', '1,234.50']) {
    assert.ok(filterPayments(payments, { ...filters, search }).some(p => p.id === '1'), search);
  }
});
test('date endpoints are inclusive; missing dates and invalid ranges behave predictably', () => {
  assert.equal(filterPayments(payments, { ...filters, from: '2026-09-10', to: '2026-09-10' }).length, 2);
  assert.equal(filterPayments(payments, { ...filters, from: '', to: '' }).length, 3);
  assert.equal(filterPayments(payments, { ...filters, from: '2026-09-13', to: '2026-09-07' }).length, 0);
});
test('clear restores weekly results and filtering never mutates source data', () => {
  const before = JSON.stringify(payments);
  assert.equal(filterPayments(payments, { ...filters, search: 'missing' }).length, 0);
  assert.equal(filterPayments(payments, filters).length, 2);
  assert.equal(JSON.stringify(payments), before);
  assert.match(paymentCurrency.format(123456.5), /1,23,456\.50/);
});

test('demo fixtures have unique sequential numbers, supported statuses and valid weekly dates', async () => {
  const { createDemoPayments } = await import('./paymentRegisterDemo');
  const samples = createDemoPayments(new Date(2026, 8, 10));
  assert.equal(samples.length, 18);
  assert.equal(new Set(samples.map(p => p.id)).size, 18);
  assert.equal(new Set(samples.map(p => p.paymentNo)).size, 18);
  assert.equal(filterPayments(samples, filters).length, 18);
  for (const payment of samples) {
    assert.match(payment.id, /^demo-payment-/);
    assert.match(payment.paymentNo, /^Pay-\d{8}-00[123]$/);
    assert.ok(['Draft', 'Approved', 'Paid', 'Cancelled'].includes(payment.status));
    assert.equal(payment.attachments.length, 0);
  }
  assert.deepEqual(createDemoPayments(new Date(2026, 8, 10)), samples);
});
