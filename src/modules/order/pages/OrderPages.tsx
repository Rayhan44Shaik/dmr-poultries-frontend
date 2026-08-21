// src/modules/order/pages/OrderPages.tsx
// Module-level router for the Order module.
//   /order/*   → single tabbed Orders workspace
//   /order/new → New Order form
//   /order/tracking → live-tracking prep (kept as a standalone route)

import { useMemo } from "react";
import { useLocation } from "react-router-dom";
import { OrderProvider } from "../store/OrderStore";
import OrderPage from "./OrderPage";
import NewOrderPage from "./NewOrderPage";
import TrackingPage from "./TrackingPage";

function resolvePage(pathname: string): "new" | "tracking" | "workspace" {
  if (pathname.endsWith("/new")) return "new";
  if (pathname.endsWith("/tracking")) return "tracking";
  return "workspace";
}

export default function OrderPages() {
  const location = useLocation();
  const page = useMemo(() => resolvePage(location.pathname), [location.pathname]);

  return (
    <OrderProvider>
      <div className="min-h-screen bg-slate-50/50">
        {page === "new" && <NewOrderPage />}
        {page === "tracking" && <TrackingPage />}
        {page === "workspace" && <OrderPage />}
      </div>
    </OrderProvider>
  );
}
