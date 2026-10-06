// src/modules/auth/MfaSettingsDialog.tsx
// Self-service two-factor authentication (TOTP) management.
//
// Mirrors ChangePasswordDialog conventions. Flow:
//   disabled -> [Enable] -> enroll (secret shown once) -> confirm code ->
//     recovery codes (shown once) -> enabled.
//   enabled -> enter current code -> [Turn off] -> disabled.
//
// The secret and recovery codes are never stored client-side beyond the
// enrollment ceremony — they live in component state and are cleared on
// close. All crypto stays server-side (see POST /auth/mfa/*).
import { useEffect, useState, type FormEvent } from "react";
import { CheckCircle2, Copy, ShieldCheck } from "lucide-react";
import {
  mfaConfirmRequest,
  mfaDisableRequest,
  mfaEnrollRequest,
  mfaStatusRequest,
} from "./authApi";
import Modal from "../../ui/Modal";

type Props = {
  open: boolean;
  onClose: () => void;
};

function mfaErrorMessage(cause: unknown, fallback: string): string {
  const message = cause instanceof Error ? cause.message : "";
  if (/expired|ticket/i.test(message)) {
    return "This enrollment expired. Start again to get a fresh code.";
  }
  if (/invalid|incorrect|wrong|code/i.test(message)) {
    return "That 6-digit code didn't work. Check your authenticator app time and try again.";
  }
  if (/already/i.test(message)) {
    return "Two-factor authentication is already set up for this account.";
  }
  return message?.trim() || fallback;
}

