import { useMemo, useState } from "react";
import { Shield, Info, RotateCcw, Save, CheckCircle2 } from "lucide-react";
import { useNotification } from "../../../providers/NotificationProvider";
import { SETTINGS_MODULES, PERMISSION_ACTIONS, ROLE_NAMES } from "../constants";
import {
  loadStoredPermissions,
  saveStoredPermissions,
} from "../storage/settingsStorage";
import type { ModulePermissions, RolePermissions, PermissionAction } from "../types";

function emptyModule(): ModulePermissions {
  return { view: false, add: false, edit: false, delete: false, approve: false, export: false };
}

/** Conservative default: everything off except View on non-sensitive modules. */
function defaultRolePermissions(): RolePermissions {
  const modules: Record<string, ModulePermissions> = {};
  for (const m of SETTINGS_MODULES) {
    modules[m] = m === "Settings" ? emptyModule() : { ...emptyModule(), view: true };
  }
  return { modules };
}

function permissionsFromStored(role: string): RolePermissions {
  const stored = loadStoredPermissions();
  const existing = stored[role];
  if (existing && existing.modules) return existing;
  return defaultRolePermissions();
}

export default function PermissionsTab() {
  const notify = useNotification();
  const [role, setRole] = useState<string>(ROLE_NAMES[0]);
  const [perms, setPerms] = useState<RolePermissions>(() => permissionsFromStored(ROLE_NAMES[0]));
  const [savedPerms, setSavedPerms] = useState<RolePermissions>(() => permissionsFromStored(ROLE_NAMES[0]));

  const allModulesEnabled = useMemo(
    () =>
      SETTINGS_MODULES.every((m) => {
        const p = perms.modules[m];
        return p && PERMISSION_ACTIONS.every((a) => p[a.key] === true);
      }),
    [perms]
  );

  const hasChanges = useMemo(
    () => JSON.stringify(perms) !== JSON.stringify(savedPerms),
    [perms, savedPerms]
  );

  const handleRoleChange = (nextRole: string) => {
    setRole(nextRole);
    const next = permissionsFromStored(nextRole);
    setPerms(next);
    setSavedPerms(next);
  };

  const toggleAction = (module: string, action: PermissionAction) => {
    setPerms((prev) => {
      const cur = prev.modules[module] ?? emptyModule();
      return {
        ...prev,
        modules: {
          ...prev.modules,
          [module]: { ...cur, [action]: !cur[action] },
        },
      };
    });
  };

  const setModuleAll = (module: string, value: boolean) => {
    setPerms((prev) => {
      const cur = prev.modules[module] ?? emptyModule();
      const next: ModulePermissions = {
        view: value,
        add: value,
        edit: value,
        delete: value,
        approve: value,
        export: value,
      };
      // Never grant "Modify" (add/edit/delete/approve) on Settings, regardless of Select All,
      // to avoid accidentally exposing dangerous defaults.
      if (module === "Settings" && value) {
        next.add = false;
        next.delete = value;
      }
      return { ...prev, modules: { ...prev.modules, [module]: { ...cur, ...next } } };
    });
  };

  const selectAll = () => {
    // Grant everything on non-Settings modules; keep Settings limited so the
    // "Select All" shortcut cannot expose dangerous default permissions.
    const modules: Record<string, ModulePermissions> = {};
    for (const m of SETTINGS_MODULES) {
      if (m === "Settings") {
        modules[m] = { ...emptyModule(), view: true };
      } else {
        modules[m] = { view: true, add: true, edit: true, delete: true, approve: true, export: true };
      }
    }
    setPerms({ modules });
  };

  const clearAll = () => {
    const modules: Record<string, ModulePermissions> = {};
    for (const m of SETTINGS_MODULES) modules[m] = emptyModule();
    setPerms({ modules });
  };

  const handleSave = () => {
    const stored = loadStoredPermissions();
    stored[role] = perms;
    saveStoredPermissions(stored);
    setSavedPerms(perms);
    notify.showNotification(
      `Permissions saved for ${role} (frontend config). Backend enforcement requires authorization.`,
      "success"
    );
  };

  const handleReset = () => {
    setPerms(savedPerms);
    notify.showNotification("Permissions reset to last saved values.", "info");
  };

  const moduleSelectionState = (module: string): "none" | "partial" | "all" => {
    const p = perms.modules[module];
    if (!p) return "none";
    const all = PERMISSION_ACTIONS.every((a) => p[a.key]);
    const any = PERMISSION_ACTIONS.some((a) => p[a.key]);
    if (all) return "all";
    if (any) return "partial";
    return "none";
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Header row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Shield size={16} className="text-indigo-500" />
          <span>Role</span>
          <select
            value={role}
            onChange={(e) => handleRoleChange(e.target.value)}
            className="ml-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            aria-label="Select role"
          >
            {ROLE_NAMES.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={hasChanges ? undefined : allModulesEnabled ? clearAll : selectAll}
            disabled={hasChanges}
            className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-40"
          >
            {hasChanges ? "Save changes first" : allModulesEnabled ? "Clear All" : "Select All"}
          </button>
          {hasChanges && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
              <Info size={12} /> Unsaved changes
            </span>
          )}
        </div>
      </div>

      {/* Matrix */}
      <div className="overflow-x-auto border border-slate-100 rounded-xl">
        <table className="w-full text-xs text-left min-w-[720px]">
          <thead className="text-[10px] font-bold text-slate-500 uppercase bg-slate-50/80 border-b border-slate-100">
            <tr>
              <th className="py-2.5 px-3 w-44">Module</th>
              {PERMISSION_ACTIONS.map((a) => (
                <th key={a.key} className="py-2.5 px-3 text-center">{a.label}</th>
              ))}
              <th className="py-2.5 px-3 text-center w-20">All</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {SETTINGS_MODULES.map((module) => {
              const p = perms.modules[module] ?? emptyModule();
              const state = moduleSelectionState(module);
              return (
                <tr key={module} className="hover:bg-slate-50/50">
                  <td className="py-2.5 px-3 font-semibold text-slate-800">
                    {module}
                    {module === "Settings" && (
                      <span className="ml-1.5 text-[9px] uppercase text-slate-400">limited</span>
                    )}
                  </td>
                  {PERMISSION_ACTIONS.map((a) => (
                    <td key={a.key} className="py-2.5 px-3 text-center">
                      <input
                        type="checkbox"
                        checked={p[a.key]}
                        onChange={() => toggleAction(module, a.key)}
                        aria-label={`${a.label} ${module}`}
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 accent-blue-600"
                      />
                    </td>
                  ))}
                  <td className="py-2.5 px-3 text-center">
                    <button
                      type="button"
                      onClick={() => setModuleAll(module, state !== "all")}
                      aria-label={`Toggle all ${module}`}
                      className="w-4 h-4 mx-auto flex items-center justify-center"
                    >
                      <span
                        className={
                          "inline-flex items-center justify-center w-4 h-4 rounded border text-white " +
                          (state === "all"
                            ? "bg-blue-600 border-blue-600"
                            : state === "partial"
                            ? "bg-blue-400 border-blue-400"
                            : "bg-white border-slate-300")
                        }
                      >
                        {state === "all" && <CheckCircle2 size={12} />}
                        {state === "partial" && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </span>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-start gap-2 p-3 bg-indigo-50/60 border border-indigo-100 text-indigo-800 rounded-xl text-xs">
        <Info size={16} className="text-indigo-500 shrink-0 mt-0.5" />
        <span>
          This is frontend configuration only — these permission checks are not enforced by backend
          authentication yet. "Settings" modifications are intentionally limited by default to avoid
          exposing dangerous permissions.
        </span>
      </div>

      {/* Actions */}
      <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
        <button
          type="button"
          onClick={handleReset}
          disabled={!hasChanges}
          className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-600 hover:bg-slate-50 shadow-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <RotateCcw size={15} /> Reset
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!hasChanges}
          className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow-md transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Save size={15} /> Save Permissions
        </button>
      </div>
    </div>
  );
}
