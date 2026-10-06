// src/modules/auth/LoginPage.tsx
// Premium sign-in experience for DMR Poultries ERP.
//
// A single sign-in: enter username + password and the signed-in role
// (Owner / Supervisor) decides which pages open. Client-side validation runs
// before the network call; API errors are mapped to clear, safe messages.
// Accounts with two-factor authentication enabled pause after the password
// step for a 6-digit TOTP code — no session exists until the code verifies.

import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, AlertCircle, Building2, Eye, EyeOff, Info, Lock, ShieldCheck, Truck, User, X } from "lucide-react";
import BrandMark from "../../ui/BrandMark";
import { useI18n } from "../../i18n";
import { useAuth } from "../../providers/authContext";
import { currentUserRequest, loginRequest, mfaVerifyRequest } from "./authApi";
import { landingPathForRole } from "./permissions";
import { IDLE_SIGNOUT_KEY } from "./IdleSessionGuard";
import { getLastUsername, setLastUsername, sweepWorkspaceCaches } from "./cacheSweep";
import { loginErrorMessage, validateLoginForm } from "./loginValidation";
import { notify } from "../../ui/notifications/notificationStore";
import ForgotPasswordPage from "./ForgotPasswordPage";
import ResetPasswordPage from "./ResetPasswordPage";

const REMEMBER_KEY = "dmr-remember-username";
// Module-level submit lock: survives React remounts/StrictMode double-effects
// so one user action issues one logical login (authApi dedupe covers the rest).
let loginSubmitInFlight = false;

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-10 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20";
const inputErrorClass =
  "w-full rounded-lg border border-rose-300 bg-white py-2.5 pl-10 pr-10 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20";

function readRememberedUsername(): string {
  try {
    return localStorage.getItem(REMEMBER_KEY) ?? "";
  } catch {
    return "";
  }
}

function mfaErrorMessage(cause: unknown): string {
  const status = (cause as { status?: number } | null)?.status;
  const message = cause instanceof Error ? cause.message : "";
  if (status === 429) return "Too many attempts. Please wait a few minutes and try again.";
  if (/expired|ticket/i.test(message)) {
    return "This sign-in expired. Please sign in again from the start.";
  }
  if (status === 401 || /invalid|incorrect|wrong|code/i.test(message)) {
    return "That 6-digit code didn't work. Check your authenticator app and try again.";
  }
  return loginErrorMessage(cause, "Verification failed. Please try again.");
}

