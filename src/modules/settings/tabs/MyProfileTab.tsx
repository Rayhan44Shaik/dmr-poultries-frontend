import { useRef, useState } from "react";
import { User, Mail, Phone, Save, X, Loader2, ShieldCheck, KeyRound, Eye, EyeOff, CheckCircle2, Globe, Edit3, Check } from "lucide-react";
import { useNotification } from "../../../providers/NotificationProvider";
import { useLanguage } from "../../../providers/languageContext";
import { getCurrentUser } from "../services";
import { loadStoredProfile, saveStoredProfile, type StoredProfile } from "../storage/settingsStorage";
import { LANGUAGES } from "../constants";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface ProfileErrors { name?: string; email?: string; mobile?: string }

function validateProfile(v: StoredProfile): ProfileErrors {
  const e: ProfileErrors = {};
  const name = v.name.trim();
  if (!name) e.name = "Full name is required.";
  else if (name.length < 2) e.name = "Name must be at least 2 characters.";
  const email = v.email.trim();
  if (!email) e.email = "Email is required.";
  else if (!EMAIL_RE.test(email)) e.email = "Enter a valid email address.";
  const mobile = v.mobile.trim();
  if (!mobile) e.mobile = "Mobile number is required.";
  else if (!/^[+]?[0-9\s-]{8,16}$/.test(mobile)) e.mobile = "Enter a valid mobile number (8–16 digits).";
  return e;
}

interface Passwords { current: string; newPassword: string; confirm: string }
type PassErrorKey = keyof Passwords;

function evaluateStrength(pw: string): { label: string; ok: boolean }[] {
  return [
    { label: "At least 8 characters", ok: pw.length >= 8 },
    { label: "At least one uppercase letter", ok: /[A-Z]/.test(pw) },
    { label: "At least one number", ok: /[0-9]/.test(pw) },
    { label: "At least one symbol", ok: /[^A-Za-z0-9]/.test(pw) },
  ];
}

function strengthScore(pw: string): number { return evaluateStrength(pw).filter((r) => r.ok).length; }

