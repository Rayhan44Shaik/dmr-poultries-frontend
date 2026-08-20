// src/modules/order/pages/OrderPages.tsx
// Module-level router for the Order module. Resolves the active page from the
// pathname so every Order URL works on direct navigation / refresh.

import { useMemo } from "react";
import { useLocation } from "react-router-dom";
import { OrderProvider } from "../store/OrderStore";
import OrderPage from "./OrderPage";
import NewOrderPage from "./NewOrderPage";
import RoutePlanningPage from "./RoutePlanningPage";
import TrackingPage from "./TrackingPage";

type OrderPageKey = "list" | "new" | "planning" | "routes" | "tracking";

function resolvePage(pathname: string): OrderPageKey {
  if (pathname.endsWith("/new")) return "new";
  if (pathname.endsWith("/planning")) return "planning";
  if (pathname.endsWith("/routes")) return "routes";
  if (pathname.endsWith("/tracking")) return "tracking";
  return "list";
}

export default function OrderPages() {
  const location = useLocation();
  const page = useMemo(() => resolvePage(location.pathname), [location.pathname]);

  return (
    <OrderProvider>
      <div className="min-h-screen bg-slate-50/50">
        {page === "new" && <NewOrderPage />}
        {(page === "planning" || page === "routes") && <RoutePlanningPage />}
        {page === "tracking" && <TrackingPage />}
        {page === "list" && <OrderPage />}
      </div>
    </OrderProvider>
  );
}
