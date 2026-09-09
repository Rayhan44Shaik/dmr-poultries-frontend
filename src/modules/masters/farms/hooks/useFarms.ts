import { useCallback } from "react";
import { useMasterRecords, type MasterQuery } from "../../hooks/useMasterRecords";
import { createFarm, updateFarm, deleteFarm, loadFarms, mapFarm, type FarmInput, bulkCreateFarms } from "../services/farmService";
const config = { path: "/masters/farms", load: loadFarms, map: mapFarm };
export function useFarms(options?: MasterQuery) {
  const state = useMasterRecords(config, options);
  const { mutate } = state;
  const addFarm = useCallback((input: FarmInput) => mutate(() => createFarm(input)), [mutate]);
  const editFarm = useCallback((id: number, input: FarmInput) => mutate(() => updateFarm(id, input)), [mutate]);
  const removeFarm = useCallback((id: number) => mutate(() => deleteFarm(id)), [mutate]);
  const addFarmsBulk = useCallback((inputs: FarmInput[]) => mutate(() => bulkCreateFarms(inputs)), [mutate]);
  return { ...state, farms: state.rows, addFarm, editFarm, removeFarm, addFarmsBulk };
}
