import { useCallback, useEffect, useState } from "react";

import type { BirdType } from "../types/birdType";
import {
  createBirdType,
  deleteBirdType,
  handleApiError,
  loadBirdTypes,
  refreshBirdTypes,
  updateBirdType,
  type BirdTypeInput,
} from "../services/birdTypeService";

/**
 * Bird Types page data hook — table state comes only from GET /api/masters/bird-types.
 */
export function useBirdTypes() {
  const [birdTypes, setBirdTypes] = useState<BirdType[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await loadBirdTypes();
      setBirdTypes(data);
      return data;
    } catch (err) {
      const message = handleApiError(err);
      setError(message);
      setBirdTypes([]);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload().catch(() => {
      /* error already captured in state */
    });
  }, [reload]);

  const addBirdType = useCallback(async (input: BirdTypeInput) => {
    setSaving(true);
    setError(null);
    try {
      await createBirdType(input);
      const data = await refreshBirdTypes();
      setBirdTypes(data);
      return data;
    } catch (err) {
      const message = handleApiError(err);
      setError(message);
      throw err;
    } finally {
      setSaving(false);
    }
  }, []);

  const editBirdType = useCallback(async (id: number, input: BirdTypeInput) => {
    setSaving(true);
    setError(null);
    try {
      await updateBirdType(id, input);
      const data = await refreshBirdTypes();
      setBirdTypes(data);
      return data;
    } catch (err) {
      const message = handleApiError(err);
      setError(message);
      throw err;
    } finally {
      setSaving(false);
    }
  }, []);

  const removeBirdType = useCallback(async (id: number) => {
    setSaving(true);
    setError(null);
    try {
      await deleteBirdType(id);
      const data = await refreshBirdTypes();
      setBirdTypes(data);
      return data;
    } catch (err) {
      const message = handleApiError(err);
      setError(message);
      throw err;
    } finally {
      setSaving(false);
    }
  }, []);

  return {
    birdTypes,
    loading,
    saving,
    error,
    reload,
    addBirdType,
    editBirdType,
    removeBirdType,
  };
}
