import { useState, useRef, useCallback, type Dispatch, type SetStateAction } from "react";
import type { Trip, ShopDelivery, BoxDetail } from "../types/trip";
import {
  handleApiError,
  loadTripById,
  saveNewStart,
  saveTripStepProgress,
  submitStep1,
  submitTripStep,
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

type StepKey = "start" | "farm" | "pickup" | "deliveries" | "expenses";

/** Fields sent per step. Everything else stays out of the payload so the
 *  backend never clobbers unrelated columns (e.g. farm defaults of 0). */
const STEP_FIELDS: Record<StepKey, string[]> = {
  start: [
    "tripDate", "tripNo", "status", "startTime", "vehicleId", "vehicleNo",
    "driverId", "driverName", "supervisorId", "supervisorName",
    "openingMeter", "advanceAmount", "helpers", "loaders", "remarks",
    "updatedAt",
  ],
  farm: [
    "tripDate", "sourceFarmId", "sourceFarm", "farmAddress", "reachedTime",
    "destMeter", "pickupTolls", "farmBirdTypeId", "farmBirdType",
    "farmBirdCount", "farmLoadWeight", "farmRate", "farmAmount",
    "avgBirdWeight", "remarks", "updatedAt",
  ],
  pickup: [
    "tripDate", "dcWeight", "totalBirds", "boxes", "boxDetails", "avgWeight",
    "pickupLoadTime", "dcPhotoKey", "dcPhotoMime", "dcPhotoData", "updatedAt",
  ],
  deliveries: [
    "tripDate", "deliveries", "totalShops", "totalWeight", "totalDeliveredWeight",
    "totalBirdsDelivered", "totalMortality", "totalMortalityCount",
    "totalMortalityWeight", "weightLoss", "survivalRate", "lastShop", "updatedAt",
  ],
  expenses: [
    "tripDate", "closingMeter", "endMeter", "endTime", "totalKm",
    "deliveryTolls", "destinationTolls", "meals", "mealsTiffin",
    "driverBata", "helperBata", "loading", "vehicleMaintenance",
    "othersRC", "others1Amt", "others2Amt", "others3Amt", "others4Amt",
    "others5Amt", "fuel", "expense", "remarks", "updatedAt",
  ],
};

function pickStepFields(trip: Partial<Trip>, fields: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const source = trip as Record<string, unknown>;
  for (const key of Object.keys(source)) {
    // Preserve expected fields AND any dynamically generated diesel fields for Step 5
    if (fields.includes(key) || key.startsWith("diesel")) {
      const value = source[key];
      if (value !== undefined) out[key] = value;
    }
  }
  return out;
}

export function useTripEntry(
  showNotification?: NotificationFn,
  onTripsChanged?: () => void
) {
  const notifyRef = useRef(showNotification);
  notifyRef.current = showNotification;
  const onTripsChangedRef = useRef(onTripsChanged);
  onTripsChangedRef.current = onTripsChanged;
  const inFlightRef = useRef(false);

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
    loaders: [],
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

  const [trip, setTrip] = useState<Trip>(emptyTrip);
  const [savedTrip, setSavedTrip] = useState<Trip>(emptyTrip);
  const tripRef = useRef(trip);
  tripRef.current = trip;

  const [isEditing, setIsEditing] = useState(false);
  const [endStepSubmitted, setEndStepSubmitted] = useState<boolean>(false);
  const [headerLoading, setHeaderLoading] = useState(false);

  const onTripIdAssignedRef = useRef<((id: number) => void) | null>(null);
  const onStep1SuccessRef = useRef<((trip: Trip) => void) | null>(null);

  const syncEndStep = (tripData: Trip) => {
    setEndStepSubmitted(tripData.endStepSubmitted || false);
  };

  /** URL synchronization is only used after loading an existing permanent trip. */
  const registerTripIdCallback = useCallback((cb: (id: number) => void) => {
    onTripIdAssignedRef.current = cb;
  }, []);

  /** Parent registers post-submit UI reset (Recent Trips already refreshed via onTripsChanged). */
  const registerStep1SuccessCallback = useCallback((cb: (trip: Trip) => void) => {
    onStep1SuccessRef.current = cb;
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
    const survivalRate = birds > 0 ? Number(((1 - mortalityCount / birds) * 100).toFixed(1)) : 0;

    return { totalDelBirds, totalDelWeight, totalShops, lastShop, mortalityWeight, weightLoss, survivalRate };
  };

  /** Step 1 edits update React state only — no localStorage, no backend. */
  const applyStartFieldChange = useCallback(
    (updater: Trip | ((prev: Trip) => Trip)) => {
      setTrip((previous) => {
        const next =
          typeof updater === "function" ? updater(previous) : { ...previous, ...updater };
        tripRef.current = next;
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

  const loadTripFromApi = useCallback(async (id: number): Promise<boolean> => {
    setHeaderLoading(true);
    try {
      const loaded = await loadTripById(id);
      setTrip(loaded);
      setSavedTrip(loaded);
      tripRef.current = loaded;
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
  }, []);

  const applySavedTrip = (saved: Trip) => {
    setTrip(saved);
    setSavedTrip(saved);
    tripRef.current = saved;
    syncEndStep(saved);
    setIsEditing(true);
    onTripsChangedRef.current?.();
  };

  const submitStartStep = async (data: Partial<Trip> = {}): Promise<true | string> => {
    if (inFlightRef.current) return "A save is already in progress. Please wait.";
    const merged = {
      ...tripRef.current,
      ...data,
    };
    const validation = validateStartStep(merged as Trip);
    if (!validation.valid) {
      return validation.errors[0] || "Please complete required Start fields.";
    }

    inFlightRef.current = true;
    setHeaderLoading(true);
    try {
      const isNewTrip = !merged.id || merged.id <= 0;
      const submitted = isNewTrip
        ? await submitStep1({
            ...merged,
            startTime: new Date().toLocaleString(),
          })
        : await submitTripStep(merged.id, "start", {
            ...pickStepFields(merged, STEP_FIELDS.start),
            startStepSubmitted: true,
          });

      applySavedTrip(submitted);
      onStep1SuccessRef.current?.(submitted);
      return true;
    } catch (error) {
      const msg = handleApiError(error);
      notifyRef.current?.(msg, "error");
      return msg;
    } finally {
      inFlightRef.current = false;
      setHeaderLoading(false);
    }
  };

  const submitFarmStep = async (data: Partial<Trip> = {}): Promise<true | string> => {
    if (inFlightRef.current) return "A save is already in progress. Please wait.";
    const current = tripRef.current;
    if (!current.id) {
      const msg = "Trip ID is missing. Submit Step 1 first.";
      notifyRef.current?.(msg, "error");
      return msg;
    }

    const reachedTime = current.farmStepSubmitted
      ? current.reachedTime
      : new Date().toLocaleString();
    const updatedData = { ...current, ...data, reachedTime };

    const validation = validateFarmStep(updatedData as Trip);
    if (!validation.valid) {
      const msg = validation.errors[0] || "Please complete required Farm fields.";
      notifyRef.current?.(msg, "error");
      return msg;
    }

    inFlightRef.current = true;
    setHeaderLoading(true);
    try {
      const submitted = await submitTripStep(current.id, "farm", {
        ...pickStepFields(updatedData, STEP_FIELDS.farm),
        farmStepSubmitted: true,
      });
      applySavedTrip(submitted);
      return true;
    } catch (error) {
      const msg = handleApiError(error);
      notifyRef.current?.(msg, "error");
      return msg;
    } finally {
      inFlightRef.current = false;
      setHeaderLoading(false);
    }
  };

  const saveStepProgress = async (
    step: "start" | "farm" | "pickup" | "deliveries" | "expenses",
    data: Partial<Trip> = {}
  ): Promise<true | string> => {
    if (inFlightRef.current) return "A save is already in progress. Please wait.";
    const current = { ...tripRef.current, ...data } as Trip;

    if (!current.id && step === "start") {
      inFlightRef.current = true;
      setHeaderLoading(true);
      try {
        const saved = await saveNewStart(current);
        applySavedTrip(saved);
        notifyRef.current?.("Start progress saved", "success");
        return true;
      } catch (error) {
        const msg = handleApiError(error);
        notifyRef.current?.(msg, "error");
        return msg;
      } finally {
        inFlightRef.current = false;
        setHeaderLoading(false);
      }
    }

    if (!current.id) {
      const msg = "Submit Start Details before saving later progress.";
      notifyRef.current?.(msg, "error");
      return msg;
    }

    const label = {
      start: "Start",
      farm: "Farm",
      pickup: "Pickup",
      deliveries: "Delivery",
      expenses: "End",
    }[step];

    inFlightRef.current = true;
    setHeaderLoading(true);
    try {
      const saved = await saveTripStepProgress(current.id, step, {
        ...pickStepFields(current, STEP_FIELDS[step]),
        tripDate: current.tripDate,
      });
      applySavedTrip(saved);
      notifyRef.current?.(`${label} progress saved`, "success");
      return true;
    } catch (error) {
      const msg = handleApiError(error);
      notifyRef.current?.(msg, "error");
      return msg;
    } finally {
      inFlightRef.current = false;
      setHeaderLoading(false);
    }
  };

  const saveStartProgress = (data: Partial<Trip> = {}) =>
    saveStepProgress("start", data);
  const saveFarmProgress = (data: Partial<Trip> = {}) =>
    saveStepProgress("farm", data);
  const savePickupProgress = (data: Partial<Trip> = {}) =>
    saveStepProgress("pickup", data);
    
  const saveDeliveriesProgress = (rows?: ShopDelivery[]) => {
    const dataToSave = rows || tripRef.current.deliveries;
    if (rows) {
      updateDeliveries(rows);
    }
    return saveStepProgress("deliveries", { deliveries: dataToSave });
  };
  
  const saveEndProgress = (data: Partial<Trip> = {}) =>
    saveStepProgress("expenses", data);

  const updateBoxDetails = (
    rows: BoxDetail[],
    _persistToStorage: boolean = false,
    _silent: boolean = false
  ) => {
    const current = tripRef.current;
    const totalBirds = rows.reduce((sum, r) => sum + (r.birds || 0), 0);
    const dcWeight = Number(rows.reduce((sum, r) => sum + (r.weight || 0), 0).toFixed(2));
    const boxes = rows.length;
    const avgWeight = calculateAvgWeight(dcWeight, totalBirds);

    const updatedTrip: Trip = {
      ...current,
      boxDetails: rows,
      totalBirds,
      dcWeight,
      boxes,
      avgWeight,
    };

    setTrip(updatedTrip);
    tripRef.current = updatedTrip;
    syncEndStep(updatedTrip);
  };

  const submitPickupStep = async (data: Partial<Trip> = {}): Promise<true | string> => {
    if (inFlightRef.current) return "A save is already in progress. Please wait.";
    const current = tripRef.current;
    if (!current.id) {
      const msg = "Trip ID is missing. Submit Step 1 first.";
      notifyRef.current?.(msg, "error");
      return msg;
    }

    const updatedData = { ...current, ...data };

    if (!updatedData.boxDetails || updatedData.boxDetails.length === 0) {
      const msg = `Please add at least one box before submitting Pickup.`;
      notifyRef.current?.(msg, "error");
      return msg;
    }

    const validation = validatePickupStep(updatedData as Trip);
    if (!validation.valid) {
      const msg = validation.errors[0] || "Please complete required Pickup fields.";
      notifyRef.current?.(msg, "error");
      return msg;
    }

    const avg = calculateAvgWeight(updatedData.dcWeight || 0, updatedData.totalBirds || 0);
    const pickupLoadTime = current.pickupStepSubmitted
      ? current.pickupLoadTime
      : new Date().toLocaleString();

    inFlightRef.current = true;
    setHeaderLoading(true);
    try {
      const submitted = await submitTripStep(current.id, "pickup", {
        ...pickStepFields(updatedData, STEP_FIELDS.pickup),
        avgWeight: avg,
        pickupLoadTime: pickupLoadTime,
        pickupStepSubmitted: true,
      });
      applySavedTrip(submitted);
      return true;
    } catch (error) {
      const msg = handleApiError(error);
      notifyRef.current?.(msg, "error");
      return msg;
    } finally {
      inFlightRef.current = false;
      setHeaderLoading(false);
    }
  };

  const submitDeliveriesStep = async (): Promise<true | string> => {
    if (inFlightRef.current) return "A save is already in progress. Please wait.";
    const current = tripRef.current;
    if (!current.id) {
      const msg = "Trip ID is missing. Submit Step 1 first.";
      notifyRef.current?.(msg, "error");
      return msg;
    }
    if (!current.deliveries || current.deliveries.length === 0) {
      const msg = `Please add at least one shop delivery before proceeding.`;
      notifyRef.current?.(msg, "error");
      return msg;
    }

    inFlightRef.current = true;
    setHeaderLoading(true);
    try {
      const submitted = await submitTripStep(current.id, "deliveries", {
        ...pickStepFields(current, STEP_FIELDS.deliveries),
        deliveryStepSubmitted: true,
      });
      applySavedTrip(submitted);
      return true;
    } catch (error) {
      const msg = handleApiError(error);
      notifyRef.current?.(msg, "error");
      return msg;
    } finally {
      inFlightRef.current = false;
      setHeaderLoading(false);
    }
  };

  const updateTrip = (updates: Partial<Trip>) => {
    setTrip((prev) => {
      const next = { ...prev, ...updates };
      tripRef.current = next;
      return next;
    });
    if (updates.endStepSubmitted !== undefined) {
      setEndStepSubmitted(updates.endStepSubmitted);
    }
  };

  const updateDeliveries = (rows: ShopDelivery[], _persistToStorage: boolean = false) => {
    const current = tripRef.current;
    const totalMortalityCount = rows.reduce((sum, r) => sum + (r.mortality || 0), 0);
    const kpis = calculateDeliveryKPIs(
      rows,
      current.totalBirds,
      current.dcWeight,
      current.avgWeight,
      totalMortalityCount
    );

    const updatedTrip: Trip = {
      ...current,
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
      totalMortality: totalMortalityCount,
    };

    setTrip(updatedTrip);
    tripRef.current = updatedTrip;
    syncEndStep(updatedTrip);
  };

  const submitEndTrip = async (data: Partial<Trip> = {}): Promise<true | string> => {
    if (inFlightRef.current) return "A save is already in progress. Please wait.";
    const current = { ...tripRef.current, ...data };
    if (!current.id) {
      const msg = "Trip ID is missing. Submit Step 1 first.";
      notifyRef.current?.(msg, "error");
      return msg;
    }
    if (!current.deliveryStepSubmitted) {
      const msg = `You must complete and lock the Deliveries step first.`;
      notifyRef.current?.(msg, "error");
      return msg;
    }

    const endValidation = validateEndStep(current);
    if (!endValidation.valid) {
      const msg = endValidation.errors[0] || "Please complete required End fields.";
      notifyRef.current?.(msg, "error");
      return msg;
    }

    const finalValidation = validateFinalTrip(current);
    if (!finalValidation.valid) {
      const msg = finalValidation.errors[0] || "Please complete required End fields.";
      notifyRef.current?.(msg, "error");
      return msg;
    }

    const closingMeter = Number(
      current.closingMeter || (current as Trip & { endMeter?: number }).endMeter || 0
    );
    const totalKm = closingMeter - (current.openingMeter || 0);

    inFlightRef.current = true;
    setHeaderLoading(true);
    try {
      const submitted = await submitTripStep(current.id, "expenses", {
        ...pickStepFields(current, STEP_FIELDS.expenses),
        closingMeter,
        totalKm,
        endTime: current.endTime || new Date().toLocaleString(),
        endStepSubmitted: true,
        expensesStepSubmitted: true,
      });
      applySavedTrip(submitted);
      return true;
    } catch (error) {
      const msg = handleApiError(error);
      notifyRef.current?.(msg, "error");
      return msg;
    } finally {
      inFlightRef.current = false;
      setHeaderLoading(false);
    }
  };

  const loadTrip = (tripToLoad: Trip) => {
    const normalized = {
      ...tripToLoad,
      helpers: tripToLoad.helpers || [],
      deliveries: tripToLoad.deliveries || [],
      boxDetails: tripToLoad.boxDetails || [],
    };
    setTrip(normalized);
    setSavedTrip(normalized);
    tripRef.current = normalized;
    setIsEditing(true);
    setEndStepSubmitted(tripToLoad.endStepSubmitted === true);
  };

  const clearTrip = () => {
    const fresh = emptyTrip();
    setTrip(fresh);
    setSavedTrip(fresh);
    tripRef.current = fresh;
    setIsEditing(false);
    setEndStepSubmitted(false);
  };

  return {
    trip,
    savedTrip,
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
    saveStartProgress,
    submitFarmStep,
    saveFarmProgress,
    submitPickupStep,
    savePickupProgress,
    submitDeliveriesStep,
    saveDeliveriesProgress,
    submitEndTrip,
    saveEndProgress,
    loadTrip,
    loadTripFromApi,
    clearTrip,
    setStartTrip,
    updateStartTrip,
    registerTripIdCallback,
    registerStep1SuccessCallback,
  };
}