// src/modules/settings/pages/SettingsPage.tsx
// Settings hub: routes to available settings pages.

import React, { useMemo } from "react";
import { useLocation } from "react-router-dom";

import Profile from "./Profile_copy";
import Language from "./Language";
import Appearance from "./Appearance";
import About from "./About";

const settingsTabs: Record<string, React.ComponentType<{ embedded?: boolean }>> = {
  profile: Profile,
  language: Language,
  appearance: Appearance,
  about: About,
};

const SETTINGS_LABELS: Record<string, string> = {
  profile: "Profile",
  language: "Language",
  appearance: "Appearance",
  about: "About",
};

const SettingsPage = () => {
  const location = useLocation();

  const activeTab = useMemo(() => {
    const searchParams = new URLSearchParams(location.search);
    return searchParams.get("tab") || "profile";
  }, [location.search]);

  const ActiveComponent = useMemo(() => {
    return settingsTabs[activeTab] ?? Profile;
  }, [activeTab]);

  const tabs = [
    { key: "profile", label: SETTINGS_LABELS.profile },
    { key: "language", label: SETTINGS_LABELS.language },
    { key: "appearance", label: SETTINGS_LABELS.appearance },
    { key: "about", label: SETTINGS_LABELS.about },
  ];

  return (
    <div className="w-full px-4 pb-12 pt-8 sm:px-6 sm:pt-10 lg:px-8">
      <div className="mx-auto w-full max-w-[1480px]">
        {/* Tabs */}
        <div className="mb-6 flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                const params = new URLSearchParams(location.search);
                params.set("tab", tab.key);
                window.history.pushState({}, "", `${location.pathname}?${params.toString()}`);
                window.dispatchEvent(new Event("popstate"));
              }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 sm:p-8">
          <ActiveComponent embedded />
        </div>
      </div>
    </div>
  );
};

export default React.memo(SettingsPage);
