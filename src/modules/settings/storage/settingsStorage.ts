// src/modules/settings/storage/settingsStorage.ts
// Single, namespaced, corruption-safe localStorage layer for frontend-only
// Settings data (profile overrides, users, permissions).
//
// NEVER store passwords, API secrets, or authentication tokens here.
// This module is frontend-only and is NOT a substitute for backend persistence.

import type { SystemUser, RolePermissions } from "../types";

const PREFIX = "dmr.settings.";

function readRaw(key: string): unknown {
  try {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    return JSON.parse(raw) as unknown;
  } catch {
    // Corrupted JSON (or storage unavailable) -> safe default null; UI falls back.
    return null;
  }
}

function writeRaw(key: string, value: unknown): void {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Quota/availability errors are swallowed: the feature gracefully degrades
    // to in-memory state rather than crashing the Settings page.
  }
}

function isObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

export interface StoredProfile {
  name: string;
  email: string;
  mobile: string;
  profileImage?: string;
}

const PROFILE_KEY = "profile";

export const PROFILE_DEFAULTS: StoredProfile = {
  name: "Rubulla",
  email: "info@dmrpoultries.com",
  mobile: "+91 9122456789",
  profileImage: undefined,
};

export function loadStoredProfile(): StoredProfile {
  const raw = readRaw(PROFILE_KEY);
  if (!isObject(raw)) return { ...PROFILE_DEFAULTS };
  return {
    name: typeof raw.name === "string" ? raw.name : PROFILE_DEFAULTS.name,
    email: typeof raw.email === "string" ? raw.email : PROFILE_DEFAULTS.email,
    mobile: typeof raw.mobile === "string" ? raw.mobile : PROFILE_DEFAULTS.mobile,
    profileImage:
      typeof raw.profileImage === "string" && raw.profileImage
        ? raw.profileImage
        : undefined,
  };
}

export function saveStoredProfile(profile: StoredProfile): void {
  writeRaw(PROFILE_KEY, profile);
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

const USERS_KEY = "users";

export function loadStoredUsers(): SystemUser[] {
  const raw = readRaw(USERS_KEY);
  if (!Array.isArray(raw)) return [];
  const valid: SystemUser[] = [];
  for (const item of raw) {
    if (!isObject(item)) continue;
    const id = typeof item.id === "number" ? item.id : -1;
    if (id === -1) continue;
    valid.push({
      id,
      name: typeof item.name === "string" ? item.name : "",
      username: typeof item.username === "string" ? item.username : "",
      department: typeof item.department === "string" ? item.department : "",
      role: typeof item.role === "string" ? item.role : "",
      status: item.status === "Inactive" ? "Inactive" : "Active",
      lastLogin: typeof item.lastLogin === "string" ? item.lastLogin : "—",
    });
  }
  return valid;
}

export function saveStoredUsers(users: SystemUser[]): void {
  writeRaw(USERS_KEY, users);
}

// ---------------------------------------------------------------------------
// Permissions (keyed by role)
// ---------------------------------------------------------------------------

const PERMISSIONS_KEY = "permissions";

export function loadStoredPermissions(): Record<string, RolePermissions> {
  const raw = readRaw(PERMISSIONS_KEY);
  if (!isObject(raw)) return {};
  const result: Record<string, RolePermissions> = {};
  for (const [role, value] of Object.entries(raw)) {
    if (!isObject(value)) continue;
    result[role] = sanitizeRolePermissions(value);
  }
  return result;
}

export function saveStoredPermissions(
  permissions: Record<string, RolePermissions>
): void {
  writeRaw(PERMISSIONS_KEY, permissions);
}

function sanitizeRolePermissions(v: Record<string, unknown>): RolePermissions {
  const bool = (x: unknown): boolean => x === true;
  const modules = v.modules;
  const sanitized: RolePermissions = { modules: {} };
  if (isObject(modules)) {
    for (const [module, perms] of Object.entries(modules)) {
      if (!isObject(perms)) continue;
      sanitized.modules[module] = {
        view: bool(perms.view),
        add: bool(perms.add),
        edit: bool(perms.edit),
        delete: bool(perms.delete),
        approve: bool(perms.approve),
        export: bool(perms.export),
      };
    }
  }
  return sanitized;
}

// ---------------------------------------------------------------------------
// Misc local preference used only where the UI genuinely consumes it.
// ---------------------------------------------------------------------------

export function loadStringValue(key: string, fallback: string): string {
  const raw = readRaw(key);
  return typeof raw === "string" ? raw : fallback;
}

export function saveStringValue(key: string, value: string): void {
  writeRaw(key, value);
}
