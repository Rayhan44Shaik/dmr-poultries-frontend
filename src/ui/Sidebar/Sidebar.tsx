import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";

import {
  LayoutDashboard,
  Database,
  Truck,
  ReceiptIndianRupee,
  Car,
  Users,
  FileText,
  Settings,
  ChevronDown,
  ChevronRight,
  Building2
} from "lucide-react";

interface MenuItem {
  title: string;
  icon: React.ReactNode;
  children?: {
    title: string;
    path: string;
  }[];
  path?: string;
}

export default function Sidebar() {
  const location = useLocation();
  const prevPathname = useRef(location.pathname);

  const [openOperations, setOpenOperations] = useState(
    location.pathname.startsWith("/operations")
  );

  // Auto‑close when navigating away from /operations
  useEffect(() => {
    const current = location.pathname;
    const prev = prevPathname.current;

    const wasInOperations = prev.startsWith("/operations");
    const isInOperations = current.startsWith("/operations");

    if (wasInOperations && !isInOperations) {
      setOpenOperations(false);
    }
    if (!wasInOperations && isInOperations) {
      setOpenOperations(true);
    }

    prevPathname.current = current;
  }, [location.pathname]);

  const menu: MenuItem[] = [
    {
      title: "Dashboard",
      icon: <LayoutDashboard size={18} />,
      path: "/dashboard"
    },
    {
      title: "Masters",
      icon: <Database size={18} />,
      path: "/masters"
    },
    {
      title: "Operations",
      icon: <Truck size={18} />,
      children: [
        { title: "Vehicle Trips", path: "/operations/vehicle-trips/entry" }, // ✅ changed to Entry
        { title: "Sales", path: "/operations/shop-sales" },
        { title: "Collection", path: "/operations/collections/entry" },
        { title: "Fuel Expenses", path: "/operations/fuel-expenses" },
      ]
    },
    {
      title: "Accounts",
      icon: <ReceiptIndianRupee size={18} />,
      path: "/accounts"
    },
    {
      title: "Vehicles",
      icon: <Car size={18} />,
      path: "/vehicles"
    },
    {
      title: "Staff",
      icon: <Users size={18} />,
      path: "/staff"
    },
    {
      title: "Reports",
      icon: <FileText size={18} />,
      path: "/reports"
    },
    {
      title: "Settings",
      icon: <Settings size={18} />,
      path: "/settings"
    }
  ];

  return (
    <aside className="flex h-screen w-72 flex-col border-r border-slate-200 bg-white">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b border-slate-200 px-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-white">
          <Building2 size={22} />
        </div>
        <div>
          <h1 className="text-lg font-bold text-slate-800">DMR Poultries</h1>
          <p className="text-xs text-slate-500">ERP System</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {/* Dashboard */}
        <Link
          to="/dashboard"
          className={`mb-2 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
            location.pathname === "/dashboard"
              ? "bg-blue-600 text-white"
              : "text-slate-700 hover:bg-slate-100"
          }`}
        >
          <LayoutDashboard size={18} />
          Dashboard
        </Link>

        {/* Masters */}
        <Link
          to="/masters"
          className={`mb-2 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
            location.pathname === "/masters"
              ? "bg-blue-600 text-white"
              : "text-slate-700 hover:bg-slate-100"
          }`}
        >
          <Database size={18} />
          Masters
        </Link>

        {/* Operations – toggle button */}
        <button
          type="button"
          onClick={() => setOpenOperations(!openOperations)}
          className="mb-1 flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"
        >
          <div className="flex items-center gap-3">
            <Truck size={18} />
            Operations
          </div>
          {openOperations ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>

        {/* Children */}
        {openOperations && (
          <div className="ml-5 border-l border-slate-200 pl-3">
            {menu[2].children?.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`mb-1 flex rounded-md px-3 py-2 text-sm transition ${
                  location.pathname === item.path
                    ? "bg-blue-50 font-semibold text-blue-700"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {item.title}
              </Link>
            ))}
          </div>
        )}

        {/* Main Menu */}
        <div className="mt-4 space-y-1">
          {menu.slice(3).map((item) => (
            <Link
              key={item.title}
              to={item.path ?? "#"}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                location.pathname === item.path
                  ? "bg-blue-600 text-white"
                  : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              {item.icon}
              <span>{item.title}</span>
            </Link>
          ))}
        </div>
      </nav>
    </aside>
  );
}