import { initialBanks } from "../data/banks";
import type { Bank } from "../types/bank";

const STORAGE_KEY = "dmr-banks";

export function getBanks(): Bank[] {

  const data = localStorage.getItem(STORAGE_KEY);

  if (!data) {

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(initialBanks)
    );

    return initialBanks;

  }

  return JSON.parse(data);

}

export function saveBanks(
  banks: Bank[]
) {

  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(banks)
  );

}