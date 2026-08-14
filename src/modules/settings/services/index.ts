import { apiGet, apiPatch, apiPost } from "../../../api";
import type { SettingsState, SystemUser, UserProfile } from "../types";

const STORAGE_KEY = "dmr_settings_v2";

export const defaultSettings: SettingsState = {
  general: { businessName: "DMR Poultries", financialYearStart: "04-01", currency: "INR", timezone: "Asia/Kolkata", dateFormat: "DD/MM/YYYY", firstDayOfWeek: "monday" },
  ai: { enabled: true, provider: "deepseek", model: "DeepSeek V4 Flash", monthlyBudgetUsd: 2, temperature: 0.2, maxOutputTokens: 1200, analyticsEnabled: true, reportSummariesEnabled: true, anomalyDetectionEnabled: true, apiKeyConfigured: true },
  notifications: { browser: true, email: true, vehicleExpiry: true, emiDue: true, pendingCollections: true, expenseApproval: true, dailySummary: false },
  appearance: { theme: "light", compactTables: false, showAnimations: true },
  language: { language: "en" },
};

const mergeSettings = (partial?: Partial<SettingsState>): SettingsState => ({
  ...defaultSettings,
  ...partial,
  general: { ...defaultSettings.general, ...(partial?.general ?? {}) },
  ai: { ...defaultSettings.ai, ...(partial?.ai ?? {}) },
  notifications: { ...defaultSettings.notifications, ...(partial?.notifications ?? {}) },
  appearance: { ...defaultSettings.appearance, ...(partial?.appearance ?? {}) },
  language: { ...defaultSettings.language, ...(partial?.language ?? {}) },
});

export const getSettings = (): SettingsState => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? mergeSettings(JSON.parse(raw)) : defaultSettings;
  } catch {
    return defaultSettings;
  }
};

export const saveSettings = async (settings: SettingsState): Promise<SettingsState> => {
  const normalized = mergeSettings(settings);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  if (import.meta.env.VITE_SETTINGS_API_ENABLED === "true") {
    try { await apiPatch("/settings", normalized); } catch { /* local fallback */ }
  }
  return normalized;
};

export const getServerSettings = async (): Promise<SettingsState | null> => {
  if (import.meta.env.VITE_SETTINGS_API_ENABLED !== "true") return null;
  try {
    const response = await apiGet<Partial<SettingsState>>("/settings");
    return mergeSettings(response.data);
  } catch {
    return null;
  }
};

export const testAiConnection = async (): Promise<{ ok: boolean; message: string }> => {
  if (import.meta.env.VITE_SETTINGS_API_ENABLED !== "true") return { ok: false, message: "Settings API is not enabled yet. Keep the DeepSeek key on the backend and enable the settings API after the backend endpoint is ready." };
  try {
    await apiPost("/settings/ai/test", {});
    return { ok: true, message: "DeepSeek connection test completed successfully." };
  } catch {
    return { ok: false, message: "DeepSeek connection could not be verified by the backend." };
  }
};

export const getCurrentUser = (): UserProfile => ({ id: 1, name: "Rubulla", email: "info@dmrpoultries.com", role: "Owner", department: "Administration", mobile: "+91 9122456789", employeeId: "DMR001", dateJoined: "01-Jan-2020", username: "rubullaadmin" });
export const getUsers = (): SystemUser[] => [
  { id: 1, name: "Rubulla", username: "rubullaadmin", department: "Administration", role: "Owner", status: "Active", lastLogin: "Today, 05:58 AM" },
  { id: 2, name: "Imran", username: "imran123", department: "Accounts", role: "Senior Accountant", status: "Active", lastLogin: "Today, 05:41 AM" },
  { id: 3, name: "Shafi", username: "shafi01", department: "Operations", role: "Supervisor", status: "Active", lastLogin: "Yesterday, 10:22 PM" },
  { id: 4, name: "Arif", username: "arif02", department: "Collection", role: "Collector", status: "Inactive", lastLogin: "12-Aug-2026 08:14 PM" },
];
export const formatCurrency = (value: number, currency = "INR") => new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
