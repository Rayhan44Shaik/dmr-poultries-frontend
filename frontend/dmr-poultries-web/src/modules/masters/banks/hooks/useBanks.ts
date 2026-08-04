import { useEffect, useState } from "react";

import type { Bank } from "../types/bank";

import {
  getBanks,
  saveBanks as persistBanks,
} from "../services/bankService";

export function useBanks() {

  const [banks, setBanks] =
    useState<Bank[]>([]);

  useEffect(() => {

    setBanks(getBanks());

  }, []);

  const saveBanks = (
    data: Bank[]
  ) => {

    setBanks(data);

    persistBanks(data);

  };

  return {

    banks,

    saveBanks,

  };

}