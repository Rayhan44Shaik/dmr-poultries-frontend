// src/modules/settings/pages/SettingsPage.tsx
// TEMPORARY PLACEHOLDER — Settings is being developed later, after the main
// ERP modules are finalized. No tabs, forms, or functionality yet.

import React from "react";
import { Construction } from "lucide-react";

function SettingsPage() {
  return (
    <div className="flex min-h-[70vh] w-full items-center justify-center px-4 py-10">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-200/90 bg-white p-10 text-center shadow-sm">
        <div className="mx-auto mb-5 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50">
          <Construction size={32} className="text-blue-600" />
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Settings - Coming Soon
        </h1>

        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-slate-500">
          This module is currently being enhanced and will be made fully
          available after the upcoming updates.
        </p>
      </div>
    </div>
  );
}

export default React.memo(SettingsPage);
