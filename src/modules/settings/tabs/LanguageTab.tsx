import { useState } from "react";
import { Check, Globe } from "lucide-react";
import { useNotification } from "../../../providers/NotificationProvider";
import { useLanguage } from "../../../providers/LanguageProvider";
import { LANGUAGES } from "../constants";

export default function LanguageTab() {
  const { locale, setLocale, t } = useLanguage();
  const notify = useNotification();
  // Draft mirrors the live global language so Cancel can restore it truthfully.
  const [selected, setSelected] = useState<string>(locale);
  const hasChanged = selected !== locale;

  const handleSelect = (id: string) => setSelected(id);

  const handleSave = () => {
    const next = selected === "te" ? "te" : "en";
    setLocale(next); // apply globally (persists via LanguageProvider)
    notify.showNotification(
      next === "te"
        ? "Telugu preference applied globally. Full module translation can be enabled when the translation catalog is available."
        : "English is now the active application language.",
      "success"
    );
  };

  const handleCancel = () => {
    setSelected(locale); // restore from the true global language
    notify.showNotification("Changes reverted.", "info");
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col md:flex-row gap-6">
        <div className="flex items-center justify-center w-full md:w-1/3 py-4">
          <span className="text-6xl">🌍</span>
        </div>

        <div className="flex-1 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-600 block">
                {t("settings.language")}
              </label>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                <Globe size={12} /> {locale === "te" ? "తెలుగు" : "English"} active
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {LANGUAGES.map((lang) => {
                const isSelected = selected === lang.id;
                return (
                  <button
                    key={lang.id}
                    type="button"
                    onClick={() => handleSelect(lang.id)}
                    aria-pressed={isSelected}
                    className={"relative p-3.5 rounded-xl border text-left transition-all flex items-start gap-3 " +
                      (isSelected
                        ? "border-emerald-600 bg-emerald-50/40 shadow-sm ring-1 ring-emerald-600/20"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50")}
                  >
                    <span className="text-2xl select-none leading-none pt-0.5">{lang.flag}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-slate-800">{lang.name}</p>
                        {isSelected && (
                          <div className="h-4 w-4 rounded-full bg-emerald-600 flex items-center justify-center text-white">
                            <Check size={10} strokeWidth={3} />
                          </div>
                        )}
                      </div>
                      <p className="text-[11px] font-medium text-slate-500 mt-0.5">{lang.nativeName}</p>
                      <span className="inline-block text-[10px] text-slate-400 mt-1">{lang.region}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-start gap-2 p-3 bg-indigo-50/60 border border-indigo-100 text-indigo-800 rounded-xl text-xs">
            <Globe size={16} className="text-indigo-500 shrink-0 mt-0.5" />
            <span>
              The selected language drives the global application chrome, sidebar, and Settings page now.
              Other ERP modules remain English until their translation catalogs are shipped.
            </span>
          </div>
        </div>
      </div>

      <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
        <button
          type="button"
          onClick={handleCancel}
          disabled={!hasChanged}
          className="px-5 py-2 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-600 hover:bg-slate-50 shadow-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!hasChanged}
          className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-md transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Save Language
        </button>
      </div>
    </div>
  );
}
