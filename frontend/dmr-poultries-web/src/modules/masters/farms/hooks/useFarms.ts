import { useEffect, useState } from "react";

import type { Farm } from "../types/farm";

import {
  getFarms,
  saveFarms as persistFarms,
} from "../services/farmService";

export function useFarms() {
  const [farms, setFarms] = useState<Farm[]>([]);

  useEffect(() => {
    setFarms(getFarms());
  }, []);

  const saveFarms = (data: Farm[]) => {
    setFarms(data);
    persistFarms(data);
  };

  return {
    farms,
    saveFarms,
  };
}