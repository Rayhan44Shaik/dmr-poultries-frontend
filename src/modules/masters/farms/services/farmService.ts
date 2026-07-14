import { initialFarms } from "../data/farms";
import type { Farm } from "../types/farm";

const STORAGE_KEY = "dmr-farms";

export function getFarms(): Farm[] {
  const data = localStorage.getItem(STORAGE_KEY);

  if (!data) {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(initialFarms)
    );

    return initialFarms;
  }

  return JSON.parse(data);
}

export function saveFarms(farms: Farm[]) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(farms)
  );
}