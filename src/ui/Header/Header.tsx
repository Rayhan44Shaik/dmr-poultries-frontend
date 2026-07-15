import { useLocation, Link } from "react-router-dom";
import { Fuel } from "lucide-react";
import CollectionTabs from "../../modules/operations/collections/components/CollectionTabs";
import VehicleTripTabs from "../../modules/operations/vehicle-trips/components/VehicleTripTabs";

const masterTabs = [
  { label: "Shops", path: "/masters/shops" },
  { label: "Farms", path: "/masters/farms" },
  { label: "Vehicles", path: "/masters/vehicles" },
  { label: "Employees", path: "/masters/employees" },
  { label: "Banks", path: "/masters/banks" },
  { label: "Bird Types", path: "/masters/bird-types" },
];

const shopSalesTabs = [
  { label: "Shop Sales", path: "/operations/shop-sales" },
  { label: "Rate Entry", path: "/operations/shop-sales/rate-entry" },
];

function Header() {
  const location = useLocation();
  const currentPath = location.pathname;

  const isMastersPage = currentPath === "/masters" || currentPath.startsWith("/masters/");
  const isShopSalesPage =
    currentPath === "/operations/shop-sales" ||
    currentPath === "/operations/shop-sales/rate-entry";
  const isCollectionPage = currentPath.startsWith("/operations/collections");
  const isVehicleTripPage = currentPath.startsWith("/operations/vehicle-trips");

  // Dashboard detection – includes /operations/overview
  const isDashboardPage =
    currentPath === "/" ||
    currentPath === "/dashboard" ||
    currentPath.startsWith("/dashboard") ||
    currentPath === "/operations/overview" ||
    currentPath.startsWith("/operations/overview");

  const isActive = (tabPath: string) => {
    if (currentPath === "/masters" && tabPath === "/masters/shops") return true;
    return currentPath === tabPath;
  };

  const userProfile = (
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-full bg-green-700 text-white flex items-center justify-center font-bold">R</div>
      <div>
        <p className="font-semibold text-slate-800">Ruhulla</p>
        <p className="text-xs text-slate-500">Administrator</p>
      </div>
    </div>
  );

  // ---- Masters Page ----
  if (isMastersPage) {
    return (
      <header className="h-16 bg-white border-b border-slate-200 shadow-sm flex items-center justify-between px-6">
        <div className="flex items-center gap-6 overflow-x-auto">
          {masterTabs.map((tab) => (
            <Link
              key={tab.path}
              to={tab.path}
              className={`relative py-2 text-sm font-medium transition-colors duration-200 whitespace-nowrap ${
                isActive(tab.path) ? "text-blue-600" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {tab.label}
              <span
                className={`absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-blue-600 transition-all duration-200 ${
                  isActive(tab.path) ? "scale-x-100" : "scale-x-0"
                }`}
              />
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-6">
          <button className="text-slate-600 hover:text-green-700 text-xl">🔔</button>
          {userProfile}
        </div>
      </header>
    );
  }

  // ---- Other pages ----
  let leftContent = null;
  let rightContent = null;

  if (isCollectionPage) {
    leftContent = <CollectionTabs />;
  } else if (isVehicleTripPage) {
    leftContent = <VehicleTripTabs />;
  } else if (isShopSalesPage) {
    leftContent = (
      <div className="flex items-center gap-6 overflow-x-auto">
        {shopSalesTabs.map((tab) => (
          <Link
            key={tab.path}
            to={tab.path}
            className={`relative py-2 text-sm font-medium transition-colors duration-200 whitespace-nowrap ${
              currentPath === tab.path ? "text-blue-600" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {tab.label}
            <span
              className={`absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-blue-600 transition-all duration-200 ${
                currentPath === tab.path ? "scale-x-100" : "scale-x-0"
              }`}
            />
          </Link>
        ))}
      </div>
    );
  } else {
    const pageTitles: Record<string, string> = {
      "/operations/overview": "Operations Dashboard",
      "/operations": "Operations",
      "/accounts": "Accounts",
      "/vehicles": "Vehicle Management",
      "/staff": "Staff",
      "/reports": "Reports",
      "/settings": "Settings",
    };

    // Fuel Entry
    if (currentPath === "/operations/fuel-expenses") {
      leftContent = (
        <div className="flex items-center gap-2.5">
          <Fuel size={20} className="text-blue-600" />
          <h1 className="text-2xl font-bold text-slate-800">Fuel Entry</h1>
        </div>
      );
    } else {
      let title = pageTitles[currentPath] || "";
      // Fallback for any dashboard-like path
      if (isDashboardPage && !title) {
        title = "Operations Dashboard";
      }

      if (title) {
        // 🔥 For dashboard, put title on the LEFT side (same as other pages)
        leftContent = <h2 className="text-xl font-semibold text-slate-800">{title}</h2>;
        // No rightContent for dashboard anymore
      }
    }
  }

  return (
    <header className="h-16 bg-white border-b border-slate-200 shadow-sm flex items-center justify-between px-6">
      <div className="flex-1 flex items-center gap-6">{leftContent}</div>
      <div className="flex items-center gap-6">
        <button className="text-slate-600 hover:text-green-700 text-xl">🔔</button>
        {rightContent}
        {userProfile}
      </div>
    </header>
  );
}

export default Header;