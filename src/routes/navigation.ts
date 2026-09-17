// src/routes/navigation.ts
// -----------------------------------------------------------------------------
// Single source of truth for application navigation.
// Consumed by the Sidebar, the Header (breadcrumbs / titles) and the
// command palette. Every path maps to an existing, working route.
// -----------------------------------------------------------------------------

import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  ShoppingBag,
  CreditCard,
  Clock3,
  PackageOpen,
  PackageCheck,
  History,
  ClipboardList,
  BarChart3,
  ReceiptIndianRupee,
  IndianRupee,
  BookOpen,
  Sprout,
  Fuel,
  Landmark,
  Banknote,
  TrendingUp,
  FileText,
  Truck,
  Wrench,
  Contact,
  FileSpreadsheet,
  Users,
  CalendarClock,
  CalendarDays,
  Wallet,
  Store,
  Warehouse,
  Car,
  Bird,
  UserCheck,
  Settings,
  Database,
  Scale,
  ReceiptText,
} from "lucide-react";
import { ORDERS_PAGES } from "../modules/orders/routes/ordersRoutes";

/** Accent used by the sidebar icon + active row for this item. */
export type NavTone =
  | "sky"
  | "emerald"
  | "teal"
  | "amber"
  | "violet"
  | "rose"
  | "indigo"
  | "orange"
  | "lime"
  | "cyan"
  | "slate";

export const NAV_TONE_CLASS: Record<
  NavTone,
  {
    icon: string;
    iconActive: string;
    row: string;
    text: string;
    bar: string;
  }
> = {
  sky: {
    icon: "text-sky-500",
    iconActive: "text-sky-600",
    row: "bg-sky-50 dark:bg-sky-500/10",
    text: "text-sky-800 dark:text-sky-300",
    bar: "bg-sky-600 dark:bg-sky-400",
  },
  emerald: {
    icon: "text-emerald-500",
    iconActive: "text-emerald-600",
    row: "bg-emerald-50 dark:bg-emerald-500/10",
    text: "text-emerald-800 dark:text-emerald-300",
    bar: "bg-emerald-600 dark:bg-emerald-400",
  },
  teal: {
    icon: "text-teal-500",
    iconActive: "text-teal-600",
    row: "bg-teal-50 dark:bg-teal-500/10",
    text: "text-teal-800 dark:text-teal-300",
    bar: "bg-teal-600 dark:bg-teal-400",
  },
  amber: {
    icon: "text-amber-500",
    iconActive: "text-amber-600",
    row: "bg-amber-50 dark:bg-amber-500/10",
    text: "text-amber-800 dark:text-amber-300",
    bar: "bg-amber-600 dark:bg-amber-400",
  },
  violet: {
    icon: "text-violet-500",
    iconActive: "text-violet-600",
    row: "bg-violet-50 dark:bg-violet-500/10",
    text: "text-violet-800 dark:text-violet-300",
    bar: "bg-violet-600 dark:bg-violet-400",
  },
  rose: {
    icon: "text-rose-500",
    iconActive: "text-rose-600",
    row: "bg-rose-50 dark:bg-rose-500/10",
    text: "text-rose-800 dark:text-rose-300",
    bar: "bg-rose-600 dark:bg-rose-400",
  },
  indigo: {
    icon: "text-indigo-500",
    iconActive: "text-indigo-600",
    row: "bg-indigo-50 dark:bg-indigo-500/10",
    text: "text-indigo-800 dark:text-indigo-300",
    bar: "bg-indigo-600 dark:bg-indigo-400",
  },
  orange: {
    icon: "text-orange-500",
    iconActive: "text-orange-600",
    row: "bg-orange-50 dark:bg-orange-500/10",
    text: "text-orange-800 dark:text-orange-300",
    bar: "bg-orange-600 dark:bg-orange-400",
  },
  lime: {
    icon: "text-lime-600",
    iconActive: "text-lime-700",
    row: "bg-lime-50 dark:bg-lime-500/10",
    text: "text-lime-800 dark:text-lime-300",
    bar: "bg-lime-600 dark:bg-lime-400",
  },
  cyan: {
    icon: "text-cyan-500",
    iconActive: "text-cyan-600",
    row: "bg-cyan-50 dark:bg-cyan-500/10",
    text: "text-cyan-800 dark:text-cyan-300",
    bar: "bg-cyan-600 dark:bg-cyan-400",
  },
  slate: {
    icon: "text-slate-500",
    iconActive: "text-slate-700",
    row: "bg-slate-100 dark:bg-slate-800",
    text: "text-slate-800 dark:text-slate-200",
    bar: "bg-slate-600 dark:bg-slate-400",
  },
};

