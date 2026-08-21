// src/modules/order/types/trackingTypes.ts
// -----------------------------------------------------------------------------
// Live tracking types for the Order module (frontend-ready, backend-agnostic).
// -----------------------------------------------------------------------------

export type TrackingConnectionState = "Connected" | "Not Connected";

export type VehicleTrackingStatus =
  | "Idle"
  | "On the Way"
  | "Arrived"
  | "Delivered"
  | "Unknown";

/**
 * Snapshot of a vehicle's live position. All position fields are nullable —
 * GPS may be unavailable, stale, or of poor accuracy at any moment.
 */
export interface VehicleTrackingSnapshot {
  vehicleId: string;
  vehicleNo: string;
  latitude: number | null;
  longitude: number | null;
  speedKmh: number | null;
  heading: number | null;
  accuracyMeters: number | null;
  lastUpdated: string | null;
  currentStop: string | null;
  nextStop: string | null;
  etaMinutes: number | null;
  status: VehicleTrackingStatus;
  connected: boolean;
}

/** Customer-facing tracking payload — intentionally minimal (requirement #46). */
export interface CustomerTrackingInfo {
  trackingReady: boolean;
  /** Placeholder token — a real secure token is wired up by the backend later. */
  token: string | null;
  vehicleNo: string;
  status: VehicleTrackingStatus;
  destinationShop: string;
  distanceRemainingKm: number | null;
  eta: string | null;
  lastUpdated: string | null;
}
