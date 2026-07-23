import { useState } from "react";
import type { Trip, ShopDelivery } from "../types/trip";
import { generateTripNo } from "../services/tripFormService";

export function useTripEntry(showNotification?: (msg: string, type?: "success" | "error" | "info") => void) {
  const emptyTrip = (): Trip => ({
    id: 0,
    tripNo: "",
    tripDate: new Date().toISOString().split("T")[0],
    vehicleId: 0,
    vehicleNo: "",
    driverId: 0,
    driverName: "",
    supervisorId: 0,
    supervisorName: "",
    sourceFarmId: 0,
    sourceFarm: "",
    openingMeter: 0,
    closingMeter: 0,
    totalKm: 0,
    fuel: 0,
    dcWeight: 0.00,
    expense: 0,
    remarks: "",
    status: "Pending",
    rateCompleted: false,
    deliveries: [],
    totalBirds: 0,
    totalWeight: 0,
    totalShops: 0,
    totalMortality: 0,   // ← manual entry
    lastShop: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const [trip, setTrip] = useState<Trip>(emptyTrip());

  const updateField = (field: keyof Trip, value: any) => {
    setTrip((prev) => ({ ...prev, [field]: value }));
  };

  // ✅ Helper to compute totals EXCLUDING mortality
  const computeTotals = (rows: ShopDelivery[]) => {
    const totalBirds = rows.reduce((sum, r) => sum + (Number(r.birds) || 0), 0);
    const totalWeight = Number(rows.reduce((sum, r) => sum + (Number(r.weight) || 0), 0).toFixed(2));
    const totalShops = rows.length;
    const lastShop = rows.length > 0 ? rows[rows.length - 1].shopName : "";
    return { totalBirds, totalWeight, totalShops, lastShop };
  };

  // ✅ Update deliveries – preserve manual totalMortality
  const updateDeliveries = (rows: ShopDelivery[]) => {
    const { totalBirds, totalWeight, totalShops, lastShop } = computeTotals(rows);
    setTrip((prev) => ({
      ...prev,
      deliveries: rows,
      totalBirds,
      totalWeight,
      totalShops,
      // ✅ DO NOT overwrite totalMortality – keep manual value
      totalMortality: prev.totalMortality,   // ← preserve existing manual entry
      lastShop,
    }));
  };

  const loadTrip = (tripToLoad: Trip) => {
    setTrip({
      ...tripToLoad,
      deliveries: tripToLoad.deliveries || [],
      // totalMortality is already in tripToLoad
    });
  };

  const clearTrip = () => setTrip(emptyTrip());

  const saveTrip = (rows: ShopDelivery[]): boolean => {
    // 1. Validate required fields
    if (!trip.tripDate) {
      showNotification?.("Trip date is required.", "error");
      return false;
    }
    if (!trip.vehicleNo) {
      showNotification?.("Vehicle is required.", "error");
      return false;
    }
    if (!trip.driverName) {
      showNotification?.("Driver is required.", "error");
      return false;
    }
    if (!trip.supervisorName) {
      showNotification?.("Supervisor is required.", "error");
      return false;
    }
    if (!trip.sourceFarm) {
      showNotification?.("Source farm is required.", "error");
      return false;
    }
    if (rows.length === 0) {
      showNotification?.("Add at least one shop delivery.", "error");
      return false;
    }

    // 2. Compute totals from rows (excluding mortality)
    const { totalBirds, totalWeight, totalShops, lastShop } = computeTotals(rows);

    // 3. Read existing trips, generate new trip number
    const existingTrips = JSON.parse(localStorage.getItem("vehicleTrips") || "[]");
    const newTripNo = trip.tripNo || generateTripNo(existingTrips, trip.tripDate);

    // 4. Build the new trip object – use manual mortality from trip state
    const newTrip: Trip = {
      ...trip,
      id: Date.now(),
      tripNo: newTripNo,
      deliveries: rows,
      totalBirds,
      totalWeight,
      totalShops,
      totalMortality: trip.totalMortality,   // ✅ use manual value
      lastShop,
      status: "Pending",
      rateCompleted: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // 5. Save to localStorage
    const allTrips = [...existingTrips, newTrip];
    localStorage.setItem("vehicleTrips", JSON.stringify(allTrips));

    // 6. Clear form and notify
    clearTrip();
    showNotification?.("Trip saved successfully!", "success");

    console.log("✅ Saved trip – totalMortality (manual):", newTrip.totalMortality);

    return true;
  };

  const updateTrip = (rows: ShopDelivery[]): boolean => {
    if (!trip.id) {
      showNotification?.("Cannot update: trip ID missing.", "error");
      return false;
    }

    // 1. Compute totals from rows (excluding mortality)
    const { totalBirds, totalWeight, totalShops, lastShop } = computeTotals(rows);

    // 2. Build updated trip with manual mortality
    const updatedTrip: Trip = {
      ...trip,
      deliveries: rows,
      totalBirds,
      totalWeight,
      totalShops,
      totalMortality: trip.totalMortality,   // ✅ use manual value
      lastShop,
      updatedAt: new Date().toISOString(),
    };

    // 3. Save to localStorage
    const allTrips = JSON.parse(localStorage.getItem("vehicleTrips") || "[]");
    const index = allTrips.findIndex((t: Trip) => t.id === updatedTrip.id);
    if (index === -1) {
      showNotification?.("Trip not found.", "error");
      return false;
    }
    allTrips[index] = updatedTrip;
    localStorage.setItem("vehicleTrips", JSON.stringify(allTrips));

    // 4. Clear form and notify
    clearTrip();
    showNotification?.("Trip updated successfully!", "success");

    console.log("✅ Updated trip – totalMortality (manual):", updatedTrip.totalMortality);

    return true;
  };

  return {
    trip,
    setTrip,
    updateField,
    updateDeliveries,
    saveTrip,
    updateTrip,
    loadTrip,
    clearTrip,
  };
}