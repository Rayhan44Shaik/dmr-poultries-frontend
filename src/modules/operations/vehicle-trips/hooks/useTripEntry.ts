import { useState, useRef, useCallback, type Dispatch, type SetStateAction } from "react";
import type { Trip, ShopDelivery, BoxDetail, TripStatus } from "../types/trip";
import { tripService } from "../services/tripService";
import {
  createDraft,
  loadTripById,
  saveStep1Header,
  submitStep1,
  fetchLatestOpenStep1Draft,
  handleApiError,
  isConflictError,
  toStep1Payload,
  diffStep1Payload,
} from "../services/tripHeaderApiService";
import {
  calculateAvgWeight,
  validateStartStep,
  validateFarmStep,
  validatePickupStep,
  validateEndStep,
  validateFinalTrip,
} from "../services/tripFormService";

type NotificationFn = (msg: string, type?: "success" | "error" | "info") => void;

const AUTOSAVE_DELAY_MS = 800;
const MAX_AUTOSAVE_RETRIES = 2;

function mergeTripState(prev: Trip, saved: Trip): Trip {
  return {
    ...prev,
    ...saved,
    helpers: saved.helpers || [],
    deliveries: saved.deliveries || [],
    boxDetails: saved.boxDetails || [],
  };
}

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

  const tripRef = useRef(trip);
  tripRef.current = trip;

  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ensureDraftPromiseRef = useRef<Promise<number | null> | null>(null);
  const persistChainRef = useRef<Promise<Trip | null>>(Promise.resolve(null));
  const lastPersistedStep1Ref = useRef<Record<string, unknown> | null>(null);
  const savingCountRef = useRef(0);
  const onTripIdAssignedRef = useRef<((id: number) => void) | null>(null);

  const syncEndStep = (tripData: Trip) => {
    setEndStepSubmitted(tripData.endStepSubmitted || false);
  };

  const applyLoadedTrip = useCallback((loaded: Trip) => {
    setTrip({
      ...loaded,
      helpers: loaded.helpers || [],
      deliveries: loaded.deliveries || [],
      boxDetails: loaded.boxDetails || [],
    });
    syncEndStep(loaded);
    lastPersistedStep1Ref.current = toStep1Payload(loaded);
  }, []);

  const beginSaving = useCallback(() => {
    savingCountRef.current += 1;
    if (savingCountRef.current === 1) {
      setHeaderSaving(true);
    }
  }, []);

  const endSaving = useCallback(() => {
    savingCountRef.current = Math.max(0, savingCountRef.current - 1);
    if (savingCountRef.current === 0) {
      setHeaderSaving(false);
    }
  }, []);

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

  /** Idempotent draft — reuse latest open Step 1 draft for the trip date before POST. */
  const ensureDraft = useCallback(async (): Promise<number | null> => {
    if (tripRef.current.id > 0) {
      return tripRef.current.id;
    }

    if (ensureDraftPromiseRef.current) {
      return ensureDraftPromiseRef.current;
    }

    ensureDraftPromiseRef.current = (async () => {
      beginSaving();
      try {
        const existing = await fetchLatestOpenStep1Draft(tripRef.current.tripDate);
        if (existing?.id) {
          applyLoadedTrip(existing);
          setIsEditing(true);
          onTripIdAssignedRef.current?.(existing.id);
          return existing.id;
        }

        const saved = await createDraft(tripRef.current.tripDate);
        applyLoadedTrip(saved);
        onTripIdAssignedRef.current?.(saved.id);
        return saved.id;
      } catch (err) {
        notify?.(handleApiError(err), "error");
        return null;
      } finally {
        endSaving();
        ensureDraftPromiseRef.current = null;
      }
    })();

    return ensureDraftPromiseRef.current;
  }, [applyLoadedTrip, beginSaving, endSaving, notify]);

  const persistHeaderWithRetry = useCallback(
    async (changedFields: Record<string, unknown>): Promise<Trip | null> => {
      const id = tripRef.current.id;
      if (!id || Object.keys(changedFields).length === 0) return null;

      beginSaving();
      try {
        for (let attempt = 0; attempt <= MAX_AUTOSAVE_RETRIES; attempt++) {
          try {
            const saved = await saveStep1Header(id, tripRef.current, changedFields);
            setTrip((prev) => mergeTripState(prev, saved));
            syncEndStep(saved);
            lastPersistedStep1Ref.current = toStep1Payload(saved);
            return saved;
          } catch (err) {
            if (isConflictError(err)) {
              try {
                const fresh = await loadTripById(id);
                applyLoadedTrip(fresh);
                notify?.("Conflict while saving. Loaded the latest server copy.", "error");
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
              await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
              continue;
            }

            notify?.(message, "error");
            return null;
          }
        }
        return null;
      } finally {
        endSaving();
      }
    },
    [applyLoadedTrip, beginSaving, endSaving, notify]
  );

  const queuePersist = useCallback(
    (changedFields: Record<string, unknown> | null): Promise<Trip | null> => {
      if (!changedFields) {
        return persistChainRef.current;
      }

      const run = (): Promise<Trip | null> => {
        const latestDiff = diffStep1Payload(tripRef.current, lastPersistedStep1Ref.current);
        if (!latestDiff) return Promise.resolve(null);
        return persistHeaderWithRetry(latestDiff);
      };

      persistChainRef.current = persistChainRef.current.then(run, run);
      return persistChainRef.current;
    },
    [persistHeaderWithRetry]
  );

  const flushAutosave = useCallback(async () => {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }

    if (tripRef.current.id <= 0) {
      const id = await ensureDraft();
      if (!id) return;
    }

    const diff = diffStep1Payload(tripRef.current, lastPersistedStep1Ref.current);
    if (diff) {
      await queuePersist(diff);
    } else {
      await persistChainRef.current;
    }
  }, [ensureDraft, queuePersist]);

  const scheduleAutosave = useCallback(
    (_nextTrip: Trip) => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }

      autosaveTimerRef.current = setTimeout(() => {
        void (async () => {
          const id = tripRef.current.id > 0 ? tripRef.current.id : await ensureDraft();
          if (!id) return;

          const diff = diffStep1Payload(tripRef.current, lastPersistedStep1Ref.current);
          if (!diff) return;

          await queuePersist(diff);
        })();
      }, AUTOSAVE_DELAY_MS);
    },
    [ensureDraft, queuePersist]
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
        applyLoadedTrip(loaded);
        setIsEditing(true);
        onTripIdAssignedRef.current?.(loaded.id);
        return true;
      } catch (err) {
        notify?.(handleApiError(err), "error");
        return false;
      } finally {
        setHeaderLoading(false);
      }
    },
    [applyLoadedTrip, notify]
  );

  /** GET /api/trips?status=Draft — resume latest open Step 1 draft when no tripId exists. */
  const resumeLatestDraft = useCallback(async (): Promise<boolean> => {
    setHeaderLoading(true);
    try {
      const draft = await fetchLatestOpenStep1Draft();
      if (!draft?.id) return false;

      applyLoadedTrip(draft);
      setIsEditing(true);
      onTripIdAssignedRef.current?.(draft.id);
      return true;
    } catch (err) {
      notify?.(handleApiError(err), "error");
      return false;
    } finally {
      setHeaderLoading(false);
    }
  }, [applyLoadedTrip, notify]);

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

    beginSaving();
    try {
      let tripId = tripRef.current.id;
      if (!tripId) {
        tripId = (await ensureDraft()) ?? 0;
      }
      if (!tripId) return false;

      await flushAutosave();

      const saved = await submitStep1(tripId, merged);
      setTrip((prev) => mergeTripState(prev, { ...saved, startStepSubmitted: true }));
      syncEndStep(saved);
      lastPersistedStep1Ref.current = toStep1Payload({ ...saved, startStepSubmitted: true });
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
          applyLoadedTrip(fresh);
        } catch {
          /* ignore reload failure */
        }
      }
      notify?.(handleApiError(err), "error");
      return false;
    } finally {
      endSaving();
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
    lastPersistedStep1Ref.current = null;
    setEndStepSubmitted(tripToLoad.endStepSubmitted === true);
  };

  const clearTrip = () => {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
    lastPersistedStep1Ref.current = null;
    persistChainRef.current = Promise.resolve(null);
    setTrip(emptyTrip());
    setIsEditing(false);
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
    resumeLatestDraft,
    clearTrip,
    ensureDraft,
    setStartTrip,
    updateStartTrip,
    flushAutosave,
    registerTripIdCallback,
  };
}