async function copyText(value: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // fall through to the legacy path
  }
  try {
    const area = document.createElement("textarea");
    area.value = value;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

export default function MfaSettingsDialog({ open, onClose }: Props) {
  const [status, setStatus] = useState<"loading" | "enabled" | "disabled">("loading");
  const [enroll, setEnroll] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [code, setCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [disabling, setDisabling] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const reset = () => {
    setStatus("loading");
    setEnroll(null);
    setCode("");
    setRecoveryCodes(null);
    setDisabling(false);
    setBusy(false);
    setError("");
    setCopied(null);
  };

  useEffect(() => {
    if (!open) return;
    reset();
    let cancelled = false;
    void (async () => {
      try {
        const current = await mfaStatusRequest();
        if (!cancelled) setStatus(current.enabled ? "enabled" : "disabled");
      } catch (cause) {
        if (!cancelled) {
          setStatus("disabled");
          setError(mfaErrorMessage(cause, "Couldn't load two-factor status. Try again."));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open ]);

  const close = () => {
    if (busy) return;
    reset();
    onClose();
  };

  const startEnroll = async () => {
    setBusy(true);
    setError("");
    try {
      const fresh = await mfaEnrollRequest();
      setEnroll(fresh);
      setCode("");
    } catch (cause) {
      setError(mfaErrorMessage(cause, "Couldn't start enrollment. Try again."));
    } finally {
      setBusy(false);
    }
  };

  const confirmEnroll = async (event: FormEvent) => {
    event.preventDefault();
    if (code.trim().length !== 6 || busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await mfaConfirmRequest(code.trim());
      setRecoveryCodes(result.recoveryCodes);
      setStatus("enabled");
      setEnroll(null);
      setCode("");
    } catch (cause) {
      setError(mfaErrorMessage(cause, "Couldn't confirm. Try again."));
    } finally {
      setBusy(false);
    }
  };

  const disableMfa = async (event: FormEvent) => {
    event.preventDefault();
    if (code.trim().length !== 6 || busy) return;
    setBusy(true);
    setError("");
    try {
      await mfaDisableRequest(code.trim());
      setStatus("disabled");
      setDisabling(false);
      setCode("");
    } catch (cause) {
      setError(mfaErrorMessage(cause, "Couldn't turn off two-factor. Try again."));
    } finally {
      setBusy(false);
    }
  };

  const onCopy = async (label: string, value: string) => {
    setCopied(null);
    if (await copyText(value)) {
      setCopied(label);
      window.setTimeout(() => setCopied((current) => (current === label ? null : current)), 1600);
    } else {
      setError("Copy isn't available here — select the text and copy it manually.");
    }
  };

  const codeInput = (
    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
      6-digit code from your authenticator app
      <input
        inputMode="numeric"
        autoComplete="one-time-code"
        value={code}
        onChange={(event) => {
          setCode(event.target.value.replace(/\D/g, "").slice(0, 6));
          setError("");
        }}
        disabled={busy}
        maxLength={6}
        placeholder="123456"
        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-center text-lg font-bold tracking-[0.3em] text-slate-800 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
      />
    </label>
  );

  return (
    <Modal
      open={open}
      onClose={close}
      size="sm"
      closeOnOverlay={!busy}
      closeOnEscape={!busy}
      title={
        <span className="inline-flex items-center gap-2">
          <ShieldCheck size={18} className="text-brand-600" aria-hidden="true" />
          Two-factor authentication
        </span>
      }
      overlayClassName="!z-[120]"
      footer={
        <>
          <button
            type="button"
            onClick={close}
            disabled={busy}
            className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-60 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Close
          </button>
          {status === "disabled" && !enroll && !recoveryCodes && (
            <button
              type="button"
              onClick={() => void startEnroll()}
              disabled={busy}
              className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? "Starting…" : "Enable"}
            </button>
          )}
        </>
      }
    >
      {status === "loading" ? (
        <p className="py-6 text-center text-sm text-slate-500">Loading two-factor status…</p>
      ) : recoveryCodes ? (
        <div className="space-y-3">
          <div className="flex flex-col items-center gap-2 py-1 text-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-500" aria-hidden="true" />
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              Two-factor authentication is on.
            </p>
          </div>
          <p className="text-xs leading-relaxed text-slate-500">
            Save these recovery codes somewhere safe. Each works once if you lose your
            authenticator app. They will never be shown again.
          </p>
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 font-mono text-xs leading-6 text-slate-800">
            {recoveryCodes.map((value) => (
              <div key={value}>{value}</div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => void onCopy("recovery", recoveryCodes.join("\n"))}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <Copy size={13} /> {copied === "recovery" ? "Copied!" : "Copy codes"}
          </button>
        </div>
      ) : status === "enabled" && !disabling ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs font-semibold text-emerald-800">
            <ShieldCheck size={15} className="shrink-0 text-emerald-600" />
            Two-factor authentication is protecting this account.
          </div>
          <p className="text-xs leading-relaxed text-slate-500">
            You will be asked for a 6-digit code each time you sign in. To turn it off,
            you must confirm with a current code.
          </p>
          <button
            type="button"
            onClick={() => {
              setDisabling(true);
              setCode("");
              setError("");
            }}
            className="rounded-lg border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50"
          >
            Turn off…
          </button>
        </div>
      ) : status === "enabled" ? (
        <form onSubmit={disableMfa} className="space-y-3">
          <p className="text-xs leading-relaxed text-slate-500">
            Enter a current code from your authenticator app to turn off two-factor
            authentication.
          </p>
          {codeInput}
          {error && (
            <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setDisabling(false);
                setCode("");
                setError("");
              }}
              disabled={busy}
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-60 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Keep it on
            </button>
            <button
              type="submit"
              disabled={code.trim().length !== 6 || busy}
              className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? "Turning off…" : "Turn off"}
            </button>
          </div>
        </form>
      ) : enroll ? (
        <form onSubmit={confirmEnroll} className="space-y-3">
          <ol className="list-decimal space-y-1 pl-5 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
            <li>Open your authenticator app (Google/Microsoft Authenticator, 1Password, …).</li>
            <li>Add an account with the secret key below, or enter this setup URL manually.</li>
            <li>Enter the 6-digit code it shows to finish.</li>
          </ol>
          <div>
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">Secret key</p>
            <div className="mt-1 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-600 dark:bg-slate-800">
              <code className="flex-1 break-all font-mono text-xs text-slate-800 dark:text-slate-100">
                {enroll.secret}
              </code>
              <button
                type="button"
                onClick={() => void onCopy("secret", enroll.secret)}
                aria-label="Copy secret key"
                className="shrink-0 rounded p-1 text-slate-500 hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-700"
              >
                <Copy size={14} />
              </button>
            </div>
            {copied === "secret" && (
              <p className="mt-1 text-[11px] font-medium text-emerald-600">Secret copied.</p>
            )}
          </div>
          <details className="text-xs text-slate-500">
            <summary className="cursor-pointer font-semibold text-slate-600 dark:text-slate-300">
              Manual setup URL
            </summary>
            <code className="mt-1 block break-all rounded-lg bg-slate-50 px-2 py-1.5 font-mono text-[11px] dark:bg-slate-800">
              {enroll.otpauthUrl}
            </code>
          </details>
          {codeInput}
          {error && (
            <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={code.trim().length !== 6 || busy}
            className="w-full rounded-lg bg-brand-600 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Verifying…" : "Verify and enable"}
          </button>
        </form>
      ) : (
        <div className="space-y-3">
          <p className="text-xs leading-relaxed text-slate-500">
            Add a second step to signing in: after your password you will enter a 6-digit
            code from an authenticator app on your phone. Even if someone learns your
            password, they cannot sign in without your phone.
          </p>
          {error && (
            <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
              {error}
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}
