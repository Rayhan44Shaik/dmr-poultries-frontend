import { useState, useRef, useCallback, useEffect, type Dispatch, type SetStateAction } from "react";
import type { Trip, ShopDelivery, BoxDetail, TripStatus } from "../types/trip";
import { tripService } from "../services/tripService";
import {
  createStep1HeaderSaveService,
  type Step1HeaderSaveService,
  type SaveSyncMetadata,
} from "../services/tripHeaderSaveService";
import {
  calculateAvgWeight,
  validateStartStep,
  validateFarmStep,
  validatePickupStep,
  validateEndStep,
  validateFinalTrip,
} from "../services/tripFormService";

type NotificationFn = (msg: string, type?: "success" | "error" | "info") => void;

/**
 * Patch identity metadata only. `updatedAt` lives in the save service snapshot;
 * putting it into React state on every autosave would rerender the entire page.
 */
function patchTripMetadata(prev: Trip, sync: SaveSyncMetadata): Trip {
  if (
    prev.id === sync.id &&
    prev.tripNo === sync.tripNo &&
    prev.createdAt === sync.createdAt
  ) {
    return prev;
  }

  return {
    ...prev,
    id: sync.id || prev.id,
    tripNo: sync.tripNo || prev.tripNo,
    createdAt: sync.createdAt || prev.createdAt,
  };
}

