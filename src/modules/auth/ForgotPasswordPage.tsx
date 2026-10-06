// src/modules/auth/ForgotPasswordPage.tsx
// Forgot-password request: always shows the same generic confirmation so
// accounts cannot be enumerated. Styled like the sign-in panel.
import { useState, type FormEvent } from "react";
import { ArrowLeft, CheckCircle2, KeyRound, User } from "lucide-react";
import BrandMark from "../../ui/BrandMark";
import { useI18n } from "../../i18n";
import { forgotPasswordRequest } from "./authApi";
import { validateResetRequest } from "./resetValidation";
import { loginErrorMessage } from "./loginValidation";

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20";

export default function ForgotPasswordPage({ onBack }: { onBack: () => void }) {
  const { t } = useI18n();
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (busy || sent) return;
    const checked = validateResetRequest(username);
    if (!checked.ok) {
      setError(checked.error);
      return;
    }
    setBusy(true);
    setError("");
    forgotPasswordRequest(checked.username)
      .then(() => setSent(true))
      .catch((cause) => setError(loginErrorMessage(cause, t("auth.login.failed"))))
      .finally(() => setBusy(false));
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100/80 p-6">
      <div className="w-full max-w-[400px]">
        <div className="mb-5 flex items-center justify-center gap-2">
          <BrandMark size="md" variant="plain" />
          <span className="text-sm font-bold tracking-tight text-slate-700">DMR Poultries</span>
        </div>
        <div className="rounded-xl border border-slate-200/80 bg-white p-7 shadow-card-lg">
          <div className="flex items-center gap-2">
            <KeyRound size={16} className="text-brand-600" />
            <h2 className="text-xl font-bold tracking-tight text-slate-900">{t("auth.reset.title")}</h2>
          </div>
          <p className="mt-1 text-sm text-slate-400">{t("auth.reset.subtitle")}</p>

          {sent ? (
            <div role="status" className="mt-5 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs font-medium leading-relaxed text-emerald-800">
              <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-500" />
              {t("auth.reset.sent")}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
              <div>
                <label htmlFor="reset-username" className="mb-1 block text-xs font-semibold text-slate-600">
                  {t("auth.login.username")}
                </label>
                <div className="relative">
                  <User size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    id="reset-username"
                    type="text"
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value);
                      if (error) setError("");
                    }}
                    autoComplete="username"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    maxLength={100}
                    className={inputClass}
                    placeholder={t("auth.login.username_placeholder")}
                  />
                </div>
              </div>
              {error && (
                <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-medium text-rose-700">
                  {error}
                </div>
              )}
              <button
                type="submit"
                disabled={busy}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {busy ? t("auth.reset.requesting") : t("auth.reset.request")}
              </button>
            </form>
          )}

          <button
            type="button"
            onClick={onBack}
            className="mt-5 flex items-center gap-1.5 text-xs font-semibold text-brand-600 transition-colors hover:text-brand-700"
          >
            <ArrowLeft size={13} />
            {t("auth.reset.back")}
          </button>
        </div>
      </div>
    </div>
  );
}
