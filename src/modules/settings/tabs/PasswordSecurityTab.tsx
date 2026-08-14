import { useState } from "react";
import { Lock, Eye, EyeOff, ShieldCheck, ShieldAlert, CheckCircle2 } from "lucide-react";
import { useNotification } from "../../../providers/NotificationProvider";

interface Passwords {
  current: string;
  newPassword: string;
  confirm: string;
}

interface Errors {
  current?: string;
  newPassword?: string;
  confirm?: string;
}

interface StrengthRule {
  label: string;
  ok: boolean;
}

function evaluateStrength(pw: string): StrengthRule[] {
  return [
    { label: "At least 8 characters", ok: pw.length >= 8 },
    { label: "At least one uppercase letter", ok: /[A-Z]/.test(pw) },
    { label: "At least one number", ok: /[0-9]/.test(pw) },
    { label: "At least one symbol", ok: /[^A-Za-z0-9]/.test(pw) },
  ];
}

function strengthScore(pw: string): number {
  return evaluateStrength(pw).filter((r) => r.ok).length;
}

export default function PasswordSecurityTab() {
  const notify = useNotification();
  const [passwords, setPasswords] = useState<Passwords>({ current: "", newPassword: "", confirm: "" });
  const [show, setShow] = useState<{ current: boolean; newPassword: boolean; confirm: boolean }>({
    current: false,
    newPassword: false,
    confirm: false,
  });
  const [errors, setErrors] = useState<Errors>({});
  const [submitted, setSubmitted] = useState(false);

  const setField = (field: keyof Passwords, value: string) => {
    setPasswords((prev) => ({ ...prev, [field]: value }));
    if (errors[field as keyof Errors]) setErrors((prev) => ({ ...prev, [field]: undefined }));
    setSubmitted(false);
  };

  const toggleShow = (field: keyof typeof show) =>
    setShow((prev) => ({ ...prev, [field]: !prev[field] }));

  const handleSubmit = () => {
    const validation: Errors = {};
    if (!passwords.current) validation.current = "Current password is required.";
    if (!passwords.newPassword) validation.newPassword = "New password is required.";
    else {
      if (passwords.newPassword.length < 8)
        validation.newPassword = "New password must be at least 8 characters.";
      else if (strengthScore(passwords.newPassword) < 3)
        validation.newPassword = "New password is too weak — meet at least 3 strength rules.";
      if (passwords.newPassword === passwords.current)
        validation.newPassword = "New password must be different from the current password.";
    }
    if (!passwords.confirm) validation.confirm = "Please confirm your new password.";
    else if (passwords.confirm !== passwords.newPassword)
      validation.confirm = "Passwords do not match.";

    setErrors(validation);
    if (Object.keys(validation).length > 0) {
      notify.showNotification("Please fix the highlighted fields.", "error");
      return;
    }

    // Validation passed. Clear sensitive fields. NEVER persist or log password values.
    setPasswords({ current: "", newPassword: "", confirm: "" });
    setSubmitted(true);
    notify.showNotification(
      "Password validation completed. Server password update requires the authentication API.",
      "success"
    );
  };

  const fields: { key: keyof Passwords; label: string; placeholder: string }[] = [
    { key: "current", label: "Current Password", placeholder: "Enter current password" },
    { key: "newPassword", label: "New Password", placeholder: "Enter new password" },
    { key: "confirm", label: "Confirm New Password", placeholder: "Confirm new password" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col md:flex-row gap-6">
        <div className="flex items-center justify-center w-full md:w-1/3 shrink-0 relative text-purple-600 py-6">
          <Lock size={80} className="opacity-90 drop-shadow-sm" />
          <div className="absolute right-12 bottom-4 bg-white rounded-full p-1 shadow-md border border-slate-100">
            <ShieldCheck size={24} className="text-emerald-500" />
          </div>
        </div>

        <div className="flex-1 flex flex-col gap-4">
          {fields.map((f) => {
            const err = errors[f.key];
            return (
              <div className="space-y-1" key={f.key}>
                <label className="text-xs font-semibold text-slate-600" htmlFor={"pwd-" + f.key}>
                  {f.label}
                </label>
                <div className="relative">
                  <input
                    id={"pwd-" + f.key}
                    type={show[f.key] ? "text" : "password"}
                    value={passwords[f.key]}
                    onChange={(e) => setField(f.key, e.target.value)}
                    placeholder={f.placeholder}
                    aria-invalid={!!err}
                    autoComplete={f.key === "current" ? "current-password" : "new-password"}
                    className={`w-full rounded-xl border px-3.5 py-2 pr-10 text-sm font-medium outline-none transition-all focus:ring-2 ${
                      err
                        ? "border-rose-400 focus:border-rose-500 focus:ring-rose-100"
                        : "border-slate-200 focus:border-blue-500 focus:bg-white focus:ring-blue-100"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => toggleShow(f.key)}
                    aria-label={show[f.key] ? "Hide " + f.label : "Show " + f.label}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {show[f.key] ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {err && <p className="text-[11px] font-medium text-rose-600">{err}</p>}
              </div>
            );
          })}

          {/* Strength meter (only once a new password is typed) */}
          {passwords.newPassword && (
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-500">Password strength</span>
                <span
                  className={`text-[11px] font-bold ${
                    strengthScore(passwords.newPassword) >= 4
                      ? "text-emerald-600"
                      : strengthScore(passwords.newPassword) >= 3
                      ? "text-amber-600"
                      : "text-rose-600"
                  }`}
                >
                  {strengthScore(passwords.newPassword) >= 4
                    ? "Strong"
                    : strengthScore(passwords.newPassword) >= 3
                    ? "Medium"
                    : "Weak"}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                {evaluateStrength(passwords.newPassword).map((rule) => (
                  <div key={rule.label} className="flex items-center gap-1.5">
                    {rule.ok ? (
                      <CheckCircle2 size={12} className="text-emerald-500" />
                    ) : (
                      <span className="w-3 h-3 rounded-full border border-slate-300 bg-white" />
                    )}
                    <span className={"text-[11px] " + (rule.ok ? "text-slate-600" : "text-slate-400")}>
                      {rule.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {submitted && (
            <div className="flex items-start gap-2 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-medium">
              <ShieldCheck size={16} className="text-emerald-600 shrink-0 mt-0.5" />
              <span>
                Password validation completed. Server password update requires the authentication API.
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Session / security info (frontend-verifiable only) */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
        <div className="flex items-center gap-2 mb-2">
          <ShieldAlert size={16} className="text-indigo-500" />
          <h4 className="text-xs font-bold text-slate-700">Session &amp; Security</h4>
        </div>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-xs text-slate-600">
          <li className="flex justify-between gap-2">
            <span className="text-slate-400">Login status</span>
            <span className="font-medium text-emerald-600">Signed in</span>
          </li>
          <li className="flex justify-between gap-2">
            <span className="text-slate-400">Session storage</span>
            <span className="font-medium">Local (browser)</span>
          </li>
          <li className="flex justify-between gap-2">
            <span className="text-slate-400">Server password sync</span>
            <span className="font-medium text-slate-500">Not configured</span>
          </li>
          <li className="flex justify-between gap-2">
            <span className="text-slate-400">2FA</span>
            <span className="font-medium text-slate-500">—</span>
          </li>
        </ul>
        <p className="text-[11px] text-slate-400 mt-2 leading-snug">
          This section reflects info the browser can confirm. Server-side session details and password
          persistence require the authentication backend.
        </p>
      </div>

      <div className="pt-4 border-t border-slate-100 flex justify-end">
        <button
          type="button"
          onClick={handleSubmit}
          className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold shadow-md transition-all"
        >
          Update Password
        </button>
      </div>
    </div>
  );
}
