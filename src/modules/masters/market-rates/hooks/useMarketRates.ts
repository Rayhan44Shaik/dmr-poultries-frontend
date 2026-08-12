import { useCallback, useState } from "react";

import type { MarketRate, MarketRateInput } from "../types/marketRate";
import {
  handleApiError,
  loadMarketRates,
  saveMarketRates,
} from "../services/marketRateService";

/**
 * Market Rate data hook — state comes only from the backend API.
 * Range loads replace the local matrices; saves are batched upserts.
 */
export function useMarketRates() {
  const [rates, setRates] = useState<MarketRate[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadRange = useCallback(async (fromDate?: string, toDate?: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await loadMarketRates(fromDate, toDate);
      setRates(data);
      return data;
    } catch (err) {
      const message = handleApiError(err);
      setError(message);
      setRates([]);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const save = useCallback(async (inputs: MarketRateInput[]) => {
    setSaving(true);
    setError(null);
    try {
      const saved = await saveMarketRates(inputs);
      setRates((prev) => {
        const next = prev.filter(
          (r) => !saved.some((s) => s.businessDate === r.businessDate)
        );
        return [...next, ...saved].sort((a, b) =>
          a.businessDate.localeCompare(b.businessDate)
        );
      });
      return saved;
    } catch (err) {
      const message = handleApiError(err);
      setError(message);
      throw err;
    } finally {
      setSaving(false);
    }
  }, []);

  return {
    rates,
    loading,
    saving,
    error,
    loadRange,
    save,
  };
}
