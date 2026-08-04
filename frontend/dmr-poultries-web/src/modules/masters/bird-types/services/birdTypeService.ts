import { initialBirdTypes } from "../data/birdTypes";
import type { BirdType } from "../types/birdType";

const STORAGE_KEY = "dmr-bird-types";

export function getBirdTypes(): BirdType[] {

  const data = localStorage.getItem(STORAGE_KEY);

  if (!data) {

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(initialBirdTypes)
    );

    return initialBirdTypes;

  }

  return JSON.parse(data);

}

export function saveBirdTypes(
  birdTypes: BirdType[]
) {

  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(birdTypes)
  );

}