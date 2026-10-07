// src/modules/auth/permissions.ts
// -----------------------------------------------------------------------------
// Role-based access control for DMR Poultries.
//
// Two roles sign in to the desktop app:
//   • OWNER      — full access to every page and every action.
//   • SUPERVISOR — field-entry role: trip entry/list, collections (entry only),
//                  fuel expenses (entry only), maintenance (entry only) and
//                  leave requests (add only). No dashboard, no masters, no
//                  accounts, no reports, no salary register, no performance
//                  pages — and no approve/delete anywhere.
//
// The model has two layers:
//   1. CAPABILITIES  — fine-grained action permissions (delete/approve/…).
//      A page hides or disables the UI for a capability the role lacks.
//   2. LOCATION ACCESS — which paths (+ `?tab=` deep links) a role may open.
//      Enforced by the route guard (`RequireAccess`) and used to filter the
//      sidebar / command palette / quick actions.
// -----------------------------------------------------------------------------
import { useAuth } from "../../providers/authContext";
import type { AppRole } from "./authApi";

/** Action-level permissions. */
export const CAPABILITIES = {
  TRIP_DELETE: "trip.delete",
  COLLECTION_APPROVE: "collection.approve",
  COLLECTION_REJECT: "collection.reject",
  COLLECTION_DELETE: "collection.delete",
  FUEL_APPROVE: "fuel.approve",
  FUEL_DELETE: "fuel.delete",
  MAINTENANCE_APPROVE: "maintenance.approve",
  MAINTENANCE_DELETE: "maintenance.delete",
  LEAVE_APPROVE: "leave.approve",
  LEAVE_REJECT: "leave.reject",
  LEAVE_DELETE: "leave.delete",
  DUTY_DELETE: "duty.delete",
} as const;

export type Capability = (typeof CAPABILITIES)[keyof typeof CAPABILITIES];

/** Tabs (the `?tab=` value) a role may open inside each hub section. */
export type SectionTabs = "*" | readonly string[];

export interface RoleAccess {
  /** Hub sections the role can open at all (top-level paths). */
  readonly sections: "*" | readonly string[];
  /** Allowed `?tab=` per hub section; `"*"` = every tab. */
  readonly tabs: Readonly<Record<string, SectionTabs>>;
  /** Action capabilities; `"*"` = everything. */
  readonly capabilities: "*" | readonly Capability[];
}


/** OWNER — the business owner sees and does everything. */
const OWNER_ACCESS: RoleAccess = {
  sections: "*",
  tabs: {},
  capabilities: "*",
};

/**
 * SUPERVISOR — exactly the pages the role works in, entry-only everywhere:
 *   • Trip Entry + Trip List  (no delete)
 *   • Collection Entry + Pending Collections (no approve / reject / delete)
 *   • Fuel Expenses           (no approve / delete)
 *   • Maintenance Entry + Timeline (no approve / delete)
 *   • Permits & Documents, EMI, FASTag (view + entry)
 *   • Duty Planner (assign shifts, no removal) + Leaves (add only)
 * No dashboard, masters, accounts, reports, salary register or performance
 * pages — and no approve/delete anywhere.
 */
const SUPERVISOR_ACCESS: RoleAccess = {
  sections: ["operations", "settings"],
  tabs: {
    operations: ["trip-entry"],
    settings: ["profile"],
  },
  capabilities: [],
};

const OFFICE_ACCESS: RoleAccess = {
  sections: ["operations", "fleet", "staff", "settings"],
  tabs: {
    operations: ["trip-entry", "trip-list", "fuel-expenses"],
    fleet: ["entry", "history", "permits", "emi"],
    staff: ["leaves", "duty-planner"],
    settings: ["profile"],
  }, capabilities: [],
};

const COLLECTION_ACCESS: RoleAccess = {
  sections: ["operations", "settings"],
  tabs: { operations: ["trip-list", "orders", "collection", "pending-collections"], settings:["profile"] },
  capabilities: [],
};

const AUDIT_ACCESS: RoleAccess = {
  sections: ["dashboard", "masters", "operations", "fleet", "staff", "accounts", "reports", "settings"],
  tabs: {settings:["profile"]}, capabilities: [],
};

const ROLE_ACCESS: Readonly<Record<AppRole, RoleAccess>> = {
  OWNER: OWNER_ACCESS,
  FULL_ACCESS: OWNER_ACCESS,
  AUDIT: AUDIT_ACCESS,
  OFFICE: OFFICE_ACCESS,
  COLLECTION: COLLECTION_ACCESS,
  SUPERVISOR: SUPERVISOR_ACCESS,
};

/** `true` when the role holds the capability (owners hold all of them). */
export function hasCapability(role: AppRole | undefined | null, capability: Capability): boolean {
  if (!role) return false;
  const access = ROLE_ACCESS[role] ?? SUPERVISOR_ACCESS;
  return access.capabilities === "*" || access.capabilities.includes(capability);
}

