import { StatusBadge } from "../../../ui";

/**
 * Active / Inactive badge for master records.
 *
 * Delegates to the global `StatusBadge`, so master lists now use exactly the
 * same badge shape, colour mapping and status vocabulary as every other module
 * (previously the masters had their own bespoke pill while Operations had
 * another and Staff a third).
 *
 * Colour is never the sole signal: the label always renders, and the dot is
 * `aria-hidden` so screen readers hear the word, not the colour.
 */
export default function MasterStatusBadge({
  status,
}: {
  status: "Active" | "Inactive";
}) {
  return <StatusBadge status={status} size="md" />;
}
