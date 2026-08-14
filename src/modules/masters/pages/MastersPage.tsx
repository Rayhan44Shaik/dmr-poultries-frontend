import React, { useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Store,
  Sprout,
  Truck,
  Users,
  Landmark,
  Bird,
  TrendingUp,
} from "lucide-react";

import ShopsPage from "../shops/pages/ShopsPage";
import FarmsPage from "../farms/pages/FarmsPage";
import VehiclesPage from "../vehicles/pages/VehiclesPage";
import EmployeesPage from "../employees/pages/EmployeesPage";
import BanksPage from "../banks/pages/BanksPage";
import BirdTypesPage from "../bird-types/pages/BirdTypesPage";
import { MarketRatePage } from "../Market_Rates/Pages/MarketRatePage";

import ModuleTabs, { type ModuleTab } from "../../../ui/ModuleTabs";

const tabs: ModuleTab[] = [
  { key: "shops", label: "Shops", icon: Store, color: "text-emerald-500" },
  { key: "farms", label: "Farms", icon: Sprout, color: "text-green-500" },
  { key: "vehicles", label: "Vehicles", icon: Truck, color: "text-sky-500" },
  { key: "employees", label: "Employees", icon: Users, color: "text-amber-500" },
  { key: "banks", label: "Banks", icon: Landmark, color: "text-violet-500" },
  { key: "birdTypes", label: "Bird Types", icon: Bird, color: "text-rose-500" },
  { key: "market-rate", label: "Market Rate", icon: TrendingUp, color: "text-indigo-500" },
];

const tabComponents: Record<
  string,
  React.ComponentType<{ embedded?: boolean }>
> = {
  shops: ShopsPage,
  farms: FarmsPage,
  vehicles: VehiclesPage,
  employees: EmployeesPage,
  banks: BanksPage,
  birdTypes: BirdTypesPage,
  "market-rate": MarketRatePage,
};

function MastersPage() {
  const location = useLocation();
  const navigate = useNavigate();

  const searchParams = useMemo(
    () => new URLSearchParams(location.search),
    [location.search]
  );

  const activeTab = searchParams.get("tab") || "shops";

  useEffect(() => {
    if (!searchParams.get("tab")) {
      navigate("/masters?tab=shops", { replace: true });
    }
  }, [location.search, navigate, searchParams]);

  const ActiveComponent = useMemo(
    () => tabComponents[activeTab] ?? ShopsPage,
    [activeTab]
  );

  const handleTabChange = (tabKey: string) => {
    navigate(`/masters?tab=${tabKey}`);
  };

  return (
    <div className="mx-auto w-full max-w-[1480px] space-y-4 pb-6">
      <ModuleTabs
        tabs={tabs}
        activeKey={activeTab}
        onChange={handleTabChange}
        className="px-4 pt-3 sm:px-6 lg:px-8"
      />

      <div className="w-full px-4 sm:px-6 lg:px-8">
        <ActiveComponent embedded={true} />
      </div>
    </div>
  );
}

export default React.memo(MastersPage);