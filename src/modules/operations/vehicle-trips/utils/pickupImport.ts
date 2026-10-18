import * as XLSX from "xlsx";
import type { BoxDetail } from "../types/trip";
import { loadPdfJs } from "../../../reports/components/pdfJsLoader";

const num = (value: unknown) => {
  const parsed = Number(String(value ?? "").replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : NaN;
};

export interface PickupImportMetadata {
  vehicleNo?: string;
  driverName?: string;
  tripNo?: string;
  tripDate?: string;
}

export interface PickupImportResult {
  boxes: BoxDetail[];
  metadata: PickupImportMetadata;
}

export function continuePickupBoxNumbers(rows: BoxDetail[], existingCount: number): BoxDetail[] {
  const start = Math.max(0, Math.floor(Number(existingCount) || 0));
  return rows.map((row, index) => ({
    ...row,
    boxNo: start + index + 1,
  }));
}

const text = (value: unknown) => String(value ?? "").trim();

function extractMetadata(rows: unknown[][]): PickupImportMetadata {
  const metadata: PickupImportMetadata = {};
  const definitions: Array<[keyof PickupImportMetadata, RegExp]> = [
    ["vehicleNo", /vehicle\s*(?:no|number|reg(?:istration)?)\b/i],
    ["driverName", /driver(?:\s*name)?\b/i],
    ["tripNo", /trip\s*(?:no|number)\b/i],
    ["tripDate", /(?:trip\s*)?date\b/i],
  ];
  for (const row of rows) {
    for (let col = 0; col < row.length; col += 1) {
      const cell = text(row[col]);
      if (!cell) continue;
      for (const [key, label] of definitions) {
        if (metadata[key] || !label.test(cell)) continue;
        const inline = cell.match(/[:\-]\s*(.+)$/)?.[1]?.trim();
        const adjacent = text(row[col + 1]);
        const value = inline || adjacent;
        if (value && !label.test(value)) metadata[key] = value;
      }
    }
  }
  return metadata;
}

export function parsePickupRows(rows: unknown[][]): PickupImportResult {
  const normalized = rows.filter((row) => row.some((cell) => String(cell ?? "").trim()));
  const headerIndex = normalized.findIndex((row) => {
    const text = row.map((cell) => String(cell ?? "").toLowerCase()).join(" ");
    return /box/.test(text) && /bird/.test(text) && /weight|wt/.test(text);
  });
  if (headerIndex < 0) throw new Error("Could not find Box, Birds and Weight columns.");
  const header = normalized[headerIndex].map((cell) => text(cell).toLowerCase());
  const boxCols = header.flatMap((cell, index) => /box/.test(cell) ? [index] : []);
  const groups = boxCols.map((boxCol, groupIndex) => {
    const end = boxCols[groupIndex + 1] ?? header.length;
    const birdsOffset = header.slice(boxCol, end).findIndex((cell) => /bird|qty|count/.test(cell));
    const weightOffset = header.slice(boxCol, end).findIndex((cell) => /weight|wt|kg/.test(cell));
    return {
      boxCol,
      birdsCol: birdsOffset < 0 ? -1 : boxCol + birdsOffset,
      weightCol: weightOffset < 0 ? -1 : boxCol + weightOffset,
    };
  }).filter((group) => group.birdsCol >= 0 && group.weightCol >= 0);
  if (!groups.length) throw new Error("Could not find Box, Birds and Weight columns.");
  const boxes: BoxDetail[] = [];
  for (const row of normalized.slice(headerIndex + 1)) {
    for (const group of groups) {
      const parsed: BoxDetail = {
        boxNo: num(row[group.boxCol]),
        birds: num(row[group.birdsCol]),
        weight: num(row[group.weightCol]),
        avgWeight: null,
      };
      if (Number.isInteger(parsed.boxNo) && parsed.boxNo > 0 && Number.isInteger(parsed.birds) && parsed.birds > 0 && parsed.weight > 0) {
        boxes.push(parsed);
      }
    }
  }
  const seen = new Set<number>();
  for (const row of boxes) {
    if (seen.has(row.boxNo)) throw new Error(`Box ${row.boxNo} appears more than once.`);
    seen.add(row.boxNo);
    row.avgWeight = Number((row.weight / row.birds).toFixed(2));
  }
  if (!boxes.length) throw new Error("No valid box rows were found.");
  boxes.sort((a, b) => a.boxNo - b.boxNo);
  return { boxes, metadata: extractMetadata(normalized.slice(0, headerIndex)) };
}

export async function parsePickupImport(file: File): Promise<PickupImportResult> {
  const lower = file.name.toLowerCase();
  if (/\.xlsx?$/.test(lower)) {
    const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    return parsePickupRows(XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false }));
  }
  if (lower.endsWith(".pdf")) {
    const [pdfjs, worker] = await loadPdfJs();
    // Vite resolves `?url` to a string in production. Node's deterministic
    // binary-fixture harness loads pdfjs directly and uses its built-in fake
    // worker, so do not assign the module object as an invalid worker URL.
    if (typeof worker.default === "string") pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    const lines: unknown[][] = [];
    for (let pageNo = 1; pageNo <= pdf.numPages; pageNo += 1) {
      const content = await (await pdf.getPage(pageNo)).getTextContent();
      const text = content.items.map((item) => "str" in item ? item.str : "").join(" ");
      for (const match of text.matchAll(/(?:box\s*)?(\d+)\s+(\d+)\s+(\d+(?:\.\d+)?)/gi)) {
        lines.push([match[1], match[2], match[3]]);
      }
    }
    return parsePickupRows([["Box", "Birds", "Weight"], ...lines]);
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

export function validatePickupAppend(existing: BoxDetail[], incoming: BoxDetail[], capacity: number): string[] {
  const combined = [...existing, ...incoming];
  const errors = validatePickupImport(combined, capacity);
  if (capacity > 0 && combined.length > capacity) {
    const remaining = Math.max(0, capacity - existing.length);
    return [`Only ${remaining} vehicle box slot${remaining === 1 ? "" : "s"} remain, but this file contains ${incoming.length} boxes.`];
  }
  return errors;
}
