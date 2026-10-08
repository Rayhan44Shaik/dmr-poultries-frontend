import { useAuth } from "../../../providers/authContext";
import AccessManagement from "./AccessManagement";
import Profile from "./Profile_copy";

/**
 * Settings is intentionally one continuous workspace. Profile information and
 * preferences come first; authorized users then continue directly into the
 * paginated employee access directory without switching views.
 */
export default function SettingsPage() {
  const { user } = useAuth();
  const canViewAccess = user?.role === "OWNER" || user?.role === "FULL_ACCESS";

  return (
    <main className="min-h-screen w-full bg-slate-50/50 px-3 pb-10 pt-4 text-slate-800 sm:px-6 lg:px-8 dark:bg-slate-950/40 dark:text-slate-100">
      <div className="mx-auto max-w-[1480px] space-y-8">
        <Profile />
        {canViewAccess && <AccessManagement />}
      </div>
    </main>
  );
}
