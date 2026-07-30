import React, { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { 
  User, Lock, CheckCircle2, Eye, EyeOff, 
  Sun, Moon, Pencil, Trash2 
} from "lucide-react";
import { getCurrentUser, getUsers } from "../services";

interface SettingsContextType {
  activeTab: string;
  setActiveTab: (tabKey: string) => void;
}

export default function SettingsPage() {
  const { activeTab, setActiveTab } = useOutletContext<SettingsContextType>();

  const user = getCurrentUser();
  const users = getUsers();
  const [showPass, setShowPass] = useState({ current: false, new: false, confirm: false });

  const renderContent = () => {
    switch (activeTab) {
      case "profile":
        return (
          <div className="flex flex-col gap-6 pt-2">
            <div className="flex flex-col md:flex-row gap-6">
              <div className="flex flex-col items-center gap-3 w-full md:w-32 shrink-0">
                <div className="h-24 w-24 rounded-full bg-slate-100 border-4 border-white shadow-md flex items-center justify-center text-slate-400">
                  <User size={40} />
                </div>
                <button className="border border-slate-200 bg-white hover:bg-slate-50 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 w-full transition-colors shadow-sm">
                  Change Photo
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600">Full Name</label>
                  <div className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm font-medium text-slate-800">{user.name}</div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600">Department</label>
                  <div className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm font-medium text-slate-800">{user.department}</div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600">Email</label>
                  <div className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm font-medium text-slate-800">{user.email}</div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600">Designation</label>
                  <div className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm font-medium text-slate-800">{user.role}</div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600">Mobile Number</label>
                  <div className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm font-medium text-slate-800">{user.mobile}</div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600">Username</label>
                  <div className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm font-medium text-slate-800">rubullaadmin</div>
                </div>
              </div>
            </div>
            <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
              <button onClick={() => setActiveTab("profile")} className="px-5 py-2 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-600 hover:bg-slate-50 shadow-sm transition-colors">
                Cancel
              </button>
              <button className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-md transition-all">
                Save Changes
              </button>
            </div>
          </div>
        );

      case "password":
        return (
          <div className="flex flex-col gap-6 pt-2">
            <div className="flex flex-col md:flex-row gap-6">
              <div className="flex items-center justify-center w-full md:w-1/3 shrink-0 relative text-blue-600 py-6">
                <Lock size={80} className="opacity-90 drop-shadow-sm" />
                <div className="absolute right-12 bottom-4 bg-white rounded-full p-1 shadow-md border border-slate-100">
                  <CheckCircle2 size={24} className="text-emerald-500" />
                </div>
              </div>
              <div className="flex-1 flex flex-col gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600">Current Password</label>
                  <div className="relative">
                    <input type={showPass.current ? "text" : "password"} placeholder="Enter current password" className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 pr-10 text-sm font-medium outline-none focus:border-blue-500 focus:bg-white transition-all" />
                    <button onClick={() => setShowPass(p => ({...p, current: !p.current}))} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      {showPass.current ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600">New Password</label>
                  <div className="relative">
                    <input type={showPass.new ? "text" : "password"} placeholder="Enter new password" className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 pr-10 text-sm font-medium outline-none focus:border-blue-500 focus:bg-white transition-all" />
                    <button onClick={() => setShowPass(p => ({...p, new: !p.new}))} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      {showPass.new ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600">Confirm New Password</label>
                  <div className="relative">
                    <input type={showPass.confirm ? "text" : "password"} placeholder="Confirm new password" className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 pr-10 text-sm font-medium outline-none focus:border-blue-500 focus:bg-white transition-all" />
                    <button onClick={() => setShowPass(p => ({...p, confirm: !p.confirm}))} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      {showPass.confirm ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
              <button onClick={() => setActiveTab("profile")} className="px-5 py-2 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-600 hover:bg-slate-50 shadow-sm transition-colors">
                Cancel
              </button>
              <button className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-md transition-all">
                Update Password
              </button>
            </div>
          </div>
        );

      case "language":
        return (
          <div className="flex flex-col gap-6 pt-2">
            <div className="flex flex-col md:flex-row gap-6">
              <div className="flex items-center justify-center w-full md:w-1/3 py-4"><span className="text-6xl">🌍</span></div>
              <div className="flex-1 space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600">Default Language</label>
                  <select className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-sm font-medium outline-none focus:border-blue-500 focus:bg-white">
                    <option>English</option>
                    <option>Telugu</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
              <button onClick={() => setActiveTab("profile")} className="px-5 py-2 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-600 hover:bg-slate-50 shadow-sm transition-colors">
                Cancel
              </button>
              <button className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-md transition-all">
                Save Language
              </button>
            </div>
          </div>
        );

      case "appearance":
        return (
          <div className="flex flex-col gap-6 pt-2">
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600 mb-2 block">Theme</label>
                <div className="flex gap-3">
                  <div className="flex items-center justify-center gap-2 border-2 border-blue-600 bg-blue-50/50 rounded-xl py-2.5 px-4 w-32 cursor-pointer font-medium text-blue-700 text-sm">
                    <Sun size={18} className="text-blue-600" /> Light
                  </div>
                  <div className="flex items-center justify-center gap-2 border border-slate-200 rounded-xl py-2.5 px-4 w-32 cursor-pointer font-medium text-slate-600 text-sm hover:bg-slate-50">
                    <Moon size={18} className="text-slate-500" /> Dark
                  </div>
                </div>
              </div>
            </div>
            <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
              <button onClick={() => setActiveTab("profile")} className="px-5 py-2 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-600 hover:bg-slate-50 shadow-sm transition-colors">
                Cancel
              </button>
              <button className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-md transition-all">
                Apply Changes
              </button>
            </div>
          </div>
        );

      case "users":
        return (
          <div className="flex flex-col gap-6 pt-2">
            <div className="flex justify-end">
              <button className="text-xs font-semibold text-blue-600 border border-blue-200 bg-blue-50 hover:bg-blue-600 hover:text-white px-4 py-2 rounded-lg transition-all shadow-sm">
                + Add User
              </button>
            </div>
            <div className="overflow-x-auto border border-slate-100 rounded-xl">
              <table className="w-full text-xs text-left">
                <thead className="text-[10px] font-bold text-slate-500 uppercase bg-slate-50/80 border-b border-slate-100">
                  <tr>
                    <th className="py-2.5 px-3 w-8">#</th>
                    <th className="py-2.5 px-3">Name</th>
                    <th className="py-2.5 px-3">Username</th>
                    <th className="py-2.5 px-3">Role</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((u: any) => (
                    <tr key={u.id} className="hover:bg-slate-50/50">
                      <td className="py-3 px-3 text-center text-slate-500">{u.id}</td>
                      <td className="py-3 px-3 font-semibold text-slate-800">{u.name}</td>
                      <td className="py-3 px-3 text-slate-600">{u.username}</td>
                      <td className="py-3 px-3 text-slate-600">{u.role}</td>
                      <td className="py-3 px-3 text-center">
                        <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-semibold px-2.5 py-0.5 rounded-full">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Active
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center flex justify-center gap-2">
                        <button className="text-blue-600 hover:text-blue-800 p-1 rounded"><Pencil size={14} /></button>
                        <button className="text-rose-500 hover:text-rose-700 p-1 rounded"><Trash2 size={14} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );

      case "permissions":
        return (
          <div className="flex flex-col gap-6 pt-2">
            <div className="overflow-x-auto border border-slate-100 rounded-xl">
              <table className="w-full text-xs text-left">
                <thead className="text-[10px] font-bold text-slate-500 uppercase bg-slate-50/80 border-b border-slate-100">
                  <tr>
                    <th className="py-2.5 px-3">Module</th>
                    <th className="py-2.5 px-3 text-center">View</th>
                    <th className="py-2.5 px-3 text-center">Add</th>
                    <th className="py-2.5 px-3 text-center">Edit</th>
                    <th className="py-2.5 px-3 text-center">Delete</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {["Dashboard", "Operations", "Accounts", "Reports", "Settings"].map((mod, i) => (
                    <tr key={i} className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-3 font-semibold text-slate-800">{mod}</td>
                      {["View", "Add", "Edit", "Delete"].map(p => (
                        <td key={p} className="py-2.5 px-3 text-center">
                          <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" defaultChecked={p !== "Add"} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );

      case "about":
        return (
          <div className="flex flex-col gap-6 pt-2">
            <div className="flex flex-col items-center gap-3 pb-2">
              <div className="bg-blue-50 border border-blue-100 p-4 rounded-2xl shadow-inner text-5xl">🐔</div>
              <div className="text-center">
                <h3 className="text-lg font-bold text-slate-900 tracking-tight">DMR Poultries ERP</h3>
                <p className="text-xs text-slate-500 max-w-xs leading-relaxed mt-1">A complete ERP solution for poultry farming operations.</p>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return renderContent();
}