export type ShopPdfBoxQuantity = { birds: number; weight: number };

/**
 * Keeps the selected box labels while making the saved delivery row the
 * quantity authority. This matters after Shop Sales splits one original box
 * delivery across multiple shops.
 */
export function allocateSavedDeliveryAcrossBoxes(
  boxes: ShopPdfBoxQuantity[],
  deliveredBirds: number,
  deliveredWeight: number
): ShopPdfBoxQuantity[] {
  if (!boxes.length) return [];
  const targetBirds = Math.max(0, Math.round(deliveredBirds));
  const targetWeight = Math.max(0, Number(deliveredWeight.toFixed(2)));
  const sourceBirds = boxes.reduce((sum, box) => sum + Math.max(0, box.birds), 0);
  const sourceWeight = boxes.reduce((sum, box) => sum + Math.max(0, box.weight), 0);
  let assignedBirds = 0;
  let assignedWeight = 0;

  return boxes.map((box, index) => {
    const last = index === boxes.length - 1;
    const birds = last
      ? targetBirds - assignedBirds
      : Math.max(0, Math.floor(targetBirds * (sourceBirds > 0 ? box.birds / sourceBirds : 1 / boxes.length)));
    const weight = last
      ? Number((targetWeight - assignedWeight).toFixed(2))
      : Math.max(0, Number((targetWeight * (sourceWeight > 0 ? box.weight / sourceWeight : 1 / boxes.length)).toFixed(2)));
    assignedBirds += birds;
    assignedWeight = Number((assignedWeight + weight).toFixed(2));
    return { birds, weight };
  });
}
