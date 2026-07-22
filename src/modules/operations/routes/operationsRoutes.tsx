// src/modules/operations/routes/operationsRoutes.tsx

import { Navigate, Outlet, type RouteObject } from "react-router-dom";
import DashboardLayout from "../../../layouts/DashboardLayout/DashboardLayout";
import OperationsDashboard from "../pages/OperationsDashboard";
import TripEntryPage from "../vehicle-trips/pages/TripEntryPage";
import TripListPage from "../vehicle-trips/pages/TripListPage";
import ShopSalesPage from "../shop-sales/pages/ShopSalesPage";
import RatesEntryPage from "../shop-sales/pages/RatesEntryPage";
import CollectionEntryPage from "../collections/pages/CollectionEntryPage";
import PendingCollectionsPage from "../collections/pages/PendingCollectionsPage";
import CollectionReportPage from "../collections/pages/CollectionReportPage";
import FuelExpensesPage from "../fuel-expenses/pages/FuelExpensesPage";

const operationsRoutes: RouteObject[] = [
  {
    path: "/operations",
    element: (
      <DashboardLayout>
        <Outlet />
      </DashboardLayout>
    ),
    children: [
      {
        index: true,
        element: <Navigate to="/operations/overview" replace />,
      },
      {
        path: "overview",
        element: <OperationsDashboard />,
      },
      {
        path: "vehicle-trips/entry",
        element: <TripEntryPage />,
      },
      {
        path: "vehicle-trips/list",
        element: <TripListPage />,
      },
      // Shop routes under /operations/shop/
      {
        path: "shop/shop-sales",
        element: <ShopSalesPage />,
      },
      {
        path: "shop/rate-entry",
        element: <RatesEntryPage embedded={true} />,
      },
      {
        path: "collections/entry",
        element: <CollectionEntryPage />,
      },
      {
        path: "collections/pending",
        element: <PendingCollectionsPage />,
      },
      {
        path: "collections/report",
        element: <CollectionReportPage />,
      },
      {
        path: "fuel-expenses",
        element: <FuelExpensesPage />,
      },
    ],
  },
];

export default operationsRoutes;