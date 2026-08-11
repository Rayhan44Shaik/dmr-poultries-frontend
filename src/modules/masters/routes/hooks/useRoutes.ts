import { useCallback, useEffect, useState } from "react";

import type { Route } from "../types/route";
import {
  createRoute,
  deleteRoute,
  handleApiError,
  loadRoutes,
  refreshRoutes,
  updateRoute,
  type RouteInput,
} from "../services/routeService";

/**
 * Routes page data hook — table state comes only from GET /api/masters/routes.
 */
export function useRoutes() {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await loadRoutes();
      setRoutes(data);
      return data;
    } catch (err) {
      const message = handleApiError(err);
      setError(message);
      setRoutes([]);
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

  const addRoute = useCallback(async (input: RouteInput) => {
    setSaving(true);
    setError(null);
    try {
      await createRoute(input);
      const data = await refreshRoutes();
      setRoutes(data);
      return data;
    } catch (err) {
      const message = handleApiError(err);
      setError(message);
      throw err;
    } finally {
      setSaving(false);
    }
  }, []);

  const editRoute = useCallback(async (id: number, input: RouteInput) => {
    setSaving(true);
    setError(null);
    try {
      await updateRoute(id, input);
      const data = await refreshRoutes();
      setRoutes(data);
      return data;
    } catch (err) {
      const message = handleApiError(err);
      setError(message);
      throw err;
    } finally {
      setSaving(false);
    }
  }, []);

  const removeRoute = useCallback(async (id: number) => {
    setSaving(true);
    setError(null);
    try {
      await deleteRoute(id);
      const data = await refreshRoutes();
      setRoutes(data);
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
    routes,
    loading,
    saving,
    error,
    reload,
    addRoute,
    editRoute,
    removeRoute,
  };
}
