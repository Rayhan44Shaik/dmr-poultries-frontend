import React from "react";

export default function About() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between border-b border-slate-100 pb-4">
        <div><h3 className="text-base font-bold text-slate-800">About</h3><p className="text-xs text-slate-400 mt-0.5">System information and details</p></div>
      </div>
      <div className="flex flex-col items-center gap-4 pb-2">
        <div className="bg-white border border-slate-100 p-4 rounded-full shadow-sm text-6xl mt-2">🐔</div>
        <div className="text-center"><h3 className="text-lg font-bold text-indigo-900 tracking-tight">DMR Poultries ERP</h3><p className="text-[10px] text-slate-500 max-w-[240px] leading-relaxed mt-1">A complete ERP solution for poultry farming operations.</p></div>
      </div>
      <div className="space-y-1.5 text-[11px] text-slate-700 border-t border-slate-100 pt-4">
         <div className="flex justify-between"><span className="text-slate-400">Software Version</span><span className="font-medium">1.0.0</span></div>
         <div className="flex justify-between"><span className="text-slate-400">Build Number</span><span className="font-medium">2026.05.28.01</span></div>
         <div className="flex justify-between"><span className="text-slate-400">Database Version</span><span className="font-medium">PostgreSQL 15.3</span></div>
         <div className="flex justify-between"><span className="text-slate-400">Last Update</span><span className="font-medium">28-May-2026</span></div>
         <div className="flex justify-between"><span className="text-slate-400">Developer</span><span className="font-medium">DMR Solutions</span></div>
         <div className="flex justify-between"><span className="text-slate-400">Support Email</span><span className="font-medium text-[#6c5ce7]">support@dmrpoultries.com</span></div>
      </div>
    </div>
  );
}