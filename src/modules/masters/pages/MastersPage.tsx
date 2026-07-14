import React, { useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import DashboardLayout from "../../../layouts/DashboardLayout/DashboardLayout";

import ShopsPage from "../shops/pages/ShopsPage";
import FarmsPage from "../farms/pages/FarmsPage";
import VehiclesPage from "../vehicles/pages/VehiclesPage";
import EmployeesPage from "../employees/pages/EmployeesPage";
import BanksPage from "../banks/pages/BanksPage";
import BirdTypesPage from "../bird-types/pages/BirdTypesPage";

const tabs = [
  { key: "shops", label: "Shops", component: ShopsPage },
  { key: "farms", label: "Farms", component: FarmsPage },
  { key: "vehicles", label: "Vehicles", component: VehiclesPage },
  { key: "employees", label: "Employees", component: EmployeesPage },
  { key: "banks", label: "Banks", component: BanksPage },
  { key: "birdTypes", label: "Bird Types", component: BirdTypesPage },
];

function MastersPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const activeTab = searchParams.get("tab") || "shops";

  useEffect(() => {
    if (!searchParams.get("tab")) {
      navigate("/masters?tab=shops", { replace: true });
    }
  }, [location.search]);

  const ActiveComponent = useMemo(() => {
    const found = tabs.find((tab) => tab.key === activeTab);
    return found ? found.component : ShopsPage;
  }, [activeTab]);

  return (
    <DashboardLayout>
      <div className="px-4 sm:px-6 lg:px-8 pt-8 pb-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <ActiveComponent embedded={true} />
        </div>
      </div>
    </DashboardLayout>
  );
}

export default React.memo(MastersPage);