import assert from "node:assert/strict";
import test from "node:test";
import { escapeHtml } from "./escapeHtml";

test("leaves ordinary text unchanged", () => {
  assert.equal(escapeHtml("Fuel bill FUEL-1042"), "Fuel bill FUEL-1042");
});

test("escapes HTML markup characters in the correct order", () => {
  assert.equal(escapeHtml("A & B < C > D"), "A &amp; B &lt; C &gt; D");
  assert.equal(escapeHtml("&lt;"), "&amp;lt;", "pre-escaped text must not pass through");
});

test("escapes both quote characters for attribute contexts", () => {
  assert.equal(escapeHtml('10" pipe'), "10&quot; pipe");
  assert.equal(escapeHtml("Driver's name"), "Driver&#39;s name");
  assert.equal(escapeHtml(`"'`), "&quot;&#39;");
});

test("keeps backslashes, parentheses and path separators literal", () => {
  assert.equal(escapeHtml(String.raw`C:\receipts\(nov)\file.pdf`), String.raw`C:\receipts\(nov)\file.pdf`);
});

test("preserves newlines, carriage returns and tabs", () => {
  assert.equal(escapeHtml("line 1\nline 2\r\nline 3\tend"), "line 1\nline 2\r\nline 3\tend");
});

test("preserves Unicode, including Telugu and Indian names", () => {
  assert.equal(escapeHtml("రాము & శ్రీ బాలాజీ"), "రాము &amp; శ్రీ బాలాజీ");
  assert.equal(escapeHtml("A. P. Rao — ₹1,234.50"), "A. P. Rao — ₹1,234.50");
});

test("handles the existing nullish and numeric contract", () => {
  assert.equal(escapeHtml(""), "");
  assert.equal(escapeHtml(null), "");
  assert.equal(escapeHtml(undefined), "");
  assert.equal(escapeHtml(0), "0");
  assert.equal(escapeHtml(1234.5), "1234.5");
});

test("escapes a long combined description once", () => {
  const input = `Diesel <urgent> & "receipt" from O'Brien\n${"x".repeat(5000)}`;
  const output = escapeHtml(input);
  assert.ok(output.startsWith("Diesel &lt;urgent&gt; &amp; &quot;receipt&quot; from O&#39;Brien\n"));
  assert.ok(output.endsWith("x".repeat(5000)));
  assert.equal(output.match(/&amp;/g)?.length, 1);
});
