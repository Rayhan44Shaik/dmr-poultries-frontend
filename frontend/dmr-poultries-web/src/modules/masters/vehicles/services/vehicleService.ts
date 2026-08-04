import { initialVehicles } from "../data/vehicles";
import type { Vehicle } from "../types/vehicle";

const STORAGE_KEY = "dmr-vehicles";

export function getVehicles(): Vehicle[] {
  const data = localStorage.getItem(STORAGE_KEY);

  if (!data) {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(initialVehicles)
    );

    return initialVehicles;
  }

  return JSON.parse(data);
}

export function saveVehicles(vehicles: Vehicle[]) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(vehicles)
  );
}