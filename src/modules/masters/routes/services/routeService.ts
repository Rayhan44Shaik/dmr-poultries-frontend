/**
 * Routes master — PostgreSQL ONLY via shared Axios helpers.
 */

import {
  apiDelete,
  apiGet,
  apiPost,
  apiPut,
  handleApiError,
} from "../../../../api";
import type { Route } from "../types/route";

const ROUTES_PATH = "/masters/routes";

/** Cache filled exclusively by GET /api/masters/routes. */
let routesCache: Route[] = [];

export type RouteInput = Omit<Route, "id" | "routeNo"> & {
  routeNo?: number;
};

function normalizeStatus(status: unknown): Route["status"] {
  return status === "Active" ? "Active" : "Inactive";
}

function mapRoute(raw: Record<string, unknown>): Route {
  return {
    id: Number(raw.id),
    routeNo: Number(raw.routeNo ?? raw.route_no ?? 0),
    routeName: String(raw.routeName ?? raw.route_name ?? ""),
    routeCode: String(raw.routeCode ?? raw.route_code ?? ""),
    description: String(raw.description ?? ""),
    status: normalizeStatus(raw.status),
  };
}

function toPayload(input: RouteInput | Partial<Route>): Record<string, unknown> {
  return {
    routeNo: input.routeNo,
    routeName: input.routeName?.trim(),
    routeCode: input.routeCode?.trim() ?? "",
    description: input.description?.trim() ?? "",
    status: input.status ?? "Active",
  };
}

function setCacheFromApi(rows: Record<string, unknown>[] | null | undefined): Route[] {
  routesCache = Array.isArray(rows) ? rows.map(mapRoute) : [];
  return routesCache;
}

/** Sync snapshot for other modules — reflects last successful API load only. */
export function getRoutes(): Route[] {
  return routesCache;
}

/**
 * @deprecated Do not use for Routes UI. Mutations must go through API helpers.
 */
export function saveRoutes(_routes: Route[]): void {
  // Intentionally no-op. Cache is API-owned.
}

/** GET /api/masters/routes — sole source of truth for the Routes table. */
export async function loadRoutes(): Promise<Route[]> {
  const { data } = await apiGet<Record<string, unknown>[]>(ROUTES_PATH);
  return setCacheFromApi(data);
}

/** POST /api/masters/routes */
export async function createRoute(input: RouteInput): Promise<Route> {
  const { data } = await apiPost<Record<string, unknown>>(
    ROUTES_PATH,
    toPayload(input)
  );
  return mapRoute(data);
}

/** PUT /api/masters/routes/:id */
export async function updateRoute(
  id: number,
  input: RouteInput | Partial<Route>
): Promise<Route> {
  const { data } = await apiPut<Record<string, unknown>>(
    `${ROUTES_PATH}/${id}`,
    toPayload({ ...(input as RouteInput), routeNo: input.routeNo })
  );
  return mapRoute(data);
}

/** DELETE /api/masters/routes/:id */
export async function deleteRoute(id: number): Promise<void> {
  await apiDelete(`${ROUTES_PATH}/${id}`);
}

/** Always re-fetch from PostgreSQL. */
export async function refreshRoutes(): Promise<Route[]> {
  return loadRoutes();
}

export { handleApiError };
