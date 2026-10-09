import { useEffect, useState } from "react";
import {
  AtSign,
  Briefcase,
  Building2,
  KeyRound,
  Languages,
  Moon,
  Smartphone,
  Sun,
  Type,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { profileRequest, type UserProfile } from "../../auth/authApi";
import ChangePasswordDialog from "../../auth/ChangePasswordDialog";
import { loadEmployees } from "../../masters/employees/services/employeeService";
import type { Employee } from "../../masters/employees/types/employee";
import { useI18n } from "../../../i18n";
import { useUserPreferences } from "../hooks/useUserPreferences";
import { FONT_SCALE_LEVELS, formatFontScale } from "../../../providers/fontScale";
import { ActionTooltip } from "../../../ui/ActionTooltip";
import MasterDropdown from "../../masters/components/MasterDropdown";

/** Password tile wants the exact moment, not just the day. */
const formatDateTime = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true }).format(new Date(value))
    : null;

const roleLabel = (role: string) =>
  role
    .toLowerCase()
    .split("_")
    .map((x) => (x ? x[0].toUpperCase() + x.slice(1) : x))
    .join(" ");

/** Shared section shell — same heading rhythm everywhere on the page. */
function SectionHeading({ icon: Icon, title, delay }: { icon: LucideIcon; title: string; delay: number }) {
  return (
    <div className="animate-fade-in mb-3 flex items-center gap-2" style={{ animationDelay: `${delay}ms` }}>
      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
        <Icon size={15} />
      </span>
      <h3 className="text-sm font-bold tracking-tight text-slate-800 dark:text-slate-100">{title}</h3>
      <span className="ml-1 h-px flex-1 bg-slate-200 dark:bg-slate-800" />
    </div>
  );
}

/**
 * The password tile. It is rendered immediately after the Username tile in the
 * grid so the change control and the last-changed date sit beside the user's
 * login name, where the operator looks for them — not in a separate section
 * further down the page.
 */
function PasswordTile({
  lastChanged,
  delay,
  onOpen,
}: {
  lastChanged: string | null;
  delay: number;
  onOpen: () => void;
}) {
  const { t } = useI18n();
  return (
    <div
      className="group animate-fade-in flex items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-3 py-2.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:hover:border-emerald-500/40"
      style={{ animationDelay: `${delay}ms` }}
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-600 transition-transform duration-200 group-hover:-rotate-6 group-hover:scale-110 dark:bg-emerald-500/10 dark:text-emerald-400">
        <KeyRound size={14} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">
          {t("settings.password")}
        </p>
        <p className="truncate text-[13px] font-semibold leading-tight text-slate-800 dark:text-slate-100">
          {lastChanged ?? t("settings.not_changed")}
        </p>
      </div>
      <button
        type="button"
        onClick={onOpen}
        className="group inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[11px] font-bold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-emerald-700 active:translate-y-0 active:scale-95"
      >
        <span className="inline-flex motion-safe:group-hover:animate-[var(--animate-action-add)]"><KeyRound size={12} /></span>
        {t("settings.change_password")}
      </button>
    </div>
  );
}

/** One labelled value with the tinted glyph used across the trip/activity cards.
 *  `sub` renders a small secondary line (e.g. the employee no under the name). */
function InfoTile({ icon: Icon, label, value, sub, delay }: { icon: LucideIcon; label: string; value: string; sub?: string; delay: number }) {
  return (
    <div
      className="group animate-fade-in flex items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-3 py-2.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:hover:border-emerald-500/40"
      style={{ animationDelay: `${delay}ms` }}
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-600 transition-transform duration-200 group-hover:-rotate-6 group-hover:scale-110 dark:bg-emerald-500/10 dark:text-emerald-400">
        <Icon size={14} />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">{label}</p>
        <p className="truncate text-[13px] font-semibold leading-tight text-slate-800 dark:text-slate-100">{value || "—"}</p>
        {sub ? (
          <p className="mt-0.5 truncate text-[10.5px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">{sub}</p>
        ) : null}
      </div>
    </div>
  );
}

