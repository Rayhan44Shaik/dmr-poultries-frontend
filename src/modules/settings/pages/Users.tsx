import React from "react";
import { Pencil, Trash2 } from "lucide-react";
import { getUsers } from "../services";

export default function Users() {
  const users = getUsers();
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between border-b border-slate-100 pb-4">
        <div><h3 className="text-base font-bold text-slate-800">User Management</h3><p className="text-xs text-slate-400 mt-0.5">Add and manage system users</p></div>
        <button className="text-xs font-medium text-[#6c5ce7] border border-[#6c5ce7]/30 bg-[#f3f4ff] hover:bg-[#6c5ce7] hover:text-white px-3 py-1.5 rounded-full transition-colors">+ Add User</button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead className="text-[10px] font-bold text-slate-500 uppercase bg-slate-50 border-b border-slate-100">
            <tr><th className="py-2 px-3 w-8">#</th><th className="py-2 px-3">Name</th><th className="py-2 px-3">Username</th><th className="py-2 px-3">Role</th><th className="py-2 px-3 text-center">Status</th><th className="py-2 px-3 text-center">Actions</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((u) => (
              <tr key={u.id}>
                <td className="py-3 px-3 text-center">{u.id}</td>
                <td className="py-3 px-3 font-medium">{u.name}</td>
                <td className="py-3 px-3">{u.username}</td>
                <td className="py-3 px-3">{u.role}</td>
                <td className="py-3 px-3 text-center"><span className="inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Active</span></td>
                <td className="py-3 px-3 text-center flex justify-center gap-2">
                  <button className="text-[#6c5ce7] hover:text-[#5a4bd1]"><Pencil size={14} /></button>
                  <button className="text-rose-500 hover:text-rose-700"><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex justify-end pt-2">
        <div className="flex items-center gap-1 border border-slate-200 rounded-lg p-1 bg-slate-50">
          <button className="w-7 h-7 rounded bg-[#6c5ce7] text-white text-xs font-bold flex items-center justify-center shadow-sm">1</button>
          <button className="w-7 h-7 rounded hover:bg-slate-200 text-slate-600 text-xs font-bold flex items-center justify-center">2</button>
          <button className="w-7 h-7 rounded hover:bg-slate-200 text-slate-600 text-xs font-bold flex items-center justify-center">3</button>
        </div>
      </div>
    </div>
  );
}