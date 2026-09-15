export const FONT_SCALE_STORAGE_KEY = "dmr_font_scale";
export const LEGACY_FONT_SIZE_STORAGE_KEY = "dmr_font_size";

export const FONT_SCALE_LEVELS = [1, 1.1, 1.2, 1.3, 1.4, 1.5] as const;

export type FontScale = (typeof FONT_SCALE_LEVELS)[number];

export const DEFAULT_FONT_SCALE: FontScale = 1;
export const MIN_FONT_SCALE: FontScale = FONT_SCALE_LEVELS[0];
export const MAX_FONT_SCALE: FontScale = FONT_SCALE_LEVELS[FONT_SCALE_LEVELS.length - 1];

export interface FontScaleStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem?: (key: string) => void;
}

const LEGACY_FONT_SCALE: Record<string, FontScale> = {
  small: 1,
  medium: 1,
  large: 1.1,
};

export function isFontScale(value: unknown): value is FontScale {
  return typeof value === "number" && FONT_SCALE_LEVELS.some((level) => level === value);
}

/**
 * Converts persisted input into one of the six supported levels.
 * Malformed values fall back to 100%; finite unsupported values are clamped
 * and snapped to the nearest 10% step so an arbitrary value can never escape.
 */
export function normalizeFontScale(value: unknown): FontScale {
  let numeric: number;

  if (typeof value === "number") {
    numeric = value;
  } else if (typeof value === "string") {
    const trimmed = value.trim();
    const match = trimmed.match(/^(\d+(?:\.\d+)?)\s*(%)?$/);
    if (!match) return DEFAULT_FONT_SCALE;
    numeric = Number(match[1]);
    if (match[2] || numeric >= 10) numeric /= 100;
  } else {
    return DEFAULT_FONT_SCALE;
  }

  if (!Number.isFinite(numeric)) return DEFAULT_FONT_SCALE;

  const clamped = Math.min(MAX_FONT_SCALE, Math.max(MIN_FONT_SCALE, numeric));
  return FONT_SCALE_LEVELS.reduce((nearest, level) =>
    Math.abs(level - clamped) < Math.abs(nearest - clamped) ? level : nearest
  );
}

export function fontScalePercent(scale: FontScale): number {
  return Math.round(scale * 100);
}

export function formatFontScale(scale: FontScale): string {
  return `${fontScalePercent(scale)}%`;
}

/**
 * The legacy setting changed a 16px root to 15/16/17px. The new feature has a
 * strict 100% minimum, so Small and Medium converge to 100%, while Large snaps
 * from 106.25% to the nearest supported level (110%).
 */
export function migrateLegacyFontSize(value: unknown): FontScale {
  if (typeof value !== "string") return DEFAULT_FONT_SCALE;
  return LEGACY_FONT_SCALE[value.trim().toLowerCase()] ?? DEFAULT_FONT_SCALE;
}

/** Defensive storage reader used by the provider and unit tests. */
export function readFontScalePreference(storage: FontScaleStorage | undefined): FontScale {
  if (!storage) return DEFAULT_FONT_SCALE;

  try {
    const stored = storage.getItem(FONT_SCALE_STORAGE_KEY);
    if (stored !== null) {
      const normalized = normalizeFontScale(stored);
      try {
        storage.setItem(FONT_SCALE_STORAGE_KEY, String(normalized));
        storage.removeItem?.(LEGACY_FONT_SIZE_STORAGE_KEY);
      } catch {
        // A stale/unsupported value is harmless when storage is read-only.
      }
      return normalized;
    }

    const legacy = storage.getItem(LEGACY_FONT_SIZE_STORAGE_KEY);
    if (legacy === null) return DEFAULT_FONT_SCALE;

    const migrated = migrateLegacyFontSize(legacy);
    try {
      storage.setItem(FONT_SCALE_STORAGE_KEY, String(migrated));
      storage.removeItem?.(LEGACY_FONT_SIZE_STORAGE_KEY);
    } catch {
      // A readable but non-writable storage area must not break startup.
    }
    return migrated;
  } catch {
    return DEFAULT_FONT_SCALE;
  }
}

export function applyFontScale(root: HTMLElement | undefined, scale: FontScale): void {
  if (!root) return;
  root.style.setProperty("--dmr-font-scale", String(scale));
  root.dataset.fontScale = String(fontScalePercent(scale));
}

/** Reads the already-applied scale without subscribing React consumers. */
export function getAppliedFontScale(): FontScale {
  if (typeof document === "undefined") return DEFAULT_FONT_SCALE;
  const fromDataset = document.documentElement.dataset.fontScale;
  return normalizeFontScale(fromDataset ?? DEFAULT_FONT_SCALE);
}
