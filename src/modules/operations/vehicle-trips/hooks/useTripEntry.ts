import { useState, useRef, useCallback, type Dispatch, type SetStateAction } from "react";
import type { Trip, ShopDelivery, BoxDetail, TripStatus } from "../types/trip";
import { tripService } from "../services/tripService";
import {
  handleApiError,
  loadTripById,
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

  const applySubmittedTrip = (submitted: Trip) => {
    setTrip(submitted);
    tripRef.current = submitted;
    syncEndStep(submitted);
    setIsEditing(true);
    tripService.upsert(submitted);
    onTripsChangedRef.current?.();
  };

  const submitStartStep = async (data: Partial<Trip> = {}): Promise<boolean> => {
    const merged = {
      ...tripRef.current,
      ...data,
    };
    const validation = validateStartStep(merged as Trip);
    if (!validation.valid) {
      return false;
    }

    setHeaderLoading(true);
    try {
      const submitted = await submitStep1({
        ...merged,
        startTime: new Date().toLocaleString(),
      });

      applySubmittedTrip(submitted);
      onStep1SuccessRef.current?.(submitted);
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

  const submitFarmStep = async (data: Partial<Trip> = {}): Promise<boolean> => {
    const current = tripRef.current;
    if (!current.id) {
      notifyRef.current?.("Trip ID is missing. Submit Step 1 first.", "error");
      return false;
    }

    const reachedTime = current.farmStepSubmitted
      ? current.reachedTime
      : new Date().toLocaleString();
    const updatedData = { ...current, ...data, reachedTime };

    const validation = validateFarmStep(updatedData as Trip);
    if (!validation.valid) {
      notifyRef.current?.(validation.errors[0], "error");
      return false;
    }

    setHeaderLoading(true);
    try {
      const submitted = await submitTripStep(current.id, "farm", {
        ...updatedData,
        farmStepSubmitted: true,
      });
      applySubmittedTrip(submitted);
      notifyRef.current?.(`✅ Step 2 completed successfully. Moving to Step 3...`, "success");
      return true;
    } catch (error) {
      notifyRef.current?.(handleApiError(error), "error");
      return false;
    } finally {
      setHeaderLoading(false);
    }
  };

  /** Pickup edits stay in React state until Submit — no localStorage, no backend. */
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

  const submitPickupStep = async (data: Partial<Trip> = {}): Promise<boolean> => {
    const current = tripRef.current;
    if (!current.id) {
      notifyRef.current?.("Trip ID is missing. Submit Step 1 first.", "error");
      return false;
    }

    const updatedData = { ...current, ...data };

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
    const pickupLoadTime = current.pickupStepSubmitted
      ? current.pickupLoadTime
      : new Date().toLocaleString();

    setHeaderLoading(true);
    try {
      const submitted = await submitTripStep(current.id, "pickup", {
        ...updatedData,
        avgWeight: avg,
        pickupLoadTime,
        pickupStepSubmitted: true,
      });
      applySubmittedTrip(submitted);
      notifyRef.current?.(`✅ Step 3 completed successfully. Moving to Step 4...`, "success");
      return true;
    } catch (error) {
      notifyRef.current?.(handleApiError(error), "error");
      return false;
    } finally {
      setHeaderLoading(false);
    }
  };

  const submitDeliveriesStep = async (): Promise<boolean> => {
    const current = tripRef.current;
    if (!current.id) {
      notifyRef.current?.("Trip ID is missing. Submit Step 1 first.", "error");
      return false;
    }
    if (!current.deliveries || current.deliveries.length === 0) {
      notifyRef.current?.(
        `❌ Please add at least one shop delivery before proceeding.`,
        "error"
      );
      return false;
    }

    setHeaderLoading(true);
    try {
      const submitted = await submitTripStep(current.id, "deliveries", {
        ...current,
        deliveryStepSubmitted: true,
      });
      applySubmittedTrip(submitted);
      notifyRef.current?.(`✅ Deliveries locked. Proceed to End Trip.`, "success");
      return true;
    } catch (error) {
      notifyRef.current?.(handleApiError(error), "error");
      return false;
    } finally {
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

    // Wizard edits stay in React state until Submit.
    setTrip(updatedTrip);
    tripRef.current = updatedTrip;
    syncEndStep(updatedTrip);
  };

  const submitEndTrip = async (data: Partial<Trip> = {}): Promise<boolean> => {
    const current = { ...tripRef.current, ...data };
    if (!current.id) {
      notifyRef.current?.("Trip ID is missing. Submit Step 1 first.", "error");
      return false;
    }
    if (!current.deliveryStepSubmitted) {
      notifyRef.current?.(
        `❌ You must complete and lock the Deliveries step first.`,
        "error"
      );
      return false;
    }

    const endValidation = validateEndStep(current);
    if (!endValidation.valid) {
      notifyRef.current?.(endValidation.errors[0], "error");
      return false;
    }

    const finalValidation = validateFinalTrip(current);
    if (!finalValidation.valid) {
      notifyRef.current?.(finalValidation.errors[0], "error");
      return false;
    }

    const closingMeter = Number(
      current.closingMeter || (current as Trip & { endMeter?: number }).endMeter || 0
    );
    const totalKm = closingMeter - (current.openingMeter || 0);

    setHeaderLoading(true);
    try {
      const submitted = await submitTripStep(current.id, "expenses", {
        ...current,
        closingMeter,
        totalKm,
        endTime: current.endTime || new Date().toLocaleString(),
        status: "Pending" as TripStatus,
        endStepSubmitted: true,
        expensesStepSubmitted: true,
      });
      applySubmittedTrip(submitted);
      setEndStepSubmitted(true);
      notifyRef.current?.(
        `✅ Trip ${submitted.tripNo} completed! Awaiting approval.`,
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

  const loadTrip = (tripToLoad: Trip) => {
    const normalized = {
      ...tripToLoad,
      helpers: tripToLoad.helpers || [],
      deliveries: tripToLoad.deliveries || [],
      boxDetails: tripToLoad.boxDetails || [],
    };
    setTrip(normalized);
    tripRef.current = normalized;
    setIsEditing(true);
    setEndStepSubmitted(tripToLoad.endStepSubmitted === true);
  };

  const clearTrip = () => {
    const fresh = emptyTrip();
    setTrip(fresh);
    tripRef.current = fresh;
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
    clearTrip,
    setStartTrip,
    updateStartTrip,
    registerTripIdCallback,
    registerStep1SuccessCallback,
  };
}
