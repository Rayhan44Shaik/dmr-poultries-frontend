// EVERY t("key") used anywhere in src must resolve in some dictionary — the
// global tables or a module's own copy file. A key that resolves nowhere is
// printed to the operator verbatim ("orders.wa_send_to"), in English AND in
// Telugu, so this is the check that "no broken Telugu" really rests on.
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const files = [];
(function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full);
    else if (/\.(ts|tsx)$/.test(entry) && !entry.includes(".test.")) files.push(full);
  }
})("src");

const keyPattern = /(?<![.\w])t\(\s*["'`]([A-Za-z0-9_.]+)["'`]/g;
const used = new Map();
for (const file of files) {
  const source = readFileSync(file, "utf8");
  for (const match of source.matchAll(keyPattern)) {
    if (!used.has(match[1])) used.set(match[1], new Set());
    used.get(match[1]).add(file);
  }
}

// Every dictionary in the repository: the global pair, the module tables and
// each module's own copy file.
const definitions = new Set();
for (const file of files) {
  if (!file.includes(`${path.sep}i18n${path.sep}`) && !/i18n[^/]*\.ts$/.test(file) && !/Copy\.ts$/.test(file)) continue;
  const source = readFileSync(file, "utf8");
  for (const match of source.matchAll(/["'`]([A-Za-z0-9_.]+)["'`]\s*:/g)) definitions.add(match[1]);
}

// Values, for the Telugu report: a Telugu dictionary missing a key falls back to
// English, which is a visible hole even though the key exists somewhere.
const valueOf = (file, key) => {
  const match = readFileSync(file, "utf8").match(new RegExp(`["'\`]${key.replace(/\./g, "\\.")}["'\`]\\s*:\\s*["'\`]([^"'\`]*)`));
  return match ? match[1] : null;
};
const teGlobal = new Set();
for (const file of ["src/i18n/te.ts", ...readdirSync("src/i18n/modules").filter((f) => f.includes(".te.")).map((f) => path.join("src/i18n/modules", f))]) {
  for (const match of readFileSync(file, "utf8").matchAll(/["'`]([A-Za-z0-9_.]+)["'`]\s*:/g)) teGlobal.add(match[1]);
}

const unresolvable = [...used.entries()].filter(([key]) => !definitions.has(key));
const englishInTelugu = [...used.keys()].filter((key) => {
  // Only the global tables are language-complete; module copy files carry their
  // own Telugu columns, so a key defined in a module table is that module's job.
  const globalKey = !teGlobal.has(key) && [...definitions].includes(key);
  return globalKey && key === key;
});

console.log(`keys used: ${used.size}`);
console.log(`defined somewhere: ${definitions.size}`);
console.log(`UNRESOLVABLE: ${unresolvable.length}`);
for (const [key, where] of unresolvable) console.log(`  ${key}  ${[...where].slice(0, 2).join(", ")}`);

// A key that exists in the English table but not the Telugu one still reads
// English in a Telugu session.
const enOnly = [];
for (const key of used.keys()) {
  if (/^[a-z]+$/.test(key) && !key.includes(".")) continue; // module-scoped, keyed without a prefix
  const inEn = valueOf("src/i18n/en.ts", key) ?? null;
  if (inEn === null) continue;
  if (valueOf("src/i18n/te.ts", key) === null) enOnly.push(key);
}
console.log(`EN-ONLY (no Telugu entry): ${enOnly.length}`);
if (enOnly.length) console.log("  " + enOnly.slice(0, 20).join(", "));
