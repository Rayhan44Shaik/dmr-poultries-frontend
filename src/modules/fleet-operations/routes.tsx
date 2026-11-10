// Backwards-compatible re-export.
// Fleet route metadata now lives in `./fleetRouteConfig`, with the lazy page
// components isolated in `./fleetLazyPages`. This behaviour-preserving split
// removes the react-refresh/only-export-components findings without deleting
// any route, registration, page, or navigation entry.
// `fleetRoutes` remains intentionally unregistered — Fleet renders through
// `FleetPages` (see `activeFleetScope`), not through this array.
export { fleetRoutes } from './fleetRouteConfig';
