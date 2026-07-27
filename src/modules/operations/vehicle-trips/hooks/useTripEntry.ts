import { useState } from "react";
import type { Trip, ShopDelivery, BoxDetail, TripStatus } from "../types/trip";
import { tripService } from "../services/tripService";
import {
  generateTripNo,
  calculateAvgWeight,
  validateStartStep,
  validateFarmStep,
  validatePickupStep,
  validateEndStep,
  validateFinalTrip
} from "../services/tripFormService";

export function useTripEntry(showNotification?: (msg: string, type?: "success" | "error" | "info") => void) {

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
    status: "Pending",
    fuel: 0,
    expense: 0,
    remarks: "",
    rateCompleted: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    // ✅ Legacy fields – now included
    boxNo: 0,
    birds: 0,
    weight: 0
  });

  const [trip, setTrip] = useState<Trip>(emptyTrip());
  const [isEditing, setIsEditing] = useState(false);

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
    const expectedBirds = totalDelBirds + mortalityCount;
    const birdCountValid = expectedBirds === birds;
    const survivalRate = birds > 0 ? Number(((1 - (mortalityCount / birds)) * 100).toFixed(1)) : 0;

    return { totalDelBirds, totalDelWeight, totalShops, lastShop, mortalityWeight, weightLoss, birdCountValid, survivalRate };
  };

  const submitStartStep = (data: Partial<Trip>): boolean => {
    const updatedData = { ...trip, ...data, startTime: new Date().toLocaleString() };
    const validation = validateStartStep(updatedData as Trip);
    if (!validation.valid) {
      showNotification?.(validation.errors[0], "error");
      return false;
    }

    let savedTrip: Trip;
    if (isEditing) {
      savedTrip = tripService.update({ ...updatedData, startStepSubmitted: true });
      showNotification?.(`✅ Step 1 updated successfully.`, "success");
    } else {
      const existingTrips = tripService.getAll();
      const tripNo = generateTripNo(existingTrips, updatedData.tripDate);
      savedTrip = tripService.create({
        ...updatedData,
        id: Date.now(),
        tripNo,
        startStepSubmitted: true
      });
      showNotification?.(`✅ Step 1 completed successfully. Moving to Step 2...`, "success");
    }
    setTrip(savedTrip);
    return true;
  };

  const submitFarmStep = (data: Partial<Trip>): boolean => {
    const reachedTime = trip.farmStepSubmitted ? trip.reachedTime : new Date().toLocaleString();
    const updatedData = { ...trip, ...data, reachedTime };

    const validation = validateFarmStep(updatedData as Trip);
    if (!validation.valid) {
      showNotification?.(validation.errors[0], "error");
      return false;
    }
    const savedTrip = tripService.update({ ...updatedData, farmStepSubmitted: true });
    setTrip(savedTrip);
    showNotification?.(isEditing ? `✅ Step 2 updated successfully.` : `✅ Step 2 completed successfully. Moving to Step 3...`, "success");
    return true;
  };

  const updateBoxDetails = (rows: BoxDetail[], persistToStorage: boolean = false) => {
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
      showNotification?.(`💾 Pickup progress saved.`, "info");
    } else {
      setTrip(updatedTrip);
    }
  };

  const submitPickupStep = (data: Partial<Trip> = {}): boolean => {
    const updatedData = { ...trip, ...data };

    if (!updatedData.boxDetails || updatedData.boxDetails.length === 0) {
      showNotification?.(`❌ Please add at least one box before submitting Pickup.`, "error");
      return false;
    }

    const validation = validatePickupStep(updatedData as Trip);
    if (!validation.valid) {
      showNotification?.(validation.errors[0], "error");
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

    showNotification?.(isEditing ? `✅ Step 3 updated successfully.` : `✅ Step 3 completed successfully. Moving to Step 4...`, "success");
    return true;
  };

  const submitDeliveriesStep = (): boolean => {
    if (trip.deliveries.length === 0) {
      showNotification?.(`❌ Please add at least one shop delivery before proceeding.`, "error");
      return false;
    }
    const savedTrip = tripService.update({ ...trip, deliveryStepSubmitted: true });
    setTrip(savedTrip);
    showNotification?.(`✅ Deliveries locked. Proceed to End Trip.`, "success");
    return true;
  };

  const updateTrip = (updates: Partial<Trip>) => setTrip(prev => ({ ...prev, ...updates }));

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
    } else {
      setTrip(updatedTrip);
    }
  };

  const submitEndTrip = (): boolean => {
    if (!trip.deliveryStepSubmitted) {
      showNotification?.(`❌ You must complete and lock the Deliveries step first.`, "error");
      return false;
    }

    const endValidation = validateEndStep(trip);
    if (!endValidation.valid) {
      showNotification?.(endValidation.errors[0], "error");
      return false;
    }

    const finalValidation = validateFinalTrip(trip);
    if (!finalValidation.valid) {
      showNotification?.(finalValidation.errors[0], "error");
      return false;
    }

    const totalKm = trip.closingMeter - trip.openingMeter;
    const updatedTrip = {
      ...trip,
      totalKm,
      endTime: new Date().toLocaleString(),
      status: "Completed" as TripStatus
    };

    const savedTrip = tripService.update(updatedTrip);
    setTrip(savedTrip);
    showNotification?.(`✅ Trip ${savedTrip.tripNo} completed successfully!`, "success");
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
  };

  const clearTrip = () => {
    setTrip(emptyTrip());
    setIsEditing(false);
  };

  return {
    trip,
    setTrip,
    isEditing,
    setIsEditing,
    updateTrip,
    updateDeliveries,
    updateBoxDetails,        // ✅ now exposed
    submitStartStep,
    submitFarmStep,
    submitPickupStep,
    submitDeliveriesStep,
    submitEndTrip,
    loadTrip,
    clearTrip
  };
}