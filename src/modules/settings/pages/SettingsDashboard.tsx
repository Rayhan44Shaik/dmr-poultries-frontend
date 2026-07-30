import React from "react";
import { Link } from "react-router-dom";
import { User, Lock, Globe, Sun, Users, Shield, Info } from "lucide-react";

export default function SettingsDashboard() {
  const cards = [
    { icon: User, title: "My Profile", subtitle: "View & update your details", path: "/settings/profile" },
    { icon: Lock, title: "Change Password", subtitle: "Update your account password", path: "/settings/password" },
    { icon: Globe, title: "Language", subtitle: "Select your preferred language", path: "/settings/language" },
    { icon: Sun, title: "Appearance", subtitle: "Choose light or dark theme", path: "/settings/appearance" },
    { icon: Users, title: "User Management", subtitle: "Add and manage system users", path: "/settings/users" },
    { icon: Shield, title: "Permissions", subtitle: "Manage user role permissions", path: "/settings/permissions" },
    { icon: Info, title: "About", subtitle: "View system information", path: "/settings/about" },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Clean Title */}
      <div className="border-b border-slate-100 pb-4">
        <h2 className="text-xl font-bold text-slate-900">Settings Dashboard</h2>
        <p className="text-sm text-slate-500 mt-1">Manage your profile and system preferences</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((item, idx) => (
          <Link
            key={idx}
            to={item.path}
            className="bg-slate-50/50 hover:bg-[#f3f4ff] border border-slate-200/80 rounded-xl p-5 flex flex-col gap-3 hover:shadow-md transition-all group cursor-pointer"
          >
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-white text-[#6c5ce7] flex items-center justify-center shrink-0 shadow-sm">
                <item.icon size={20} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-800">{item.title}</h4>
                <p className="text-xs text-slate-500">{item.subtitle}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}