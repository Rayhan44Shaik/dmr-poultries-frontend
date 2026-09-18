// src/modules/auth/LoginPage.tsx
// Premium sign-in experience for DMR Poultries ERP.
//
// Two roles sign in here:
//   • Owner      → the whole system, everywhere.
//   • Supervisor → field-entry workspace (trips, collections, fuel,
//                  maintenance, leaves) with approve/delete held back.
// The two role cards double as demo shortcuts: one click fills the form and
// signs in against the sample server.

import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Briefcase, Building2, ClipboardCheck, Eye, EyeOff, Info, Lock, ShieldCheck, Truck, User } from "lucide-react";
import BrandMark from "../../ui/BrandMark";
import { useAuth } from "../../providers/authContext";
import { useI18n } from "../../i18n";
import { landingPathForRole } from "./permissions";
import { IDLE_SIGNOUT_KEY } from "./IdleSessionGuard";
import LanguageMiniToggle from "../staff/components/performance/LanguageMiniToggle";

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-10 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20";

/** The two sign-in roles, in the order they appear on the page. */
const ROLE_CARDS = [
  {
    role: "owner" as const,
    username: "owner",
    demoPassword: "owner123",
    icon: Briefcase,
    titleKey: "auth.login.role_owner_title",
    descKey: "auth.login.role_owner_desc",
    accent: "border-emerald-300 hover:border-emerald-500 hover:bg-emerald-50/60",
    iconWrap: "bg-emerald-100 text-emerald-700",
  },
  {
    role: "supervisor" as const,
    username: "supervisor",
    demoPassword: "supervisor123",
    icon: ClipboardCheck,
    titleKey: "auth.login.role_supervisor_title",
    descKey: "auth.login.role_supervisor_desc",
    accent: "border-sky-300 hover:border-sky-500 hover:bg-sky-50/60",
    iconWrap: "bg-sky-100 text-sky-700",
  },
];

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { t } = useI18n();
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  // Why are we on the sign-in screen? Read once at mount: "idle" means the
  // 10-minute inactivity logout brought us here, "expired" a dead session.
  // (The flag itself is cleared below, in an effect — external cleanup only.)
  const [noticeReason] = useState<"none" | "idle" | "expired">(() => {
    try {
      const reason = sessionStorage.getItem(IDLE_SIGNOUT_KEY);
      return reason === "idle" ? "idle" : reason === "expired" ? "expired" : "none";
    } catch {
      return "none";
    }
  });
  const notice = noticeReason === "idle" ? t("auth.idle.signed_out") : noticeReason === "expired" ? t("auth.session.expired") : "";

  useEffect(() => {
    if (noticeReason === "none") return;
    try {
      sessionStorage.removeItem(IDLE_SIGNOUT_KEY);
    } catch {
      // storage unavailable — the notice is cosmetic
    }
  }, [noticeReason]);

  const authenticate = async (user: string, pass: string) => {
    setBusy(true);
    setError("");
    try {
      const signedIn = await login(user, pass);
      navigate(landingPathForRole(signedIn?.role ?? null));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("auth.login.failed"));
    } finally {
      setBusy(false);
    }
  };

  const handleSignIn = (e: FormEvent) => {
    e.preventDefault();
    void authenticate(username, password);
  };

  const handleRoleCard = (card: (typeof ROLE_CARDS)[number]) => {
    setUsername(card.username);
    setPassword(card.demoPassword);
    void authenticate(card.username, card.demoPassword);
  };

  return (
    <div className="flex min-h-screen bg-slate-100/80">
      {/* Brand panel */}
      <div className="relative hidden w-[46%] max-w-[620px] flex-col justify-between overflow-hidden bg-gradient-to-br from-emerald-800 via-emerald-900 to-slate-950 p-10 lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.13]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 10%, #34d399 0, transparent 40%), radial-gradient(circle at 85% 80%, #10b981 0, transparent 45%)",
          }}
        />
        <div className="relative flex items-center gap-3">
          <BrandMark size="lg" variant="plain" />
          <h1 className="text-lg font-bold tracking-tight text-white">DMR Poultries</h1>
        </div>

        <div className="relative">
          <h2 className="max-w-md text-[28px] font-bold leading-tight tracking-tight text-white">
            {t("auth.login.tagline_title")}
          </h2>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-emerald-100/70">
            {t("auth.login.tagline_text")}
          </p>
          <ul className="mt-8 space-y-3.5">
            {[
              { icon: Truck, text: t("auth.login.point_trips") },
              { icon: ShieldCheck, text: t("auth.login.point_collections") },
              { icon: Building2, text: t("auth.login.point_masters") },
            ].map((item) => (
              <li key={item.text} className="flex items-center gap-3 text-sm text-emerald-50/90">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 text-emerald-300 ring-1 ring-inset ring-white/10">
                  <item.icon size={15} />
                </span>
                {item.text}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-emerald-100/50">
          {t("auth.login.copyright", { year: new Date().getFullYear() })}
        </p>
      </div>

      {/* Sign-in panel */}
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-[400px] animate-fade-in-up">
          {/* Language before sign-in: a Telugu-first user should be able to read
              the form without signing in first. */}
          <div className="mb-4 flex justify-end">
            <LanguageMiniToggle className="bg-white" />
          </div>
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <BrandMark size="lg" variant="plain" />
            <h1 className="text-lg font-bold tracking-tight text-slate-900">DMR Poultries</h1>
          </div>

          <div className="rounded-xl border border-slate-200/80 bg-white p-7 shadow-card-lg">
            <div className="flex items-center gap-3">
              <BrandMark size="md" variant="plain" label="DMR Poultries" />
              <div>
                <h2 className="text-xl font-bold tracking-tight text-slate-900">{t("auth.login.welcome")}</h2>
                <p className="mt-0.5 text-sm text-slate-400">{t("auth.login.subtitle")}</p>
              </div>
            </div>

            {/* Two sign-in roles */}
            <div className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {ROLE_CARDS.map((card) => (
                <button
                  key={card.role}
                  type="button"
                  disabled={busy}
                  onClick={() => handleRoleCard(card)}
                  className={`group flex items-start gap-2.5 rounded-xl border bg-white p-3 text-left shadow-sm transition-all disabled:cursor-not-allowed disabled:opacity-60 ${card.accent}`}
                >
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${card.iconWrap}`}>
                    <card.icon size={17} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[13px] font-bold text-slate-800">{t(card.titleKey)}</span>
                    <span className="mt-0.5 block text-[11px] leading-snug text-slate-500">{t(card.descKey)}</span>
                    <span className="mt-1.5 block font-mono text-[10.5px] font-semibold tracking-tight text-slate-400">
                      {card.username} · {card.demoPassword}
                    </span>
                  </span>
                </button>
              ))}
            </div>

            <div className="my-5 flex items-center gap-3" aria-hidden="true">
              <span className="h-px flex-1 bg-slate-200" />
              <span className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-400">
                {t("auth.login.or_manual")}
              </span>
              <span className="h-px flex-1 bg-slate-200" />
            </div>

            {notice && (
              <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs font-medium text-amber-800">
                <Info size={14} className="mt-0.5 shrink-0 text-amber-500" />
                {notice}
              </div>
            )}

            <form onSubmit={handleSignIn} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">
                  {t("auth.login.username")}
                </label>
                <div className="relative">
                  <User size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required className={inputClass} placeholder={t("auth.login.username_placeholder")} />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">
                  {t("auth.login.password")}
                </label>
                <div className="relative">
                  <Lock size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                    className={inputClass}
                    placeholder={t("auth.login.password_placeholder")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600"
                    aria-label={showPassword ? t("auth.login.hide_password") : t("auth.login.show_password")}
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {error && <p role="alert" className="text-xs font-medium text-rose-600">{error}</p>}

              <div className="flex items-center justify-between text-xs">
                <label className="flex items-center gap-2 font-medium text-slate-500">
                  <input type="checkbox" defaultChecked className="h-3.5 w-3.5 rounded border-slate-300 text-brand-600 accent-emerald-600" />
                  {t("auth.login.remember")}
                </label>
                <button type="button" className="font-semibold text-brand-700 transition-colors hover:text-brand-800">
                  {t("auth.login.forgot")}
                </button>
              </div>

              <button
                type="submit"
                disabled={busy}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {busy ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                    </svg>
                    {t("auth.login.signing_in")}
                  </>
                ) : (
                  <>
                    {t("auth.login.sign_in")}
                    <ArrowRight size={15} />
                  </>
                )}
              </button>
            </form>
          </div>

          <p className="mt-5 text-center text-xs text-slate-400">
            {t("auth.login.footer")}
          </p>
        </div>
      </div>
    </div>
  );
}
