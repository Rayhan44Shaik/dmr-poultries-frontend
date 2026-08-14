import { Info, Cpu, Globe, Layers, CalendarDays } from "lucide-react";

const TECH_STACK = ["React", "TypeScript", "Tailwind CSS", "Express", "PostgreSQL"];

export default function AboutTab() {
  // Do not invent version numbers. Use a real value if provided via env config,
  // otherwise present this clearly as a development build.
  const appVersion = import.meta.env.VITE_APP_VERSION as string | undefined;
  const env = import.meta.env.MODE ?? "development";
  const buildYear = new Date().getFullYear();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-3 pb-2">
        <div className="bg-blue-50 border border-blue-100 p-4 rounded-2xl shadow-inner text-5xl">🐔</div>
        <div className="text-center">
          <h3 className="text-lg font-bold text-slate-900 tracking-tight">DMR Poultries ERP</h3>
          <p className="text-xs text-slate-500 max-w-xs leading-relaxed mt-1">
            A complete ERP solution for poultry farming operations.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className=" rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Layers size={16} className="text-blue-600" />
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Application</h4>
          </div>
          <dl className="space-y-2 text-xs">
            <div className="flex justify-between"><dt className="text-slate-400">Product</dt><dd className="font-medium text-slate-700">DMR Poultries</dd></div>
            <div className="flex justify-between"><dt className="text-slate-400">System</dt><dd className="font-medium text-slate-700">ERP System</dd></div>
            <div className="flex justify-between">
              <dt className="text-slate-400">Version</dt>
              <dd className="font-medium text-slate-700">{appVersion || "Development build"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-400">Environment</dt>
              <dd className="font-medium text-slate-700 capitalize">{env}</dd>
            </div>
          </dl>
        </div>

        <div className=" rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Cpu size={16} className="text-indigo-600" />
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Technology</h4>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {TECH_STACK.map((t) => (
              <span
                key={t}
                className="inline-flex items-center rounded-md bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600"
              >
                {t}
              </span>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 p-4 sm:col-span-2">
          <div className="flex items-center gap-2 mb-3">
            <Info size={16} className="text-emerald-600" />
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide">About</h4>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            This is the DMR Poultries ERP — a poultry farm management system covering masters, operations,
            accounts, fleet, staff, reports, and settings. Data in the Settings module is managed on the
            frontend and persisted locally until the backend services are connected.
          </p>
        </div>
      </div>

      <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <Globe size={14} /> © {buildYear} DMR Poultries. All rights reserved.
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <CalendarDays size={14} /> ERP System
        </div>
      </div>
    </div>
  );
}
