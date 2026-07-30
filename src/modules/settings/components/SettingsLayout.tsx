import React, { useMemo } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { 
  User, Lock, Globe, Sun, Users, Shield, Info 
} from "lucide-react";

// Tabs matching the exact structure and color pattern of MastersPage
const tabs = [
  { key: "profile", label: "Profile", icon: User, color: "text-blue-600" },
  { key: "password", label: "Password", icon: Lock, color: "text-amber-500" },
  { key: "language", label: "Language", icon: Globe, color: "text-emerald-500" },
  { key: "appearance", label: "Appearance", icon: Sun, color: "text-purple-600" },
  { key: "users", label: "Users", icon: Users, color: "text-indigo-600" },
  { key: "permissions", label: "Permissions", icon: Shield, color: "text-rose-500" },
  { key: "about", label: "About", icon: Info, color: "text-cyan-600" },
];

export default function SettingsLayout() {
  const location = useLocation();
  const navigate = useNavigate();

  // Active tab derived from the current path segment (e.g. /settings/profile)
  const activeTab = useMemo(() => {
    const pathParts = location.pathname.split("/").filter(Boolean);
    return pathParts[1] || "profile";
  }, [location.pathname]);

  const handleTabChange = (tabKey: string) => {
    navigate(`/settings/${tabKey}`);
  };

  return (
    <div className="w-full pt-4 pb-6 space-y-5">
      {/* Tab Bar Container - overflow-y-hidden prevents vertical scroll controls */}
      <div className="bg-white border-y sm:border border-slate-200/90 sm:rounded-xl shadow-sm px-4 sm:px-6 py-1.5 w-full overflow-y-hidden">
        <div 
          className="flex items-center gap-1 overflow-x-auto overflow-y-hidden"
          style={{
            scrollbarWidth: "none", /* Firefox */
            msOverflowStyle: "none", /* IE/Edge */
          }}
        >
          {/* Hide Webkit scrollbars inline */}
          <style>
            {`
              .overflow-x-auto::-webkit-scrollbar {
                display: none;
              }
            `}
          </style>

          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => handleTabChange(tab.key)}
                className={`
                  flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all duration-200 outline-none
                  ${isActive
                    ? "bg-blue-50 text-blue-700 font-semibold"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  }
                `}
              >
                <Icon
                  size={18}
                  className={isActive ? "text-blue-700" : tab.color}
                />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content Area */}
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm p-6 min-h-[500px]">
          <Outlet context={{ activeTab, setActiveTab: handleTabChange }} />
        </div>
      </div>
    </div>
  );
}