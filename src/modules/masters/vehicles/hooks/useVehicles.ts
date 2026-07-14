import { useEffect, useState } from "react";

import type { Vehicle } from "../types/vehicle";

import {
  getVehicles,
  saveVehicles as persistVehicles,
} from "../services/vehicleService";

export function useVehicles() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);

  useEffect(() => {
    setVehicles(getVehicles());
  }, []);

  const saveVehicles = (data: Vehicle[]) => {
    setVehicles(data);
    persistVehicles(data);
  };

  return {
    vehicles,
    saveVehicles,
  };
}