/**
 * Collection status labels.
 *
 * The backend calls the awaiting-decision state "Pending Approval", and the
 * global `status.pending_approval` key spells that out in full. Within the
 * Collection screens we show the shorter "Pending" instead — the surrounding
 * tab and column already establish that approval is what is pending, so the
 * longer phrase only crowded the badge and the tab.
 *
 * The global key is deliberately left alone: the Trips dashboard and other
 * modules still render the full phrase, and changing it there would be an
 * unrelated, unrequested edit.
 */

type Translate = (key: string, params?: Record<string, string | number>) => string;

/** Maps a raw backend status onto the i18n key used inside Collections. */
export function collectionStatusKey(rawStatus: string | null | undefined): string {
  const raw = String(rawStatus ?? "").trim();
  // "Pending Approval" → the short "Pending" label used across Collections.
  if (raw.toLowerCase().startsWith("pending")) return "status.pending";
  return "status." + raw.toLowerCase().replace(/\s+/g, "_");
}

/**
 * Translated status label, falling back to the raw backend value when no
 * translation exists so an unknown status still renders as something.
 */
export function collectionStatusLabel(rawStatus: string | null | undefined, t: Translate): string {
  const raw = String(rawStatus ?? "").trim();
  const key = collectionStatusKey(raw);
  const label = t(key);
  return label === key ? raw : label;
}
