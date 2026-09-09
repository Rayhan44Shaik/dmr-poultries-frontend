import { useCallback, useEffect, useRef, useState } from "react";
import { apiGet, handleApiError } from "../../../api";

export interface MasterQuery {
  page: number;
  pageSize: number;
  search: string;
  status?: string;
  sort?: string;
  direction?: string;
  department?: string;
  city?: string;
}
interface PageResult { items: Record<string, unknown>[]; total: number; page: number; facets: Record<string, string[]> }
interface Config<T> { path: string; load: () => Promise<T[]>; map: (raw: Record<string, unknown>) => T }

export function useMasterRecords<T>(config: Config<T>, options?: MasterQuery) {
  const [rows, setRows] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [facets, setFacets] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [queryKey, setQueryKey] = useState(JSON.stringify(options));
  const nextKey = JSON.stringify(options);
  const generation = useRef(0);
  const busy = useRef(false);
  useEffect(() => {
    // Invalidate in-flight results immediately; debounce only the next request.
    generation.current += 1;
    const timer = window.setTimeout(() => setQueryKey(nextKey), 250);
    return () => window.clearTimeout(timer);
  }, [nextKey]);
  const reload = useCallback(async () => {
    const request = ++generation.current;
    setLoading(true); setError(null);
    try {
      let items: T[];
      if (queryKey) {
        const { data } = await apiGet<PageResult>(config.path, { params: JSON.parse(queryKey) });
        items = data.items.map(config.map);
        if (request === generation.current) { setTotal(data.total); setPage(data.page); setFacets(data.facets); }
      } else {
        items = await config.load();
        if (request === generation.current) setTotal(items.length);
      }
      if (request === generation.current) setRows(items);
      return items;
    } catch (err) {
      if (request === generation.current) { setError(handleApiError(err)); setRows([]); }
      throw err;
    } finally {
      if (request === generation.current) setLoading(false);
    }
  }, [config, queryKey]);
  useEffect(() => {
    void reload().catch(() => {});
    return () => { generation.current += 1; };
  }, [reload]);
  const mutate = useCallback(async (operation: () => Promise<unknown>) => {
    if (busy.current) throw new Error("An operation is already in progress.");
    busy.current = true; setSaving(true); setError(null);
    try {
      await operation();
      // The write succeeded even if refreshing fails. Do not invite duplicate retries.
      return await reload().catch(() => [] as T[]);
    } catch (err) { setError(handleApiError(err)); throw err; }
    finally { busy.current = false; setSaving(false); }
  }, [reload]);
  const exportRows = useCallback(async () => {
    const { data } = await apiGet<PageResult>(config.path, { params: { ...(queryKey ? JSON.parse(queryKey) : {}), export: "true" } });
    return data.items.map(config.map);
  }, [config, queryKey]);
  return { rows, total, page, facets, loading: loading || nextKey !== queryKey, saving, error, reload, mutate, exportRows };
}
