// src/routes/RequireAccess.tsx
// -----------------------------------------------------------------------------
// Route-level role guard.
//
// Wraps every authenticated route element. On EVERY location change (including
// `?tab=` switches inside the hub sections) it re-checks the signed-in role's
// access; a role that deep-links or pallettes into a page it may not open is
// redirected to its landing page with a short explanation — never a blank
// screen or a half-loaded page.
// -----------------------------------------------------------------------------
import { Suspense, useEffect, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../providers/authContext";
import { landingPathForRole, canAccessLocation } from "../modules/auth/permissions";
import { useSafeNotification } from "../hooks/useSafeNotification";
import { useI18n } from "../i18n";

export default function RequireAccess({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();
  const { t } = useI18n();
  const { showNotification } = useSafeNotification();

  const allowed = canAccessLocation(user?.role, location.pathname, location.search);

  useEffect(() => {
    if (!allowed) {
      showNotification(t("auth.access.denied_toast"), "error");
    }
  }, [allowed, showNotification, t]);

  if (!allowed) {
    return (
      <Navigate
        to={landingPathForRole(user?.role)}
        replace
      />
    );
  }
  return <Suspense fallback={null}>{children}</Suspense>;
}
