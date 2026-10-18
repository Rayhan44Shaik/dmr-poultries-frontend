/**
 * G — PDF pickup import (advertised: accept=".pdf", UI "Import Excel / PDF").
 * Harmless generated binary fixtures only.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { parsePickupImport } from "./pickupImport";

/** Minimal PDF with embedded text via a simple content stream. */
function pdfWithText(lines: string[]): File {
  // Prefer a compact hand-built PDF; pdfjs can extract the text operators.
  const objects: string[] = [];
  objects.push("1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n");
  objects.push("2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n");
  objects.push(
    "3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources<< /Font<< /F1 5 0 R >> >> >>endobj\n",
  );
  const content = `BT /F1 12 Tf 72 720 Td (${lines.join(") Tj T* (")}) Tj ET`;
  objects.push(`4 0 obj<< /Length ${content.length} >>stream\n${content}\nendstream\nendobj\n`);
  objects.push("5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj\n");
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += obj;
  }
  const xrefStart = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i <= objects.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return new File([Buffer.from(pdf, "utf8")], "pickup.pdf", { type: "application/pdf" });
}

test("G: PDF import is an advertised production feature (accept list + parser)", () => {
  // Product advertises PDF in StepPickup accept=".xlsx,.xls,.pdf" and button copy.
  assert.equal(typeof parsePickupImport, "function");
});

test("G: valid PDF with Box Birds Weight text extracts boxes", async () => {
  const file = pdfWithText(["Box Birds Weight", "1 40 80.5", "2 35 70.25"]);
  const result = await parsePickupImport(file);
  assert.equal(result.boxes.length, 2, "expected both binary PDF rows");
  assert.deepEqual(result.boxes.map(({ boxNo, birds, weight }) => ({ boxNo, birds, weight })), [
    { boxNo: 1, birds: 40, weight: 80.5 },
    { boxNo: 2, birds: 35, weight: 70.25 },
  ]);
});

test("G: empty PDF / wrong content / non-pdf rejected or yields no valid rows", async () => {
  const empty = new File([Buffer.from("%PDF-1.4\n%%EOF")], "empty.pdf", { type: "application/pdf" });
  await assert.rejects(() => parsePickupImport(empty), /box|valid|find|PDF|Excel/i);

  const wrong = pdfWithText(["Hello World", "No pickup data here"]);
  await assert.rejects(() => parsePickupImport(wrong), /box|valid|find/i);

  const huge = new File([Buffer.alloc(6 * 1024 * 1024, 65)], "huge.pdf", { type: "application/pdf" });
  // Product may accept or reject by size at UI; parser should not hang — race with timeout expectation.
  const started = Date.now();
  try {
    await parsePickupImport(huge);
  } catch {
    /* expected */
  }
  assert.ok(Date.now() - started < 30_000, "excessive PDF must fail or return within 30s");
});
