/**
 * Shared bulk-import utilities:
 *  - template generation (.xlsx)
 *  - file parsing + column/header normalization
 *  - sequential per-row create helper for masters without a bulk endpoint
 */

import * as XLSX from "xlsx";
import type {
  BulkImportColumn,
  BulkImportConfig,
  CreateManyResult,
  ParsedImportRow,
} from "./bulkImportTypes";

/** Download an .xlsx template containing headers + one sample row. */
export function downloadImportTemplate<T, E = T>(
  config: BulkImportConfig<T, E>
): void {
  const headers = config.columns.map((c) =>
    c.required ? `${c.key} *` : c.key
  );
  const sampleRow = config.columns.map((c) => c.sample);

  const worksheet = XLSX.utils.aoa_to_sheet([headers]);
  worksheet["!cols"] = config.columns.map(() => ({ wch: 22 }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Template");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([headers, sampleRow]), "Example - do not import");

  const filename = `${config.filenamePrefix}_Template.xlsx`;
  XLSX.writeFile(workbook, filename);
}

function acceptedLabels(column: BulkImportColumn): string[] {
  return [column.key, ...(column.aliases ?? [])];
}

/** Normalize case, surrounding whitespace, and a trailing template-required marker. */
function normalizeHeaderLabel(label: string): string {
  return label.trim().replace(/\s*\*\s*$/, "").trim().toLowerCase();
}

/**
 * Map uploaded header labels to canonical keys. A header like "Mobile Number *"
 * or "Phone *" is matched against each column's accepted labels.
 */
function normalizeHeaders(
  rawHeaders: string[],
  columns: BulkImportColumn[]
): Record<string, string> {
  const mapping: Record<string, string> = {};
  const normalized = new Map(
    rawHeaders.map((header) => [normalizeHeaderLabel(header), header])
  );

  for (const column of columns) {
    const match = acceptedLabels(column).find((label) =>
      normalized.has(normalizeHeaderLabel(label))
    );
    if (match) {
      mapping[column.key] = normalized.get(normalizeHeaderLabel(match))!;
    }
  }
  return mapping;
}

/** Check required columns are present in the uploaded file. */
export function findMissingColumns(
  rawHeaders: string[],
  columns: BulkImportColumn[]
): string[] {
  const headers = new Set(rawHeaders.map(normalizeHeaderLabel));
  return columns
    .filter(
      (column) =>
        column.required &&
        !acceptedLabels(column).some((label) =>
          headers.has(normalizeHeaderLabel(label))
        )
    )
    .map((column) => column.key);
}

export type ParsedFile<T> = {
  rows: ParsedImportRow<T>[];
  missingColumns: string[];
  parseError: string | null;
};

/**
 * Read an .xlsx/.xls/.csv file, normalize every row to canonical keys,
 * then run the config's parseRow + validateRow.
 */
export async function parseImportFile<T, E = T>(
  file: File,
  config: BulkImportConfig<T, E>,
  existing: E[]
): Promise<ParsedFile<T>> {
  const parsed: ParsedFile<T> = {
    rows: [],
    missingColumns: [],
    parseError: null,
  };

  let workbook: XLSX.WorkBook;
  try {
    if (!/\.(xlsx|xls|csv)$/i.test(file.name) || file.size === 0 || file.size > 5 * 1024 * 1024) {
      throw new Error("Use a non-empty .xlsx, .xls or .csv file no larger than 5 MB.");
    }
    const buffer = await file.arrayBuffer();
    // XLSX is a ZIP archive. Bound advertised decompressed data before parsing.
    const view = new DataView(buffer);
    let expanded = 0;
    for (let i = 0; i + 46 <= view.byteLength; i++) {
      if (view.getUint32(i, true) !== 0x02014b50) continue;
      expanded += view.getUint32(i + 24, true);
      if (expanded > 20 * 1024 * 1024) throw new Error("The workbook expands beyond the 20 MB safety limit.");
    }
    workbook = XLSX.read(buffer, { type: "array", sheetRows: 1002, cellDates: true, cellFormula: true });
  } catch (err) {
    parsed.parseError = err instanceof Error ? err.message : "Could not read this file. Upload a valid workbook or CSV.";
    return parsed;
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    parsed.parseError = "The file does not contain any sheets.";
    return parsed;
  }
  const worksheet = workbook.Sheets[sheetName];
  const range = XLSX.utils.decode_range(worksheet["!fullref"] ?? worksheet["!ref"] ?? "A1");
  if (range.e.r > 1000 || range.e.c > 99) {
    parsed.parseError = "An import may contain at most 1,000 data rows and 100 columns.";
    return parsed;
  }
  for (const [address, cell] of Object.entries(worksheet)) {
    if (address.startsWith("!")) continue;
    if (cell.f) { parsed.parseError = `Formula at ${address}: replace formulas with values before importing.`; return parsed; }
    if (cell.t === "d" && cell.v instanceof Date) {
      cell.t = "s"; cell.v = cell.v.toISOString().slice(0, 10); delete cell.w;
    }
  }
  const headerRows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1, defval: "" });
  const rawHeaders = (headerRows[0] ?? []).map(String);
  const nonEmpty = rawHeaders.filter(h => h.trim()).map(normalizeHeaderLabel);
  if (new Set(nonEmpty).size !== nonEmpty.length) {
    parsed.parseError = "Duplicate column headers are ambiguous. Give each column one unique header.";
    return parsed;
  }
  for (const column of config.columns) {
    if (rawHeaders.filter(h => acceptedLabels(column).some(label => normalizeHeaderLabel(label) === normalizeHeaderLabel(h))).length > 1) {
      parsed.parseError = `More than one column maps to ${column.key}. Keep only one.`;
      return parsed;
    }
  }
  const json: Record<string, unknown>[] = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

  if (json.length === 0) {
    parsed.parseError = "The file does not contain any data rows.";
    return parsed;
  }

  parsed.missingColumns = findMissingColumns(rawHeaders, config.columns);
  if (parsed.missingColumns.length > 0) {
    parsed.parseError =
      "The file is missing required columns: " + parsed.missingColumns.join(", ");
    return parsed;
  }

  const mapping = normalizeHeaders(rawHeaders, config.columns);
  const seen = new Set<string>();

  parsed.rows = json
    .filter((row) => Object.values(row).some((v) => v !== "" && v != null))
    .map((rawRow, index): ParsedImportRow<T> => {
      const record: Record<string, unknown> = {};
      for (const column of config.columns) {
        const sourceHeader = mapping[column.key];
        record[column.key] = sourceHeader ? rawRow[sourceHeader] : "";
      }

      const data = config.parseRow(record);
      const errors = [...config.validateRow(data, existing)];
      for (const [key, value] of Object.entries(record)) {
        if (typeof value === "string" && /^[=+@]/.test(value.trim())) errors.push(`${key}: formula-like values are not allowed.`);
        if (/status/i.test(key) && value && !["Active", "Inactive", "Suspended"].includes(String(value).trim())) errors.push("Status must be Active, Inactive or Suspended.");
      }

      const dupKey = config.duplicateKey?.(data);
      if (dupKey !== undefined) {
        const normalizedKey = String(dupKey).trim().toLowerCase();
        if (seen.has(normalizedKey)) {
          errors.push(`Duplicate ${config.noun.toLowerCase()} within the uploaded file.`);
        }
        seen.add(normalizedKey);
      }

      return {
        rowNumber: index + 2, // +1 data offset from header row, +1 from 0-index
        values: record,
        data,
        errors,
      };
    });

  return parsed;
}

/**
 * Helper for masters that only have a single-create API: runs every valid row
 * through createOne, collecting per-row failures, and reports progress.
 */
export async function executeSequentialImport<T>(
  rows: ParsedImportRow<T>[],
  createOne: (data: T) => Promise<void>,
  errorToString: (err: unknown) => string,
  onProgress: (done: number, total: number) => void
): Promise<CreateManyResult> {
  const total = rows.length;
  const errors: CreateManyResult["errors"] = [];
  let imported = 0;

  onProgress(0, total);
  for (let i = 0; i < rows.length; i += 1) {
    try {
      await createOne(rows[i].data);
      imported += 1;
    } catch (err) {
      errors.push({ row: rows[i].rowNumber, message: errorToString(err) });
    }
    onProgress(i + 1, total);
  }

  return {
    total,
    attempted: total,
    imported,
    failed: errors.length,
    errors,
  };
}