export interface NavChild {
  label: string;
  /** i18n key for the label — used for translation when available. */
  labelKey?: string;
  /** i18n key for the browser/page title. */
  titleKey?: string;
  path: string;
  icon?: LucideIcon;
  tone?: NavTone;
  /** Marks a planned module — rendered with a subtle "Soon" pill. */
  soon?: boolean;
  keywords?: string;
  /** Ids a run of related pages (e.g. "orders"). The sidebar renders a small
   *  sub-heading for the group and indents its rows, so a module that owns
   *  several pages still reads as one block inside its section. */
  group?: string;
}

/** Headings for `NavChild.group` runs, keyed by group id. */
export const NAV_CHILD_GROUPS: Record<string, { label: string; labelKey: string; icon: LucideIcon }> = {
  orders: { label: "Orders", labelKey: "nav.orders", icon: ReceiptText },
};

export interface NavSection {
  id: string;
  label: string;
  /** i18n key for the label — used for translation when available. */
  labelKey?: string;
  icon: LucideIcon;
  /** Optional direct path for single-item sections. */
  path?: string;
  children: NavChild[];
}

/** Sidebar rows for the Orders module, derived from its route table. */
const ORDERS_NAV_CHILDREN: NavChild[] = ORDERS_PAGES.map((page) => ({
  label: page.label,
  labelKey: page.labelKey,
  titleKey: page.titleKey,
  path: page.path,
  icon: page.icon,
  tone: page.tone,
  group: "orders",
  keywords: page.keywords,
}));

