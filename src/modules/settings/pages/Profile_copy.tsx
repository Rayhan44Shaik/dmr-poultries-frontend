import { useEffect, useState } from "react";
import {
  AtSign,
  BadgeCheck,
  Briefcase,
  Hash,
  KeyRound,
  Languages,
  Moon,
  ShieldCheck,
  Smartphone,
  Sun,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { profileRequest, type UserProfile } from "../../auth/authApi";
import ChangePasswordDialog from "../../auth/ChangePasswordDialog";
import { loadEmployees } from "../../masters/employees/services/employeeService";
import type { Employee } from "../../masters/employees/types/employee";
import { useI18n } from "../../../i18n";
import { useTheme } from "../../../providers/ThemeProvider";

const formatDate = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value))
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

/** One labelled value with the tinted glyph used across the trip/activity cards. */
function InfoTile({ icon: Icon, label, value, delay }: { icon: LucideIcon; label: string; value: string; delay: number }) {
  return (
    <div
      className="group animate-fade-in flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md dark:border-slate-700 dark:bg-slate-900 dark:hover:border-emerald-500/40"
      style={{ animationDelay: `${delay}ms` }}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 transition-transform duration-200 group-hover:-rotate-6 group-hover:scale-110 dark:bg-emerald-500/10 dark:text-emerald-400">
        <Icon size={18} />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">{label}</p>
        <p className="mt-0.5 truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{value || "—"}</p>
      </div>
    </div>
  );
}

export default function Profile() {
  const { t, language, setLanguage } = useI18n();
  const { theme, setTheme } = useTheme();
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
            const match =
              (no ? list.find((e) => String(e.employeeNo) === no) : undefined) ??
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

  const fullName = master?.employeeName?.trim() || profile.fullName;
  const employeeNo = profile.employeeNumber || (master ? String(master.employeeNo) : "");
  const mobile = master?.phoneNumber?.trim() || profile.mobileNumber;
  const department = master?.department?.trim() || profile.department;
  const roleText = roleLabel(profile.role);
  const lastChanged = formatDate(profile.lastPasswordResetAt);
  const initials =
    fullName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((x) => x[0])
      .join("")
      .toUpperCase() || "";

  const tiles: Array<{ icon: LucideIcon; label: string; value: string }> = [
    { icon: UserRound, label: t("settings.full_name"), value: fullName },
    { icon: Hash, label: t("settings.employee_number"), value: employeeNo ? String(employeeNo) : "" },
    { icon: Smartphone, label: t("settings.mobile_number"), value: mobile },
    { icon: Briefcase, label: t("settings.role"), value: roleText + (department ? ` · ${department}` : "") },
    { icon: AtSign, label: t("settings.username"), value: profile.username },
  ];

  return (
    <div className="space-y-6">
      {/* ── Identity: the logo card ─────────────────────────────────────── */}
      <section
        className="animate-fade-in relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-6"
        aria-label="Identity"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-emerald-500/10 blur-2xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-20 -left-10 h-40 w-40 rounded-full bg-brand-500/10 blur-2xl"
        />
        <div className="relative flex flex-wrap items-center gap-4">
          <span className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-lg font-bold text-white shadow-lg shadow-emerald-500/25 ring-4 ring-white transition-transform duration-300 hover:scale-105 dark:ring-slate-900">
            {initials || <UserRound size={26} />}
            <span className="absolute -bottom-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-white ring-2 ring-white dark:bg-slate-900 dark:ring-slate-900">
              <BadgeCheck size={13} className="text-emerald-500" />
            </span>
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold tracking-tight text-slate-900 dark:text-white">{fullName}</h2>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                <ShieldCheck size={12} />
                {roleText}
              </span>
              {department && <span>{department}</span>}
              {profile.username && (
                <span className="inline-flex items-center gap-1">
                  <AtSign size={12} />
                  {profile.username}
                </span>
              )}
            </p>
          </div>
        </div>
      </section>

      {/* ── Personal information ────────────────────────────────────────── */}
      <section aria-labelledby="personal-info">
        <div id="personal-info">
          <SectionHeading icon={UserRound} title={t("settings.personal_information")} delay={60} />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {tiles.map((tile, index) => (
            <InfoTile key={tile.label} icon={tile.icon} label={tile.label} value={tile.value} delay={80 + index * 45} />
          ))}
        </div>
      </section>

      {/* ── Security ───────────────────────────────────────────────────── */}
      <section aria-labelledby="security">
        <div id="security">
          <SectionHeading icon={ShieldCheck} title={t("settings.security")} delay={260} />
        </div>
        <div
          className="animate-fade-in flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"
          style={{ animationDelay: "300ms" }}
        >
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
              <KeyRound size={18} />
            </span>
            <div>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{t("settings.password")}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t("settings.last_changed")}: {lastChanged ?? t("settings.not_changed")}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setPasswordOpen(true)}
            className="group inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-emerald-700 hover:shadow-lg hover:shadow-emerald-500/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 active:translate-y-0 active:scale-95"
          >
            <KeyRound
              size={15}
              className="transition-transform duration-300 group-hover:-rotate-12 group-active:rotate-0"
            />
            {t("auth.password.title")}
          </button>
        </div>
      </section>

      {/* ── Preferences ────────────────────────────────────────────────── */}
      <section aria-labelledby="preferences">
        <div id="preferences">
          <SectionHeading icon={Languages} title={t("settings.preferences")} delay={340} />
        </div>
        <div
          className="animate-fade-in grid gap-5 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-2 dark:border-slate-700 dark:bg-slate-900"
          style={{ animationDelay: "380ms" }}
        >
          <label className="block">
            <span className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
              <Languages size={15} />
              {t("settings.language")}
            </span>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as "en" | "te")}
              className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="en">{t("settings.english")}</option>
              <option value="te">{t("settings.telugu")}</option>
            </select>
          </label>

          <div>
            <p className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
              {theme === "dark" ? <Moon size={15} /> : <Sun size={15} />}
              {t("settings.appearance")}
            </p>
            <div className="mt-2 grid grid-cols-2 gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-800/60">
              {(["light", "dark"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setTheme(mode)}
                  aria-pressed={theme === mode}
                  className={`inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold capitalize transition-all duration-200 ${
                    theme === mode
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "text-slate-600 hover:bg-white hover:shadow-sm dark:text-slate-300 dark:hover:bg-slate-700"
                  }`}
                >
                  {mode === "light" ? <Sun size={13} /> : <Moon size={13} />}
                  {mode}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <ChangePasswordDialog open={passwordOpen} onClose={() => setPasswordOpen(false)} />
    </div>
  );
}
