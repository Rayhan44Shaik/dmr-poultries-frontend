import * as XLSX from "xlsx";
import type { BoxDetail } from "../types/trip";
import { loadPdfJs } from "../../../reports/components/pdfJsLoader";

const num = (value: unknown) => {
  const parsed = Number(String(value ?? "").replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : NaN;
};

function rowsToBoxes(rows: unknown[][]): BoxDetail[] {
  const normalized = rows.filter((row) => row.some((cell) => String(cell ?? "").trim()));
  const headerIndex = normalized.findIndex((row) => {
    const text = row.map((cell) => String(cell ?? "").toLowerCase()).join(" ");
    return /box/.test(text) && /bird/.test(text) && /weight|wt/.test(text);
  });
  if (headerIndex < 0) throw new Error("Could not find Box, Birds and Weight columns.");
  const header = normalized[headerIndex].map((cell) => String(cell ?? "").trim().toLowerCase());
  const boxCol = header.findIndex((cell) => /box/.test(cell));
  const birdsCol = header.findIndex((cell) => /bird|qty|count/.test(cell));
  const weightCol = header.findIndex((cell) => /weight|wt|kg/.test(cell));
  const boxes: BoxDetail[] = normalized.slice(headerIndex + 1).map((row): BoxDetail => ({
    boxNo: num(row[boxCol]), birds: num(row[birdsCol]), weight: num(row[weightCol]), avgWeight: null,
  })).filter((row) => Number.isInteger(row.boxNo) && row.boxNo > 0 && Number.isInteger(row.birds) && row.birds > 0 && row.weight > 0);
  const seen = new Set<number>();
  for (const row of boxes) {
    if (seen.has(row.boxNo)) throw new Error(`Box ${row.boxNo} appears more than once.`);
    seen.add(row.boxNo);
    row.avgWeight = Number((row.weight / row.birds).toFixed(2));
  }
  if (!boxes.length) throw new Error("No valid box rows were found.");
  return boxes;
}

export async function parsePickupImport(file: File): Promise<BoxDetail[]> {
  const lower = file.name.toLowerCase();
  if (/\.xlsx?$/.test(lower)) {
    const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    return rowsToBoxes(XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false }));
  }
  if (lower.endsWith(".pdf")) {
    const [pdfjs, worker] = await loadPdfJs();
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    const lines: unknown[][] = [];
    for (let pageNo = 1; pageNo <= pdf.numPages; pageNo += 1) {
      const content = await (await pdf.getPage(pageNo)).getTextContent();
      const text = content.items.map((item) => "str" in item ? item.str : "").join(" ");
      for (const match of text.matchAll(/(?:box\s*)?(\d+)\s+(\d+)\s+(\d+(?:\.\d+)?)/gi)) {
        lines.push([match[1], match[2], match[3]]);
      }
    }
    return rowsToBoxes([["Box", "Birds", "Weight"], ...lines]);
  }
  throw new Error("Choose an Excel (.xlsx/.xls) or PDF file.");
}

export function validatePickupImport(rows: BoxDetail[], capacity: number): string[] {
  const errors: string[] = [];
  const seen = new Set<number>();
  for (const [index, row] of rows.entries()) {
    if (!Number.isInteger(row.boxNo) || row.boxNo <= 0) errors.push(`Row ${index + 1}: Box number must be a positive whole number.`);
    else if (seen.has(row.boxNo)) errors.push(`Box ${row.boxNo} appears more than once.`);
    else seen.add(row.boxNo);
    if (!Number.isInteger(row.birds) || row.birds <= 0) errors.push(`Box ${row.boxNo || index + 1}: Birds must be a positive whole number.`);
    if (!Number.isFinite(row.weight) || row.weight <= 0) errors.push(`Box ${row.boxNo || index + 1}: Weight must be greater than zero.`);
  }
  if (capacity <= 0) errors.push("Vehicle box capacity is unavailable. Select a vehicle with a box limit first.");
  if (capacity > 0 && rows.length > capacity) errors.push(`File has ${rows.length} boxes, but this vehicle can load only ${capacity}.`);
  if (capacity > 0 && rows.some((row) => row.boxNo > capacity)) errors.push(`Box numbers must be between 1 and ${capacity}.`);
  return errors;
}
