import { useEffect, useState } from "react";

import type { BirdType } from "../types/birdType";

import {
  getBirdTypes,
  saveBirdTypes as persistBirdTypes,
} from "../services/birdTypeService";

export function useBirdTypes() {

  const [birdTypes, setBirdTypes] =
    useState<BirdType[]>([]);

  useEffect(() => {

    setBirdTypes(getBirdTypes());

  }, []);

  const saveBirdTypes = (
    data: BirdType[]
  ) => {

    setBirdTypes(data);

    persistBirdTypes(data);

  };

  return {

    birdTypes,

    saveBirdTypes,

  };

}