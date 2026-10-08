// src/modules/auth/ChangePasswordDialog.tsx
import { useMemo, useState, type FormEvent } from "react";
import { CheckCircle2, Eye, EyeOff, KeyRound, X } from "lucide-react";
import { changePasswordRequest } from "./authApi";
import { useI18n } from "../../i18n";
import { useAuth } from "../../providers/authContext";
import Modal from "../../ui/Modal";
import { IDLE_SIGNOUT_KEY } from "./IdleSessionGuard";
import { beginSignOut } from "./signOutGate";
import { storeToken } from "./tokenStore";

type Props = {
  open: boolean;
  onClose: () => void;
};

function fieldClass(opts: { enabled: boolean; ok?: boolean; bad?: boolean }): string {
  const base =
    "w-full rounded-lg border px-3 py-2 text-sm outline-none transition dark:bg-slate-800 dark:text-slate-100";
  if (!opts.enabled) {
    return `${base} cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400 dark:border-slate-700 dark:bg-slate-900/60`;
  }
  if (opts.ok) {
    return `${base} border-emerald-400 bg-emerald-50/40 text-slate-800 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-emerald-500/50 dark:bg-emerald-500/10`;
  }
  if (opts.bad) {
    return `${base} border-rose-400 bg-rose-50/40 text-slate-800 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 dark:border-rose-500/50`;
  }
  return `${base} border-slate-200 bg-white text-slate-800 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-600`;
}

function passwordChangeErrorMessage(cause: unknown, fallback: string): string {
  const status = (cause as { status?: number } | null)?.status;
  const message = cause instanceof Error ? cause.message : "";
  if (status === 401 || /current password/i.test(message)) {
    return "Wrong current password entered.";
  }
  if (status === 400 && /different/i.test(message)) {
    return "New password must be different from the current password.";
  }
  if (status === 400 && /12/i.test(message)) {
    return "New password must be at least 12 characters.";
  }
  return message?.trim() || fallback;
}

