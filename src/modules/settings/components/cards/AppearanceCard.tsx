import { Check, Moon, Sun } from "lucide-react";
import { useI18n } from "../../../../i18n";
import { useFontScale } from "../../../../providers/fontScaleContext";
import { useTheme } from "../../../../providers/ThemeProvider";
import { SHOW_THEME_CONTROLS } from "../../../../providers/themeControls";
import FontScalePicker from "../../../../ui/Header/FontScalePicker";
import { Button, Card } from "../common";

export function AppearanceCard() {
  const { t } = useI18n();
  const { setScale } = useFontScale();
  const { theme, toggleTheme } = useTheme();

  return (
    <Card className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 pb-4">
        <div>
          <h3 className="text-base font-bold text-slate-800">{t("settings.appearance")}</h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">{t("fontScale.settingsDescription")}</p>
        </div>
        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
          {t("fontScale.savedAutomatically")}
        </span>
      </div>

      {SHOW_THEME_CONTROLS ? (
        <div>
          <label className="mb-2 block text-xs font-semibold text-slate-600">{t("settings.theme")}</label>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => theme === "dark" && toggleTheme()}
              className={`relative flex min-h-10 min-w-28 items-center justify-center gap-2 rounded-lg border px-3 text-xs font-semibold transition-colors ${
                theme === "light"
                  ? "border-brand-600 bg-brand-50 text-brand-800"
                  : "border-slate-200 text-slate-500 hover:border-slate-300"
              }`}
            >
              <Sun size={15} /> {t("settings.light_mode")}
              {theme === "light" ? <Check size={13} className="absolute right-2 top-2 text-brand-600" /> : null}
            </button>
            <button
              type="button"
              onClick={() => theme === "light" && toggleTheme()}
              className={`relative flex min-h-10 min-w-28 items-center justify-center gap-2 rounded-lg border px-3 text-xs font-semibold transition-colors ${
                theme === "dark"
                  ? "border-brand-600 bg-brand-50 text-brand-800 dark:bg-brand-500/10 dark:text-brand-300"
                  : "border-slate-200 text-slate-500 hover:border-slate-300"
              }`}
            >
              <Moon size={15} /> {t("settings.dark_mode")}
              {theme === "dark" ? <Check size={13} className="absolute right-2 top-2 text-brand-600 dark:text-brand-300" /> : null}
            </button>
          </div>
        </div>
      ) : null}

      <section aria-labelledby="settings-font-scale-title" className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 sm:p-5">
        <FontScalePicker labelId="settings-font-scale-title" />
        <p className="mt-3 text-[11px] leading-relaxed text-slate-400">{t("fontScale.settingsHint")}</p>
      </section>

      <div>
        <label className="mb-2 block text-xs font-semibold text-slate-600">{t("fontScale.brandAccent")}</label>
        <div className="flex gap-3">
          <div className="h-7 w-7 rounded-full bg-brand-600 ring-2 ring-brand-600/30" title="DMR Emerald" />
          <div className="h-7 w-7 rounded-full border border-slate-200 bg-slate-100" title={t("fontScale.moreAccentsSoon")} />
        </div>
      </div>

      <div className="flex justify-end border-t border-slate-100 pt-4">
        <Button variant="secondary" onClick={() => setScale(1)}>
          {t("common.reset")}
        </Button>
      </div>
    </Card>
  );
}
