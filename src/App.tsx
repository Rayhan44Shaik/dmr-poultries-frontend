import { BrowserRouter } from 'react-router-dom';
import { I18nProvider } from './i18n';
import { ThemeProvider } from './providers/ThemeProvider';
import { AuthProvider } from './providers/AuthProvider';
import { SettingsProvider } from './providers/SettingsProvider';
import { NotificationProvider } from './providers/NotificationProvider';
import { ToastProvider } from './components/common/ToastProvider';
import AppRoutes from './routes/AppRoutes';

function App() {
  return (
    <BrowserRouter>
      <I18nProvider>
        <ThemeProvider>
          <AuthProvider>
            <SettingsProvider>
              <NotificationProvider>
                <ToastProvider>
                  <AppRoutes />
                </ToastProvider>
              </NotificationProvider>
            </SettingsProvider>
          </AuthProvider>
        </ThemeProvider>
      </I18nProvider>
    </BrowserRouter>
  );
}

export default App;