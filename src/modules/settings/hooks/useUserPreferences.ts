import { useCallback, useEffect, useState } from "react";
import { useI18n } from "../../../i18n";
import { useTheme } from "../../../providers/ThemeProvider";
import {
  fetchPreferences,
  savePreferences,
  type SettingsAlphabetSize,
  type SettingsLanguage,
  type SettingsTheme,
} from "../services/settingsApi";

export type PreferenceSyncState = "loading" | "idle" | "saving" | "saved" | "error";

/**
 * Server-backed language + theme preferences.
 *
 * The providers stay the single source of truth for rendering (they own the
 * `<html class="dark">` and `<html lang>` side effects); this hook only
 * reconciles them with the user's stored preference:
 *
 *   • a stored row is authoritative — the device adopts it on load;
 *   • NO stored row means "never chosen": the device's current choice is
 *     published once, so an existing localStorage theme is never silently
 *     reset to the default just because the feature shipped;
 *   • a failed save keeps the local choice and reports `error` — preferences
 *     must never block using the app.
 */
export function useUserPreferences() {
  const { language, setLanguage } = useI18n();
  const { theme, setTheme } = useTheme();
  const [alphabetSize, setAlphabetSizeState] = useState<SettingsAlphabetSize>("medium");
  const [state, setState] = useState<PreferenceSyncState>("loading");
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  /** The root font-size scale follows the stored choice on every render. */
  useEffect(() => {
    document.documentElement.dataset.alphabet = alphabetSize;
  }, [alphabetSize]);

  /**
   * Runs once, against the values this device already had at mount. The
   * dependency list is intentionally empty: re-running on every language/theme
   * change would start a fetch loop that races the optimistic update below.
   */
  useEffect(() => {
    let live = true;
    const local = { language, theme };
    fetchPreferences()
      .then((prefs) => {
        if (!live) return;
        setUpdatedAt(prefs.updatedAt);
        if (prefs.updatedAt === null) {
          setState("idle");
          void savePreferences({ ...local, alphabetSize })
            .then((saved) => {
              if (live) setUpdatedAt(saved.updatedAt);
            })
            .catch(() => undefined);
          return;
        }
        if (prefs.language !== local.language) setLanguage(prefs.language);
        if (prefs.theme !== local.theme) setTheme(prefs.theme);
        setAlphabetSizeState(prefs.alphabetSize);
        setState("idle");
      })
      .catch(() => {
        // Offline / endpoint unavailable — the local values stay usable.
        if (live) setState("error");
      });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run-once reconciliation by design
  }, []);

  const apply = useCallback(
    async (patch: {
      language?: SettingsLanguage;
      theme?: SettingsTheme;
      alphabetSize?: SettingsAlphabetSize;
    }) => {
      // Optimistic: the UI must switch immediately, then confirm with the API.
      if (patch.language) setLanguage(patch.language);
      if (patch.theme) setTheme(patch.theme);
      if (patch.alphabetSize) setAlphabetSizeState(patch.alphabetSize);
      setState("saving");
      try {
        const saved = await savePreferences(patch);
        setUpdatedAt(saved.updatedAt);
        setState("saved");
      } catch {
        setState("error");
      }
    },
    [setLanguage, setTheme],
  );

  const setPreferenceLanguage = useCallback(
    (value: SettingsLanguage) => {
      void apply({ language: value });
    },
    [apply],
  );

  const setPreferenceTheme = useCallback(
    (value: SettingsTheme) => {
      void apply({ theme: value });
    },
    [apply],
  );

  const setPreferenceAlphabetSize = useCallback(
    (value: SettingsAlphabetSize) => {
      void apply({ alphabetSize: value });
    },
    [apply],
  );

  return {
    language,
    theme,
    alphabetSize,
    updatedAt,
    syncState: state,
    setLanguage: setPreferenceLanguage,
    setTheme: setPreferenceTheme,
    setAlphabetSize: setPreferenceAlphabetSize,
  };
}
