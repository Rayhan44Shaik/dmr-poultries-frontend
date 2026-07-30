import React from "react";

export default function Permissions() {
  const modules = ["Dashboard", "Operations", "Accounts", "Reports", "Settings"];
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between border-b border-slate-100 pb-4">
        <div><h3 className="text-base font-bold text-slate-800">Permissions Overview</h3><p className="text-xs text-slate-400 mt-0.5">Manage role permissions</p></div>
        <div className="w-28"><label className="text-[10px] font-semibold text-slate-600">Role</label><select className="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-1 text-xs font-medium outline-none"><option>Supervisor</option></select></div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead className="text-[10px] font-bold text-slate-500 uppercase bg-slate-50">
            <tr><th className="py-2 px-2">Module</th><th className="py-2 px-2 text-center">View</th><th className="py-2 px-2 text-center">Add</th><th className="py-2 px-2 text-center">Edit</th><th className="py-2 px-2 text-center">Delete</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {modules.map((mod, i) => (
              <tr key={i}>
                <td className="py-2 px-2 font-medium">{mod}</td>
                {["View","Add","Edit","Delete"].map(p => (
                  <td key={p} className="py-2 px-2 text-center">
                    <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-[#6c5ce7] focus:ring-[#6c5ce7]" defaultChecked={p!=="Add"} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
        <button className="px-5 py-2 rounded-xl border border-slate-300 bg-white text-sm font-medium text-slate-600 hover:bg-slate-50 transition-all shadow-sm">Cancel</button>
        <button className="px-5 py-2 rounded-xl bg-[#6c5ce7] hover:bg-[#5a4bd1] text-white text-sm font-semibold shadow-md transition-all">Save Permissions</button>
      </div>
    </div>
  );
}