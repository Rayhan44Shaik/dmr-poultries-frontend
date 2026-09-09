import { useCallback } from "react";
import { useMasterRecords, type MasterQuery } from "../../hooks/useMasterRecords";
import { createVehicle, updateVehicle, deleteVehicle, loadVehicles, mapVehicle, type VehicleInput, bulkCreateVehicles } from "../services/vehicleService";
const config = { path: "/masters/vehicles", load: loadVehicles, map: mapVehicle };
export function useVehicles(options?: MasterQuery) {
  const state = useMasterRecords(config, options);
  const { mutate } = state;
  const addVehicle = useCallback((input: VehicleInput) => mutate(() => createVehicle(input)), [mutate]);
  const editVehicle = useCallback((id: number, input: VehicleInput) => mutate(() => updateVehicle(id, input)), [mutate]);
  const removeVehicle = useCallback((id: number) => mutate(() => deleteVehicle(id)), [mutate]);
  const addVehiclesBulk = useCallback((inputs: VehicleInput[]) => mutate(() => bulkCreateVehicles(inputs)), [mutate]);
  return { ...state, vehicles: state.rows, addVehicle, editVehicle, removeVehicle, addVehiclesBulk };
}
