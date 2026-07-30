import React from "react";

export default function Language() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between border-b border-slate-100 pb-4">
        <div><h3 className="text-base font-bold text-slate-800">Language Settings</h3><p className="text-xs text-slate-400 mt-0.5">Select your preferred language</p></div>
      </div>
      <div className="flex flex-col md:flex-row gap-6">
        <div className="flex items-center justify-center w-full md:w-1/3"><span className="text-7xl leading-none">🌍</span></div>
        <div className="flex-1 space-y-4">
          <div className="space-y-1"><label className="text-xs font-semibold text-slate-600">Default Language</label><select className="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-2 text-sm font-medium outline-none"><option>English</option><option>Telugu</option></select></div>
          <div className="space-y-1"><label className="text-xs font-semibold text-slate-600">Available Languages</label><div className="flex flex-col gap-1"><label className="flex items-center gap-2 text-sm font-medium text-slate-700"><input type="checkbox" defaultChecked className="w-4 h-4 rounded border-slate-300 text-[#6c5ce7]" /> English</label><label className="flex items-center gap-2 text-sm font-medium text-slate-700"><input type="checkbox" defaultChecked className="w-4 h-4 rounded border-slate-300 text-[#6c5ce7]" /> Français (Telugu)</label><label className="flex items-center gap-2 text-sm font-medium text-slate-700"><input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-[#6c5ce7]" /> தமிழ் (Tamil)</label></div></div>
        </div>
      </div>
      <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
        <button className="px-5 py-2 rounded-xl border border-slate-300 bg-white text-sm font-medium text-slate-600 hover:bg-slate-50 transition-all shadow-sm">Reset</button>
        <button className="px-5 py-2 rounded-xl bg-[#6c5ce7] hover:bg-[#5a4bd1] text-white text-sm font-semibold shadow-md transition-all">Save Language</button>
      </div>
    </div>
  );
}