export function useTripEntry(
  showNotification?: NotificationFn,
  onTripsChanged?: () => void
) {
  const notifyRef = useRef(showNotification);
  notifyRef.current = showNotification;
  const onTripsChangedRef = useRef(onTripsChanged);
  onTripsChangedRef.current = onTripsChanged;

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

  const onTripIdAssignedRef = useRef<((id: number) => void) | null>(null);
  const saveServiceRef = useRef<Step1HeaderSaveService | null>(null);

  const syncEndStep = (tripData: Trip) => {
    setEndStepSubmitted(tripData.endStepSubmitted || false);
  };

  if (!saveServiceRef.current) {
    saveServiceRef.current = createStep1HeaderSaveService(emptyTrip(), {
      onNotify: (message, type) => notifyRef.current?.(message, type),
      onTripIdAssigned: (id) => onTripIdAssignedRef.current?.(id),
      onMetadataSaved: (metadata) => {
        setTrip((prev) => {
          const patched = patchTripMetadata(prev, metadata);
          if (patched === prev) return prev;
          if (!prev.startStepSubmitted) {
            return { ...patched, startTime: "" };
          }
          return patched;
        });
      },
      onTripLoaded: (loaded) => {
        setTrip(loaded);
        syncEndStep(loaded);
        saveServiceRef.current?.setPersistSnapshotFromTrip(loaded);
        if (loaded.id > 0) {
          tripService.upsert(loaded);
          onTripsChangedRef.current?.();
        }
      },
    });
  }

  const saveService = saveServiceRef.current;

  useEffect(() => {
    saveService.updateLocalTrip((prev) =>
      prev.tripDate === trip.tripDate ? prev : { ...prev, tripDate: trip.tripDate }
    );
  }, [trip.tripDate, saveService]);

  useEffect(() => {
    return () => {
      saveService.dispose();
    };
  }, [saveService]);

  /** Parent can register a callback to sync trip id into the URL for refresh resume. */
  const registerTripIdCallback = useCallback((cb: (id: number) => void) => {
    onTripIdAssignedRef.current = cb;
  }, []);

  const subscribeHeaderSaveStatus = useCallback(
    (listener: () => void) => saveService.subscribeStatus(listener),
    [saveService]
  );

  const getHeaderSaveStatus = useCallback(() => saveService.getStatus(), [saveService]);

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

  const ensureDraft = useCallback(async (): Promise<number | null> => {
    const id = await saveService.ensureDraft();
    if (id) setIsEditing(true);
    return id;
  }, [saveService]);

  const flushAutosave = useCallback(async () => {
    await saveService.flushAutosave();
  }, [saveService]);

  /** Step 1 field updates — local save service state + debounced autosave queue. */
  const applyStartFieldChange = useCallback(
    (updater: Trip | ((prev: Trip) => Trip)) => {
      saveService.updateLocalTrip((prev) =>
        typeof updater === "function" ? updater(prev) : { ...prev, ...updater }
      );
      saveService.scheduleAutosave();
    },
    [saveService]
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

  const loadTripFromApi = useCallback(
    async (id: number): Promise<boolean> => {
      setHeaderLoading(true);
      try {
        const loaded = await saveService.loadById(id);
        if (!loaded) return false;
        setIsEditing(true);
        onTripIdAssignedRef.current?.(loaded.id);
        return true;
      } finally {
        setHeaderLoading(false);
      }
    },
    [saveService]
  );

  const resumeLatestDraft = useCallback(async (): Promise<boolean> => {
    setHeaderLoading(true);
    try {
      const draft = await saveService.resumeLatestDraft();
      if (!draft?.id) return false;
      setIsEditing(true);
      onTripIdAssignedRef.current?.(draft.id);
      return true;
    } finally {
      setHeaderLoading(false);
    }
  }, [saveService]);

  const submitStartStep = async (data: Partial<Trip> = {}): Promise<boolean> => {
    const merged = {
      ...saveService.getLocalTrip(),
      ...data,
    };
    const validation = validateStartStep(merged as Trip);
    if (!validation.valid) {
      notifyRef.current?.(validation.errors[0], "error");
      return false;
    }

    const result = await saveService.submitStep({
      ...data,
      startTime: new Date().toLocaleString(),
    });

    if (result.ok) {
      notifyRef.current?.(
        isEditing
          ? `✅ Step 1 updated successfully.`
          : `✅ Step 1 completed successfully. Moving to Step 2...`,
        "success"
      );
      return true;
    }

    return false;
  };

  const submitFarmStep = (data: Partial<Trip>): boolean => {
    const reachedTime = trip.farmStepSubmitted ? trip.reachedTime : new Date().toLocaleString();
    const updatedData = { ...trip, ...data, reachedTime };

    const validation = validateFarmStep(updatedData as Trip);
    if (!validation.valid) {
      notifyRef.current?.(validation.errors[0], "error");
      return false;
    }
    const savedTrip = tripService.update({ ...updatedData, farmStepSubmitted: true });
    setTrip(savedTrip);
    syncEndStep(savedTrip);
    notifyRef.current?.(isEditing ? `✅ Step 2 updated successfully.` : `✅ Step 2 completed successfully. Moving to Step 3...`, "success");
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
        notifyRef.current?.(`💾 Pickup progress saved.`, "info");
      }
    } else {
      setTrip(updatedTrip);
      syncEndStep(updatedTrip);
    }
  };

  const submitPickupStep = (data: Partial<Trip> = {}): boolean => {
    const updatedData = { ...trip, ...data };

    if (!updatedData.boxDetails || updatedData.boxDetails.length === 0) {
      notifyRef.current?.(`❌ Please add at least one box before submitting Pickup.`, "error");
      return false;
    }

    const validation = validatePickupStep(updatedData as Trip);
    if (!validation.valid) {
      notifyRef.current?.(validation.errors[0], "error");
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

    notifyRef.current?.(isEditing ? `✅ Step 3 updated successfully.` : `✅ Step 3 completed successfully. Moving to Step 4...`, "success");
    return true;
  };

  const submitDeliveriesStep = (): boolean => {
    if (trip.deliveries.length === 0) {
      notifyRef.current?.(`❌ Please add at least one shop delivery before proceeding.`, "error");
      return false;
    }
    const savedTrip = tripService.update({
      ...trip,
      deliveryStepSubmitted: true
    });
    setTrip(savedTrip);
    syncEndStep(savedTrip);
    notifyRef.current?.(`✅ Deliveries locked. Proceed to End Trip.`, "success");
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
      notifyRef.current?.(`❌ You must complete and lock the Deliveries step first.`, "error");
      return false;
    }

    const endValidation = validateEndStep(trip);
    if (!endValidation.valid) {
      notifyRef.current?.(endValidation.errors[0], "error");
      return false;
    }

    const finalValidation = validateFinalTrip(trip);
    if (!finalValidation.valid) {
      notifyRef.current?.(finalValidation.errors[0], "error");
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
    notifyRef.current?.(`✅ Trip ${savedTrip.tripNo} completed! Awaiting approval.`, "success");
    return true;
  };

  const loadTrip = (tripToLoad: Trip) => {
    const normalized = {
      ...tripToLoad,
      helpers: tripToLoad.helpers || [],
      deliveries: tripToLoad.deliveries || [],
      boxDetails: tripToLoad.boxDetails || []
    };
    setTrip(normalized);
    saveService.setLocalTrip(normalized);
    saveService.clearPersistSnapshot();
    setIsEditing(true);
    setEndStepSubmitted(tripToLoad.endStepSubmitted === true);
  };

  const clearTrip = () => {
    saveService.reset();
    const fresh = emptyTrip();
    saveService.setLocalTrip(fresh);
    setTrip(fresh);
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
    subscribeHeaderSaveStatus,
    getHeaderSaveStatus,
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
