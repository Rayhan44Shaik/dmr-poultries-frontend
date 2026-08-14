// src/modules/settings/types/index.ts
// Shared types for the Settings module (frontend-only).

export interface UserProfile {
  id: number;
  name: string;
  email: string;
  role: string;
  department: string;
  mobile: string;
  employeeId: string;
  dateJoined: string;
  username: string;
  designation?: string;
  profileImage?: string;
}

export type UserStatus = "Active" | "Inactive";

export interface SystemUser {
  id: number;
  name: string;
  username: string;
  department: string;
  role: string;
  status: UserStatus;
  lastLogin: string;
}

export type PermissionAction =
  | "view"
  | "add"
  | "edit"
  | "delete"
  | "approve"
  | "export";

export interface ModulePermissions {
  view: boolean;
  add: boolean;
  edit: boolean;
  delete: boolean;
  approve: boolean;
  export: boolean;
}

export interface RolePermissions {
  modules: Record<string, ModulePermissions>;
}

/** Legacy shape kept for backward compatibility with existing call sites. */
export interface Permission {
  module: string;
  view: boolean;
  add: boolean;
  edit: boolean;
  delete: boolean;
}
