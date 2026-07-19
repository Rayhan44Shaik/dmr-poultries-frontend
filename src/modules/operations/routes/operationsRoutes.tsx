// src/modules/operations/routes/operationsRoutes.tsx
import { Navigate, type RouteObject } from "react-router-dom";
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
        <OperationsDashboard />
      </DashboardLayout>
    ),
    children: [
      // Redirect from /operations to /operations/overview (so dashboard shows)
      {
        index: true,
        element: <Navigate to="/operations/overview" replace />,
      },
      // Overview – no separate element, handled by parent
      {
        path: "overview",
        element: null,
      },
      // Functional modules
      {
        path: "vehicle-trips/entry",
        element: <TripEntryPage />,
      },
      {
        path: "vehicle-trips/list",
        element: <TripListPage />,
      },
      {
        path: "shop-sales",
        element: <ShopSalesPage />,
      },
      {
        path: "shop-sales/rate-entry",
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