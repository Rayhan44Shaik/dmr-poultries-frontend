// src/modules/staff/utils/salaryDisplay.ts
//
// Salary Register display text — employee names, departments and roles in
// English or Telugu. Staff-specific words are translated here; everything
// else falls through to the Trip screens' helper (same approach as the Recent
// Collections approved view), which transliterates word-by-word with a
// letter fallback. Digits and punctuation always pass through untouched, so
// numerics never change — only names and words do.

import type { Language } from "../../../i18n";
import { localizeTripViewText } from "../../operations/vehicle-trips/utils/tripViewLocalization";

/** Staff words the Trip helper doesn't know (departments + name parts). */
const STAFF_WORD_TE: Record<string, string> = {
  Operations: "ఆపరేషన్స్",
  Fleet: "ఫ్లీట్",
  Warehouse: "వేర్‌హౌస్",
  Accounts: "అకౌంట్స్",
  Kumar: "కుమార్",
  Reddy: "రెడ్డి",
  Teja: "తేజ",
  Das: "దాస్",
  Naidu: "నాయుడు",
  Singh: "సింగ్",
  Babu: "బాబు",
  Chandra: "చంద్ర",
  Verma: "వర్మ",
  Rao: "రావు",
  Karthik: "కార్తీక్",
  Suresh: "సురేష్",
  Ravi: "రవి",
  Mohan: "మోహన్",
  Prakash: "ప్రకాష్",
  Arjun: "అర్జున్",
  Vijay: "విజయ్",
  Naveen: "నవీన్",
  Ramesh: "రమేష్",
  Deepak: "దీపక్",
  Sandeep: "సందీప్",
  Chakrapani: "చక్రపాణి",
  Abdul: "అబ్దుల్",
  Kareem: "కరీమ్",
  Manoj: "మనోజ్",
};

function lookupStaffWord(part: string): string | undefined {
  return (
    STAFF_WORD_TE[part] ??
    STAFF_WORD_TE[part.toLocaleLowerCase()] ??
    STAFF_WORD_TE[part.charAt(0).toLocaleUpperCase() + part.slice(1).toLocaleLowerCase()]
  );
}

/**
 * Render a name / department / role for the given language. English (or an
 * empty value) returns the source unchanged; Telugu translates staff words
 * and transliterates the rest. Numerics are never touched.
 */
export function salaryDisplayText(
  value: string | null | undefined,
  language: Language
): string {
  const source = String(value ?? "").trim();
  if (!source || language !== "te") return source;
  return source
    .split(/(\s+)/)
    .map((part) => {
      if (!part || /^\s+$/.test(part)) return part;
      return lookupStaffWord(part) ?? localizeTripViewText(part, language);
    })
    .join("");
}

/**
 * Locale for dates/months: Telugu words but ALWAYS Latin digits, so amounts,
 * dates and reference numbers are never ambiguous.
 */
export function salaryLocale(language: Language): string {
  return language === "te" ? "te-IN-u-nu-latn" : "en-IN";
}

/**
 * Bilingual match for search boxes: matches the English source AND the Telugu
 * rendering, so a user reading Telugu can still type in English (and vice
 * versa). Same behaviour as the Recent Collections approved view.
 */
export function salaryMatchesQuery(
  value: string | null | undefined,
  query: string
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const source = String(value ?? "");
  if (source.toLowerCase().includes(q)) return true;
  return salaryDisplayText(source, "te").toLowerCase().includes(q);
}

export default salaryDisplayText;