export default function ChangePasswordDialog({ open, onClose }: Props) {
  const { t } = useI18n();
  const { logout } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const currentOk = currentPassword.length > 0;
  const newEnabled = currentOk;
  const newOk = newEnabled && newPassword.length >= 12;
  const newTooShort = newEnabled && newPassword.length > 0 && newPassword.length < 12;
  const confirmEnabled = newOk;
  const passwordsMatch =
    confirmEnabled && confirmPassword.length > 0 && newPassword === confirmPassword;
  const confirmMismatch =
    confirmEnabled && confirmPassword.length > 0 && newPassword !== confirmPassword;
  const canSubmit = currentOk && newOk && passwordsMatch && newPassword !== currentPassword && !busy;

  const hint = useMemo(() => {
    if (!currentOk) return t("auth.password.step_current");
    if (!newOk) return t("auth.password.hint");
    if (!passwordsMatch) return t("auth.password.step_confirm");
    return t("auth.password.step_ready");
  }, [currentOk, newOk, passwordsMatch, t]);

  const reset = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setError("");
    setDone(false);
    setBusy(false);
    setShow(false);
  };

  const close = () => {
    if (busy) return;
    reset();
    onClose();
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!canSubmit) return;
    setBusy(true);
    try {
      await changePasswordRequest(currentPassword, newPassword);
      setDone(true);
      beginSignOut();
      storeToken(null);
      try {
        sessionStorage.setItem(IDLE_SIGNOUT_KEY, "password");
      } catch {
        // notice is cosmetic
      }
      window.setTimeout(() => {
        void logout();
      }, 1200);
    } catch (cause) {
      setError(passwordChangeErrorMessage(cause, t("auth.password.failed")));
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={close}
      size="sm"
      closeOnOverlay={!busy && !done}
      closeOnEscape={!busy && !done}
      showCloseButton={!done}
      title={
        <span className="inline-flex items-center gap-2">
          <KeyRound size={18} className="text-brand-600" aria-hidden="true" />
          {t("auth.password.title")}
        </span>
      }
      overlayClassName="!z-[120] backdrop-blur-none"
      footer={
        done ? null : (
          <div className="flex w-full items-center justify-end gap-2">
            <button
              type="button"
              onClick={close}
              disabled={busy}
              className="group inline-flex min-h-9 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 hover:shadow-md active:translate-y-0 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="inline-flex motion-safe:group-hover:animate-[var(--animate-action-close)]"><X size={14} strokeWidth={2.4} /></span>
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              form="change-password-form"
              disabled={!canSubmit}
              className="group relative inline-flex min-h-9 items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-emerald-500/25 transition-all duration-200 before:absolute before:inset-0 before:-translate-x-full before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent before:transition-transform before:duration-500 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-emerald-500/35 hover:before:translate-x-full active:translate-y-0 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:from-slate-300 disabled:to-slate-300 disabled:shadow-none disabled:hover:translate-y-0"
            >
              <span className="relative z-10 inline-flex motion-safe:group-hover:animate-[var(--animate-action-add)]"><KeyRound size={14} strokeWidth={2.4} /></span>
              <span className="relative z-10">{busy ? t("auth.password.saving") : t("auth.password.save")}</span>
            </button>
          </div>
        )
      }
    >
      {done ? (
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <CheckCircle2 className="h-10 w-10 text-emerald-500" aria-hidden="true" />
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            {t("auth.password.success_signout")}
          </p>
          <p className="text-xs text-slate-500">{t("auth.password.success_signout_hint")}</p>
        </div>
      ) : (
        <form id="change-password-form" onSubmit={submit} className="space-y-3">
          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
            {t("auth.password.current")}
            <div className="relative mt-1">
              <input
                type={show ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => {
                  setCurrentPassword(e.target.value);
                  setError("");
                  if (!e.target.value) {
                    setNewPassword("");
                    setConfirmPassword("");
                  }
                }}
                autoComplete="current-password"
                required
                disabled={busy}
                className={fieldClass({ enabled: true, ok: currentOk })}
              />
            </div>
          </label>

          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
            {t("auth.password.next")}
            <div className="relative mt-1">
              <input
                type={show ? "text" : "password"}
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  setError("");
                  if (e.target.value.length < 12) setConfirmPassword("");
                }}
                autoComplete="new-password"
                required
                minLength={12}
                disabled={!newEnabled || busy}
                className={fieldClass({ enabled: newEnabled, ok: newOk, bad: newTooShort })}
              />
            </div>
            {newTooShort && (
              <p className="mt-1 text-[11px] font-medium text-rose-600">{t("auth.password.too_short")}</p>
            )}
            {newOk && (
              <p className="mt-1 text-[11px] font-medium text-emerald-600">{t("auth.password.new_ok")}</p>
            )}
          </label>

          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
            {t("auth.password.confirm")}
            <div className="relative mt-1">
              <input
                type={show ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setError("");
                }}
                autoComplete="new-password"
                required
                minLength={12}
                disabled={!confirmEnabled || busy}
                className={fieldClass({
                  enabled: confirmEnabled,
                  ok: passwordsMatch,
                  bad: confirmMismatch,
                })}
              />
            </div>
            {confirmMismatch && (
              <p className="mt-1 text-[11px] font-medium text-rose-600">{t("auth.password.mismatch")}</p>
            )}
            {passwordsMatch && (
              <p className="mt-1 text-[11px] font-medium text-emerald-600">{t("auth.password.match_ok")}</p>
            )}
          </label>

          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400"
          >
            {show ? <EyeOff size={14} /> : <Eye size={14} />}
            {show ? t("auth.login.hide_password") : t("auth.login.show_password")}
          </button>

          {error && (
            <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
              {error}
            </p>
          )}
          <p className={`text-[11px] ${passwordsMatch ? "font-medium text-emerald-600" : "text-slate-400"}`}>
            {hint}
          </p>
        </form>
      )}
    </Modal>
  );
}
