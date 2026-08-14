export type SettingsTab =
  | "general"
  | "profile"
  | "security"
  | "appearance"
  | "language"
  | "notifications"
  | "users"
  | "permissions"
  | "ai"
  | "about";

export interface GeneralSettings {
  businessName: string;
  financialYearStart: string;
  currency: string;
  timezone: string;
  dateFormat: string;
  firstDayOfWeek: "monday" | "sunday";
}

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
  profileImage?: string;
}

export interface SystemUser {
  id: number;
  name: string;
  username: string;
  department: string;
  role: string;
  status: "Active" | "Inactive";
  lastLogin: string;
}

export interface Permission {
  module: string;
  view: boolean;
  add: boolean;
  edit: boolean;
  delete: boolean;
  approve: boolean;
  export: boolean;
}

export interface AiSettings {
  enabled: boolean;
  provider: "deepseek";
  model: string;
  monthlyBudgetUsd: number;
  temperature: number;
  maxOutputTokens: number;
  analyticsEnabled: boolean;
  reportSummariesEnabled: boolean;
  anomalyDetectionEnabled: boolean;
  apiKeyConfigured: boolean;
}

export interface NotificationSettings {
  browser: boolean;
  email: boolean;
  vehicleExpiry: boolean;
  emiDue: boolean;
  pendingCollections: boolean;
  expenseApproval: boolean;
  dailySummary: boolean;
}

export interface AppearanceSettings {
  theme: "light" | "dark" | "system";
  compactTables: boolean;
  showAnimations: boolean;
}

export interface LanguageSettings {
  language: "en" | "te";
}

export interface SettingsState {
  general: GeneralSettings;
  ai: AiSettings;
  notifications: NotificationSettings;
  appearance: AppearanceSettings;
  language: LanguageSettings;
}
