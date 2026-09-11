import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyDemoWrite, createDemoPayments, nextDemoPaymentNo, resetDemoPayments } from './paymentRegisterDemo';
import type { PaymentWritePayload } from '../types/payment.types';

const reference = new Date(2026, 8, 10);
const samples = createDemoPayments(reference);
const target = samples[0];
const payload: PaymentWritePayload = {
  paymentDate: '2026-09-10', paymentType: 'Fuel Payment', paymentMode: 'Cash', paidTo: 'Edited In Preview',
  amount: 999, referenceNo: 'SAMPLE-BILL-001', category: 'Fuel', remarks: '', status: 'Draft', createdBy: 'qa',
};

test('sample numbers are year-first, unique and sequenced per day', () => {
  assert.match(target.paymentNo, /^Pay-\d{8}-\d{3}$/);
  assert.equal(target.paymentNo.slice(4, 8), '2026', 'the date part starts with the year');
  assert.equal(nextDemoPaymentNo(samples, '2026-09-07'), 'Pay-20260907-004', '001-003 exist for that date');
  assert.equal(nextDemoPaymentNo([], '2026-09-11'), 'Pay-20260911-001');
  assert.equal(nextDemoPaymentNo([{ paymentNo: 'Pay-20260911-001' }], '2026-09-11'), 'Pay-20260911-002');
});

test('writing a sample row updates it in place and keeps its identity', () => {
  const { rows, saved } = applyDemoWrite(samples, { ...payload, paymentMode: 'UPI' }, target, reference);
  assert.equal(rows.length, samples.length, 'no row is added');
  assert.equal(saved.id, target.id);
  assert.equal(saved.paymentNo, target.paymentNo, 'a preview edit never invents a payment number');
  assert.equal(saved.createdAt, target.createdAt);
  assert.equal(saved.paidTo, 'Edited In Preview');
  assert.equal(saved.paymentMode, 'UPI');
  assert.notEqual(saved.updatedAt, target.updatedAt);
  assert.equal(rows[0], saved);
  assert.equal(samples[0], target, 'the source list is never mutated');
});

test('creating a sample row lands at the top with the next number for its date', () => {
  const { rows, saved } = applyDemoWrite(samples, payload, null, reference);
  assert.equal(rows.length, samples.length + 1);
  assert.equal(rows[0], saved);
  assert.match(saved.id, /^demo-payment-new-/, 'the prefix is what every sample guard checks');
  assert.equal(saved.paymentNo, 'Pay-20260910-004', '001-003 already exist for 10 Sep');
  assert.deepEqual(saved.attachments, []);
  assert.equal(saved.createdBy, 'qa', 'an authored row keeps its author');
  assert.equal(applyDemoWrite(samples, { ...payload, createdBy: '' }, null, reference).saved.createdBy, 'Sample preview');
  assert.equal(new Set(rows.map(row => row.paymentNo)).size, rows.length, 'numbers stay unique');
});

test('a missing category follows the payment type, like the entry sheet does', () => {
  const withoutCategory = { ...payload, category: '' };
  assert.equal(applyDemoWrite(samples, withoutCategory, null, reference).saved.category, 'Fuel Payment');
});

test('reset returns the untouched sample set', () => {
  const edited = applyDemoWrite(applyDemoWrite(samples, payload, target, reference).rows, payload, null, reference).rows;
  assert.notDeepEqual(edited, samples);
  assert.deepEqual(resetDemoPayments(reference), samples);
  assert.equal(samples.length, 18);
});
