import { useRef, useState } from "react";
import { User, Camera, Mail, Phone, Save, X, Loader2 } from "lucide-react";
import { useNotification } from "../../../providers/NotificationProvider";
import { getCurrentUser } from "../services";
import {
  loadStoredProfile,
  saveStoredProfile,
  type StoredProfile,
} from "../storage/settingsStorage";

interface Errors {
  name?: string;
  email?: string;
  mobile?: string;
}

const EMAIL_RE = /^[^s@]+@[^s@]+.[^s@]+$/;

function validateForm(values: StoredProfile): Errors {
  const errors: Errors = {};
  const name = values.name.trim();
  if (!name) errors.name = "Full name is required.";
  else if (name.length < 2) errors.name = "Name must be at least 2 characters.";

  const email = values.email.trim();
  if (!email) errors.email = "Email is required.";
  else if (!EMAIL_RE.test(email)) errors.email = "Enter a valid email address.";

  const mobile = values.mobile.trim();
  if (!mobile) errors.mobile = "Mobile number is required.";
  else if (!/^[+]?[ds-]{8,16}$/.test(mobile))
    errors.mobile = "Enter a valid mobile number (8–16 digits).";

  return errors;
}

export default function ProfileTab() {
  const saved = loadStoredProfile();
  const base = getCurrentUser();
  const notify = useNotification();

  const [values, setValues] = useState<StoredProfile>({
    name: saved.name,
    email: saved.email,
    mobile: saved.mobile,
    profileImage: saved.profileImage,
  });
  const [lastSaved, setLastSaved] = useState<StoredProfile>({ ...saved });
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const setField = (field: keyof StoredProfile, value: string) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    if (errors[field as keyof Errors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const loadPreview = (file: File): void => {
    // Frontend-only photo preview + local persistence. This is NOT a real upload.
    if (file.size > 1.5 * 1024 * 1024) {
      notify.showNotification("Photo must be under 1.5 MB.", "error");
      return;
    }
    if (!file.type.startsWith("image/")) {
      notify.showNotification("Please choose an image file.", "error");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : undefined;
      setValues((prev) => ({ ...prev, profileImage: dataUrl }));
    };
    reader.onerror = () => {
      notify.showNotification("Could not read the selected image.", "error");
    };
    reader.readAsDataURL(file);
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) loadPreview(file);
    e.target.value = "";
  };

  const handleSave = () => {
    const validation = validateForm(values);
    setErrors(validation);
    if (Object.keys(validation).length > 0) {
      notify.showNotification("Please fix the highlighted fields.", "error");
      return;
    }
    const clean: StoredProfile = {
      name: values.name.trim(),
      email: values.email.trim(),
      mobile: values.mobile.trim(),
      profileImage: values.profileImage,
    };
    setSaving(true);
    // Small delay so the disabled save state is visibly honoured (frontend-only).
    window.setTimeout(() => {
      saveStoredProfile(clean);
      setLastSaved({ ...clean });
      setSaving(false);
      notify.showNotification("Profile saved locally.", "success");
    }, 450);
  };

  const handleCancel = () => {
    setValues({ ...lastSaved });
    setErrors({});
    notify.showNotification("Changes reverted.", "info");
  };

  const readOnlyFields: { label: string; value: string }[] = [
    { label: "Username", value: base.username },
    { label: "Department", value: base.department },
    { label: "Designation", value: base.designation ?? base.role },
    { label: "Employee ID", value: base.employeeId },
    { label: "Date Joined", value: base.dateJoined },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col md:flex-row gap-6">
        {/* Photo */}
        <div className="flex flex-col items-center gap-3 w-full md:w-36 shrink-0">
          <div className="h-24 w-24 rounded-full bg-slate-100 border-4 border-white shadow-md flex items-center justify-center overflow-hidden text-slate-400">
            {values.profileImage ? (
              <img src={values.profileImage} alt="Profile" className="h-full w-full object-cover" />
            ) : (
              <User size={40} />
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={handlePhotoChange}
            aria-label="Upload profile photo"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 border border-slate-200 bg-white hover:bg-slate-50 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 transition-colors shadow-sm"
          >
            <Camera size={14} /> Change Photo
          </button>
          <p className="text-[11px] text-slate-400 text-center leading-snug">
            Preview &amp; local save only. Real upload requires the backend API.
          </p>
        </div>

        {/* Fields */}
        <div className="flex-1 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600" htmlFor="profile-name">
                Full Name
              </label>
              <input
                id="profile-name"
                value={values.name}
                onChange={(e) => setField("name", e.target.value)}
                aria-invalid={!!errors.name}
                className={`w-full rounded-xl border px-3.5 py-2 text-sm text-slate-800 outline-none transition-all focus:ring-2 ${
                  errors.name ? "border-rose-400 focus:border-rose-500 focus:ring-rose-100" : "border-slate-200 focus:border-blue-500 focus:ring-blue-100"
                }`}
              />
              {errors.name && <p className="text-[11px] font-medium text-rose-600">{errors.name}</p>}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600" htmlFor="profile-email">
                Email
              </label>
              <div className="relative">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  id="profile-email"
                  type="email"
                  value={values.email}
                  onChange={(e) => setField("email", e.target.value)}
                  aria-invalid={!!errors.email}
                  className={`w-full rounded-xl border pl-9 pr-3.5 py-2 text-sm text-slate-800 outline-none transition-all focus:ring-2 ${
                    errors.email ? "border-rose-400 focus:border-rose-500 focus:ring-rose-100" : "border-slate-200 focus:border-blue-500 focus:ring-blue-100"
                  }`}
                />
              </div>
              {errors.email && <p className="text-[11px] font-medium text-rose-600">{errors.email}</p>}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600" htmlFor="profile-mobile">
                Mobile Number
              </label>
              <div className="relative">
                <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  id="profile-mobile"
                  value={values.mobile}
                  onChange={(e) => setField("mobile", e.target.value)}
                  aria-invalid={!!errors.mobile}
                  className={`w-full rounded-xl border pl-9 pr-3.5 py-2 text-sm text-slate-800 outline-none transition-all focus:ring-2 ${
                    errors.mobile ? "border-rose-400 focus:border-rose-500 focus:ring-rose-100" : "border-slate-200 focus:border-blue-500 focus:ring-blue-100"
                  }`}
                />
              </div>
              {errors.mobile && <p className="text-[11px] font-medium text-rose-600">{errors.mobile}</p>}
            </div>

            {readOnlyFields.map((f) => (
              <div className="space-y-1" key={f.label}>
                <label className="text-xs font-semibold text-slate-600">{f.label}</label>
                <div className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm font-medium text-slate-700">
                  {f.value || "—"}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
        <button
          type="button"
          onClick={handleCancel}
          disabled={saving}
          className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-600 hover:bg-slate-50 shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <X size={15} /> Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-md transition-all disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          {saving ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </div>
  );
}
