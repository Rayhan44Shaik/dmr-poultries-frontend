import { useState } from "react";
import { Sun, Moon, Monitor, Check } from "lucide-react";
import { useNotification } from "../../../providers/NotificationProvider";
import { useTheme } from "../../../providers/themeContext";
import type { ThemeMode } from "../../../providers/themeTypes";

interface ThemeOption { id: ThemeMode; label: string; icon: typeof Sun; desc: string }

const OPTIONS: ThemeOption[] = [
  { id: "light", label: "Light", icon: Sun, desc: "Bright interface" },
  { id: "dark", label: "Dark", icon: Moon, desc: "Reduced glare" },
  { id: "system", label: "System", icon: Monitor, desc: "Follow device setting" },
];

export default function AppearanceTab() {
  const { themeMode, setTheme } = useTheme();
  const notify = useNotification();
  // Draft mirrors the live global theme so Cancel restores truthfully.
  const [draft, setDraft] = useState<ThemeMode>(themeMode);
  const hasChanged = draft !== themeMode;

  const handleSelect = (mode: ThemeMode) => setDraft(mode);

  const handleApply = () => {
    setTheme(draft); // applies globally via ThemeProvider (single source of truth)
    notify.showNotification("Theme applied across the application.", "success");
  };

  const handleCancel = () => {
    setDraft(themeMode); // restore from the true global theme
    notify.showNotification("Changes reverted.", "info");
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-slate-600 block">Theme</label>
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
            {themeMode === "system" ? "Following system" : themeMode === "dark" ? "Dark active" : "Light active"}
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const isSelected = draft === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleSelect(opt.id)}
                aria-pressed={isSelected}
                className={"relative rounded-xl border p-4 text-left transition-all " +
                  (isSelected
                    ? "border-blue-600 bg-blue-50/40 shadow-sm ring-1 ring-blue-600/20 dark:bg-slate-700/50 dark:border-blue-500"
                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:hover:border-slate-600")}
              >
                <div className="flex items-center justify-between">
                  <Icon size={20} className={isSelected ? "text-blue-600" : "text-slate-500 dark:text-slate-400"} />
                  {isSelected && (
                    <div className="h-4 w-4 rounded-full bg-blue-600 flex items-center justify-center text-white">
                      <Check size={10} strokeWidth={3} />
                    </div>
                  )}
                </div>
                <p className={"text-xs font-bold mt-2 " + (isSelected ? "text-blue-700 dark:text-blue-300" : "text-slate-800 dark:text-slate-200")}>{opt.label}</p>
                <p className="text-[11px] text-slate-400 dark:text-slate-400 mt-0.5">{opt.desc}</p>
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-slate-400 dark:text-slate-500">
          The selected theme is applied immediately and is remembered across refreshes.
        </p>
      </div>

      <div className="pt-4 border-t border-slate-100 dark:border-slate-700 flex justify-end gap-3">
        <button
          type="button"
          onClick={handleCancel}
          disabled={!hasChanged}
          className="px-5 py-2 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-600 hover:bg-slate-50 shadow-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleApply}
          disabled={!hasChanged}
          className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-md transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Apply Changes
        </button>
      </div>
    </div>
  );
}