export const NAV_SECTIONS: NavSection[] = [
  {
    id: "overview",
    label: "Overview",
    labelKey: "nav.overview",
    icon: LayoutDashboard,
    children: [
      {
        label: "Dashboard",
        labelKey: "nav.dashboard",
        titleKey: "page_title.dashboard",
        path: "/dashboard",
        icon: LayoutDashboard,
        tone: "sky",
        keywords: "home kpi charts today overview",
      },
    ],
  },
  {
    id: "masters",
    label: "Masters",
    labelKey: "nav.masters",
    icon: Database,
    children: [
      {
        label: "Shops",
        labelKey: "nav.shops",
        path: "/masters?tab=shops",
        icon: Store,
        tone: "teal",
        keywords: "shops master stores",
      },
      {
        label: "Farms",
        labelKey: "nav.farms",
        path: "/masters?tab=farms",
        icon: Warehouse,
        tone: "lime",
        keywords: "farms",
      },
      {
        label: "Vehicles",
        labelKey: "nav.vehicles_master",
        path: "/masters?tab=vehicles",
        icon: Car,
        tone: "amber",
        keywords: "vehicles master trucks",
      },
      {
        label: "Employees",
        labelKey: "nav.employees",
        path: "/masters?tab=employees",
        icon: Users,
        tone: "violet",
        keywords: "employees master staff",
      },
      {
        label: "Banks",
        labelKey: "nav.banks",
        path: "/masters?tab=banks",
        icon: Landmark,
        tone: "indigo",
        keywords: "banks master accounts",
      },
      {
        label: "Bird Types",
        labelKey: "nav.birdTypes",
        path: "/masters?tab=birdTypes",
        icon: Bird,
        tone: "amber",
        keywords: "bird types breed poultry",
      },
      {
        label: "Market Rates",
        labelKey: "nav.marketRates",
        path: "/accounts?tab=market-rate",
        icon: TrendingUp,
        tone: "emerald",
        keywords: "market rate weight price",
      },

      //{ label: "Routes", path: "/masters?tab=shops", icon: Package, soon: true, keywords: "routes master" },
    ],
  },
  {
    id: "operations",
    label: "Operations",
    labelKey: "nav.operations",
    icon: PackageOpen,
    children: [
      {
        label: "Operation Dashboard",
        labelKey: "nav.dailyOperationReport",
        path: "/operations?tab=overview",
        icon: ClipboardList,
        tone: "sky",
        keywords: "daily report operations overview",
      },

      {
        label: "Trip Entry",
        labelKey: "nav.vehicleDeliveryEntry",
        path: "/operations?tab=trip-entry",
        icon: PackageCheck,
        tone: "emerald",
        keywords: "delivery trip shop weight",
      },
      {
        label: "Trip List",
        labelKey: "nav.vehicleTripHistory",
        path: "/operations?tab=trip-list",
        icon: History,
        tone: "cyan",
        keywords: "trips history list completed",
      },

      {
        label: "Rate Entry",
        labelKey: "nav.rateEntry",
        path: "/operations?tab=rate-entry",
        icon: IndianRupee,
        tone: "amber",
        keywords: "sales shop invoice rate",
      },
      {
        label: "Shop Sales",
        labelKey: "nav.shopSalesEntry",
        path: "/operations?tab=shop-sales",
        icon: ShoppingBag,
        tone: "indigo",
        keywords: "sales shop invoice rate",
      },

      {
        label: "Collection Entry",
        labelKey: "nav.collectionEntry",
        path: "/operations?tab=collection",
        icon: CreditCard,
        tone: "teal",
        keywords: "collection payment cash",
      },
      {
        label: "Pending Collections",
        labelKey: "nav.pendingCollections",
        path: "/operations?tab=pending-collections",
        icon: Clock3,
        tone: "orange",
        keywords: "pending overdue outstanding collection",
      },

      {
        label: "Weight Loss / Mortality",
        labelKey: "nav.weightLossMortality",
        path: "/operations?tab=mortality",
        icon: Scale,
        tone: "rose",
        keywords: "weight loss mortality death birds",
      },
      {
        label: "Fuel Expenses",
        labelKey: "nav.fuelExpenses",
        path: "/operations?tab=fuel-expenses",
        icon: Fuel,
        tone: "amber",
        keywords: "fuel diesel expenses bills",
      },
      // Orders is its own module (src/modules/orders) with its own route table,
      // so these rows are generated from it — the sidebar and the app routes can
      // never disagree. Inside Operations they read as one grouped block.
      ...ORDERS_NAV_CHILDREN,

    ],
  },
  {
    id: "vehicles",
    label: "Vehicles",
    labelKey: "nav.vehicles",
    icon: Truck,
    children: [
      // DEFERRED / FUTURE: Fleet Overview (Dashboard) — files preserved, not in active nav
      //{ label: "Fleet Overview", path: "/fleet?tab=dashboard", icon: Gauge, keywords: "fleet vehicles overview status" },
      {
        label: "Maintenance Entry",
        labelKey: "nav.maintenanceEntry",
        path: "/fleet?tab=entry",
        icon: Wrench,
        tone: "orange",
        keywords: "maintenance service garage",
      },
      {
        label: "Maintenance Timeline",
        labelKey: "nav.maintenanceHistory",
        path: "/fleet?tab=history",
        icon: History,
        tone: "cyan",
        keywords: "maintenance history timeline service",
      },

      {
        label: "Permits & Documents",
        labelKey: "nav.permitsDocuments",
        path: "/fleet?tab=permits",
        icon: FileSpreadsheet,
        tone: "indigo",
        keywords: "permits insurance fitness documents",
      },

      {
        label: "EMI",
        labelKey: "nav.emi",
        path: "/fleet?tab=emi",
        icon: Banknote,
        tone: "emerald",
        keywords: "emi loan installment",
      },

      {
        label: "FASTag",
        labelKey: "nav.fastag",
        path: "/fleet?tab=fastag",
        icon: Contact,
        tone: "sky",
        keywords: "fastag toll balance",
      },

      //{ label: "Fuel", path: "/operations?tab=fuel-expenses", icon: Fuel, keywords: "fuel diesel expenses" },
      // DEFERRED / FUTURE: Expense Reports + Vehicle Reports — files preserved, not in active nav
      //{ label: "Expense Reports", path: "/fleet?tab=expenses", icon: FileText, keywords: "expense report vehicle wise" },
      //{ label: "Reports", path: "/fleet?tab=reports", icon: FileText, keywords: "reports vehicle reports" },
    ],
  },
  {
    id: "staff",
    label: "Staff",
    labelKey: "nav.staff",
    icon: Users,
    children: [
      //{ label: "Employees", path: "/masters?tab=employees", icon: UserRound, keywords: "employees staff master" },
      {
        label: "Duty Planner",
        labelKey: "nav.dutyPlanner",
        path: "/staff?tab=duty-planner",
        icon: CalendarClock,
        tone: "violet",
        keywords: "duty planner roster schedule",
      },
      {
        label: "Salary Register",
        labelKey: "nav.salaryRegister",
        path: "/staff?tab=salary-sheet",
        icon: Wallet,
        tone: "emerald",
        keywords: "salary register sheet",
      },
      {
        label: "Leaves",
        labelKey: "nav.leaves",
        path: "/staff?tab=leaves",
        icon: CalendarDays,
        tone: "amber",
        keywords: "leave management approval",
      },
      {
        label: "Driver Performance",
        labelKey: "nav.driverPerformance",
        path: "/staff?tab=driver-performance",
        icon: Truck,
        tone: "orange",
        keywords: "driver performance trips cost mileage",
      },
      {
        label: "Supervisor Performance",
        labelKey: "nav.supervisorPerformance",
        path: "/staff?tab=supervisor-performance",
        icon: UserCheck,
        tone: "sky",
        keywords: "supervisor performance shops birds mortality",
      },
      //{ label: "Attendance", path: "/staff?tab=duty-planner", icon: CalendarCheck, soon: true, keywords: "attendance biometric" },
      //{ label: "Deductions", path: "/staff?tab=salary-sheet", icon: Scale, soon: true, keywords: "deductions advance loan" },
    ],
  },
  {
    id: "accounts",
    label: "Accounts",
    labelKey: "nav.accounts",
    icon: ReceiptIndianRupee,
    children: [      {
        label: "Analysis",
        labelKey: "nav.analysis",
        path: "/accounts?tab=summary",
        icon: BarChart3,
        tone: "indigo",
        keywords: "accounts summary totals",
      },
      {
        label: "Payment Register",
        labelKey: "nav.collectionRegister",
        path: "/accounts?tab=paid-payments",
        icon: BookOpen,
        tone: "teal",
        keywords: "payments register ledger",
      },
      {
        label: "Farmer Payments",
        labelKey: "nav.farmerPayments",
        path: "/accounts?tab=farm-payment",
        icon: Sprout,
        tone: "lime",
        keywords: "farmer farm payment poultry",
      },
    ],
  },

  {
    id: "reports",
    label: "Reports",
    labelKey: "nav.reports",
    icon: FileText,
    children: [
      //{ label: "Reports Hub", path: "/reports", icon: BarChart3, keywords: "reports hub" },
      {
        label: "Shop Ledger",
        labelKey: "nav.shopLedger",
        path: "/reports?tab=shopLedger",
        icon: BookOpen,
        tone: "teal",
        keywords: "shop ledger statement",
      },
      // Collection Report now lives in Operations → Collection. The Reports
      // menu item opens that single implementation instead of a duplicate.
      {
        label: "Collection Report",
        labelKey: "nav.collectionReport",
        path: "/operations?tab=collection-report",
        icon: CreditCard,
        tone: "emerald",
        keywords: "collection report register",
      },
      {
        label: "Vehicle Analytics",
        labelKey: "nav.analytics",
        path: "/fleet?tab=analytics",
        icon: BarChart3,
        tone: "violet",
        keywords: "vehicle analytics performance fleet",
      },
    ],
  },
  {
    id: "settings",
    label: "Settings",
    labelKey: "nav.settings",
    icon: Settings,
    children: [
      // Hidden from frontend navigation — underlying modules/routes remain intact.
      {
        label: "System Settings",
        labelKey: "nav.systemSettings",
        path: "/settings?tab=appearance",
        icon: Settings,
        tone: "slate",
        keywords: "settings appearance theme language",
      },
      // { label: "Users & Roles", path: "/settings?tab=users", icon: UserCog, keywords: "users roles management" },
      // { label: "Permissions", path: "/settings?tab=permissions", icon: KeyRound, keywords: "permissions roles access" },
      // { label: "Profile & Security", path: "/settings?tab=profile", icon: ShieldCheck, keywords: "profile password security" },
    ],
  },
];

