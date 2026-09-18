import { BrowserRouter } from 'react-router-dom';
import ErrorBoundary from './components/common/ErrorBoundary';
import { I18nProvider } from './i18n';
import { AuthProvider } from './providers/AuthProvider';
import { ThemeProvider } from './providers/ThemeProvider';
import { FontScaleProvider } from './providers/FontScaleProvider';
import { SettingsProvider } from './providers/SettingsProvider';
import { NotificationProvider } from './providers/NotificationProvider';
import { ToastProvider } from './components/common/ToastProvider';
import NotificationHost from './ui/notifications/NotificationHost';
import ConfirmHost from './ui/confirm/ConfirmHost';
import AuthGate from './routes/AuthGate';
import AppRoutes from './routes/AppRoutes';

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <I18nProvider>
            <ThemeProvider>
              <FontScaleProvider>
                <SettingsProvider>
                  <NotificationProvider>
                    <ToastProvider>
                      <AuthGate>
                        <AppRoutes />
                      </AuthGate>
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
              </FontScaleProvider>
            </ThemeProvider>
          </I18nProvider>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
