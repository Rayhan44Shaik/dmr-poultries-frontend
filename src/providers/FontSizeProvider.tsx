import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export const FONT_SCALE_STEPS = [1, 1.1, 1.2, 1.3, 1.4, 1.5] as const;
export type FontScale = (typeof FONT_SCALE_STEPS)[number];

export const DEFAULT_FONT_SCALE: FontScale = 1;
export const MIN_FONT_SCALE: FontScale = 1;
export const MAX_FONT_SCALE: FontScale = 1.5;
export const FONT_SCALE_STORAGE_KEY = "dmr_font_scale";

const LEGACY_FONT_SIZE_STORAGE_KEY = "dmr_font_size";

interface FontSizeContextValue {
  scale: FontScale;
  canDecrease: boolean;
  canIncrease: boolean;
  setScale: (scale: FontScale) => void;
  increase: () => void;
  decrease: () => void;
  reset: () => void;
}

const FontSizeContext = createContext<FontSizeContextValue | undefined>(undefined);

function clampScale(value: number): FontScale {
  const closest = FONT_SCALE_STEPS.reduce((best, step) =>
    Math.abs(step - value) < Math.abs(best - value) ? step : best,
  DEFAULT_FONT_SCALE);
  return closest;
}

function readStoredScale(): FontScale {
  try {
    const stored = Number.parseFloat(localStorage.getItem(FONT_SCALE_STORAGE_KEY) ?? "");
    if (Number.isFinite(stored)) return clampScale(stored);

    // Preserve the user's existing Appearance setting when upgrading from the
    // previous three-level implementation.
    const legacy = localStorage.getItem(LEGACY_FONT_SIZE_STORAGE_KEY);
    if (legacy === "Small") return 1;
    if (legacy === "Large") return 1.2;
  } catch {
    // Storage can be unavailable in private/restricted environments.
  }
  return DEFAULT_FONT_SCALE;
}

function applyScale(scale: FontScale) {
  const root = document.documentElement;
  root.style.setProperty("--ds-font-scale", String(scale));
  root.dataset.fontScale = String(scale);
}

export function FontSizeProvider({ children }: { children: ReactNode }) {
  const [scale, setScaleState] = useState<FontScale>(readStoredScale);

  useEffect(() => {
    applyScale(scale);
    try {
      localStorage.setItem(FONT_SCALE_STORAGE_KEY, String(scale));
    } catch {
      // Keep the setting active for the current session even if persistence fails.
    }
  }, [scale]);

  const setScale = useCallback((next: FontScale) => {
    const safeScale = clampScale(next);
    // Apply immediately so the UI scales in the same frame as the control click;
    // React state then keeps the header/settings controls synchronized.
    applyScale(safeScale);
    setScaleState(safeScale);
    try {
      localStorage.setItem(FONT_SCALE_STORAGE_KEY, String(safeScale));
    } catch {
      // Ignore storage failures; the in-memory preference remains active.
    }
  }, []);

  const increase = useCallback(() => {
    const index = FONT_SCALE_STEPS.indexOf(scale);
    if (index < FONT_SCALE_STEPS.length - 1) setScale(FONT_SCALE_STEPS[index + 1]);
  }, [scale, setScale]);

  const decrease = useCallback(() => {
    const index = FONT_SCALE_STEPS.indexOf(scale);
    if (index > 0) setScale(FONT_SCALE_STEPS[index - 1]);
  }, [scale, setScale]);

  const reset = useCallback(() => setScale(DEFAULT_FONT_SCALE), [setScale]);

  const value = useMemo<FontSizeContextValue>(
    () => ({
      scale,
      canDecrease: scale > MIN_FONT_SCALE,
      canIncrease: scale < MAX_FONT_SCALE,
      setScale,
      increase,
      decrease,
      reset,
    }),
    [scale, setScale, increase, decrease, reset],
  );

  return <FontSizeContext.Provider value={value}>{children}</FontSizeContext.Provider>;
}

export function useFontSize() {
  const context = useContext(FontSizeContext);
  if (!context) throw new Error("useFontSize must be used within FontSizeProvider");
  return context;
}
