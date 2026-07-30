import React from "react";
import { Sun, Moon } from "lucide-react";

export default function Appearance() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between border-b border-slate-100 pb-4">
        <div><h3 className="text-base font-bold text-slate-800">Appearance</h3><p className="text-xs text-slate-400 mt-0.5">Customize how the app looks</p></div>
      </div>
      <div className="space-y-4">
        <div className="space-y-1"><label className="text-xs font-semibold text-slate-600 mb-2 block">Theme</label><div className="flex gap-3"><div className="flex items-center justify-center gap-2 border-2 border-[#6c5ce7] bg-[#6c5ce7]/10 rounded-xl py-3 w-28 cursor-pointer"><Sun size={18} className="text-[#6c5ce7]" /> Light</div><div className="flex items-center justify-center gap-2 border border-slate-200 rounded-xl py-3 w-28 cursor-pointer"><Moon size={18} className="text-slate-500" /> Dark</div></div></div>
        <div className="space-y-1"><label className="text-xs font-semibold text-slate-600 mb-2 block">Font Size</label><div className="flex gap-3 text-xs"><div className="flex-1 text-center border border-slate-200 rounded-xl py-2 cursor-pointer bg-slate-50">Small</div><div className="flex-1 text-center border-2 border-[#6c5ce7] bg-[#6c5ce7]/10 rounded-xl py-2 cursor-pointer font-semibold">Medium</div><div className="flex-1 text-center border border-slate-200 rounded-xl py-2 cursor-pointer">Large</div></div><p className="text-[10px] text-slate-400 mt-2">This will change the font size across the application.</p></div>
        <div className="space-y-1"><label className="text-xs font-semibold text-slate-600 mb-2 block">Color Accent</label><div className="flex gap-3"><div className="h-7 w-7 rounded-full bg-[#6c5ce7] border-2 border-[#6c5ce7] ring-2 ring-[#6c5ce7]/20 cursor-pointer"></div><div className="h-7 w-7 rounded-full bg-emerald-500 border border-slate-200 cursor-pointer"></div><div className="h-7 w-7 rounded-full bg-rose-500 border border-slate-200 cursor-pointer"></div><div className="h-7 w-7 rounded-full bg-amber-500 border border-slate-200 cursor-pointer"></div><div className="h-7 w-7 rounded-full bg-teal-500 border border-slate-200 cursor-pointer"></div></div></div>
      </div>
      <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
        <button className="px-5 py-2 rounded-xl border border-slate-300 bg-white text-sm font-medium text-slate-600 hover:bg-slate-50 transition-all shadow-sm">Reset</button>
        <button className="px-5 py-2 rounded-xl bg-[#6c5ce7] hover:bg-[#5a4bd1] text-white text-sm font-semibold shadow-md transition-all">Apply Changes</button>
      </div>
    </div>
  );
}