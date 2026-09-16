import test from "node:test";
import assert from "node:assert/strict";
import { amountInWords } from "./amountInWords";

test("amountInWords — English, Indian scales", () => {
  assert.equal(amountInWords(0), "Zero Rupees Only");
  assert.equal(amountInWords(1), "One Rupee Only");
  assert.equal(amountInWords(15), "Fifteen Rupees Only");
  assert.equal(amountInWords(2000), "Two Thousand Rupees Only");
  assert.equal(amountInWords(2500), "Two Thousand Five Hundred Rupees Only");
  assert.equal(amountInWords(15351), "Fifteen Thousand Three Hundred Fifty One Rupees Only");
  assert.equal(amountInWords(100000), "One Lakh Rupees Only");
  assert.equal(amountInWords(250750), "Two Lakh Fifty Thousand Seven Hundred Fifty Rupees Only");
  assert.equal(amountInWords(10000000), "One Crore Rupees Only");
  assert.equal(amountInWords(12345678), "One Crore Twenty Three Lakh Forty Five Thousand Six Hundred Seventy Eight Rupees Only");
});

test("amountInWords — paise", () => {
  assert.equal(amountInWords(2000.5), "Two Thousand Rupees and Fifty Paise Only");
  assert.equal(amountInWords(10.05), "Ten Rupees and Five Paise Only");
  assert.equal(amountInWords(1.01), "One Rupee and One Paisa Only");
  // Rounding must not drift (0.565 → 57 paise).
  assert.equal(amountInWords(99.565), "Ninety Nine Rupees and Fifty Seven Paise Only");
});

test("amountInWords — Telugu keeps the digits' meaning with Telugu words", () => {
  assert.equal(amountInWords(0, "te"), "సున్నా రూపాయలు మాత్రమే");
  assert.equal(amountInWords(1, "te"), "ఒక రూపాయి మాత్రమే");
  assert.equal(amountInWords(2000, "te"), "రెండు వేల రూపాయలు మాత్రమే");
  assert.equal(amountInWords(2500, "te"), "రెండు వేల ఐదు వందల రూపాయలు మాత్రమే");
  assert.equal(amountInWords(15000, "te"), "పదిహేను వేల రూపాయలు మాత్రమే");
  assert.equal(amountInWords(100000, "te"), "లక్ష రూపాయలు మాత్రమే");
  assert.equal(amountInWords(1500.5, "te"), "వెయ్యి ఐదు వందల రూపాయలు యాభై పైసలు మాత్రమే");
  // Scale words take their oblique form before "రూపాయలు" — "వేల రూపాయలు",
  // never the standing "వేలు రూపాయలు".
  assert.equal(amountInWords(25000, "te"), "ఇరవై ఐదు వేల రూపాయలు మాత్రమే");
  assert.equal(amountInWords(250750, "te"), "రెండు లక్షల యాభై వేల ఏడు వందల యాభై రూపాయలు మాత్రమే");
  assert.equal(amountInWords(25000000, "te"), "రెండు కోట్ల యాభై లక్షల రూపాయలు మాత్రమే");
  // Digits stay digits: they are never spelled out in either language.
  assert.match(amountInWords(1234567, "te"), /^[\u0C00-\u0C7F\s]+$/);
});

test("amountInWords — never throws on junk input", () => {
  assert.equal(amountInWords(Number.NaN), "Zero Rupees Only");
  assert.equal(amountInWords(-50), "Fifty Rupees Only");
});
