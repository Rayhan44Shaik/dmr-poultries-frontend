import { useState, useMemo, useEffect } from "react";
import type { ShopDelivery, BoxDetail } from "../../types/trip";

export type ShopDeliveryWithExtra = ShopDelivery & {
  deliveryMode?: string;
  selectedBoxIds?: number[];
  farmBirds?: number;
  farmWeight?: number;
  mortKg?: number;
  perBoxData?: { boxNo: number; birds: number; weight: number }[];
  autoCaptureTime?: string;
};

export type ValidationErrors = {
  birdsExceed: boolean;
  birdsMismatch: boolean;
  weightMismatch: boolean;
  birdsExceedFarm: boolean;
  weightExceedFarm: boolean;
  perBoxBirdsErrors: boolean[];
  perBoxWeightErrors: boolean[];
};

export function useShopDeliveryForm(
  safeRows: ShopDelivery[],
  safeBoxDetails: BoxDetail[],
  editingId: number | null
) {
  const [mode, setMode] = useState<"box" | "weight">("box");
  const [formData, setFormData] = useState<{
    shopId: number;
    shopName: string;
    birdTypeId: number;
    birdType: string;
    selectedBoxIds: number[];
    birds: number;
    weight: number;
    mortality: number;
    mortWeight: number;
    remarks: string;
    perBoxData: { boxNo: number; birds: number; weight: number }[];
  }>({
    shopId: 0,
    shopName: "",
    birdTypeId: 0,
    birdType: "",
    selectedBoxIds: [],
    birds: 0,
    weight: 0,
    mortality: 0,
    mortWeight: 0,
    remarks: "",
    perBoxData: [],
  });

  // ─── Compute used box numbers ──────────────────────────────────
  const usedBoxIds = useMemo<number[]>(() => {
    const used = new Set<number>();
    safeRows.forEach((row: ShopDelivery) => {
      if (editingId !== null && row.id === editingId) return;
      const rowWithExtra = row as ShopDeliveryWithExtra;
      if (rowWithExtra.selectedBoxIds && rowWithExtra.selectedBoxIds.length > 0) {
        rowWithExtra.selectedBoxIds.forEach((id: number) => used.add(id));
      }
    });
    return Array.from(used);
  }, [safeRows, editingId]);

  // ─── Available boxes ───────────────────────────────────────────
  const availableBoxDetails = useMemo<BoxDetail[]>(() => {
    return safeBoxDetails.filter(
      (b: BoxDetail) => !usedBoxIds.includes(b.boxNo) || formData.selectedBoxIds.includes(b.boxNo)
    );
  }, [safeBoxDetails, usedBoxIds, formData.selectedBoxIds]);

  // ─── Farm values ──────────────────────────────────────────────
  const farmBirds = useMemo<number>(() => {
    const selected = availableBoxDetails.filter((b: BoxDetail) => formData.selectedBoxIds.includes(b.boxNo));
    return selected.reduce((sum: number, b: BoxDetail) => sum + b.birds, 0);
  }, [availableBoxDetails, formData.selectedBoxIds]);

  const farmWeight = useMemo<number>(() => {
    const selected = availableBoxDetails.filter((b: BoxDetail) => formData.selectedBoxIds.includes(b.boxNo));
    return selected.reduce((sum: number, b: BoxDetail) => sum + b.weight, 0);
  }, [availableBoxDetails, formData.selectedBoxIds]);

  const boxCount = formData.selectedBoxIds.length;

  // ─── Weight mode totals ──────────────────────────────────────
  const weightModeTotals = useMemo<{ birds: number; weight: number }>(() => {
    if (mode !== "weight") return { birds: 0, weight: 0 };
    const totalBirds = formData.perBoxData.reduce((sum: number, item: { boxNo: number; birds: number; weight: number }) => sum + item.birds, 0);
    const totalWeight = formData.perBoxData.reduce((sum: number, item: { boxNo: number; birds: number; weight: number }) => sum + item.weight, 0);
    return { birds: totalBirds, weight: totalWeight };
  }, [formData.perBoxData, mode]);

  // ─── Mortality weight ──────────────────────────────────────────
  const mortKg = useMemo<number>(() => {
    if (mode === "box") {
      if (farmBirds > 0 && formData.mortality > 0) {
        return (farmWeight / farmBirds) * formData.mortality;
      }
      return 0;
    } else {
      return formData.mortWeight || 0;
    }
  }, [mode, farmBirds, farmWeight, formData.mortality, formData.mortWeight]);

  const deliveredBirds = mode === "box" ? Math.max(0, farmBirds - formData.mortality) : weightModeTotals.birds;
  const deliveredWeight = mode === "box" ? Math.max(0, farmWeight - mortKg) : weightModeTotals.weight;

  // ─── Weight Loss ──────────────────────────────────────────────
  const weightLoss = useMemo<number>(() => {
    if (mode !== "weight") return 0;
    const totalDeliveredWeight = weightModeTotals.weight;
    const totalMortalityWeight = formData.mortWeight || 0;
    return Math.max(0, farmWeight - (totalDeliveredWeight + totalMortalityWeight));
  }, [mode, farmWeight, weightModeTotals.weight, formData.mortWeight]);

  // ─── Validation ──────────────────────────────────────────────────
  // Derived reactively from current inputs (not imperative setState) so
  // correcting a value — e.g. Delivered Weight 51 -> 49 kg — clears the
  // error and re-enables Submit/Update on the very next render, with no
  // stale error left over from a previous failed attempt.
  const validationErrors = useMemo<ValidationErrors>(() => {
    let birdsExceed = false;
    let birdsMismatch = false;
    let weightMismatch = false;
    let birdsExceedFarm = false;
    let weightExceedFarm = false;
    const perBoxBirdsErrors: boolean[] = [];
    const perBoxWeightErrors: boolean[] = [];

    if (mode === "box") {
      birdsExceed = formData.mortality > farmBirds && farmBirds > 0;
    } else {
      // Farm Birds must equal Delivered Birds + Mortality exactly.
      const totalBirds = weightModeTotals.birds + formData.mortality;
      if (farmBirds > 0) {
        if (totalBirds > farmBirds) {
          birdsExceedFarm = true;
        } else if (totalBirds !== farmBirds) {
          birdsMismatch = true;
        }
      }

      // Delivered Weight alone must not exceed Farm Weight. Mortality
      // Weight is optional and is intentionally excluded from this check —
      // it must never block Submit/Update.
      if (farmWeight > 0 && weightModeTotals.weight > farmWeight) {
        weightExceedFarm = true;
      }

      formData.perBoxData.forEach((item, index) => {
        const farmBox = availableBoxDetails.find((b) => b.boxNo === item.boxNo);
        if (farmBox) {
          perBoxBirdsErrors[index] = item.birds > farmBox.birds;
          perBoxWeightErrors[index] = item.weight > farmBox.weight;
        } else {
          perBoxBirdsErrors[index] = false;
          perBoxWeightErrors[index] = false;
        }
      });
    }

    return {
      birdsExceed,
      birdsMismatch,
      weightMismatch,
      birdsExceedFarm,
      weightExceedFarm,
      perBoxBirdsErrors,
      perBoxWeightErrors,
    };
  }, [mode, farmBirds, farmWeight, formData.mortality, weightModeTotals, formData.perBoxData, availableBoxDetails]);

  const validate = () =>
    !validationErrors.birdsExceed &&
    !validationErrors.birdsMismatch &&
    !validationErrors.weightMismatch &&
    !validationErrors.birdsExceedFarm &&
    !validationErrors.weightExceedFarm &&
    !validationErrors.perBoxBirdsErrors.some((err) => err) &&
    !validationErrors.perBoxWeightErrors.some((err) => err);

  // ─── Auto-initialise perBoxData when switching to weight mode ──
  useEffect(() => {
    if (mode === "box") {
      setFormData((prev) => ({ ...prev, birds: 0, weight: 0, perBoxData: [], mortWeight: 0 }));
    } else {
      if (formData.selectedBoxIds.length > 0 && formData.perBoxData.length === 0) {
        const initialData = formData.selectedBoxIds.map((boxNo: number) => ({
          boxNo,
          birds: 0,
          weight: 0,
        }));
        setFormData((prev) => ({ ...prev, perBoxData: initialData, mortWeight: 0 }));
      }
    }
  }, [mode]);

  useEffect(() => {
    if (mode === "weight") {
      const currentBoxNos = formData.perBoxData.map((item: { boxNo: number }) => item.boxNo);
      const newBoxNos = formData.selectedBoxIds.filter((id: number) => !currentBoxNos.includes(id));
      const removedBoxNos = currentBoxNos.filter((id: number) => !formData.selectedBoxIds.includes(id));
      if (newBoxNos.length > 0 || removedBoxNos.length > 0) {
        let updated = formData.perBoxData.filter((item: { boxNo: number }) => formData.selectedBoxIds.includes(item.boxNo));
        newBoxNos.forEach((boxNo: number) => {
          updated.push({ boxNo, birds: 0, weight: 0 });
        });
        updated.sort((a: { boxNo: number }, b: { boxNo: number }) => a.boxNo - b.boxNo);
        setFormData((prev) => ({ ...prev, perBoxData: updated }));
      }
    }
  }, [formData.selectedBoxIds, mode]);

  return {
    mode,
    setMode,
    formData,
    setFormData,
    validationErrors,
    usedBoxIds,
    availableBoxDetails,
    farmBirds,
    farmWeight,
    boxCount,
    weightModeTotals,
    mortKg,
    deliveredBirds,
    deliveredWeight,
    weightLoss,
    validate,
  };
}