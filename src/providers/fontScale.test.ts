import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import {
  DEFAULT_FONT_SCALE,
  FONT_SCALE_LEVELS,
  FONT_SCALE_STORAGE_KEY,
  LEGACY_FONT_SIZE_STORAGE_KEY,
  formatFontScale,
  migrateLegacyFontSize,
  normalizeFontScale,
  readFontScalePreference,
  type FontScaleStorage,
} from "./fontScale";

function memoryStorage(seed: Record<string, string> = {}): FontScaleStorage & { values: Map<string, string> } {
  const values = new Map(Object.entries(seed));
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

test("all six supported font levels remain exact", () => {
  for (const level of FONT_SCALE_LEVELS) {
    assert.equal(normalizeFontScale(String(level)), level);
    assert.equal(formatFontScale(level), `${Math.round(level * 100)}%`);
  }
});

test("finite unsupported values clamp and snap to a supported level", () => {
  assert.equal(normalizeFontScale("90%"), 1);
  assert.equal(normalizeFontScale("126%"), 1.3);
  assert.equal(normalizeFontScale(1.46), 1.5);
  assert.equal(normalizeFontScale(8), 1.5);
});

test("malformed persisted values safely fall back to 100%", () => {
  assert.equal(normalizeFontScale(null), DEFAULT_FONT_SCALE);
  assert.equal(normalizeFontScale(""), DEFAULT_FONT_SCALE);
  assert.equal(normalizeFontScale("large-ish"), DEFAULT_FONT_SCALE);
  assert.equal(normalizeFontScale(Number.NaN), DEFAULT_FONT_SCALE);
});

test("legacy Small/Medium/Large semantics migrate to the nearest allowed scale", () => {
  assert.equal(migrateLegacyFontSize("Small"), 1);
  assert.equal(migrateLegacyFontSize("Medium"), 1);
  assert.equal(migrateLegacyFontSize("Large"), 1.1);
});

test("the new storage key wins and legacy data becomes one source of truth", () => {
  const current = memoryStorage({
    [FONT_SCALE_STORAGE_KEY]: "1.4",
    [LEGACY_FONT_SIZE_STORAGE_KEY]: "Large",
  });
  assert.equal(readFontScalePreference(current), 1.4);
  assert.equal(current.values.has(LEGACY_FONT_SIZE_STORAGE_KEY), false);

  const unsupported = memoryStorage({ [FONT_SCALE_STORAGE_KEY]: "126%" });
  assert.equal(readFontScalePreference(unsupported), 1.3);
  assert.equal(unsupported.values.get(FONT_SCALE_STORAGE_KEY), "1.3");

  const legacy = memoryStorage({ [LEGACY_FONT_SIZE_STORAGE_KEY]: "Large" });
  assert.equal(readFontScalePreference(legacy), 1.1);
  assert.equal(legacy.values.get(FONT_SCALE_STORAGE_KEY), "1.1");
  assert.equal(legacy.values.has(LEGACY_FONT_SIZE_STORAGE_KEY), false);
});

test("storage failures never escape into application startup", () => {
  const broken: FontScaleStorage = {
    getItem: () => { throw new Error("blocked"); },
    setItem: () => { throw new Error("blocked"); },
  };
  assert.equal(readFontScalePreference(broken), DEFAULT_FONT_SCALE);
});

test("the pre-React bootstrap applies a stored scale synchronously", () => {
  const html = readFileSync(fileURLToPath(new URL("../../index.html", import.meta.url)), "utf8");
  const scriptMatch = html.match(
    /<!-- Apply persisted accessibility preferences[\s\S]*?<script>([\s\S]*?)<\/script>/,
  );
  assert.ok(scriptMatch, "font-scale bootstrap script is present");

  const values = new Map<string, string>([[FONT_SCALE_STORAGE_KEY, "150%"]]);
  const properties = new Map<string, string>();
  const attributes = new Map<string, string>();
  const root = {
    lang: "en",
    style: { setProperty: (name: string, value: string) => properties.set(name, value) },
    setAttribute: (name: string, value: string) => attributes.set(name, value),
  };
  const localStorage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };

  runInNewContext(scriptMatch[1], { document: { documentElement: root }, localStorage });

  assert.equal(properties.get("--dmr-font-scale"), "1.5");
  assert.equal(attributes.get("data-font-scale"), "150");
  assert.equal(values.get(FONT_SCALE_STORAGE_KEY), "1.5");
});
