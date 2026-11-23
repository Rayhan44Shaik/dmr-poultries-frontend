/** Escapes text before it is interpolated into a PDF sheet's HTML markup.
 * `&` must be replaced first so the entities added afterwards are not
 * double-escaped. Quotes are escaped for attribute contexts; the numeric
 * apostrophe entity keeps the result valid in both text and attributes. */
export function escapeHtml(value: string | number | null | undefined): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
