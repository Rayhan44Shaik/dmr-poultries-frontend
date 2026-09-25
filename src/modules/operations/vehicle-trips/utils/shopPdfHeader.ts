// src/modules/operations/vehicle-trips/utils/shopPdfHeader.ts
//
// Pure Shop Delivery PDF header model (no DOM, no jsPDF, no assets) so the
// supervisor/driver/sub-shop mapping stays unit-testable. The renderer
// (generateShopPDF.ts) consumes ShopPdfHeaderModel and omits the
// Sub Shop/Remark row whenever subShopRemark is "".
import type { ShopDeliveryWithExtra } from "../components/Step_4/useShopDeliveryForm";
import { getEmployees } from "../../../../modules/masters/employees/services/employeeService";

/** Employee id/name link carried from the trip — never a second master. */
export interface ShopPdfEmployeeRef {
  supervisorId?: number | null;
  driverId?: number | null;
}

export interface ShopPdfEmployeeLite {
  id?: unknown;
  employeeName?: unknown;
  phoneNumber?: unknown;
}

export interface ShopPdfHeaderModel {
  supervisorName: string;
  supervisorMobile: string;
  driverName: string;
  driverMobile: string;
  vehicleNo: string;
  shopName: string;
  /** Render ONLY when non-empty — never a blank/placeholder row. */
  subShopRemark: string;
  dateValue: string;
  timeValue: string;
}

/** Blank-safe header text: never undefined/null/NaN/[object Object]. */
export function cleanPdfText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  if (typeof value === "string") {
    const v = value.trim();
    if (v === "" || v === "undefined" || v === "null" || v === "NaN") return "";
    return v;
  }
  return "";
}

function asEmployeeList(value: unknown): ShopPdfEmployeeLite[] {
  return Array.isArray(value) ? (value as ShopPdfEmployeeLite[]) : [];
}

/** Legacy browser snapshot (kept only as a fallback read — never written). */
function readLegacyEmployeeCache(): ShopPdfEmployeeLite[] {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem("dmr-employees") : null;
    if (!raw) return [];
    return asEmployeeList(JSON.parse(raw));
  } catch {
    return [];
  }
}

function matchEmployee(
  list: ShopPdfEmployeeLite[],
  id?: number | null,
  name?: string
): ShopPdfEmployeeLite | undefined {
  const nid = id == null ? NaN : Number(id);
  if (Number.isFinite(nid)) {
    const byId = list.find((e) => Number((e as { id?: unknown })?.id) === nid);
    if (byId) return byId;
  }
  const key = cleanPdfText(name).toLowerCase();
  if (!key) return undefined;
  return list.find(
    (e) => cleanPdfText((e as { employeeName?: unknown })?.employeeName).toLowerCase() === key
  );
}

function employeePhone(emp: ShopPdfEmployeeLite | undefined): string {
  return cleanPdfText(emp ? (emp as { phoneNumber?: unknown }).phoneNumber : "");
}

/**
 * Pure Shop Delivery PDF header model (no DOM, no jsPDF — unit-testable).
 * Supervisor/driver identity resolves through the SAME employee record
 * (id first, name fallback): Trip/Delivery Supervisor → Employee Master →
 * mobile. Missing values come back blank; subShopRemark comes back "" when
 * neither subShopName nor remarks carries a value, and the renderer omits
 * that row entirely.
 */
export function resolveShopPdfHeader(
  row: ShopDeliveryWithExtra,
  opts: {
    vehicleNo?: string;
    supervisorName?: string;
    supervisorPhone?: string;
    driverName?: string;
    driverMobile?: string;
    employeeRef?: ShopPdfEmployeeRef;
    employees?: ShopPdfEmployeeLite[];
    dateValue?: string;
    timeValue?: string;
  } = {}
): ShopPdfHeaderModel {
  const r = row as unknown as Record<string, unknown>;
  let employees = asEmployeeList(opts.employees);
  if (employees.length === 0) {
    try {
      employees = asEmployeeList(getEmployees());
    } catch {
      employees = [];
    }
  }
  const legacy = employees.length === 0 ? readLegacyEmployeeCache() : [];
  const pool = employees.length > 0 ? employees : legacy;

  const supEmp = matchEmployee(
    pool,
    opts.employeeRef?.supervisorId,
    opts.supervisorName ?? (r.supervisorName as string | undefined) ?? (r.supervisor as string | undefined)
  );
  const drvEmp = matchEmployee(
    pool,
    opts.employeeRef?.driverId,
    opts.driverName ?? (r.driverName as string | undefined) ?? (r.driver as string | undefined)
  );

  const supervisorName =
    cleanPdfText((supEmp as { employeeName?: unknown } | undefined)?.employeeName) ||
    cleanPdfText(opts.supervisorName ?? r.supervisorName ?? r.supervisor);
  const supervisorMobile =
    cleanPdfText(
      opts.supervisorPhone ??
        r.supervisorPhone ??
        r.supervisorMobile ??
        r.supervisorPhoneNo ??
        r.phone
    ) ||
    employeePhone(supEmp) ||
    cleanPdfText((r.employee as { phoneNumber?: unknown } | undefined)?.phoneNumber);

  const driverName =
    cleanPdfText((drvEmp as { employeeName?: unknown } | undefined)?.employeeName) ||
    cleanPdfText(opts.driverName ?? r.driverName ?? r.driver);
  const driverMobile =
    cleanPdfText(opts.driverMobile ?? r.driverMobile ?? r.driverPhone ?? r.driverPhoneNo) ||
    employeePhone(drvEmp);

  const subShopRemark =
    cleanPdfText(r.subShopName) || cleanPdfText(r.remarks);

  return {
    supervisorName,
    supervisorMobile,
    driverName,
    driverMobile,
    vehicleNo: cleanPdfText(opts.vehicleNo),
    shopName: cleanPdfText(r.shopName),
    subShopRemark,
    dateValue: cleanPdfText(opts.dateValue),
    timeValue: cleanPdfText(opts.timeValue),
  };
}
