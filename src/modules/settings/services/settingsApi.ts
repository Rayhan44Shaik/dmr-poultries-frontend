import { apiClient } from "../../../api/client";
import { fontScalePercent, normalizeFontScale, type FontScale } from "../../../providers/fontScale";

export type SettingsLanguage = "en" | "te";
export type SettingsTheme = "light" | "dark";

export type UserPreferences = {
  language: SettingsLanguage;
  theme: SettingsTheme;
  /** Root font size as a supported level (70%–150%). The API speaks the bare
   *  percent integer (70…150 in steps of 10); the app works in multipliers. */
  fontScale: FontScale;
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
  // normalizeFontScale snaps the percent integer onto a supported level
  // ("110" → 1.1) and defaults anything malformed to 100%.
  const fontScale = normalizeFontScale(String(value.fontScale ?? 100));
  const updatedAt = typeof value.updatedAt === "string" && value.updatedAt ? value.updatedAt : null;
  return { language, theme, fontScale, updatedAt };
}

export async function fetchPreferences(): Promise<UserPreferences> {
  const response = await apiClient.get<unknown>("/settings/preferences");
  return normalise(response.data);
}

export async function savePreferences(
  patch: Partial<Pick<UserPreferences, "language" | "theme" | "fontScale">>,
): Promise<UserPreferences> {
  const body: { language?: SettingsLanguage; theme?: SettingsTheme; fontScale?: number } = {};
  if (patch.language !== undefined) body.language = patch.language;
  if (patch.theme !== undefined) body.theme = patch.theme;
  if (patch.fontScale !== undefined) body.fontScale = fontScalePercent(patch.fontScale);
  const response = await apiClient.patch<unknown>("/settings/preferences", body);
  return normalise(response.data);
}
