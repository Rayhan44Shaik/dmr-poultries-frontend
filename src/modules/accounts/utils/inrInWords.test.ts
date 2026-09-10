import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inrInWords, numberInWords } from './inrInWords';

test('Indian grouping: lakh, crore and thousand are read as groups, not thousands', () => {
  assert.equal(numberInWords(1000), 'One Thousand');
  assert.equal(numberInWords(100000), 'One Lakh');
  assert.equal(numberInWords(123456), 'One Lakh Twenty Three Thousand Four Hundred Fifty Six');
  assert.equal(numberInWords(10000000), 'One Crore');
  assert.equal(numberInWords(1000000000), 'One Arab');
  assert.equal(numberInWords(123456789), 'Twelve Crore Thirty Four Lakh Fifty Six Thousand Seven Hundred Eighty Nine');
});

test('voucher wording keeps Rupees first and Only last, with paise in the middle', () => {
  assert.equal(inrInWords(1000), 'Rupees One Thousand Only');
  assert.equal(inrInWords(1), 'Rupees One Only');
  assert.equal(inrInWords(0), 'Rupees Zero Only');
  assert.equal(inrInWords(1234.5), 'Rupees One Thousand Two Hundred Thirty Four and Fifty Paise Only');
  assert.equal(inrInWords(123456.75), 'Rupees One Lakh Twenty Three Thousand Four Hundred Fifty Six and Seventy Five Paise Only');
  assert.equal(inrInWords(0.99), 'Ninety Nine Paise Only');
});

test('float noise and unusable amounts never render a wrong word', () => {
  // 1234.5000000000002 is what `0.1 + 0.2`-style arithmetic produces; paise round once.
  assert.equal(inrInWords(1234.5000000000002), 'Rupees One Thousand Two Hundred Thirty Four and Fifty Paise Only');
  for (const unusable of [Number.NaN, Number.POSITIVE_INFINITY, -1]) assert.equal(inrInWords(unusable), '');
});

test('amounts survive parsing back from a formatted register value', () => {
  const formatted = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2 }).format(123456.75);
  assert.equal(inrInWords(Number(formatted.replace(/,/g, ''))), inrInWords(123456.75));
});
