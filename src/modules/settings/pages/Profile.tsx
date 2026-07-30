import React from "react";
import { User } from "lucide-react";
import { getCurrentUser } from "../services";

export default function Profile() {
  const user = getCurrentUser();
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between border-b border-slate-100 pb-4">
        <div><h3 className="text-base font-bold text-slate-800">My Profile</h3><p className="text-xs text-slate-400 mt-0.5">View and update your personal details</p></div>
      </div>
      <div className="flex flex-col md:flex-row gap-6">
        <div className="flex flex-col items-center gap-3 w-full md:w-32 shrink-0">
          <div className="h-24 w-24 rounded-full bg-slate-100 border-4 border-white shadow-inner flex items-center justify-center text-slate-400"><User size={40} /></div>
          <button className="border border-slate-200 bg-white hover:bg-slate-50 px-4 py-1.5 rounded-full text-xs font-medium text-slate-600 w-full transition-colors">Change Photo</button>
          <span className="text-[9px] text-slate-400 text-center">JPG, PNG (Max 5MB)</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1">
          <div className="space-y-1"><label className="text-xs font-semibold text-slate-600">Full Name</label><div className="w-full rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700">Rubulla</div></div>
          <div className="space-y-1"><label className="text-xs font-semibold text-slate-600">Department</label><div className="w-full rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700">Administration</div></div>
          <div className="space-y-1"><label className="text-xs font-semibold text-slate-600">Email</label><div className="w-full rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700">info@dmrpoultri</div></div>
          <div className="space-y-1"><label className="text-xs font-semibold text-slate-600">Designation</label><div className="w-full rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700">Owner</div></div>
          <div className="space-y-1"><label className="text-xs font-semibold text-slate-600">Mobile Number</label><div className="w-full rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700">+91 9122456789</div></div>
          <div className="space-y-1"><label className="text-xs font-semibold text-slate-600">Username</label><div className="w-full rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700">rubullaadmin</div></div>
          <div className="space-y-1"><label className="text-xs font-semibold text-slate-600">Employee ID</label><div className="w-full rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700">DMR001</div></div>
          <div className="space-y-1"><label className="text-xs font-semibold text-slate-600">Date Joined</label><div className="w-full rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700">01-Jan-2020</div></div>
        </div>
      </div>
      <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
        <button className="px-5 py-2 rounded-xl border border-slate-300 bg-white text-sm font-medium text-slate-600 hover:bg-slate-50 transition-all shadow-sm">Cancel</button>
        <button className="px-5 py-2 rounded-xl bg-[#6c5ce7] hover:bg-[#5a4bd1] text-white text-sm font-semibold shadow-md transition-all">Save Changes</button>
      </div>
    </div>
  );
}