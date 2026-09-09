import { useCallback } from "react";
import { useMasterRecords, type MasterQuery } from "../../hooks/useMasterRecords";
import { createBirdType, updateBirdType, deleteBirdType, loadBirdTypes, mapBirdType, type BirdTypeInput, bulkCreateBirdTypes } from "../services/birdTypeService";
const config = { path: "/masters/bird-types", load: loadBirdTypes, map: mapBirdType };
export function useBirdTypes(options?: MasterQuery) {
  const state = useMasterRecords(config, options);
  const { mutate } = state;
  const addBirdType = useCallback((input: BirdTypeInput) => mutate(() => createBirdType(input)), [mutate]);
  const editBirdType = useCallback((id: number, input: BirdTypeInput) => mutate(() => updateBirdType(id, input)), [mutate]);
  const removeBirdType = useCallback((id: number) => mutate(() => deleteBirdType(id)), [mutate]);
  const addBirdTypesBulk = useCallback((inputs: BirdTypeInput[]) => mutate(() => bulkCreateBirdTypes(inputs)), [mutate]);
  return { ...state, birdTypes: state.rows, addBirdType, editBirdType, removeBirdType, addBirdTypesBulk };
}
