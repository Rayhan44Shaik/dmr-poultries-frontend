/**
 * Shop bulk-import configuration.
 *
 * Uses the existing transactional POST /masters/shops/bulk endpoint
 * (addShopsBulk) with fields supported by the current Shop contract.
 */
import type { BulkImportConfig } from "../components/bulk-import/bulkImportTypes";
import type { Shop } from "./types/shop";
import type { ShopInput } from "./services/shopService";

export type ShopBulkRow = {
  shopNumber: string;
  shopName: string;
  ownerName: string;
  phoneNumber: string;
  secondaryPhoneNumber: string;
  email: string;
  city: string;
  address: string;
  latitude: string;
  longitude: string;
  paperRate: number;
  associationType: string;
  status: "Active" | "Inactive";
  openingBalance: number;
};

function toShopPayload(row: ShopBulkRow): ShopInput {
  return {
    shopNumber: row.shopNumber.trim(),
    shopName: row.shopName.trim(),
    ownerName: row.ownerName.trim(),
    phoneNumber: row.phoneNumber.trim(),
    secondaryPhoneNumber: row.secondaryPhoneNumber.trim(),
    email: row.email.trim(),
    city: row.city.trim(),
    address: row.address.trim(),
    latitude: row.latitude.trim() ? parseFloat(row.latitude.trim()) : 0,
    longitude: row.longitude.trim() ? parseFloat(row.longitude.trim()) : 0,
    paperRate: row.paperRate,
    associationType: row.associationType.trim(),
    status: row.status,
    openingBalance: row.openingBalance,
  };
}

function validateShopRow(row: ShopBulkRow, existing: Shop[]): string[] {
  const errors: string[] = [];
  const shopNumber = row.shopNumber.trim();
  const shopName = row.shopName.trim();
  const ownerName = row.ownerName.trim();
  const phoneNumber = row.phoneNumber.trim();
  const secondaryPhoneNumber = row.secondaryPhoneNumber.trim();
  const email = row.email.trim();
  const city = row.city.trim();
  const latitude = row.latitude.trim();
  const longitude = row.longitude.trim();
  const paperRate = row.paperRate;

  if (!shopName) errors.push("Shop Name is required.");
  else if (shopName.length < 3) errors.push("Shop Name must contain at least 3 characters.");

  if (!ownerName) errors.push("Owner Name is required.");
  else if (ownerName.length < 3) errors.push("Owner Name must contain at least 3 characters.");

  if (!phoneNumber) errors.push("Mobile Number is required.");
  else if (!/^[0-9]{10}$/.test(phoneNumber)) errors.push("Mobile Number must be exactly 10 digits.");

  if (secondaryPhoneNumber !== "" && !/^[0-9]{10}$/.test(secondaryPhoneNumber)) {
    errors.push("Secondary Mobile Number must be exactly 10 digits.");
  }

  if (email !== "" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push("Please enter a valid email address.");
  }

  if (!city) errors.push("City is required.");

  if (latitude !== "") {
    const lat = parseFloat(latitude);
    if (isNaN(lat) || lat < -90 || lat > 90) {
      errors.push("Latitude must be between -90 and 90.");
    }
  }

  if (longitude !== "") {
    const lng = parseFloat(longitude);
    if (isNaN(lng) || lng < -180 || lng > 180) {
      errors.push("Longitude must be between -180 and 180.");
    }
  }

  if (paperRate < 1 || paperRate > 30 || !Number.isInteger(paperRate)) {
    errors.push("Paper Rate must be an integer between 1 and 30.");
  }

  if (!row.associationType.trim()) {
    errors.push("Association Type is required.");
  }

  const duplicate = existing.some(
    (s) => s.shopName.trim().toLowerCase() === shopName.toLowerCase()
  );
  if (duplicate) errors.push("Shop Name already exists.");

  return errors;
}

type ShopBulkDeps = {
  /** Wraps the transactional POST /masters/shops/bulk endpoint. */
  addShopsBulk: (inputs: ShopInput[]) => Promise<unknown>;
  /** Re-fetch the shops list (hook's reload). */
  reload: () => Promise<unknown>;
};

/** Build the full Shop BulkImportConfig wired to the shops hook. */
export function buildShopBulkImportConfig({
  addShopsBulk,
  reload,
}: ShopBulkDeps): BulkImportConfig<ShopBulkRow, Shop> {
  return {
    title: "Bulk Import Shops",
    subtitle: "Upload shops in one batch",
    noun: "Shop",
    nounPlural: "Shops",
    filenamePrefix: "Shops",
    columns: [
      { key: "Shop Number", sample: "SHOP-000001" },
      { key: "Shop Name", required: true, sample: "Ramesh Chicken Shop" },
      { key: "Owner Name", required: true, sample: "Ramesh Kumar" },
      { key: "Phone", aliases: ["Mobile Number", "Phone Number"], required: true, sample: "9876543210" },
      { key: "Secondary Phone", aliases: ["Secondary Mobile", "Secondary Mobile Number"], sample: "9876543211" },
      { key: "Email", aliases: ["Email ID", "email"], sample: "shop@example.com" },
      { key: "City", required: true, sample: "Bhimavaram" },
      { key: "Address", sample: "Main Road, 2nd Lane, Bhimavaram, West Godavari, Andhra Pradesh" },
      { key: "Latitude", sample: "16.544123" },
      { key: "Longitude", sample: "81.523456" },
      { key: "Paper Rate", required: true, sample: "5" },
      { key: "Association Type", required: true, sample: "Association A" },
      { key: "Opening Balance", sample: "12000" },
      { key: "Status", sample: "Active" },
    ],
    parseRow: (record): ShopBulkRow => {
      const status = String(record["Status"] ?? "Active").trim();
      return {
        shopNumber: String(record["Shop Number"] ?? "").trim(),
        shopName: String(record["Shop Name"] ?? "").trim(),
        ownerName: String(record["Owner Name"] ?? "").trim(),
        phoneNumber: String(record["Phone"] ?? "").trim(),
        secondaryPhoneNumber: String(record["Secondary Phone"] ?? "").trim(),
        email: String(record["Email"] ?? "").trim(),
        city: String(record["City"] ?? "").trim(),
        address: String(record["Address"] ?? "").trim(),
        latitude: String(record["Latitude"] ?? "").trim(),
        longitude: String(record["Longitude"] ?? "").trim(),
        paperRate: parseInt(String(record["Paper Rate"] ?? "1"), 10) || 1,
        associationType: String(record["Association Type"] ?? "").trim(),
        openingBalance: parseFloat(String(record["Opening Balance"] ?? "0")) || 0,
        status: status === "Inactive" ? "Inactive" : "Active",
      };
    },
    validateRow: validateShopRow,
    duplicateKey: (row) => row.shopName,
    toPayload: toShopPayload,
    createMany: async (rows, onProgress) => {
      const total = rows.length;
      const payloads = rows.map((r) => toShopPayload(r.data));
      onProgress(0, total);
      try {
        await addShopsBulk(payloads);
        onProgress(total, total);
        return { total, attempted: total, imported: total, failed: 0, errors: [] };
      } catch (err) {
        onProgress(total, total);
        return {
          total,
          attempted: total,
          imported: 0,
          failed: total,
          errors: [{
            row: 0,
            message: err instanceof Error ? err.message : "Shop import failed.",
          }],
        };
      }
    },
    refresh: reload,
    errorToString: (err) =>
      err instanceof Error ? err.message : "Import failed. Please try again.",
  };
}