import { useState, useRef, useCallback, type Dispatch, type SetStateAction } from "react";
import type { Trip, ShopDelivery, BoxDetail, TripStatus } from "../types/trip";
import { tripService } from "../services/tripService";
import {
  createDraft,
  loadTripById,
  saveStep1Header,
  submitStep1,
  handleApiError,
  isConflictError,
} from "../services/tripHeaderApiService";
import {
  calculateAvgWeight,
  validateStartStep,
  validateFarmStep,
  validatePickupStep,
  validateEndStep,
  validateFinalTrip,
  generateTripNo,
} from "../services/tripFormService";

type NotificationFn = (msg: string, type?: "success" | "error" | "info") => void;

const AUTOSAVE_DELAY_MS = 800;
const MAX_AUTOSAVE_RETRIES = 2;

export function useTripEntry(showNotification?: NotificationFn) {
  const notify = showNotification;

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
    weight: 0
  });

  const [trip, setTrip] = useState<Trip>(emptyTrip());
  const [isEditing, setIsEditing] = useState(false);
  const [endStepSubmitted, setEndStepSubmitted] = useState<boolean>(false);
  const [headerLoading, setHeaderLoading] = useState(false);
  const [headerSaving, setHeaderSaving] = useState(false);
  const [isApiBacked, setIsApiBacked] = useState(false);

  const tripRef = useRef(trip);
  tripRef.current = trip;

  const isApiBackedRef = useRef(isApiBacked);
  isApiBackedRef.current = isApiBacked;

  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ensureDraftPromiseRef = useRef<Promise<number | null> | null>(null);
  const onTripIdAssignedRef = useRef<((id: number) => void) | null>(null);

  const syncEndStep = (tripData: Trip) => {
    setEndStepSubmitted(tripData.endStepSubmitted || false);
  };

  /** Parent can register a callback to sync trip id into the URL for refresh resume. */
  const registerTripIdCallback = useCallback((cb: (id: number) => void) => {
    onTripIdAssignedRef.current = cb;
  }, []);

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
    const lastShop = deliveries.length > 0 ? deliveries[deliveries.length - 1].shopName : "";

    const mortalityWeight = Number((mortalityCount * avgWeight).toFixed(2));
    const weightLoss = Number((dcWeight - totalDelWeight - mortalityWeight).toFixed(2));
    const survivalRate = birds > 0 ? Number(((1 - (mortalityCount / birds)) * 100).toFixed(1)) : 0;

    return { totalDelBirds, totalDelWeight, totalShops, lastShop, mortalityWeight, weightLoss, survivalRate };
  };

  /** POST /api/trips — create Draft once; reuse the same trip id for all Step 1 saves. */
  const ensureDraft = useCallback(async (): Promise<number | null> => {
    if (tripRef.current.id > 0) {
      return tripRef.current.id;
    }

    if (ensureDraftPromiseRef.current) {
      return ensureDraftPromiseRef.current;
    }

    ensureDraftPromiseRef.current = (async () => {
      setHeaderSaving(true);
      try {
        const saved = await createDraft(tripRef.current.tripDate);
        setTrip((prev) => ({ ...prev, ...saved }));
        syncEndStep(saved);
        setIsApiBacked(true);
        onTripIdAssignedRef.current?.(saved.id);
        return saved.id;
      } catch (err) {
        notify?.(handleApiError(err), "error");
        return null;
      } finally {
        setHeaderSaving(false);
        ensureDraftPromiseRef.current = null;
      }
    })();

    return ensureDraftPromiseRef.current;
  }, [notify]);

  const persistHeaderWithRetry = useCallback(
    async (payload: Partial<Trip>, attempt = 0): Promise<Trip | null> => {
      const id = tripRef.current.id;
      if (!id) return null;

      try {
        setHeaderSaving(true);
        const saved = await saveStep1Header(id, { ...tripRef.current, ...payload });
        setTrip((prev) => ({ ...prev, ...saved }));
        syncEndStep(saved);
        return saved;
      } catch (err) {
        if (isConflictError(err)) {
          try {
            const fresh = await loadTripById(id);
            setTrip((prev) => ({
              ...prev,
              ...fresh,
              helpers: fresh.helpers || [],
              deliveries: fresh.deliveries || [],
              boxDetails: fresh.boxDetails || [],
            }));
            syncEndStep(fresh);
            notify?.("Conflict while saving. Please refresh and try again.", "error");
          } catch {
            notify?.(handleApiError(err), "error");
          }
          return null;
        }

        const message = handleApiError(err);
        const isNetwork =
          err instanceof Error &&
          (message.includes("reach the server") || message.includes("timed out"));

        if (isNetwork && attempt < MAX_AUTOSAVE_RETRIES) {
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
          return persistHeaderWithRetry(payload, attempt + 1);
        }

        notify?.(message, "error");
        return null;
      } finally {
        setHeaderSaving(false);
      }
    },
    [notify]
  );

  const flushAutosave = useCallback(async () => {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
    if (tripRef.current.id <= 0) return;
    await persistHeaderWithRetry({});
  }, [persistHeaderWithRetry]);

  const scheduleAutosave = useCallback(
    (nextTrip: Trip) => {
      if (!isApiBackedRef.current) return;

      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
      autosaveTimerRef.current = setTimeout(() => {
        void (async () => {
          const id = nextTrip.id > 0 ? nextTrip.id : await ensureDraft();
          if (!id) return;
          await persistHeaderWithRetry(nextTrip);
        })();
      }, AUTOSAVE_DELAY_MS);
    },
    [ensureDraft, persistHeaderWithRetry]
  );

  /** Step 1 field updates — local state + debounced PostgreSQL autosave. */
  const applyStartFieldChange = useCallback(
    (updater: Trip | ((prev: Trip) => Trip)) => {
      setTrip((prev) => {
        const next = typeof updater === "function" ? updater(prev) : { ...prev, ...updater };
        scheduleAutosave(next);
        return next;
      });
    },
    [scheduleAutosave]
  );

  const setStartTrip: Dispatch<SetStateAction<Trip>> = useCallback(
    (action) => {
      applyStartFieldChange(action);
    },
    [applyStartFieldChange]
  );

  const updateStartTrip = useCallback(
    (updates: Partial<Trip>) => {
      applyStartFieldChange((prev) => ({ ...prev, ...updates }));
    },
    [applyStartFieldChange]
  );

  /** GET /api/trips/:id — resume Draft after browser refresh. */
  const loadTripFromApi = useCallback(
    async (id: number): Promise<boolean> => {
      setHeaderLoading(true);
      try {
        const loaded = await loadTripById(id);
        setTrip({
          ...loaded,
          helpers: loaded.helpers || [],
          deliveries: loaded.deliveries || [],
          boxDetails: loaded.boxDetails || [],
        });
        setIsEditing(true);
        syncEndStep(loaded);
        setIsApiBacked(true);
        onTripIdAssignedRef.current?.(loaded.id);
        return true;
      } catch (err) {
        notify?.(handleApiError(err), "error");
        return false;
      } finally {
        setHeaderLoading(false);
      }
    },
    [notify]
  );

  const submitStartStep = async (data: Partial<Trip> = {}): Promise<boolean> => {
    const merged = {
      ...tripRef.current,
      ...data,
      startTime: new Date().toLocaleString(),
    };
    const validation = validateStartStep(merged as Trip);
    if (!validation.valid) {
      notify?.(validation.errors[0], "error");
      return false;
    }

    if (!isApiBackedRef.current) {
      let savedTrip: Trip;
      if (isEditing) {
        savedTrip = tripService.update({ ...merged, startStepSubmitted: true } as Trip);
        notify?.(`✅ Step 1 updated successfully.`, "success");
      } else {
        const existingTrips = tripService.getAll();
        const tripNo = generateTripNo(existingTrips, merged.tripDate);
        savedTrip = tripService.create({
          ...(merged as Trip),
          id: Date.now(),
          tripNo,
          startStepSubmitted: true,
          status: "Draft",
          endStepSubmitted: false,
        });
        notify?.(`✅ Step 1 completed successfully. Moving to Step 2...`, "success");
      }
      setTrip(savedTrip);
      syncEndStep(savedTrip);
      return true;
    }

    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }

    setHeaderSaving(true);
    try {
      let tripId = tripRef.current.id;
      if (!tripId) {
        tripId = (await ensureDraft()) ?? 0;
      }
      if (!tripId) return false;

      const saved = await submitStep1(tripId, merged);
      setTrip((prev) => ({ ...prev, ...saved, startStepSubmitted: true }));
      syncEndStep(saved);
      onTripIdAssignedRef.current?.(saved.id);

      notify?.(
        isEditing
          ? `✅ Step 1 updated successfully.`
          : `✅ Step 1 completed successfully. Moving to Step 2...`,
        "success"
      );
      return true;
    } catch (err) {
      if (isConflictError(err) && tripRef.current.id) {
        try {
          const fresh = await loadTripById(tripRef.current.id);
          setTrip((prev) => ({ ...prev, ...fresh }));
          syncEndStep(fresh);
        } catch {
          /* ignore reload failure */
        }
      }
      notify?.(handleApiError(err), "error");
      return false;
    } finally {
      setHeaderSaving(false);
    }
  };

  const submitFarmStep = (data: Partial<Trip>): boolean => {
    const reachedTime = trip.farmStepSubmitted ? trip.reachedTime : new Date().toLocaleString();
    const updatedData = { ...trip, ...data, reachedTime };

    const validation = validateFarmStep(updatedData as Trip);
    if (!validation.valid) {
      notify?.(validation.errors[0], "error");
      return false;
    }
    const savedTrip = tripService.update({ ...updatedData, farmStepSubmitted: true });
    setTrip(savedTrip);
    syncEndStep(savedTrip);
    notify?.(isEditing ? `✅ Step 2 updated successfully.` : `✅ Step 2 completed successfully. Moving to Step 3...`, "success");
    return true;
  };

  const updateBoxDetails = (rows: BoxDetail[], persistToStorage: boolean = false, silent: boolean = false) => {
    const totalBirds = rows.reduce((sum, r) => sum + (r.birds || 0), 0);
    const dcWeight = Number(rows.reduce((sum, r) => sum + (r.weight || 0), 0).toFixed(2));
    const boxes = rows.length;
    const avgWeight = calculateAvgWeight(dcWeight, totalBirds);

    const updatedTrip: Trip = {
      ...trip,
      boxDetails: rows,
      totalBirds,
      dcWeight,
      boxes,
      avgWeight
    };

    if (persistToStorage) {
      const savedTrip = tripService.update(updatedTrip);
      setTrip(savedTrip);
      syncEndStep(savedTrip);
      if (!silent) {
        notify?.(`💾 Pickup progress saved.`, "info");
      }
    } else {
      setTrip(updatedTrip);
      syncEndStep(updatedTrip);
    }
  };

  const submitPickupStep = (data: Partial<Trip> = {}): boolean => {
    const updatedData = { ...trip, ...data };

    if (!updatedData.boxDetails || updatedData.boxDetails.length === 0) {
      notify?.(`❌ Please add at least one box before submitting Pickup.`, "error");
      return false;
    }

    const validation = validatePickupStep(updatedData as Trip);
    if (!validation.valid) {
      notify?.(validation.errors[0], "error");
      return false;
    }

    const avg = calculateAvgWeight(updatedData.dcWeight || 0, updatedData.totalBirds || 0);
    const pickupLoadTime = trip.pickupStepSubmitted ? trip.pickupLoadTime : new Date().toLocaleString();

    const savedTrip = tripService.update({
      ...updatedData,
      avgWeight: avg,
      pickupLoadTime,
      pickupStepSubmitted: true
    });
    setTrip(savedTrip);
    syncEndStep(savedTrip);

    notify?.(isEditing ? `✅ Step 3 updated successfully.` : `✅ Step 3 completed successfully. Moving to Step 4...`, "success");
    return true;
  };

  const submitDeliveriesStep = (): boolean => {
    if (trip.deliveries.length === 0) {
      notify?.(`❌ Please add at least one shop delivery before proceeding.`, "error");
      return false;
    }
    const savedTrip = tripService.update({
      ...trip,
      deliveryStepSubmitted: true
    });
    setTrip(savedTrip);
    syncEndStep(savedTrip);
    notify?.(`✅ Deliveries locked. Proceed to End Trip.`, "success");
    return true;
  };

  const updateTrip = (updates: Partial<Trip>) => {
    setTrip(prev => ({ ...prev, ...updates }));
    if (updates.endStepSubmitted !== undefined) {
      setEndStepSubmitted(updates.endStepSubmitted);
    }
  };

  const updateDeliveries = (rows: ShopDelivery[], persistToStorage: boolean = true) => {
    const totalMortalityCount = rows.reduce((sum, r) => sum + (r.mortality || 0), 0);
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
      totalMortalityCount: totalMortalityCount,
      totalWeight: kpis.totalDelWeight,
      totalMortality: totalMortalityCount
    };

    if (persistToStorage) {
      const savedTrip = tripService.update(updatedTrip);
      setTrip(savedTrip);
      syncEndStep(savedTrip);
    } else {
      setTrip(updatedTrip);
      syncEndStep(updatedTrip);
    }
  };

  const submitEndTrip = (): boolean => {
    if (!trip.deliveryStepSubmitted) {
      notify?.(`❌ You must complete and lock the Deliveries step first.`, "error");
      return false;
    }

    const endValidation = validateEndStep(trip);
    if (!endValidation.valid) {
      notify?.(endValidation.errors[0], "error");
      return false;
    }

    const finalValidation = validateFinalTrip(trip);
    if (!finalValidation.valid) {
      notify?.(finalValidation.errors[0], "error");
      return false;
    }

    const totalKm = trip.closingMeter - trip.openingMeter;
    const updatedTrip = {
      ...trip,
      totalKm,
      endTime: new Date().toLocaleString(),
      status: "Pending" as TripStatus,
      endStepSubmitted: true,
    };

    const savedTrip = tripService.update(updatedTrip);
    setTrip(savedTrip);
    setEndStepSubmitted(true);
    notify?.(`✅ Trip ${savedTrip.tripNo} completed! Awaiting approval.`, "success");
    return true;
  };

  const loadTrip = (tripToLoad: Trip) => {
    setTrip({
      ...tripToLoad,
      helpers: tripToLoad.helpers || [],
      deliveries: tripToLoad.deliveries || [],
      boxDetails: tripToLoad.boxDetails || []
    });
    setIsEditing(true);
    setIsApiBacked(false);
    setEndStepSubmitted(tripToLoad.endStepSubmitted === true);
  };

  const clearTrip = () => {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
    setTrip(emptyTrip());
    setIsEditing(false);
    setIsApiBacked(false);
    setEndStepSubmitted(false);
  };

  return {
    trip,
    setTrip,
    isEditing,
    setIsEditing,
    endStepSubmitted,
    headerLoading,
    headerSaving,
    updateTrip,
    updateDeliveries,
    updateBoxDetails,
    submitStartStep,
    submitFarmStep,
    submitPickupStep,
    submitDeliveriesStep,
    submitEndTrip,
    loadTrip,
    loadTripFromApi,
    clearTrip,
    ensureDraft,
    setStartTrip,
    updateStartTrip,
    flushAutosave,
    registerTripIdCallback,
  };
}
