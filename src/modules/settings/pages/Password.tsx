import React, { useState } from "react";
import { Lock, Eye, EyeOff, CheckCircle2 } from "lucide-react";

export default function Password() {
  const [showPass, setShowPass] = useState({ current: false, new: false, confirm: false });
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between border-b border-slate-100 pb-4">
        <div><h3 className="text-base font-bold text-slate-800">Change Password</h3><p className="text-xs text-slate-400 mt-0.5">Update your account password</p></div>
      </div>
      <div className="flex flex-col md:flex-row gap-6">
        <div className="flex items-center justify-center w-full md:w-1/3 shrink-0 relative text-[#6c5ce7]">
          <Lock size={80} className="opacity-90 drop-shadow-lg" />
          <div className="absolute -right-2 -bottom-2 bg-white rounded-full p-1 shadow-md border border-slate-200"><CheckCircle2 size={28} className="text-emerald-500" /></div>
        </div>
        <div className="flex-1 flex flex-col gap-4">
           <div className="space-y-1"><label className="text-xs font-semibold text-slate-600">Current Password</label><div className="relative"><input type={showPass.current ? "text" : "password"} placeholder="Enter current password" className="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-2 pr-10 text-sm font-medium outline-none focus:border-[#6c5ce7]" /><button onClick={() => setShowPass(p => ({...p, current: !p.current}))} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">{showPass.current ? <EyeOff size={16} /> : <Eye size={16} />}</button></div></div>
           <div className="space-y-1"><label className="text-xs font-semibold text-slate-600">New Password</label><div className="relative"><input type={showPass.new ? "text" : "password"} placeholder="Enter new password" className="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-2 pr-10 text-sm font-medium outline-none focus:border-[#6c5ce7]" /><button onClick={() => setShowPass(p => ({...p, new: !p.new}))} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">{showPass.new ? <EyeOff size={16} /> : <Eye size={16} />}</button></div><div className="mt-2"><div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden"><div className="h-full w-[75%] bg-emerald-500 rounded-full"></div></div><p className="text-[10px] text-emerald-600 font-bold mt-1 text-right">Strong</p></div></div>
           <div className="space-y-1"><label className="text-xs font-semibold text-slate-600">Confirm New Password</label><div className="relative"><input type={showPass.confirm ? "text" : "password"} placeholder="Confirm new password" className="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-2 pr-10 text-sm font-medium outline-none focus:border-[#6c5ce7]" /><button onClick={() => setShowPass(p => ({...p, confirm: !p.confirm}))} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">{showPass.confirm ? <EyeOff size={16} /> : <Eye size={16} />}</button></div></div>
        </div>
      </div>
      <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
        <button className="px-5 py-2 rounded-xl border border-slate-300 bg-white text-sm font-medium text-slate-600 hover:bg-slate-50 transition-all shadow-sm">Cancel</button>
        <button className="px-5 py-2 rounded-xl bg-[#6c5ce7] hover:bg-[#5a4bd1] text-white text-sm font-semibold shadow-md transition-all">Update Password</button>
      </div>
    </div>
  );
}