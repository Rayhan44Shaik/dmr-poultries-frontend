import { useCallback, useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from "react";
import {
  applyFontScale,
  DEFAULT_FONT_SCALE,
  FONT_SCALE_LEVELS,
  FONT_SCALE_STORAGE_KEY,
  LEGACY_FONT_SIZE_STORAGE_KEY,
  isFontScale,
  normalizeFontScale,
  readFontScalePreference,
  type FontScale,
} from "./fontScale";
import { savePreferences } from "../modules/settings/services/settingsApi";
import { FontScaleContext, type FontScaleContextValue } from "./fontScaleContext";

interface FontScaleProviderProps {
  children: ReactNode;
}

function browserStorage(): Storage | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

function initialFontScale(): FontScale {
  if (typeof document !== "undefined") {
    const preloaded = document.documentElement?.dataset?.fontScale;
    if (preloaded !== undefined) return normalizeFontScale(preloaded);
  }
  return readFontScalePreference(browserStorage());
}

/**
 * One source of truth for the supported UI scales (see FONT_SCALE_LEVELS).
 * Applying the CSS custom property is synchronous and does not remount the
 * router or application tree; only the header/settings controls consume this
 * context and re-render.
 */
export function FontScaleProvider({ children }: FontScaleProviderProps) {
  const [scale, setScaleState] = useState<FontScale>(initialFontScale);

  const applyScale = useCallback((next: FontScale, persistRemote: boolean) => {
    const safeScale = isFontScale(next) ? next : DEFAULT_FONT_SCALE;
    applyFontScale(typeof document === "undefined" ? undefined : document.documentElement, safeScale);
    setScaleState(safeScale);
    try {
      const storage = browserStorage();
      storage?.setItem(FONT_SCALE_STORAGE_KEY, String(safeScale));
      storage?.removeItem(LEGACY_FONT_SIZE_STORAGE_KEY);
    } catch {
      // Persistence is optional; the current session remains fully usable.
    }
    if (persistRemote) {
      // Saved server-side like theme/language so the choice follows the user
      // across devices. A failed save keeps the local value and is retried on
      // the next change — preferences must never block using the app.
      void savePreferences({ fontScale: safeScale }).catch(() => undefined);
    }
  }, []);

  /** User-driven changes persist everywhere (localStorage + preferences API). */
  const setScale = useCallback((next: FontScale) => applyScale(next, true), [applyScale]);

  /** Reconciliation adopts the server's stored value without echoing a save. */
  const adoptScale = useCallback((next: FontScale) => applyScale(next, false), [applyScale]);

  // Keep separate tabs in sync without writing back and creating an event loop.
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const onStorage = (event: StorageEvent) => {
      if (event.key !== FONT_SCALE_STORAGE_KEY) return;
      const next = normalizeFontScale(event.newValue);
      applyFontScale(document.documentElement, next);
      setScaleState(next);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const index = FONT_SCALE_LEVELS.indexOf(scale);
  const canDecrease = index > 0;
  const canIncrease = index < FONT_SCALE_LEVELS.length - 1;

  const decrease = useCallback(() => {
    const currentIndex = FONT_SCALE_LEVELS.indexOf(scale);
    setScale(FONT_SCALE_LEVELS[Math.max(0, currentIndex - 1)]);
  }, [scale, setScale]);

  const increase = useCallback(() => {
    const currentIndex = FONT_SCALE_LEVELS.indexOf(scale);
    setScale(FONT_SCALE_LEVELS[Math.min(FONT_SCALE_LEVELS.length - 1, currentIndex + 1)]);
  }, [scale, setScale]);

  const value = useMemo<FontScaleContextValue>(
    () => ({ scale, setScale, adoptScale, increase, decrease, canIncrease, canDecrease }),
    [scale, setScale, adoptScale, increase, decrease, canIncrease, canDecrease],
  );

  // index.html applies the value before React. This layout-effect fallback runs
  // before paint in component tests or embedded builds that omit that script.
  useLayoutEffect(() => {
    applyFontScale(typeof document === "undefined" ? undefined : document.documentElement, scale);
  }, [scale]);

  return <FontScaleContext.Provider value={value}>{children}</FontScaleContext.Provider>;
}
