// src/modules/settings/pages/SettingsPage.tsx
// Settings hub: left section nav + content panels, URL-synced tabs.

import React, { useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Info,
  KeyRound,
  Lock,
  Palette,
  ShieldCheck,
  UserCog,
  UserRound,
} from "lucide-react";
import ErrorBoundary from "../../../components/common/ErrorBoundary";
import { ProfileCard } from "../components/cards/ProfileCard";
import { PasswordCard } from "../components/cards/PasswordCard";
import { AppearanceCard } from "../components/cards/AppearanceCard";
import { UserManagementCard } from "../components/cards/UserManagementCard";
import { PermissionsCard } from "../components/cards/PermissionsCard";
import { AboutCard } from "../components/cards/AboutCard";

type SettingsTabKey = "profile" | "password" | "appearance" | "users" | "permissions" | "about";

const SECTIONS: { key: SettingsTabKey; label: string; description: string; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
  { key: "profile", label: "Profile", description: "Your personal information", icon: UserRound },
  { key: "password", label: "Password & Security", description: "Sign-in credentials", icon: Lock },
  { key: "appearance", label: "Appearance", description: "Theme and font preferences", icon: Palette },
  { key: "users", label: "Users & Roles", description: "Manage team members", icon: UserCog },
  { key: "permissions", label: "Permissions", description: "Role-based access control", icon: KeyRound },
  { key: "about", label: "About ERP", description: "Version and system info", icon: Info },
];

const PANELS: Record<SettingsTabKey, React.ComponentType> = {
  profile: ProfileCard,
  password: PasswordCard,
  appearance: AppearanceCard,
  users: UserManagementCard,
  permissions: PermissionsCard,
  about: AboutCard,
};

const SettingsPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const activeTab = (searchParams.get("tab") as SettingsTabKey) || "profile";
  const activeKey: SettingsTabKey = PANELS[activeTab] ? activeTab : "profile";

  useEffect(() => {
    if (!searchParams.get("tab")) {
      navigate("/settings?tab=profile", { replace: true });
    }
  }, [location.search, navigate, searchParams]);

  const ActivePanel = PANELS[activeKey];

  return (
    <ErrorBoundary>
      <div className="mx-auto w-full max-w-[1480px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-5 flex items-center gap-2.5 animate-fade-in-up">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300">
            <ShieldCheck size={17} />
          </span>
          <div>
            <h2 className="text-[15px] font-bold tracking-tight text-slate-900 dark:text-white">System Settings</h2>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              {SECTIONS.find((s) => s.key === activeKey)?.description ?? "Configure DMR Poultries ERP"}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
          {/* Section nav */}
          <nav className="flex gap-1 overflow-x-auto pb-1 scrollbar-none lg:sticky lg:top-0 lg:flex-col lg:overflow-visible lg:pb-0">
            {SECTIONS.map((section) => {
              const Icon = section.icon;
              const isActive = activeKey === section.key;
              return (
                <button
                  key={section.key}
                  type="button"
                  onClick={() => navigate(`/settings?tab=${section.key}`)}
                  className={`flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-lg px-3 py-2 text-left text-[13px] transition-colors ${
                    isActive
                      ? "bg-brand-50 font-semibold text-brand-800 dark:bg-brand-500/10 dark:text-brand-300"
                      : "font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-200"
                  }`}
                >
                  <Icon size={16} className={isActive ? "text-brand-700 dark:text-brand-300" : "text-slate-400"} />
                  <span className="flex-1">{section.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Content panel */}
          <div className="min-w-0 animate-fade-in-up" key={activeKey}>
            <ActivePanel />
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default React.memo(SettingsPage);
