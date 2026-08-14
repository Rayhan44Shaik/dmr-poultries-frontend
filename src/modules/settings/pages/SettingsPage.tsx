// src/modules/settings/pages/SettingsPage.tsx

import React from "react";
import {
  Construction,
  Settings,
  ShieldCheck,
  Sparkles,
  ArrowRight,
} from "lucide-react";

function SettingsPage() {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-120px)] w-full max-w-[1480px] items-center justify-center px-4 py-10 sm:px-6 lg:px-8">
      <div className="relative w-full max-w-4xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_20px_60px_-20px_rgba(15,23,42,0.18)]">
        {/* Decorative background */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-emerald-100/60 blur-3xl" />
          <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-blue-100/50 blur-3xl" />
        </div>

        <div className="relative px-6 py-12 text-center sm:px-10 sm:py-16 lg:px-16 lg:py-20">
          {/* Icon */}
          <div className="mx-auto mb-7 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-emerald-50 to-teal-100 shadow-inner ring-1 ring-emerald-100">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-md">
              <Settings
                size={30}
                strokeWidth={1.8}
                className="text-emerald-600"
              />
            </div>
          </div>

          {/* Badge */}
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3.5 py-1.5 text-xs font-semibold text-emerald-700">
            <Sparkles size={14} />
            <span>Coming Soon</span>
          </div>

          {/* Heading */}
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Settings & Configuration
          </h1>

          {/* Description */}
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-slate-500 sm:text-base">
            We're building a powerful settings center for DMR Poultries ERP.
            Soon you'll be able to manage system preferences, users, roles,
            permissions, security, and other important configurations from one
            place.
          </p>

          {/* Feature cards */}
          <div className="mx-auto mt-10 grid max-w-3xl grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4 text-left">
              <ShieldCheck
                size={20}
                className="mb-3 text-emerald-600"
              />
              <p className="text-sm font-semibold text-slate-800">
                Security
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Secure system and access controls.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4 text-left">
              <Settings
                size={20}
                className="mb-3 text-blue-600"
              />
              <p className="text-sm font-semibold text-slate-800">
                Preferences
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Configure your ERP experience.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4 text-left">
              <Construction
                size={20}
                className="mb-3 text-violet-600"
              />
              <p className="text-sm font-semibold text-slate-800">
                More Controls
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                More administration tools are coming.
              </p>
            </div>
          </div>

          {/* Status */}
          <div className="mx-auto mt-8 flex w-fit items-center gap-2 rounded-full bg-slate-50 px-4 py-2 text-xs text-slate-500 ring-1 ring-slate-100">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
            Settings module is under development
          </div>

          {/* Bottom hint */}
          <div className="mt-8 flex items-center justify-center gap-2 text-xs font-medium text-slate-400">
            <span>We're working on something useful</span>
            <ArrowRight size={14} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default React.memo(SettingsPage);