export default function Profile() {
  const { t } = useI18n();
  // Language + theme are persisted per user server-side; the hook keeps the
  // providers (and therefore the whole app) in step with the stored choice.
  // Preferences persist server-side on every change; `syncState` is kept only
  // so a failed save can surface an inline error chip.
  const { language, theme, fontScale, setLanguage, setTheme, setFontScale, syncState } = useUserPreferences();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [master, setMaster] = useState<Employee | null>(null);
  const [failed, setFailed] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);

  /**
   * `/auth/profile` is the session's own record; the Employees master is the
   * same row the Masters table edits, so the card is enriched from there
   * (mobile, department, name spelling). The master load is purely additive —
   * a role without masters access still renders the profile as-is.
   */
  useEffect(() => {
    let live = true;
    profileRequest()
      .then((p) => {
        if (!live) return;
        setProfile(p);
        return loadEmployees()
          .then((list) => {
            if (!live) return;
            const no = (p.employeeNumber ?? "").trim();
            const noNum = Number(no);
            const match =
              (no
                ? list.find(
                    (e) => String(e.employeeNo) === no || (Number.isFinite(noNum) && e.employeeNo === noNum)
                  )
                : undefined) ??
              list.find((e) => e.employeeName.trim().toLowerCase() === p.fullName.trim().toLowerCase()) ??
              null;
            setMaster(match);
          })
          .catch(() => undefined);
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, []);

  if (failed) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
        {t("settings.profile_failed")}
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="space-y-4" aria-label="Loading profile" aria-busy="true">
        <div className="h-28 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
        <div className="h-40 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
        <div className="h-32 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
      </div>
    );
  }

  /* The /auth/profile payload is already master-joined server-side
     (authService.profile joins the employees row). When the Employees master
     is also loaded locally it is the fresher copy of the same record, so it
     wins; the profile values stand in when masters access is unavailable. */
  const fullName = master?.employeeName?.trim() || profile.fullName;
  const employeeNo = master ? String(master.employeeNo) : (profile.employeeNumber ?? "");
  const mobile = master?.phoneNumber?.trim() || profile.mobileNumber;
  const department = master?.department?.trim() || profile.department;
  const roleText = roleLabel(profile.role);
  const lastChanged = formatDateTime(profile.lastPasswordResetAt);
  const tiles: Array<{ icon: LucideIcon; label: string; value: string; sub?: string }> = [
    /* Name carries the employee number on its second line — one identity
       tile instead of two. */
    { icon: UserRound, label: t("settings.full_name"), value: fullName, sub: employeeNo ? `${t("settings.employee_number")}: ${employeeNo}` : "" },
    /* Where the number tile used to sit: the department, straight from the
       Employees master. */
    { icon: Building2, label: t("settings.department"), value: department },
    { icon: Smartphone, label: t("settings.mobile_number"), value: mobile },
    { icon: Briefcase, label: t("settings.role"), value: roleText },
    { icon: AtSign, label: t("settings.username"), value: profile.username },
  ];

  return (
    <div className="space-y-6">
      {/* ── Personal information ────────────────────────────────────────── */}
      <section aria-labelledby="personal-info">
        <div id="personal-info">
          <SectionHeading icon={UserRound} title={t("settings.personal_information")} delay={60} />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {tiles.map((tile, index) => (
            <InfoTile key={tile.label} icon={tile.icon} label={tile.label} value={tile.value} sub={tile.sub} delay={80 + index * 45} />
          ))}
          {/* Password sits directly beside the username tile: its last-changed
              date and the control to change it live together here. */}
          <PasswordTile
            delay={80 + tiles.length * 45}
            lastChanged={lastChanged}
            onOpen={() => setPasswordOpen(true)}
          />
        </div>
      </section>

      {/* ── Preferences ────────────────────────────────────────────────── */}
      <section aria-labelledby="preferences">
        <div id="preferences">
          <SectionHeading icon={Languages} title={t("settings.preferences")} delay={340} />
        </div>
        {/* Compact, always-aligned preference row — Language select, the
            horizontal font-size strip and the Light/Dark toggle share one
            strip. Saving is silent: every change is persisted to the backend
            immediately (errors surface only when a save actually fails), so no
            "last saved" chip is shown. */}
        <div
          className="animate-fade-in flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900"
          style={{ animationDelay: "380ms" }}
        >
          <div className="flex min-w-[180px] flex-1 items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400">
              <Languages size={14} />
            </span>
            <MasterDropdown
              hideLabel
              label={t("settings.language")}
              value={language}
              onChange={(value) => setLanguage(value as "en" | "te")}
              options={[
                { value: "en", label: t("settings.english") },
                { value: "te", label: t("settings.telugu") },
              ]}
              className="w-[150px]"
              triggerClassName="h-8 px-2.5 text-xs"
            />
            {/* Font size — horizontal percentage strip on the same scale as
                the header control, with its own tinted logo. Every button
                keeps a single-line tooltip below itself. */}
            <div className="flex min-w-[180px] flex-1 items-center gap-2">
              <span className="group relative flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400">
                <Type size={14} />
                <ActionTooltip
                  label={t("fontScale.current", { value: formatFontScale(fontScale) })}
                  side="bottom"
                  className="whitespace-nowrap"
                />
              </span>
              <div
                className="flex flex-wrap rounded-md border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-700 dark:bg-slate-800/60"
                role="group"
                aria-label={t("fontScale.levels")}
              >
                {FONT_SCALE_LEVELS.map((level) => {
                  const active = level === fontScale;
                  const label = formatFontScale(level);
                  return (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setFontScale(level)}
                      aria-pressed={active}
                      aria-label={t("fontScale.set", { value: label })}
                      className={`group relative inline-flex items-center rounded-sm px-2 py-1 text-[11px] font-bold tabular-nums transition-all duration-200 ${
                        active
                          ? "bg-emerald-600 text-white shadow-sm"
                          : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                      }`}
                    >
                      {label}
                      <ActionTooltip
                        label={t("fontScale.set", { value: label })}
                        side="bottom"
                        className="whitespace-nowrap"
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${
                theme === "dark"
                  ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400"
                  : "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400"
              }`}
            >
              {theme === "dark" ? <Moon size={14} /> : <Sun size={14} />}
            </span>
            <div className="flex rounded-md border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-700 dark:bg-slate-800/60">
              {(["light", "dark"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setTheme(mode)}
                  aria-pressed={theme === mode}
                  className={`inline-flex items-center gap-1 rounded-sm px-2.5 py-1 text-[11px] font-bold capitalize transition-all duration-200 ${
                    theme === mode
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                  }`}
                >
                  {mode === "light" ? <Sun size={11} /> : <Moon size={11} />}
                  {mode}
                </button>
              ))}
            </div>
          </div>
          {syncState === "error" && (
            <span className="inline-flex items-center rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
              {t("settings.preferences_state_error")}
            </span>
          )}
        </div>
      </section>

      <ChangePasswordDialog open={passwordOpen} onClose={() => setPasswordOpen(false)} />
    </div>
  );
}
