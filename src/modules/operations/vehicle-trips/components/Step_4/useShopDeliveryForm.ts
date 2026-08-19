import { useState, useMemo, useCallback, useEffect } from "react";
import type { ShopDelivery, BoxDetail } from "../../types/trip";
import { remainingBoxesByNumber } from "./remainingBoxes";

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

const EMPTY_VALIDATION_ERRORS: ValidationErrors = {
  birdsExceed: false,
  birdsMismatch: false,
  weightMismatch: false,
  birdsExceedFarm: false,
  weightExceedFarm: false,
  perBoxBirdsErrors: [],
  perBoxWeightErrors: [],
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

  const [validationErrors, setValidationErrors] = useState<ValidationErrors>(EMPTY_VALIDATION_ERRORS);

  const remainingByBox = useMemo(
    () =>
      remainingBoxesByNumber(
        safeBoxDetails,
        safeRows,
        editingId != null ? { excludeRowId: editingId } : {}
      ),
    [safeRows, safeBoxDetails, editingId]
  );

  const usedBoxIds = useMemo<number[]>(() => {
    const used: number[] = [];
    remainingByBox.forEach((remain, boxNo) => {
      if (remain.birds <= 0 && remain.weight <= 0) used.push(boxNo);
    });
    return used;
  }, [remainingByBox]);

  const availableBoxDetails = useMemo<BoxDetail[]>(() => {
    return safeBoxDetails
      .map((b: BoxDetail) => {
        const remain = remainingByBox.get(b.boxNo) ?? { birds: b.birds, weight: b.weight };
        return { ...b, birds: remain.birds, weight: remain.weight };
      })
      .filter(
        (b: BoxDetail) => !usedBoxIds.includes(b.boxNo) || formData.selectedBoxIds.includes(b.boxNo)
      );
  }, [safeBoxDetails, usedBoxIds, formData.selectedBoxIds, remainingByBox]);

  const farmBirds = useMemo<number>(() => {
    const selected = availableBoxDetails.filter((b: BoxDetail) => formData.selectedBoxIds.includes(b.boxNo));
    return selected.reduce((sum: number, b: BoxDetail) => sum + b.birds, 0);
  }, [availableBoxDetails, formData.selectedBoxIds]);

  const farmWeight = useMemo<number>(() => {
    const selected = availableBoxDetails.filter((b: BoxDetail) => formData.selectedBoxIds.includes(b.boxNo));
    return selected.reduce((sum: number, b: BoxDetail) => sum + b.weight, 0);
  }, [availableBoxDetails, formData.selectedBoxIds]);

  const boxCount = formData.selectedBoxIds.length;

  const weightModeTotals = useMemo<{ birds: number; weight: number }>(() => {
    if (mode !== "weight") return { birds: 0, weight: 0 };
    const totalBirds = formData.perBoxData.reduce(
      (sum: number, item: { boxNo: number; birds: number; weight: number }) => sum + item.birds,
      0
    );
    const totalWeight = formData.perBoxData.reduce(
      (sum: number, item: { boxNo: number; birds: number; weight: number }) => sum + item.weight,
      0
    );
    return { birds: totalBirds, weight: totalWeight };
  }, [formData.perBoxData, mode]);

  const mortKg = useMemo<number>(() => {
    if (mode === "box") {
      if (farmBirds > 0 && formData.mortality > 0) {
        return (farmWeight / farmBirds) * formData.mortality;
      }
      return 0;
    }
    return formData.mortWeight || 0;
  }, [mode, farmBirds, farmWeight, formData.mortality, formData.mortWeight]);

  const deliveredBirds = mode === "box" ? Math.max(0, farmBirds - formData.mortality) : weightModeTotals.birds;
  const deliveredWeight = mode === "box" ? Math.max(0, farmWeight - mortKg) : weightModeTotals.weight;

  const weightLoss = useMemo<number>(() => {
    if (mode !== "weight") return 0;
    return Math.max(0, farmWeight - (weightModeTotals.weight + (formData.mortWeight || 0)));
  }, [mode, farmWeight, weightModeTotals.weight, formData.mortWeight]);

  const calculateValidationErrors = useCallback((): ValidationErrors => {
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
      const totalBirds = weightModeTotals.birds + formData.mortality;
      const totalWeight = weightModeTotals.weight + mortKg;

      if (farmBirds > 0) {
        if (totalBirds > farmBirds) birdsExceedFarm = true;
        else if (totalBirds !== farmBirds) birdsMismatch = true;
      }

      if (farmWeight > 0 && totalWeight > farmWeight) weightExceedFarm = true;

      formData.perBoxData.forEach((item, index) => {
        const farmBox = availableBoxDetails.find((b) => b.boxNo === item.boxNo);
        perBoxBirdsErrors[index] = Boolean(farmBox && item.birds > farmBox.birds);
        perBoxWeightErrors[index] = Boolean(farmBox && item.weight > farmBox.weight);
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
  }, [
    mode,
    farmBirds,
    farmWeight,
    formData.mortality,
    weightModeTotals,
    mortKg,
    formData.perBoxData,
    availableBoxDetails,
  ]);

  const validationIsClear = useCallback((errors: ValidationErrors) => {
    return (
      !errors.birdsExceed &&
      !errors.birdsMismatch &&
      !errors.weightMismatch &&
      !errors.birdsExceedFarm &&
      !errors.weightExceedFarm &&
      !errors.perBoxBirdsErrors.some(Boolean) &&
      !errors.perBoxWeightErrors.some(Boolean)
    );
  }, []);

  /**
   * Keep field-level validation live while the user edits the form. This is
   * intentionally not a submit notification: an invalid value is red while it
   * is invalid and immediately returns to normal when corrected.
   */
  useEffect(() => {
    setValidationErrors(calculateValidationErrors());
  }, [calculateValidationErrors]);

  const validate = useCallback(() => {
    const errors = calculateValidationErrors();
    setValidationErrors(errors);
    return validationIsClear(errors);
  }, [calculateValidationErrors, validationIsClear]);

  useEffect(() => {
    if (mode === "box") {
      setFormData((prev) => ({ ...prev, birds: 0, weight: 0, perBoxData: [], mortWeight: 0 }));
    } else if (formData.selectedBoxIds.length > 0 && formData.perBoxData.length === 0) {
      const initialData = formData.selectedBoxIds.map((boxNo: number) => ({ boxNo, birds: 0, weight: 0 }));
      setFormData((prev) => ({ ...prev, perBoxData: initialData, mortWeight: 0 }));
    }
  }, [mode]);

  useEffect(() => {
    if (mode !== "weight") return;
    const currentBoxNos = formData.perBoxData.map((item: { boxNo: number }) => item.boxNo);
    const newBoxNos = formData.selectedBoxIds.filter((id: number) => !currentBoxNos.includes(id));
    const removedBoxNos = currentBoxNos.filter((id: number) => !formData.selectedBoxIds.includes(id));
    if (newBoxNos.length > 0 || removedBoxNos.length > 0) {
      const updated = formData.perBoxData
        .filter((item: { boxNo: number }) => formData.selectedBoxIds.includes(item.boxNo))
        .concat(newBoxNos.map((boxNo: number) => ({ boxNo, birds: 0, weight: 0 })))
        .sort((a: { boxNo: number }, b: { boxNo: number }) => a.boxNo - b.boxNo);
      setFormData((prev) => ({ ...prev, perBoxData: updated }));
    }
  }, [formData.selectedBoxIds, mode]);

  return {
    mode,
    setMode,
    formData,
    setFormData,
    validationErrors,
    setValidationErrors,
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
