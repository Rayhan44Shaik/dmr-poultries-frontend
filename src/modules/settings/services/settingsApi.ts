import { apiClient } from "../../../api/client";

export type SettingsLanguage = "en" | "te";
export type SettingsTheme = "light" | "dark";
export type SettingsAlphabetSize = "small" | "medium" | "large";

export type UserPreferences = {
  language: SettingsLanguage;
  theme: SettingsTheme;
  alphabetSize: SettingsAlphabetSize;
  /**
   * When the preference was last saved server-side. `null` means the user has
   * NEVER stored a preference — the distinction lets the client publish the
   * value already chosen on this device instead of resetting the user to the
   * defaults the first time the page is opened.
   */
  updatedAt: string | null;
};

/** The server owns the vocabulary; anything unexpected falls back to defaults
 *  rather than putting a bad value into <select>/theme state. */
function normalise(raw: unknown): UserPreferences {
  const value = (raw ?? {}) as Record<string, unknown>;
  const language: SettingsLanguage = value.language === "te" ? "te" : "en";
  const theme: SettingsTheme = value.theme === "dark" ? "dark" : "light";
  const alphabetSize: SettingsAlphabetSize =
    value.alphabetSize === "small" || value.alphabetSize === "large"
      ? value.alphabetSize
      : "medium";
  const updatedAt = typeof value.updatedAt === "string" && value.updatedAt ? value.updatedAt : null;
  return { language, theme, alphabetSize, updatedAt };
}

export async function fetchPreferences(): Promise<UserPreferences> {
  const response = await apiClient.get<unknown>("/settings/preferences");
  return normalise(response.data);
}

export async function savePreferences(
  patch: Partial<Pick<UserPreferences, "language" | "theme" | "alphabetSize">>,
): Promise<UserPreferences> {
  const response = await apiClient.patch<unknown>("/settings/preferences", patch);
  return normalise(response.data);
}
