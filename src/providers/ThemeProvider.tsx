import {
  useState,
  useEffect,
  useCallback,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { ThemeContext } from './themeContext';
import type { ThemeMode } from './themeTypes';

interface ThemeProviderProps {
  children: ReactNode;
}

const SYSTEM_QUERY = '(prefers-color-scheme: dark)';

function readStoredMode(): ThemeMode {
  try {
    const stored = window.localStorage.getItem('dmr_theme_mode');
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  } catch {
    /* storage unavailable */
  }
  return 'light';
}

function subscribeSystemDark(callback: () => void): () => void {
  const mq = window.matchMedia(SYSTEM_QUERY);
  mq.addEventListener('change', callback);
  return () => mq.removeEventListener('change', callback);
}

function getSystemDark(): boolean {
  try {
    return window.matchMedia(SYSTEM_QUERY).matches;
  } catch {
    return false;
  }
}

export const ThemeProvider = ({ children }: ThemeProviderProps) => {
  const [themeMode, setThemeMode] = useState<ThemeMode>(readStoredMode);
  // Live subscription to the OS color-scheme preference (idiomatic to React
  // and avoids cascading renders — the lint-guarded alternative to a manual
  // matchMedia sync inside an effect body).
  const systemDark = useSyncExternalStore(subscribeSystemDark, getSystemDark, getSystemDark);

  const resolved = themeMode === 'system' ? (systemDark ? 'dark' : 'light') : themeMode;

  useEffect(() => {
    document.documentElement.classList.toggle('dark', resolved === 'dark');
    try {
      window.localStorage.setItem('dmr_theme_mode', themeMode);
    } catch {
      /* storage unavailable */
    }
  }, [resolved, themeMode]);

  const setTheme = useCallback((mode: ThemeMode) => {
    setThemeMode(mode);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeMode((prev) => {
      if (prev === 'system') return resolved === 'dark' ? 'light' : 'dark';
      return prev === 'light' ? 'dark' : 'light';
    });
  }, [resolved]);

  return (
    <ThemeContext.Provider value={{ theme: resolved, themeMode, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
