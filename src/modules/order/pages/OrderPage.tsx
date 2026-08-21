// src/modules/order/pages/OrderPage.tsx
// Single Orders workspace — header + segmented tabs (Orders / Shop Assignment /
// Vehicle Trips / Delivery Planning / Exceptions).

import { useCallback, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import OrderHeader from "../components/OrderHeader";
import OrderTabs, { type OrderTabKey } from "../components/OrderTabs";
import OrdersTab from "../components/OrdersTab";
import ShopAssignmentTab from "../components/ShopAssignmentTab";
import VehicleTripsTab from "../components/VehicleTripsTab";
import DeliveryPlanningTab from "../components/DeliveryPlanningTab";
import ExceptionsTab from "../components/ExceptionsTab";
import { useOrders } from "../store/orderContext";
import { getActiveVehicles } from "../services/tripIntegrationService";
import type { RouteVehicle } from "../types/routeTypes";

function tabFromPath(pathname: string): OrderTabKey | null {
  if (pathname.endsWith("/planning") || pathname.endsWith("/routes")) return "planning";
  return null;
}

const TAB_KEYS: OrderTabKey[] = ["orders", "assignment", "trips", "planning", "exceptions"];

export default function OrderPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { orders } = useOrders();
  const [vehicles, setVehicles] = useState<RouteVehicle[]>(() => getActiveVehicles());

  const activeTab: OrderTabKey = useMemo(() => {
    const fromPath = tabFromPath(window.location.pathname);
    if (fromPath) return fromPath;
    const param = searchParams.get("tab");
    return TAB_KEYS.includes(param as OrderTabKey) ? (param as OrderTabKey) : "orders";
  }, [searchParams]);

  const setTab = useCallback(
    (tab: OrderTabKey) => {
      setSearchParams(tab === "orders" ? {} : { tab }, { replace: true });
    },
    [setSearchParams],
  );

  const pendingCount = useMemo(
    () => orders.filter((o) => !o.vehicleAssignment && o.status !== "Cancelled" && o.status !== "Delivered").length,
    [orders],
  );

  const handleRefresh = useCallback(() => setVehicles(getActiveVehicles()), []);

  return (
    <div className="mx-auto max-w-[1600px] px-3 py-4 md:px-6 md:py-6">
      <div className="space-y-4">
        <OrderHeader onNewOrder={() => navigate("/order/new")} onRefresh={handleRefresh} refreshing={false} />

        <OrderTabs
          active={activeTab}
          onChange={setTab}
          badges={{ assignment: pendingCount, trips: vehicles.length }}
        />

        {activeTab === "orders" && <OrdersTab vehicles={vehicles} />}
        {activeTab === "assignment" && <ShopAssignmentTab vehicles={vehicles} />}
        {activeTab === "trips" && <VehicleTripsTab onNavigate={setTab} />}
        {activeTab === "planning" && <DeliveryPlanningTab vehicles={vehicles} />}
        {activeTab === "exceptions" && <ExceptionsTab vehicles={vehicles} />}
      </div>
    </div>
  );
}