export default function LoginPage() {
  const { t } = useI18n();
  const { adoptSession } = useAuth();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const remembered = readRememberedUsername();
  const [username, setUsername] = useState(remembered);
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(Boolean(remembered));
  const [fieldErrors, setFieldErrors] = useState<{ username?: string; password?: string }>({});
  const [error, setError] = useState("");
  // Second-factor state: set when the password step returns an MFA challenge.
  // No session exists while this is set — the ticket alone grants nothing.
  const [mfaTicket, setMfaTicket] = useState<string | null>(null);
  const [mfaUsername, setMfaUsername] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaBusy, setMfaBusy] = useState(false);
  // Sub-views of the sign-in screen: "forgot" requests a reset, "reset"
  // consumes ?resetToken= from a reset link. No router change needed —
  // unauthenticated users always land on this page through AuthGate.
  const [view, setView] = useState<"login" | "forgot" | "reset">(() => {
    try {
      return new URLSearchParams(window.location.search).get("resetToken") ? "reset" : "login";
    } catch {
      return "login";
    }
  });
  const [initialResetToken] = useState(() => {
    try {
      return new URLSearchParams(window.location.search).get("resetToken") ?? "";
    } catch {
      return "";
    }
  });
  // Why are we on the sign-in screen? Read once at mount: "idle" means the
  // 10-minute inactivity logout brought us here, "expired" a dead session.
  const [noticeReason] = useState<"none" | "idle" | "expired" | "password">(() => {
    try {
      const reason = sessionStorage.getItem(IDLE_SIGNOUT_KEY);
      if (reason === "idle") return "idle";
      if (reason === "expired") return "expired";
      if (reason === "password") return "password";
      return "none";
    } catch {
      return "none";
    }
  });
  const notice =
    noticeReason === "idle"
      ? t("auth.idle.signed_out")
      : noticeReason === "expired"
        ? t("auth.session.expired")
        : noticeReason === "password"
          ? t("auth.password.signed_out_notice")
          : "";

  useEffect(() => {
    if (noticeReason === "none") return;
    try {
      sessionStorage.removeItem(IDLE_SIGNOUT_KEY);
    } catch {
      // storage unavailable — the notice is cosmetic
    }
  }, [noticeReason]);

  // Shared tail of both sign-in paths: verify the freshly issued session
  // through the same proxy before mounting the dashboard, then land by role.
  // This closes the gap where a bad/stale token could launch every
  // dashboard query at once and turn one auth failure into many 401s.
  const finishSignIn = async (previousSessionsEnded: boolean) => {
    const verifiedUser = await currentUserRequest();
    const previous = getLastUsername();
    if (previous !== verifiedUser.username) sweepWorkspaceCaches();
    setLastUsername(verifiedUser.username);
    try {
      if (rememberMe) localStorage.setItem(REMEMBER_KEY, verifiedUser.username);
      else localStorage.removeItem(REMEMBER_KEY);
    } catch {
      // remember-me is best-effort
    }
    adoptSession(verifiedUser);
    if (previousSessionsEnded) {
      notify.info(t("auth.login.sessions_replaced"));
    }
    navigate(landingPathForRole(verifiedUser.role), { replace: true });
  };

  const authenticate = async (user: string, pass: string) => {
    if (loginSubmitInFlight) return;
    loginSubmitInFlight = true;
    setBusy(true);
    setError("");
    setFieldErrors({});
    try {
      const signedIn = await loginRequest(user, pass);
      if (signedIn.mfaRequired) {
        // Password accepted, second factor pending. Hold here for the code —
        // finishSignIn runs only after the ticket verifies.
        setMfaUsername(user);
        setMfaTicket(signedIn.mfaTicket);
        setMfaCode("");
        setPassword("");
        setBusy(false);
        loginSubmitInFlight = false;
        return;
      }
      await finishSignIn(signedIn.previousSessionsEnded);
      loginSubmitInFlight = false;
    } catch (cause) {
      setError(loginErrorMessage(cause, t("auth.login.failed")));
      loginSubmitInFlight = false;
      setBusy(false);
      setPassword("");
    }
  };

  const verifyMfa = async (e: FormEvent) => {
    e.preventDefault();
    if (mfaBusy || !mfaTicket || mfaCode.trim().length !== 6) return;
    setMfaBusy(true);
    setError("");
    try {
      const verified = await mfaVerifyRequest(mfaTicket, mfaCode.trim());
      await finishSignIn(verified.previousSessionsEnded);
    } catch (cause) {
      const message = mfaErrorMessage(cause);
      if (/sign in again from the start/i.test(message)) {
        // The ticket died — back to the password step, not a dead-end.
        setMfaTicket(null);
        setMfaCode("");
      } else {
        setMfaCode("");
      }
      setError(message);
      setMfaBusy(false);
    }
  };

  const backToPassword = () => {
    setMfaTicket(null);
    setMfaCode("");
    setMfaUsername("");
    setError("");
  };

  if (view !== "login") {
    return view === "forgot" ? (
      <ForgotPasswordPage onBack={() => setView("login")} />
    ) : (
      <ResetPasswordPage initialToken={initialResetToken} onDone={() => setView("login")} />
    );
  }

  const handleSignIn = (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const checked = validateLoginForm(username, password);
    if (!checked.ok) {
      setFieldErrors({
        username: checked.errors.username,
        password: checked.errors.password,
      });
      setError(checked.errors.form ?? "");
      return;
    }
    void authenticate(checked.username, checked.password);
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
          <div className="rounded-xl border border-slate-200/80 bg-white p-7 shadow-card-lg">
            <div className="text-center">
              <h2 className="text-xl font-bold tracking-tight text-slate-900">{t("auth.login.welcome")}</h2>
              <p className="mt-1 text-sm text-slate-400">{t("auth.login.subtitle")}</p>
            </div>

            {notice && (
              <div className="mt-5 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs font-medium text-amber-800">
                <Info size={14} className="mt-0.5 shrink-0 text-amber-500" />
                {notice}
              </div>
            )}

            {mfaTicket ? (
              <form onSubmit={verifyMfa} className="mt-6 space-y-4" noValidate>
                <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs font-medium leading-relaxed text-emerald-800">
                  <ShieldCheck size={14} className="mt-0.5 shrink-0 text-emerald-600" />
                  Password accepted{mfaUsername ? ` for ${mfaUsername}` : ""}. Enter the
                  6-digit code from your authenticator app to finish signing in.
                </div>
                <div>
                  <label htmlFor="login-mfa-code" className="mb-1 block text-xs font-semibold text-slate-600">
                    Two-factor code
                  </label>
                  <input
                    id="login-mfa-code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={mfaCode}
                    onChange={(e) => {
                      setMfaCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                      if (error) setError("");
                    }}
                    maxLength={6}
                    className="w-full rounded-lg border border-slate-200 bg-white py-2.5 text-center text-lg font-bold tracking-[0.35em] text-slate-800 shadow-sm outline-none transition placeholder:text-slate-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                    placeholder="••••••"
                    aria-invalid={Boolean(error)}
                  />
                </div>

                {error && (
                  <div
                    role="alert"
                    className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-medium leading-relaxed text-rose-700"
                  >
                    <AlertCircle size={14} className="mt-0.5 shrink-0 text-rose-500" aria-hidden="true" />
                    <span className="flex-1">{error}</span>
                    <button
                      type="button"
                      onClick={() => setError("")}
                      aria-label={t("common.close")}
                      className="shrink-0 rounded p-0.5 text-rose-400 transition-colors hover:bg-rose-100 hover:text-rose-700"
                    >
                      <X size={14} aria-hidden="true" />
                    </button>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={mfaBusy || mfaCode.trim().length !== 6}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {mfaBusy ? (
                    <>
                      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                      </svg>
                      Verifying…
                    </>
                  ) : (
                    <>
                      Verify and sign in
                      <ArrowRight size={15} />
                    </>
                  )}
                </button>
                <div className="text-center text-xs">
                  <button type="button" onClick={backToPassword} className="font-medium text-brand-600 transition-colors hover:text-brand-700">
                    Back to username and password
                  </button>
                </div>
              </form>
            ) : (
            <form onSubmit={handleSignIn} className="mt-6 space-y-4" noValidate>
              <div>
                <label htmlFor="login-username" className="mb-1 block text-xs font-semibold text-slate-600">
                  {t("auth.login.username")}
                </label>
                <div className="relative">
                  <User size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    id="login-username"
                    type="text"
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value);
                      if (fieldErrors.username) setFieldErrors((prev) => ({ ...prev, username: undefined }));
                    }}
                    autoComplete="username"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    maxLength={100}
                    className={fieldErrors.username ? inputErrorClass : inputClass}
                    placeholder={t("auth.login.username_placeholder")}
                    aria-invalid={Boolean(fieldErrors.username)}
                    aria-describedby={fieldErrors.username ? "login-username-error" : undefined}
                  />
                </div>
                {fieldErrors.username && (
                  <p id="login-username-error" className="mt-1 text-xs font-medium text-rose-600">
                    {fieldErrors.username}
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="login-password" className="mb-1 block text-xs font-semibold text-slate-600">
                  {t("auth.login.password")}
                </label>
                <div className="relative">
                  <Lock size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: undefined }));
                    }}
                    autoComplete="current-password"
                    maxLength={1024}
                    className={fieldErrors.password ? inputErrorClass : inputClass}
                    placeholder={t("auth.login.password_placeholder")}
                    aria-invalid={Boolean(fieldErrors.password)}
                    aria-describedby={fieldErrors.password ? "login-password-error" : undefined}
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
                {fieldErrors.password && (
                  <p id="login-password-error" className="mt-1 text-xs font-medium text-rose-600">
                    {fieldErrors.password}
                  </p>
                )}
              </div>

              {error && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-medium leading-relaxed text-rose-700"
                >
                  <AlertCircle size={14} className="mt-0.5 shrink-0 text-rose-500" aria-hidden="true" />
                  <span className="flex-1">{error}</span>
                  <button
                    type="button"
                    onClick={() => setError("")}
                    aria-label={t("common.close")}
                    className="shrink-0 rounded p-0.5 text-rose-400 transition-colors hover:bg-rose-100 hover:text-rose-700"
                  >
                    <X size={14} aria-hidden="true" />
                  </button>
                </div>
              )}

              <div className="flex items-center justify-between text-xs">
                <label className="flex items-center gap-2 font-medium text-slate-500">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-slate-300 text-brand-600 accent-emerald-600"
                  />
                  {t("auth.login.remember")}
                </label>
                <button type="button" onClick={() => setView("forgot")} className="font-medium text-brand-600 transition-colors hover:text-brand-700">
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
            )}
          </div>

          <p className="mt-5 text-center text-xs text-slate-400">
            {t("auth.login.footer")}
          </p>
        </div>
      </div>
    </div>
  );
}
