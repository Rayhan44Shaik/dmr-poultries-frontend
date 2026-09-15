// src/modules/auth/LoginPage.tsx
// Premium sign-in experience for DMR Poultries ERP.

import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Building2, Eye, EyeOff, Lock, ShieldCheck, Truck, User } from "lucide-react";
import BrandMark from "../../ui/BrandMark";
import { useAuth } from "../../providers/authContext";
import { useI18n } from "../../i18n";
import LanguageMiniToggle from "../staff/components/performance/LanguageMiniToggle";

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-10 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20";

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { t } = useI18n();
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSignIn = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await login(username, password);
      navigate("/dashboard");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("auth.login.failed"));
    } finally { setBusy(false); }
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
            <h2 className="text-xl font-bold tracking-tight text-slate-900">{t("auth.login.welcome")}</h2>
            <p className="mt-1 text-sm text-slate-400">{t("auth.login.subtitle")}</p>

            <form onSubmit={handleSignIn} className="mt-6 space-y-4">
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