/** Flat list of all navigable entries — used by the command palette. */
export interface FlatNavEntry {
  section: string;
  sectionKey?: string;
  label: string;
  labelKey?: string;
  titleKey?: string;
  path: string;
  icon: LucideIcon;
  soon?: boolean;
  keywords?: string;
}

export const FLAT_NAV: FlatNavEntry[] = NAV_SECTIONS.flatMap((section) =>
  section.children.map((child) => ({
    section: section.label,
    sectionKey: section.labelKey,
    label: child.label,
    labelKey: child.labelKey,
    titleKey: child.titleKey,
    path: child.path,
    icon: child.icon ?? section.icon,
    soon: child.soon,
    keywords: child.keywords,
  }))
);

/** Quick actions surfaced in the header and command palette. */
export interface QuickAction {
  label: string;
  labelKey?: string;
  description: string;
  descriptionKey?: string;
  path: string;
  icon: LucideIcon;
}

export const QUICK_ACTIONS: QuickAction[] = [
  {
    label: "New Trip Entry",
    labelKey: "quick.new_trip",
    description: "Dispatch a vehicle on a new trip",
    descriptionKey: "quick.new_trip_desc",
    path: "/operations?tab=trip-entry",
    icon: PackageOpen,
  },
  {
    label: "Record Collection",
    labelKey: "quick.record_collection",
    description: "Enter a shop collection received",
    descriptionKey: "quick.record_collection_desc",
    path: "/operations?tab=collection",
    icon: CreditCard,
  },
  {
    label: "Enter Shop Sale",
    labelKey: "quick.enter_shop_sale",
    description: "Record a delivery against a shop",
    descriptionKey: "quick.enter_shop_sale_desc",
    path: "/operations?tab=shop-sales",
    icon: ShoppingBag,
  },
  {
    label: "Add Fuel Expense",
    labelKey: "quick.add_fuel",
    description: "Log diesel / fuel for a vehicle",
    descriptionKey: "quick.add_fuel_desc",
    path: "/operations?tab=fuel-expenses",
    icon: Fuel,
  },
];

