/**
 * Banks master — PostgreSQL ONLY via shared Axios helpers.
 * Static/mock arrays and localStorage are not used as a data source.
 */

import {
  apiDelete,
  apiGet,
  apiPost,
  apiPut,
  handleApiError,
} from "../../../../api";
import type { Bank } from "../types/bank";

const BANKS_PATH = "/masters/banks";

/** Legacy browser keys that previously held mock bank lists. */
const LEGACY_STORAGE_KEYS = [
  "dmr-banks",
  "dmr_poultries_banks_master_data",
] as const;

/** Cache filled exclusively by GET /api/masters/banks. */
let banksCache: Bank[] = [];

export type BankInput = Omit<Bank, "id" | "bankNo"> & {
  bankNo?: number;
};

function clearLegacyBankStorage(): void {
  try {
    for (const key of LEGACY_STORAGE_KEYS) {
      localStorage.removeItem(key);
    }
  } catch {
    /* ignore storage access errors */
  }
}

function normalizeStatus(status: unknown): Bank["status"] {
  if (status === "Active" || status === "Inactive") return status;
  throw new Error("Invalid Bank Master status in API response.");
}

export function mapBank(raw: Record<string, unknown>): Bank {
  const id = Number(raw.id);
  const bankNo = Number(raw.bankNo ?? raw.bank_no);
  if (!Number.isInteger(id) || id <= 0 || !Number.isInteger(bankNo) || bankNo <= 0) {
    throw new Error("Invalid Bank Master identity in API response.");
  }
  return {
    id,
    bankNo,
    bankName: String(raw.bankName ?? raw.bank_name ?? ""),
    branch: String(raw.branch ?? ""),
    accountNumber: String(raw.accountNumber ?? raw.account_number ?? ""),
    ifscCode: String(raw.ifscCode ?? raw.ifsc_code ?? ""),
    upiId: String(raw.upiId ?? raw.upi_id ?? ""),
    status: normalizeStatus(raw.status),
  };
}

function toPayload(input: BankInput | Partial<Bank>): Record<string, unknown> {
  return {
    bankNo: input.bankNo,
    bankName: input.bankName?.trim(),
    branch: input.branch?.trim() ?? "",
    accountNumber: input.accountNumber?.trim() ?? "",
    ifscCode: input.ifscCode?.trim()?.toUpperCase() ?? "",
    upiId: input.upiId?.trim() ?? "",
    status: input.status ?? "Active",
  };
}

function setCacheFromApi(rows: Record<string, unknown>[] | null | undefined): Bank[] {
  if (!Array.isArray(rows) || rows.some((row) => !row || typeof row !== "object" || Array.isArray(row))) {
    throw new Error("Bank list response must be an array of records.");
  }
  banksCache = rows.map(mapBank);
  return banksCache;
}

/** Sync snapshot for other modules — reflects last successful API load only. */
export function getBanks(): Bank[] {
  return banksCache;
}

/** GET /api/masters/banks — sole source of truth for the Banks table. */
export async function loadBanks(): Promise<Bank[]> {
  clearLegacyBankStorage();
  const { data } = await apiGet<Record<string, unknown>[]>(BANKS_PATH);
  return setCacheFromApi(data);
}

/** POST /api/masters/banks */
export async function createBank(input: BankInput): Promise<Bank> {
  clearLegacyBankStorage();
  const { data } = await apiPost<Record<string, unknown>>(
    BANKS_PATH,
    toPayload(input)
  );
  return mapBank(data);
}

/** PUT /api/masters/banks/:id */
export async function updateBank(
  id: number,
  input: BankInput | Partial<Bank>
): Promise<Bank> {
  clearLegacyBankStorage();
  const { data } = await apiPut<Record<string, unknown>>(
    `${BANKS_PATH}/${id}`,
    toPayload({ ...(input as BankInput), bankNo: input.bankNo })
  );
  return mapBank(data);
}

/** DELETE /api/masters/banks/:id */
export async function deleteBank(id: number): Promise<void> {
  clearLegacyBankStorage();
  await apiDelete(`${BANKS_PATH}/${id}`);
}

/** Always re-fetch from PostgreSQL. */
export async function refreshBanks(): Promise<Bank[]> {
  return loadBanks();
}

export { handleApiError };
