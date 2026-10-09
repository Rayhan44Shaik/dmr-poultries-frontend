import { useCallback, useEffect, useState } from "react";
import { useI18n } from "../../../i18n";
import { useTheme } from "../../../providers/ThemeProvider";
import { useFontScale } from "../../../providers/fontScaleContext";
import type { FontScale } from "../../../providers/fontScale";
import {
  fetchPreferences,
  savePreferences,
  type SettingsLanguage,
  type SettingsTheme,
} from "../services/settingsApi";

export type PreferenceSyncState = "loading" | "idle" | "saving" | "saved" | "error";

/**
 * Server-backed language + theme + font-size preferences.
 *
 * The providers stay the single source of truth for rendering (they own the
 * `<html class="dark">`, `<html lang>` and root font-scale side effects); this
 * hook only reconciles them with the user's stored preference:
 *
 *   • a stored row is authoritative — the device adopts it on load;
 *   • NO stored row means "never chosen": the device's current choice is
 *     published once, so an existing localStorage theme is never silently
 *     reset to the default just because the feature shipped;
 *   • a failed save keeps the local choice and reports `error` — preferences
 *     must never block using the app.
 *
 * Font scale writes are persisted by FontScaleProvider itself (localStorage +
 * this same preferences API), so the header popover and this page always save
 * through one write path and can never drift apart. Reconciliation adopts the
 * stored value through `adoptScale`, which never echoes a save back.
 */
export function useUserPreferences() {
  const { language, setLanguage } = useI18n();
  const { theme, setTheme } = useTheme();
  const { scale: fontScale, setScale: applyFontScaleChange, adoptScale } = useFontScale();
  const [state, setState] = useState<PreferenceSyncState>("loading");
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  /**
   * Runs once, against the values this device already had at mount. The
   * dependency list is intentionally empty: re-running on every language/theme
   * change would start a fetch loop that races the optimistic update below.
   */
  useEffect(() => {
    let live = true;
    const local = { language, theme, fontScale };
    fetchPreferences()
      .then((prefs) => {
        if (!live) return;
        setUpdatedAt(prefs.updatedAt);
        if (prefs.updatedAt === null) {
          setState("idle");
          void savePreferences(local)
            .then((saved) => {
              if (live) setUpdatedAt(saved.updatedAt);
            })
            .catch(() => undefined);
          return;
        }
        if (prefs.language !== local.language) setLanguage(prefs.language);
        if (prefs.theme !== local.theme) setTheme(prefs.theme);
        if (prefs.fontScale !== local.fontScale) adoptScale(prefs.fontScale);
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
      fontScale?: FontScale;
    }) => {
      // Optimistic: the UI must switch immediately, then confirm with the API.
      if (patch.language) setLanguage(patch.language);
      if (patch.theme) setTheme(patch.theme);
      // Font scale persists through FontScaleProvider (local + server), so the
      // header popover and this page share one write path.
      if (patch.fontScale) applyFontScaleChange(patch.fontScale);
      const remote = {
        ...(patch.language ? { language: patch.language } : {}),
        ...(patch.theme ? { theme: patch.theme } : {}),
      };
      if (Object.keys(remote).length === 0) return;
      setState("saving");
      try {
        const saved = await savePreferences(remote);
        setUpdatedAt(saved.updatedAt);
        setState("saved");
      } catch {
        setState("error");
      }
    },
    [setLanguage, setTheme, applyFontScaleChange],
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

  const setPreferenceFontScale = useCallback(
    (value: FontScale) => {
      void apply({ fontScale: value });
    },
    [apply],
  );

  return {
    language,
    theme,
    fontScale,
    updatedAt,
    syncState: state,
    setLanguage: setPreferenceLanguage,
    setTheme: setPreferenceTheme,
    setFontScale: setPreferenceFontScale,
  };
}