/** Reactive `can(capability)` bound to the signed-in user. */
export function useCan(): (capability: Capability) => boolean {
  const { user } = useAuth();
  const role = user?.role;
  return (capability: Capability) => hasCapability(role, capability);
}

// ── Location access ─────────────────────────────────────────────────────────

export type HubSection =
  | "dashboard"
  | "masters"
  | "operations"
  | "fleet"
  | "staff"
  | "accounts"
  | "reports"
  | "settings";

/** Top-level hub for a pathname (before any `?tab=` resolution). */
export function sectionForPath(pathname: string): HubSection | null {
  const p = pathname.endsWith("/") && pathname !== "/" ? pathname.slice(0, -1) : pathname;
  if (p === "/" || p === "/dashboard" || p.startsWith("/dashboard/")) return "dashboard";
  if (p === "/masters" || p.startsWith("/masters/")) return "masters";
  if (p === "/operations" || p.startsWith("/operations/")) return "operations";
  if (p === "/fleet" || p.startsWith("/fleet/")) return "fleet";
  if (p === "/staff" || p.startsWith("/staff/")) return "staff";
  if (p === "/accounts" || p.startsWith("/accounts/")) return "accounts";
  if (p === "/reports" || p.startsWith("/reports/")) return "reports";
  if (p === "/settings" || p.startsWith("/settings/")) return "settings";
  return null;
}

/** The active `?tab=` of a hub section, mirroring each page's own resolver. */
export function tabForLocation(pathname: string, search: string): string | null {
  const params = new URLSearchParams(search);
  const tab = params.get("tab");
  if (tab) return tab;

  // Path aliases the hub pages also accept (legacy deep links).
  if (pathname.includes("trip-entry")) return "trip-entry";
  if (pathname.includes("trip-list")) return "trip-list";
  if (pathname.includes("rate-entry")) return "rate-entry";
  if (pathname.includes("shop-sales")) return "shop-sales";
  if (pathname.includes("collections/entry")) return "collection";
  if (pathname.includes("collections/pending")) return "pending-collections";
  if (pathname.includes("collections/report")) return "collection-report";
  if (pathname.includes("mortality")) return "mortality";
  if (pathname.includes("fuel-expenses")) return "fuel-expenses";
  if (pathname.startsWith("/operations/orders")) return "orders";
  if (pathname.includes("duty-planner")) return "duty-planner";
  if (pathname.includes("salary-sheet")) return "salary-sheet";
  if (pathname.includes("leave")) return "leaves";
  if (pathname.includes("driver-performance")) return "driver-performance";
  if (pathname.includes("supervisor-performance")) return "supervisor-performance";
  return null;
}

/** May this role open this exact location (path + `?tab=`)? */
export function canAccessLocation(
  role: AppRole | undefined | null,
  pathname: string,
  search: string = "",
): boolean {
  if (!role) return false;
  const access = ROLE_ACCESS[role] ?? SUPERVISOR_ACCESS;
  const section = sectionForPath(pathname);
  if (!section) return false; // unknown top-level paths are never role-openable
  if (access.sections !== "*" && !access.sections.includes(section)) return false;
  if (access.sections === "*") return true;

  const allowedTabs = access.tabs[section];
  if (!allowedTabs) return true; // section without tab rules → whole section
  if (allowedTabs === "*") return true;
  const tab = tabForLocation(pathname, search);
  // A tabless hub URL resolves to the section's default tab inside the page;
  // the guard only has to reject tabs the role may not see.
  return tab === null || allowedTabs.includes(tab);
}

/** First page a role lands on after sign-in. */
export function landingPathForRole(role: AppRole | undefined | null): string {
  if (canAccessLocation(role, "/dashboard")) return "/dashboard";
  if (canAccessLocation(role, "/operations", "?tab=trip-entry")) return "/operations?tab=trip-entry";
  return "/";
}

/** May this role open this nav entry (a `/path?tab=…` pair)? */
export function canAccessNavPath(role: AppRole | undefined | null, navPath: string): boolean {
  const [path, query = ""] = navPath.split("?");
  return canAccessLocation(role, path, query ? `?${query}` : "");
}

/**
 * The first tab of a hub section this role may open — used as the section's
 * default landing tab (`/staff` → Leaves for a supervisor, Duty Planner for
 * the owner). `null` = no restriction, the section keeps its own default.
 */
export function firstAllowedTab(
  role: AppRole | undefined | null,
  section: "operations" | "fleet" | "staff",
): string | null {
  if (!role) return null;
  const access = ROLE_ACCESS[role] ?? SUPERVISOR_ACCESS;
  const allowed = access.tabs[section];
  return allowed && allowed !== "*" ? allowed[0] : null;
}

/** Filtered copies of the navigation tables for the signed-in role. */
export function filterNavPaths<T extends { path: string }>(role: AppRole | undefined | null, items: readonly T[]): T[] {
  return items.filter((item) => canAccessNavPath(role, item.path));
}
