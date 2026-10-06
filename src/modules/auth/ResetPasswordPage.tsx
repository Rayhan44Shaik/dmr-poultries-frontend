// src/modules/auth/ResetPasswordPage.tsx
// Reset completion: consumes the single-use token from the reset link (?token=
// or pasted). Never signs in automatically — the user signs in afterwards.
import { useState, type FormEvent } from "react";
import { AlertCircle, CheckCircle2, KeyRound, Lock } from "lucide-react";
import BrandMark from "../../ui/BrandMark";
import { useI18n } from "../../i18n";
import { resetPasswordRequest } from "./authApi";
import { validateResetComplete } from "./resetValidation";
import { loginErrorMessage } from "./loginValidation";

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20";

export default function ResetPasswordPage({
  initialToken,
  onDone,
}: {
  initialToken: string;
  onDone: () => void;
}) {
  const { t } = useI18n();
  const [token, setToken] = useState(initialToken);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ token?: string; password?: string; confirm?: string }>({});
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (busy || done) return;
    const checked = validateResetComplete(token, password, confirm);
    if (!checked.ok) {
      setFieldErrors(checked.errors);
      return;
    }
    setFieldErrors({});
    setBusy(true);
    setError("");
    resetPasswordRequest(checked.token, checked.newPassword)
      .then(() => {
        setDone(true);
        setPassword("");
        setConfirm("");
      })
      .catch((cause) => setError(loginErrorMessage(cause, t("auth.reset.invalid"))))
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
            <h2 className="text-xl font-bold tracking-tight text-slate-900">{t("auth.reset.new_title")}</h2>
          </div>

          {done ? (
            <div className="mt-5 space-y-4">
              <div role="status" className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs font-medium leading-relaxed text-emerald-800">
                <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-500" />
                {t("auth.reset.done")}
              </div>
              <button
                type="button"
                onClick={onDone}
                className="flex w-full items-center justify-center rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700"
              >
                {t("auth.reset.back")}
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
              <div>
                <label htmlFor="reset-token" className="mb-1 block text-xs font-semibold text-slate-600">
                  {t("auth.reset.token")}
                </label>
                <div className="relative">
                  <KeyRound size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    id="reset-token"
                    type="text"
                    value={token}
                    onChange={(e) => {
                      setToken(e.target.value);
                      if (fieldErrors.token) setFieldErrors((prev) => ({ ...prev, token: undefined }));
                    }}
                    autoComplete="off"
                    spellCheck={false}
                    className={inputClass}
                    placeholder={t("auth.reset.token_placeholder")}
                  />
                </div>
                {fieldErrors.token && <p className="mt-1 text-xs font-medium text-rose-600">{fieldErrors.token}</p>}
              </div>
              <div>
                <label htmlFor="reset-password" className="mb-1 block text-xs font-semibold text-slate-600">
                  {t("auth.reset.new_password")}
                </label>
                <div className="relative">
                  <Lock size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    id="reset-password"
                    type="password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: undefined }));
                    }}
                    autoComplete="new-password"
                    maxLength={1024}
                    className={inputClass}
                    placeholder={t("auth.password.hint")}
                  />
                </div>
                {fieldErrors.password && <p className="mt-1 text-xs font-medium text-rose-600">{fieldErrors.password}</p>}
              </div>
              <div>
                <label htmlFor="reset-confirm" className="mb-1 block text-xs font-semibold text-slate-600">
                  {t("auth.reset.confirm")}
                </label>
                <div className="relative">
                  <Lock size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    id="reset-confirm"
                    type="password"
                    value={confirm}
                    onChange={(e) => {
                      setConfirm(e.target.value);
                      if (fieldErrors.confirm) setFieldErrors((prev) => ({ ...prev, confirm: undefined }));
                    }}
                    autoComplete="new-password"
                    maxLength={1024}
                    className={inputClass}
                  />
                </div>
                {fieldErrors.confirm && <p className="mt-1 text-xs font-medium text-rose-600">{fieldErrors.confirm}</p>}
              </div>
              {error && (
                <div role="alert" className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-medium text-rose-700">
                  <AlertCircle size={14} className="mt-0.5 shrink-0 text-rose-500" />
                  {error}
                </div>
              )}
              <button
                type="submit"
                disabled={busy}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {busy ? t("auth.reset.saving") : t("auth.reset.save")}
              </button>
              <button
                type="button"
                onClick={onDone}
                className="w-full text-center text-xs font-semibold text-brand-600 transition-colors hover:text-brand-700"
              >
                {t("auth.reset.back")}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
