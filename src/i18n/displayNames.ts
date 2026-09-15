// src/i18n/displayNames.ts
// -----------------------------------------------------------------------------
// PEOPLE NAMES IN TELUGU
//
// The master data stores English spellings (Anil Kumar, Basha Goud, …). In
// Telugu mode the UI shows them transliterated (అనిల్ కుమార్) word by word:
//
//   • every word is looked up as `name.<lowercase word>` in the dictionaries
//   • a word with no entry (a new employee, a shop or farm name, …) is shown
//     exactly as stored, so nothing is ever lost or guessed
//
// English mode returns the stored spelling untouched, and the DATA never
// changes: the API, the filters and the search box all keep working with the
// English value — only the label on screen follows the language.
// -----------------------------------------------------------------------------

import type { Language } from './context';

type Translator = (key: string, params?: Record<string, string | number>) => string;

/**
 * `Anil Kumar` → `అనిల్ కుమార్` (Telugu), unchanged in English mode.
 * Unknown words pass through as-is, so this is safe for any name.
 */
export function personNameLabel(t: Translator, language: Language, name: string): string {
  if (language !== 'te' || !name) return name;
  return name
    .trim()
    .split(/\s+/)
    .map((word) => {
      const key = `name.${word.toLowerCase()}`;
      const translated = t(key);
      return translated === key ? word : translated;
    })
    .join(' ');
}
