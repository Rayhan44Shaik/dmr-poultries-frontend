/**
 * Order Collection → trip delivery mode (single rule, tested).
 *
 * The collection sheet captures birds / boxes / weight per shop but has no
 * mode toggle, so the mode is derived from what was entered: a row with
 * boxes is a box sale, a weight-only capture (boxes 0) is a weight sale.
 * Getting this wrong mislabels the row on every downstream surface (Trip
 * List cards, Rate Entry badge, Step 4 list), all of which read the stored
 * `delivery_mode` — so the rule lives here, not inline in the page.
 */
export function collectionDeliveryMode(boxes: number | null | undefined): "box" | "weight" {
  return Number(boxes) > 0 ? "box" : "weight";
}
