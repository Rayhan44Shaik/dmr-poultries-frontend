// src/modules/settings/pages/SettingsPage.tsx
import React, { useState } from "react";
import {
  User, Lock, Globe, Sun, Users, Shield, Info,
} from "lucide-react";
import ProfileTab from "../tabs/ProfileTab";
import PasswordSecurityTab from "../tabs/PasswordSecurityTab";
import LanguageTab from "../tabs/LanguageTab";
import AppearanceTab from "../tabs/AppearanceTab";
import UsersTab from "../tabs/UsersTab";
import PermissionsTab from "../tabs/PermissionsTab";
import AboutTab from "../tabs/AboutTab";

type TabKey = "profile" | "password" | "language" | "appearance" | "users" | "permissions" | "about";

interface TabItem {
  key: TabKey;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color: string;
}

// Tabs matching MastersPage styling with distinct icon colors
const tabs: TabItem[] = [
  { key: "profile", label: "Profile", icon: User, color: "text-blue-600" },
  { key: "password", label: "Password & Security", icon: Lock, color: "text-purple-600" },
  { key: "language", label: "Language", icon: Globe, color: "text-emerald-600" },
  { key: "appearance", label: "Appearance", icon: Sun, color: "text-amber-600" },
  { key: "users", label: "Users", icon: Users, color: "text-orange-600" },
  { key: "permissions", label: "Permissions", icon: Shield, color: "text-indigo-600" },
  { key: "about", label: "About ERP", icon: Info, color: "text-rose-600" },
];

function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("profile");

  const renderContent = () => {
    switch (activeTab) {
      case "profile":
        return <ProfileTab />;
      case "password":
        return <PasswordSecurityTab />;
      case "language":
        return <LanguageTab />;
      case "appearance":
        return <AppearanceTab />;
      case "users":
        return <UsersTab />;
      case "permissions":
        return <PermissionsTab />;
      case "about":
        return <AboutTab />;
      default:
        return null;
    }
  };

  return (
    <div className="w-full pt-4 pb-6 space-y-5">
      {/* Full-width Tab Bar Container touching left & right edges */}
      <div className="bg-white border-y sm:border border-slate-200/90 sm:rounded-xl shadow-sm px-4 sm:px-6 py-1.5 w-full">
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                aria-current={isActive ? "page" : undefined}
                className={`
                  flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all duration-200
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

      {/* Content Area with matching Masters side padding & container styling */}
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="bg-white border border-slate-200/90 sm:rounded-xl shadow-sm p-6 min-h-[450px]">
          <h2 className="text-base font-bold text-slate-800 border-b border-slate-100 pb-3 mb-4">
            {tabs.find((t) => t.key === activeTab)?.label}
          </h2>
          {renderContent()}
        </div>
      </div>
    </div>
  );
}

export default React.memo(SettingsPage);