/** Resolve the section + page labels for the current pathname (breadcrumbs). */
export function resolveRoute(pathname: string): { section?: NavSection; page?: NavChild } {
  // Normalize: drop query string
  const path = pathname.split("?")[0];
  const query = pathname.includes("?") ? pathname.slice(pathname.indexOf("?")) : "";

  // Pass 1 — exact path + query match.
  for (const section of NAV_SECTIONS) {
    for (const child of section.children) {
      const childPath = child.path.split("?")[0];
      const childQuery = child.path.includes("?") ? child.path.slice(child.path.indexOf("?")) : "";
      if (path === childPath && childQuery && query === childQuery) {
        return { section, page: child };
      }
    }
  }

  // Pass 2 — path match for children without a query (section hubs).
  for (const section of NAV_SECTIONS) {
    for (const child of section.children) {
      const childPath = child.path.split("?")[0];
      const childQuery = child.path.includes("?") ? child.path.slice(child.path.indexOf("?")) : "";
      if (path === childPath && !childQuery) {
        return { section, page: child };
      }
    }
  }

  // Pass 3 — deep path that mirrors a query-based child:
  //   "/masters/shops"      ↔ "/masters?tab=shops"
  //   "/accounts/market-rate" ↔ "/accounts?tab=market-rate"
  // The app registers BOTH forms (AppRoutes mounts /masters/shops, the sidebar
  // links to /masters?tab=shops), and a deep link used to fall through to the
  // bare section — the header then showed the raw English section label
  // ("Masters") even in a Telugu session, and the sidebar highlighted nothing.
  for (const section of NAV_SECTIONS) {
    for (const child of section.children) {
      const [childPath, childQuery] = child.path.split("?");
      if (!childQuery) continue;
      const params = new URLSearchParams(childQuery);
      for (const value of params.values()) {
        if (path === `${childPath}/${value}`) return { section, page: child };
      }
    }
  }

  // Fall back to section-level match (e.g. "/masters", "/operations").
  for (const section of NAV_SECTIONS) {
    const paths = section.children.map((c) => c.path.split("?")[0]);
    if (paths.includes(path) || (path.length > 1 && paths.some((p) => path.startsWith(p + "/")))) {
      return { section };
    }
    // Also match section hubs by prefix conventions (e.g. /staff, /fleet).
    const hubs: Record<string, string[]> = {
      operations: ["/operations"],
      accounts: ["/accounts"],
      vehicles: ["/fleet"],
      staff: ["/staff"],
      masters: ["/masters"],
      reports: ["/reports"],
      settings: ["/settings"],
    };
    if (hubs[section.id]?.includes(path)) return { section };
  }

  return {};
}
