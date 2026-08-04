import { useCallback, useState } from "react";
import type { Trip, ShopDelivery, BoxDetail, TripStatus } from "../types/trip";
import {
  createTrip,
  handleApiError,
  loadLatestDraft,
  loadTripById,
  saveTrip,
  submitTripStep,
  tripService,
  upsertTrip,
} from "../services/tripService";
import {
  generateTripNo,
  calculateAvgWeight,
  validateStartStep,
  validateFarmStep,
  validatePickupStep,
  validateEndStep,
  validateFinalTrip,
} from "../services/tripFormService";

export function useTripEntry(
  showNotification?: (msg: string, type?: "success" | "error" | "info") => void
) {
  const emptyTrip = (): Trip => ({
    id: 0,
    tripNo: "",
    tripDate: new Date().toISOString().split("T")[0],
    startTime: "",
    vehicleId: 0,
    vehicleNo: "",
    driverId: 0,
    driverName: "",
    supervisorId: 0,
    supervisorName: "",
    helpers: [],
    openingMeter: 0,
    advanceAmount: 0,
    startStepSubmitted: false,
    sourceFarmId: 0,
    sourceFarm: "",
    reachedTime: "",
    destMeter: 0,
    pickupTolls: 0,
    farmStepSubmitted: false,
    farmAddress: "",
    dcWeight: 0,
    totalBirds: 0,
    boxes: 0,
    boxDetails: [],
    avgWeight: 0,
    pickupLoadTime: "",
    pickupStepSubmitted: false,
    deliveries: [],
    deliveryStepSubmitted: false,
    closingMeter: 0,
    endTime: "",
    deliveryTolls: 0,
    endStepSubmitted: false,
    totalKm: 0,
    totalShops: 0,
    totalWeight: 0,
    totalDeliveredWeight: 0,
    totalBirdsDelivered: 0,
    totalMortality: 0,
    totalMortalityCount: 0,
    totalMortalityWeight: 0,
    weightLoss: 0,
    survivalRate: 0,
    lastShop: "",
    status: "Draft",
    fuel: 0,
    expense: 0,
    remarks: "",
    rateCompleted: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    boxNo: 0,
    birds: 0,
    weight: 0,
  });

  const [trip, setTrip] = useState<Trip>(emptyTrip());
  const [isEditing, setIsEditing] = useState(false);
  const [endStepSubmitted, setEndStepSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const syncEndStep = (tripData: Trip) => {
    setEndStepSubmitted(Boolean(tripData.endStepSubmitted));
  };

  const applySaved = (saved: Trip) => {
    setTrip({
      ...saved,
      helpers: saved.helpers || [],
      loaders: saved.loaders || [],
      deliveries: saved.deliveries || [],
      boxDetails: saved.boxDetails || [],
    });
    syncEndStep(saved);
    setError(null);
    return saved;
  };

  const calculateDeliveryKPIs = (
    deliveries: ShopDelivery[],
    birds: number,
    dcWeight: number,
    avgWeight: number,
    mortalityCount: number
  ) => {
    const totalDelBirds = deliveries.reduce((s, r) => s + r.birds, 0);
    const totalDelWeight = deliveries.reduce((s, r) => s + r.weight, 0);
    const totalShops = deliveries.length;
    const lastShop =
      deliveries.length > 0 ? deliveries[deliveries.length - 1].shopName : "";
    const mortalityWeight = Number((mortalityCount * avgWeight).toFixed(2));
    const weightLoss = Number(
      (dcWeight - totalDelWeight - mortalityWeight).toFixed(2)
    );
    const survivalRate =
      birds > 0
        ? Number(((1 - mortalityCount / birds) * 100).toFixed(1))
        : 0;

    return {
      totalDelBirds,
      totalDelWeight,
      totalShops,
      lastShop,
      mortalityWeight,
      weightLoss,
      survivalRate,
    };
  };

  /** Persist current trip to PostgreSQL without advancing a step flag. */
  const persistTrip = useCallback(
    async (
      data: Partial<Trip> & Record<string, unknown>,
      options?: { silent?: boolean }
    ): Promise<Trip | null> => {
      setSaving(true);
      setError(null);
      try {
        const merged = { ...trip, ...data } as Trip & Record<string, unknown>;
        const saved = await upsertTrip(merged);
        applySaved(saved);
        if (!options?.silent) {
          showNotification?.("💾 Progress saved.", "info");
        }
        return saved;
      } catch (err) {
        const message = handleApiError(err);
        setError(message);
        showNotification?.(message, "error");
        return null;
      } finally {
        setSaving(false);
      }
    },
    [trip, showNotification]
  );

  const submitStartStep = async (data: Partial<Trip>): Promise<boolean> => {
    const updatedData = {
      ...trip,
      ...data,
      startTime: trip.startTime || new Date().toLocaleString(),
    };
    const validation = validateStartStep(updatedData as Trip);
    if (!validation.valid) {
      showNotification?.(validation.errors[0], "error");
      return false;
    }

    setSaving(true);
    setError(null);
    try {
      let saved: Trip;
      if (trip.id && trip.id > 0) {
        saved = await submitTripStep(trip.id, "start", {
          ...updatedData,
          status: "Draft",
        });
        showNotification?.(`✅ Step 1 updated successfully.`, "success");
      } else {
        const existing = tripService.getAll();
        const tripNo =
          updatedData.tripNo ||
          generateTripNo(existing, updatedData.tripDate);
        // Create Draft in PostgreSQL, then mark start step submitted
        const created = await createTrip({
          ...updatedData,
          tripNo,
          status: "Draft",
          startStepSubmitted: true,
        });
        saved = await submitTripStep(created.id, "start", {
          ...updatedData,
          tripNo: created.tripNo,
          status: "Draft",
        });
        showNotification?.(
          `✅ Step 1 completed successfully. Moving to Step 2...`,
          "success"
        );
      }
      applySaved(saved);
      setIsEditing(true);
      return true;
    } catch (err) {
      const message = handleApiError(err);
      setError(message);
      showNotification?.(message, "error");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const submitFarmStep = async (data: Partial<Trip>): Promise<boolean> => {
    if (!trip.id) {
      showNotification?.("Trip not created yet. Complete Step 1 first.", "error");
      return false;
    }
    const reachedTime = trip.farmStepSubmitted
      ? trip.reachedTime
      : new Date().toLocaleString();
    const updatedData = { ...trip, ...data, reachedTime };
    const validation = validateFarmStep(updatedData as Trip);
    if (!validation.valid) {
      showNotification?.(validation.errors[0], "error");
      return false;
    }

    setSaving(true);
    setError(null);
    try {
      const saved = await submitTripStep(trip.id, "farm", updatedData);
      applySaved(saved);
      showNotification?.(
        isEditing
          ? `✅ Step 2 updated successfully.`
          : `✅ Step 2 completed successfully. Moving to Step 3...`,
        "success"
      );
      return true;
    } catch (err) {
      const message = handleApiError(err);
      setError(message);
      showNotification?.(message, "error");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const updateBoxDetails = async (
    rows: BoxDetail[],
    persistToStorage: boolean = false,
    silent: boolean = false
  ) => {
    const totalBirds = rows.reduce((sum, r) => sum + (r.birds || 0), 0);
    const dcWeight = Number(
      rows.reduce((sum, r) => sum + (r.weight || 0), 0).toFixed(2)
    );
    const boxes = rows.length;
    const avgWeight = calculateAvgWeight(dcWeight, totalBirds);

    const updatedTrip: Trip = {
      ...trip,
      boxDetails: rows,
      totalBirds,
      dcWeight,
      boxes,
      avgWeight,
    };

    if (persistToStorage && trip.id) {
      setSaving(true);
      try {
        const saved = await saveTrip(trip.id, updatedTrip);
        applySaved(saved);
        if (!silent) showNotification?.(`💾 Pickup progress saved.`, "info");
      } catch (err) {
        const message = handleApiError(err);
        setError(message);
        showNotification?.(message, "error");
        setTrip(updatedTrip);
      } finally {
        setSaving(false);
      }
    } else {
      setTrip(updatedTrip);
      syncEndStep(updatedTrip);
    }
  };

  const submitPickupStep = async (data: Partial<Trip> = {}): Promise<boolean> => {
    if (!trip.id) {
      showNotification?.("Trip not created yet. Complete Step 1 first.", "error");
      return false;
    }
    const updatedData = { ...trip, ...data };
    if (!updatedData.boxDetails || updatedData.boxDetails.length === 0) {
      showNotification?.(
        `❌ Please add at least one box before submitting Pickup.`,
        "error"
      );
      return false;
    }
    const validation = validatePickupStep(updatedData as Trip);
    if (!validation.valid) {
      showNotification?.(validation.errors[0], "error");
      return false;
    }

    const avg = calculateAvgWeight(
      updatedData.dcWeight || 0,
      updatedData.totalBirds || 0
    );
    const pickupLoadTime = trip.pickupStepSubmitted
      ? trip.pickupLoadTime
      : new Date().toLocaleString();

    setSaving(true);
    setError(null);
    try {
      const saved = await submitTripStep(trip.id, "pickup", {
        ...updatedData,
        avgWeight: avg,
        pickupLoadTime,
      });
      applySaved(saved);
      showNotification?.(
        isEditing
          ? `✅ Step 3 updated successfully.`
          : `✅ Step 3 completed successfully. Moving to Step 4...`,
        "success"
      );
      return true;
    } catch (err) {
      const message = handleApiError(err);
      setError(message);
      showNotification?.(message, "error");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const submitDeliveriesStep = async (): Promise<boolean> => {
    if (!trip.id) {
      showNotification?.("Trip not created yet. Complete Step 1 first.", "error");
      return false;
    }
    if (trip.deliveries.length === 0) {
      showNotification?.(
        `❌ Please add at least one shop delivery before proceeding.`,
        "error"
      );
      return false;
    }

    setSaving(true);
    setError(null);
    try {
      const saved = await submitTripStep(trip.id, "deliveries", trip);
      applySaved(saved);
      showNotification?.(`✅ Deliveries locked. Proceed to End Trip.`, "success");
      return true;
    } catch (err) {
      const message = handleApiError(err);
      setError(message);
      showNotification?.(message, "error");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const updateTrip = (
    updates: Partial<Trip>,
    persist?: boolean,
    silent?: boolean
  ) => {
    setTrip((prev) => {
      const next = { ...prev, ...updates };
      if (updates.endStepSubmitted !== undefined) {
        setEndStepSubmitted(Boolean(updates.endStepSubmitted));
      }
      if (persist && prev.id) {
        void (async () => {
          setSaving(true);
          try {
            const saved = await saveTrip(prev.id, { ...prev, ...updates });
            applySaved(saved);
            if (!silent) showNotification?.("💾 Progress saved.", "info");
          } catch (err) {
            const message = handleApiError(err);
            setError(message);
            if (!silent) showNotification?.(message, "error");
          } finally {
            setSaving(false);
          }
        })();
      }
      return next;
    });
  };

  const updateDeliveries = async (
    rows: ShopDelivery[],
    persistToStorage: boolean = true
  ) => {
    const totalMortalityCount = rows.reduce(
      (sum, r) => sum + (r.mortality || 0),
      0
    );
    const kpis = calculateDeliveryKPIs(
      rows,
      trip.totalBirds,
      trip.dcWeight,
      trip.avgWeight,
      totalMortalityCount
    );

    const updatedTrip: Trip = {
      ...trip,
      deliveries: rows,
      totalDeliveredWeight: kpis.totalDelWeight,
      totalBirdsDelivered: kpis.totalDelBirds,
      totalShops: kpis.totalShops,
      lastShop: kpis.lastShop,
      totalMortalityWeight: kpis.mortalityWeight,
      weightLoss: kpis.weightLoss,
      survivalRate: kpis.survivalRate,
      totalMortalityCount,
      totalWeight: kpis.totalDelWeight,
      totalMortality: totalMortalityCount,
    };

    if (persistToStorage && trip.id) {
      setSaving(true);
      try {
        const saved = await saveTrip(trip.id, updatedTrip);
        applySaved(saved);
      } catch (err) {
        const message = handleApiError(err);
        setError(message);
        showNotification?.(message, "error");
        setTrip(updatedTrip);
      } finally {
        setSaving(false);
      }
    } else {
      setTrip(updatedTrip);
      syncEndStep(updatedTrip);
    }
  };

  const submitEndTrip = async (
    data: Partial<Trip> = {}
  ): Promise<boolean> => {
    if (!trip.id) {
      showNotification?.("Trip not created yet.", "error");
      return false;
    }
    if (!trip.deliveryStepSubmitted) {
      showNotification?.(
        `❌ You must complete and lock the Deliveries step first.`,
        "error"
      );
      return false;
    }

    const merged = { ...trip, ...data } as Trip;
    const endValidation = validateEndStep(merged);
    if (!endValidation.valid) {
      showNotification?.(endValidation.errors[0], "error");
      return false;
    }
    const finalValidation = validateFinalTrip(merged);
    if (!finalValidation.valid) {
      showNotification?.(finalValidation.errors[0], "error");
      return false;
    }

    const closingMeter = Number(
      (data as any).closingMeter ??
        (data as any).endMeter ??
        merged.closingMeter
    );
    const totalKm = closingMeter - merged.openingMeter;

    setSaving(true);
    setError(null);
    try {
      // Backend expenses step defaults to Completed; match existing StepEnd workflow.
      const saved = await submitTripStep(trip.id, "expenses", {
        ...merged,
        ...data,
        closingMeter,
        endMeter: closingMeter,
        totalKm,
        endTime: new Date().toLocaleString(),
        status: (data.status as TripStatus) || "Completed",
        endStepSubmitted: true,
        expensesStepSubmitted: true,
      });
      applySaved(saved);
      setEndStepSubmitted(true);
      showNotification?.(
        `✅ Trip ${saved.tripNo} completed!`,
        "success"
      );
      return true;
    } catch (err) {
      const message = handleApiError(err);
      setError(message);
      showNotification?.(message, "error");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const loadTrip = (tripToLoad: Trip) => {
    applySaved(tripToLoad);
    setIsEditing(true);
  };

  const resumeDraft = useCallback(async (): Promise<Trip | null> => {
    setLoading(true);
    setError(null);
    try {
      const draft = await loadLatestDraft();
      if (draft) {
        applySaved(draft);
        setIsEditing(true);
        return draft;
      }
      return null;
    } catch (err) {
      const message = handleApiError(err);
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const reloadCurrentTrip = useCallback(async (): Promise<Trip | null> => {
    if (!trip.id) return null;
    setLoading(true);
    setError(null);
    try {
      const fresh = await loadTripById(trip.id);
      applySaved(fresh);
      return fresh;
    } catch (err) {
      const message = handleApiError(err);
      setError(message);
      showNotification?.(message, "error");
      return null;
    } finally {
      setLoading(false);
    }
  }, [trip.id, showNotification]);

  const clearTrip = () => {
    setTrip(emptyTrip());
    setIsEditing(false);
    setEndStepSubmitted(false);
    setError(null);
  };

  const saveDraft = async (): Promise<boolean> => {
    if (!trip.id && !trip.startStepSubmitted) {
      showNotification?.("Nothing to save yet.", "info");
      return false;
    }
    const saved = await persistTrip({ ...trip, status: "Draft" }, { silent: false });
    return Boolean(saved);
  };

  return {
    trip,
    setTrip,
    isEditing,
    setIsEditing,
    endStepSubmitted,
    saving,
    loading,
    error,
    setError,
    updateTrip,
    updateDeliveries,
    updateBoxDetails,
    submitStartStep,
    submitFarmStep,
    submitPickupStep,
    submitDeliveriesStep,
    submitEndTrip,
    persistTrip,
    saveDraft,
    loadTrip,
    resumeDraft,
    reloadCurrentTrip,
    clearTrip,
  };
}
