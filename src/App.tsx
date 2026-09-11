import { BrowserRouter, Navigate, useLocation } from 'react-router-dom';
import ErrorBoundary from './components/common/ErrorBoundary';
import { I18nProvider } from './i18n';
import { ThemeProvider } from './providers/ThemeProvider';
import { AuthProvider } from './providers/AuthProvider';
import { useAuth } from './providers/authContext';
import { SettingsProvider } from './providers/SettingsProvider';
import { NotificationProvider } from './providers/NotificationProvider';
import { ToastProvider } from './components/common/ToastProvider';
import NotificationHost from './ui/notifications/NotificationHost';
import ConfirmHost from './ui/confirm/ConfirmHost';
import AppRoutes from './routes/AppRoutes';

function SessionGate() {
  const { loading, isAuthenticated } = useAuth();
  const location = useLocation();
  if (loading) return <div className="flex h-dvh items-center justify-center">Loading…</div>;
  const isPublic = location.pathname === '/' || location.pathname.startsWith('/mobile');
  if (!isPublic && !isAuthenticated) return <Navigate to="/" replace />;
  if (location.pathname === '/' && isAuthenticated) return <Navigate to="/dashboard" replace />;
  return <AppRoutes />;
}

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <I18nProvider>
          <ThemeProvider>
            <AuthProvider>
              <SettingsProvider>
                <NotificationProvider>
                  <ToastProvider>
                    <SessionGate />
                    {/* Single renderer for every notification in the app.
                        Both providers above are adapters onto the same store,
                        so one action produces exactly one toast. */}
                    <NotificationHost />
                    {/* Single confirmation dialog, driven by `confirmDialog()`.
                        Notification z-index (90) sits above the dialog (60) on
                        purpose: transient feedback should never be hidden
                        behind a modal. */}
                    <ConfirmHost />
                  </ToastProvider>
                </NotificationProvider>
              </SettingsProvider>
            </AuthProvider>
          </ThemeProvider>
        </I18nProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
