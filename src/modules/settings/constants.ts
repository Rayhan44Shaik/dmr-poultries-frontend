// src/modules/settings/constants.ts
import type { PermissionAction } from "./types";

export const SETTINGS_MODULES: readonly string[] = [
  "Dashboard",
  "Masters",
  "Operations",
  "Vehicles",
  "Staff",
  "Accounts",
  "Reports",
  "Settings",
];

export const PERMISSION_ACTIONS: readonly { key: PermissionAction; label: string }[] = [
  { key: "view", label: "View" },
  { key: "add", label: "Add" },
  { key: "edit", label: "Edit" },
  { key: "delete", label: "Delete" },
  { key: "approve", label: "Approve" },
  { key: "export", label: "Export" },
];

export const ROLE_NAMES: readonly string[] = [
  "Owner",
  "Admin",
  "Senior Account",
  "Accountant",
  "Supervisor",
  "Manager",
  "Operator",
  "Viewer",
];

export const DEPARTMENTS: readonly string[] = [
  "Administration",
  "Accounts",
  "Operations",
  "Vehicles",
  "Staff",
  "Reports",
];

export const LANGUAGES: readonly { id: string; name: string; nativeName: string; flag: string; region: string }[] = [
  { id: "en", name: "English", nativeName: "English (US)", flag: "🇺🇸", region: "International" },
  { id: "te", name: "Telugu", nativeName: "తెలుగు", flag: "🇮🇳", region: "Regional (India)" },
];
