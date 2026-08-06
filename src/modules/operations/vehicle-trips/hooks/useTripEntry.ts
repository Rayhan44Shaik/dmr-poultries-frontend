import { useState, useRef, useCallback, type Dispatch, type SetStateAction } from "react";
import type { Trip, ShopDelivery, BoxDetail, TripStatus } from "../types/trip";
import { tripService } from "../services/tripService";
import { handleApiError, loadTripById, submitStep1 } from "../services/tripHeaderApiService";
import {
  calculateAvgWeight,
  validateStartStep,
  validateFarmStep,
  validatePickupStep,
  validateEndStep,
  validateFinalTrip,
} from "../services/tripFormService";

type NotificationFn = (msg: string, type?: "success" | "error" | "info") => void;
const STEP1_DRAFT_KEY = "trip-step1-draft";

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

  const readLocalDraft = (): Trip => {
    try {
      const stored = localStorage.getItem(STEP1_DRAFT_KEY);
      if (!stored) return emptyTrip();
      const parsed = JSON.parse(stored) as Partial<Trip>;
      return {
        ...emptyTrip(),
        ...parsed,
        id: 0,
        tripNo: "",
        startTime: "",
        startStepSubmitted: false,
        helpers: parsed.helpers ?? [],
        loaders: parsed.loaders ?? [],
      };
    } catch {
      return emptyTrip();
    }
  };

  const writeLocalDraft = (next: Trip) => {
    localStorage.setItem(
      STEP1_DRAFT_KEY,
      JSON.stringify({
        ...next,
        id: 0,
        tripNo: "",
        startTime: "",
        startStepSubmitted: false,
      })
    );
  };

  const [trip, setTrip] = useState<Trip>(readLocalDraft);
  const [isEditing, setIsEditing] = useState(false);
  const [endStepSubmitted, setEndStepSubmitted] = useState<boolean>(false);
  const [headerLoading, setHeaderLoading] = useState(false);

  const onTripIdAssignedRef = useRef<((id: number) => void) | null>(null);

  const syncEndStep = (tripData: Trip) => {
    setEndStepSubmitted(tripData.endStepSubmitted || false);
  };

  /** URL synchronization is only used after a successful permanent submission. */
  const registerTripIdCallback = useCallback((cb: (id: number) => void) => {
    onTripIdAssignedRef.current = cb;
  }, []);

  const subscribeHeaderSaveStatus = useCallback(() => () => {}, []);
  const getHeaderSaveStatus = useCallback(
    (): "idle" | "saving" | "saved" => "idle",
    []
  );

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

  /** Step 1 edits persist only to browser localStorage until final submission. */
  const applyStartFieldChange = useCallback(
    (updater: Trip | ((prev: Trip) => Trip)) => {
      setTrip((previous) => {
        const next =
          typeof updater === "function" ? updater(previous) : { ...previous, ...updater };
        writeLocalDraft(next);
        return next;
      });
    },
    []
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
        const loaded = await loadTripById(id);
        setTrip(loaded);
        syncEndStep(loaded);
        setIsEditing(true);
        onTripIdAssignedRef.current?.(loaded.id);
        return true;
      } catch (error) {
        notifyRef.current?.(handleApiError(error), "error");
        return false;
      } finally {
        setHeaderLoading(false);
      }
    },
    []
  );

  const restoreLocalDraft = useCallback((): boolean => {
    const restored = readLocalDraft();
    const hasDraft = Boolean(
      restored.vehicleId ||
        restored.driverId ||
        restored.supervisorId ||
        restored.helpers.length ||
        (restored.loaders?.length ?? 0) ||
        restored.openingMeter ||
        restored.advanceAmount ||
        restored.remarks
    );
    if (hasDraft) {
      setTrip(restored);
      setIsEditing(true);
    }
    return hasDraft;
  }, []);

  const submitStartStep = async (data: Partial<Trip> = {}): Promise<boolean> => {
    const merged = {
      ...trip,
      ...data,
    };
    const validation = validateStartStep(merged as Trip);
    if (!validation.valid) {
      notifyRef.current?.(validation.errors[0], "error");
      return false;
    }

    setHeaderLoading(true);
    try {
      const submitted = await submitStep1({
        ...merged,
        startTime: new Date().toLocaleString(),
      });
      localStorage.removeItem(STEP1_DRAFT_KEY);
      setTrip(submitted);
      tripService.upsert(submitted);
      onTripsChangedRef.current?.();
      onTripIdAssignedRef.current?.(submitted.id);
      notifyRef.current?.(
        `✅ Step 1 completed successfully. Moving to Step 2...`,
        "success"
      );
      return true;
    } catch (error) {
      notifyRef.current?.(handleApiError(error), "error");
      return false;
    } finally {
      setHeaderLoading(false);
    }
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
    setIsEditing(true);
    setEndStepSubmitted(tripToLoad.endStepSubmitted === true);
  };

  const clearTrip = () => {
    const fresh = emptyTrip();
    localStorage.removeItem(STEP1_DRAFT_KEY);
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
    restoreLocalDraft,
    clearTrip,
    setStartTrip,
    updateStartTrip,
    registerTripIdCallback,
  };
}