function SectionCard({ icon, title, subtitle, children }: { icon: React.ReactNode; title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200/90 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center gap-2.5 border-b border-slate-100 px-5 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">{icon}</div>
        <div>
          <h3 className="text-sm font-bold text-slate-800">{title}</h3>
          {subtitle && <p className="text-[11px] text-slate-400">{subtitle}</p>}
        </div>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function inputCls(error?: string, extra = ""): string {
  return "w-full rounded-xl border px-3.5 py-2 text-sm text-slate-800 outline-none transition-all focus:ring-2 " + extra + " " + (error ? "border-rose-400 focus:border-rose-500 focus:ring-rose-100" : "border-slate-200 focus:border-blue-500 focus:ring-blue-100");
}

function pwInputCls(error?: string): string {
  return "w-full rounded-xl border px-3.5 py-2 pr-10 text-sm font-medium outline-none transition-all focus:ring-2 " + (error ? "border-rose-400 focus:border-rose-500 focus:ring-rose-100" : "border-slate-200 focus:border-blue-500 focus:bg-white focus:ring-blue-100");
}

function pwStrengthLabel(pw: string): string { const s = strengthScore(pw); return s >= 4 ? "Strong" : s >= 3 ? "Medium" : "Weak"; }
function pwStrengthColor(pw: string): string { const s = strengthScore(pw); return s >= 4 ? "text-emerald-600" : s >= 3 ? "text-amber-600" : "text-rose-600"; }

export default function MyProfileTab() {
  const notify = useNotification();
  const { locale, setLocale } = useLanguage();
  const base = getCurrentUser();
  const saved = loadStoredProfile();

  const [values, setValues] = useState<StoredProfile>({ name: saved.name, email: saved.email, mobile: saved.mobile, profileImage: saved.profileImage });
  const [lastSaved, setLastSaved] = useState<StoredProfile>({ ...saved });
  const [pErrors, setPErrors] = useState<ProfileErrors>({});
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [pw, setPw] = useState<Passwords>({ current: "", newPassword: "", confirm: "" });
  const [show, setShow] = useState<Record<PassErrorKey, boolean>>({ current: false, newPassword: false, confirm: false });
  const [pwErrors, setPwErrors] = useState<Partial<Passwords>>({});
  const [pwDone, setPwDone] = useState(false);

  const [langDraft, setLangDraft] = useState<string>(locale);
  const langChanged = langDraft !== locale;

  const setProfileField = (field: keyof StoredProfile, value: string) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    if (pErrors[field as keyof ProfileErrors]) setPErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const loadPreview = (file: File) => {
    if (file.size > 1.5 * 1024 * 1024) { notify.showNotification("Photo must be under 1.5 MB.", "error"); return; }
    if (!file.type.startsWith("image/")) { notify.showNotification("Please choose an image file.", "error"); return; }
    const reader = new FileReader();
    reader.onload = () => setValues((prev) => ({ ...prev, profileImage: typeof reader.result === "string" ? reader.result : prev.profileImage }));
    reader.onerror = () => notify.showNotification("Could not read the selected image.", "error");
    reader.readAsDataURL(file);
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (file) loadPreview(file); e.target.value = ""; };

  const handleProfileSave = () => {
    const validation = validateProfile(values);
    setPErrors(validation);
    if (Object.keys(validation).length > 0) { notify.showNotification("Please fix the highlighted fields.", "error"); return; }
    const clean: StoredProfile = { name: values.name.trim(), email: values.email.trim(), mobile: values.mobile.trim(), profileImage: values.profileImage };
    setSaving(true);
    window.setTimeout(() => { saveStoredProfile(clean); setLastSaved({ ...clean }); setSaving(false); notify.showNotification("Profile saved locally.", "success"); }, 400);
  };

  const handleProfileCancel = () => { setValues({ ...lastSaved }); setPErrors({}); notify.showNotification("Profile changes reverted.", "info"); };

  const setPwField = (field: PassErrorKey, value: string) => { setPw((prev) => ({ ...prev, [field]: value })); if (pwErrors[field]) setPwErrors((prev) => ({ ...prev, [field]: undefined })); setPwDone(false); };
  const toggleShow = (field: PassErrorKey) => setShow((prev) => ({ ...prev, [field]: !prev[field] }));

  const handlePassword = () => {
    const errs: Partial<Passwords> = {};
    if (!pw.current) errs.current = "Current password is required.";
    if (!pw.newPassword) errs.newPassword = "New password is required.";
    else {
      if (pw.newPassword.length < 8) errs.newPassword = "New password must be at least 8 characters.";
      else if (strengthScore(pw.newPassword) < 3) errs.newPassword = "New password is too weak — meet at least 3 strength rules.";
      if (pw.newPassword === pw.current) errs.newPassword = "New password must be different from the current password.";
    }
    if (!pw.confirm) errs.confirm = "Please confirm your new password.";
    else if (pw.confirm !== pw.newPassword) errs.confirm = "Passwords do not match.";
    setPwErrors(errs);
    if (Object.keys(errs).length > 0) { notify.showNotification("Please fix the highlighted fields.", "error"); return; }
    setPw({ current: "", newPassword: "", confirm: "" }); setPwDone(true);
    notify.showNotification("Password validation completed. Server password update requires the authentication API.", "success");
  };

  const applyLanguage = () => { const next = langDraft === "te" ? "te" : "en"; setLocale(next); notify.showNotification(next === "te" ? "Telugu is now the active application language." : "English is now the active application language.", "success"); };

  const pwFields: { key: PassErrorKey; label: string; placeholder: string }[] = [
    { key: "current", label: "Current Password", placeholder: "Enter current password" },
    { key: "newPassword", label: "New Password", placeholder: "Enter new password" },
    { key: "confirm", label: "Confirm New Password", placeholder: "Confirm new password" },
  ];

  const readOnlyFields = [
    { label: "Username", value: base.username },
    { label: "Department", value: base.department },
    { label: "Designation", value: base.designation ?? base.role },
    { label: "Employee ID", value: base.employeeId },
    { label: "Date Joined", value: base.dateJoined },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm">
        <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-slate-400 ring-4 ring-white shadow-md">
          {values.profileImage ? <img src={values.profileImage} alt="Profile" className="h-full w-full object-cover" /> : <User size={36} />}
        </div>
        <div className="flex-1"><h3 className="text-lg font-bold text-slate-900">{base.name}</h3><p className="text-sm font-medium text-slate-600">{base.role} · {base.department}</p></div>
        <input ref={fileInputRef} type="file" accept="image/*" className="sr-only" onChange={handlePhotoChange} aria-label="Upload profile photo" />
        <button type="button" onClick={() => fileInputRef.current?.click()} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"><Edit3 size={15} /> Change Photo</button>
      </div>

      <SectionCard icon={<User size={18} />} title="Personal Information" subtitle="Editable contact details">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="space-y-1"><label className="text-xs font-semibold text-slate-600">Full Name</label><input value={values.name} onChange={(e) => setProfileField("name", e.target.value)} aria-invalid={!!pErrors.name} className={inputCls(pErrors.name)} />{pErrors.name && <p className="text-[11px] font-medium text-rose-600">{pErrors.name}</p>}</div>
          <div className="space-y-1"><label className="text-xs font-semibold text-slate-600">Email</label><div className="relative"><Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input type="email" value={values.email} onChange={(e) => setProfileField("email", e.target.value)} aria-invalid={!!pErrors.email} className={inputCls(pErrors.email, "pl-9")} /></div>{pErrors.email && <p className="text-[11px] font-medium text-rose-600">{pErrors.email}</p>}</div>
          <div className="space-y-1"><label className="text-xs font-semibold text-slate-600">Mobile Number</label><div className="relative"><Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={values.mobile} onChange={(e) => setProfileField("mobile", e.target.value)} aria-invalid={!!pErrors.mobile} className={inputCls(pErrors.mobile, "pl-9")} /></div>{pErrors.mobile && <p className="text-[11px] font-medium text-rose-600">{pErrors.mobile}</p>}</div>
        </div>
        <div className="mt-5 flex justify-end gap-3 border-t border-slate-100 pt-4">
          <button type="button" onClick={handleProfileCancel} disabled={saving} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-5 py-2 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50 transition-colors disabled:opacity-50"><X size={15} /> Cancel</button>
          <button type="button" onClick={handleProfileSave} disabled={saving} className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-md hover:bg-blue-700 transition-all disabled:opacity-60">{saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}{saving ? "Saving…" : "Save Changes"}</button>
        </div>
      </SectionCard>

      <SectionCard icon={<ShieldCheck size={18} />} title="Account Information" subtitle="Read-only account details">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {readOnlyFields.map((f) => (
            <div className="space-y-1" key={f.label}><label className="text-xs font-semibold text-slate-600">{f.label}</label><div className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm font-medium text-slate-700">{f.value || "—"}</div></div>
          ))}
        </div>
      </SectionCard>

      <SectionCard icon={<KeyRound size={18} />} title="Security" subtitle="Change your password">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {pwFields.map((f) => { const err = pwErrors[f.key]; return (
            <div className="space-y-1" key={f.key}><label className="text-xs font-semibold text-slate-600">{f.label}</label><div className="relative"><input id={"pwd-" + f.key} type={show[f.key] ? "text" : "password"} value={pw[f.key]} onChange={(e) => setPwField(f.key, e.target.value)} placeholder={f.placeholder} aria-invalid={!!err} autoComplete={f.key === "current" ? "current-password" : "new-password"} className={pwInputCls(err)} /><button type="button" onClick={() => toggleShow(f.key)} aria-label={show[f.key] ? "Hide " + f.label : "Show " + f.label} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">{show[f.key] ? <EyeOff size={16} /> : <Eye size={16} />}</button></div>{err && <p className="text-[11px] font-medium text-rose-600">{err}</p>}</div>
          ); })}
        </div>
        {pw.newPassword && (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/70 p-3 space-y-1.5"><div className="flex items-center justify-between"><span className="text-[11px] font-semibold text-slate-500">Password strength</span><span className={"text-[11px] font-bold " + pwStrengthColor(pw.newPassword)}>{pwStrengthLabel(pw.newPassword)}</span></div><div className="grid grid-cols-2 gap-x-4 gap-y-1">{evaluateStrength(pw.newPassword).map((rule) => (<div key={rule.label} className="flex items-center gap-1.5">{rule.ok ? <CheckCircle2 size={12} className="text-emerald-500" /> : <span className="h-3 w-3 rounded-full border border-slate-300 bg-white" />}<span className={"text-[11px] " + (rule.ok ? "text-slate-600" : "text-slate-400")}>{rule.label}</span></div>))}</div></div>
        )}
        {pwDone && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-medium text-emerald-800"><ShieldCheck size={16} className="shrink-0 text-emerald-600" /><span>Password validation completed. Server password update requires the authentication API.</span></div>
        )}
        <div className="mt-5 flex justify-end border-t border-slate-100 pt-4"><button type="button" onClick={handlePassword} className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-5 py-2 text-sm font-semibold text-white shadow-md hover:bg-purple-700 transition-all"><KeyRound size={15} /> Update Password</button></div>
      </SectionCard>

      <SectionCard icon={<Globe size={18} />} title="Language & Regional Preference" subtitle="Application language">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex-1"><label className="text-xs font-semibold text-slate-600 block mb-2">Application Language</label><div className="flex flex-wrap items-center gap-3"><select value={langDraft} onChange={(e) => setLangDraft(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 outline-none focus:border-emerald-500">{LANGUAGES.map((l) => (<option key={l.id} value={l.id}>{l.flag} {l.name}</option>))}</select><span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700"><Check size={12} /> {locale === "te" ? "తెలుగు active" : "English active"}</span></div></div>
          <button type="button" onClick={applyLanguage} disabled={!langChanged} className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-md hover:bg-blue-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed">Apply Language</button>
        </div>
        <p className="mt-3 text-[11px] text-slate-400 leading-relaxed">The selected language applies globally across the application chrome and supported module labels. Business data and IDs are never translated.</p>
      </SectionCard>
    </div>
  );
}
