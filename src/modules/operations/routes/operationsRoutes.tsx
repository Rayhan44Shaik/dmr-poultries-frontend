import type { RouteObject } from "react-router-dom";
import DashboardLayout from "../../../layouts/DashboardLayout/DashboardLayout";
import OperationsDashboard from "../pages/OperationsDashboard";
import TripEntryPage from "../vehicle-trips/pages/TripEntryPage";
import TripListPage from "../vehicle-trips/pages/TripListPage";
import ShopSalesPage from "../shop-sales/pages/ShopSalesPage";
import RatesEntryPage from "../shop-sales/pages/RatesEntryPage";

const operationsRoutes: RouteObject[] = [
  {
    path: "/operations",
    element: <OperationsDashboard />,
  },
  // Vehicle Trips
  {
    path: "/operations/vehicle-trips/entry",
    element: <TripEntryPage />,
  },
  {
    path: "/operations/vehicle-trips/list",
    element: <TripListPage />,
  },
  // Shop Sales
  {
    path: "/operations/shop-sales",
    element: (
      <DashboardLayout>
        <ShopSalesPage />
      </DashboardLayout>
    ),
  },
  {
    path: "/operations/shop-sales/rate-entry",
    element: <RatesEntryPage embedded={true} />, // RatesEntryPage already handles its own layout
  },
];

export default operationsRoutes;