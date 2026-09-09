import { useCallback } from "react";
import { useMasterRecords, type MasterQuery } from "../../hooks/useMasterRecords";
import { createBank, updateBank, deleteBank, loadBanks, mapBank, type BankInput } from "../services/bankService";
const config = { path: "/masters/banks", load: loadBanks, map: mapBank };
export function useBanks(options?: MasterQuery) {
  const state = useMasterRecords(config, options);
  const { mutate } = state;
  const addBank = useCallback((input: BankInput) => mutate(() => createBank(input)), [mutate]);
  const editBank = useCallback((id: number, input: BankInput) => mutate(() => updateBank(id, input)), [mutate]);
  const removeBank = useCallback((id: number) => mutate(() => deleteBank(id)), [mutate]);
  return { ...state, banks: state.rows, addBank, editBank, removeBank };
}
