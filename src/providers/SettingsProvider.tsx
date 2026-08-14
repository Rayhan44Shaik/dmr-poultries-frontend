import { createContext, useContext, useState, type ReactNode } from 'react';

// NOTE on single sources of truth:
// - Language is owned by LanguageProvider (dmr_language key).
// - Theme is owned by ThemeProvider (dmr_theme_mode key).
// SettingsProvider intentionally does NOT hold language/theme so there is no
// competing state. It keeps only generic, currently-unused business prefs.

interface Settings {
  currency: string;
  dateFormat: string;
}

interface SettingsContextType {
  settings: Settings;
  updateSettings: (newSettings: Partial<Settings>) => void;
  resetSettings: () => void;
}

const defaultSettings: Settings = {
  currency: 'INR',
  dateFormat: 'DD/MM/YYYY',
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

interface SettingsProviderProps {
  children: ReactNode;
}

function readStoredSettings(): Settings {
  try {
    const stored = window.localStorage.getItem('dmr_settings');
    if (!stored) return defaultSettings;
    const parsed = JSON.parse(stored) as Record<string, unknown>;
    return {
      currency: typeof parsed.currency === 'string' ? parsed.currency : defaultSettings.currency,
      dateFormat: typeof parsed.dateFormat === 'string' ? parsed.dateFormat : defaultSettings.dateFormat,
    };
  } catch {
    // Corrupted JSON -> safe defaults.
    return defaultSettings;
  }
}

export const SettingsProvider = ({ children }: SettingsProviderProps) => {
  const [settings, setSettings] = useState<Settings>(readStoredSettings);

  const updateSettings = (newSettings: Partial<Settings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      try {
        window.localStorage.setItem('dmr_settings', JSON.stringify(updated));
      } catch {
        /* storage unavailable */
      }
      return updated;
    });
  };

  const resetSettings = () => {
    setSettings(defaultSettings);
    try {
      window.localStorage.setItem('dmr_settings', JSON.stringify(defaultSettings));
    } catch {
      /* storage unavailable */
    }
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, resetSettings }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) throw new Error('useSettings must be used within SettingsProvider');
  return context;
};
