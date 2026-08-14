// src/providers/themeContext.ts
import { createContext, useContext } from 'react';
import type { ThemeMode } from './themeTypes';

export interface ThemeContextType {
  /** Resolved theme actually applied (never 'system'). */
  theme: 'light' | 'dark';
  /** User preference: 'light' | 'dark' | 'system'. */
  themeMode: ThemeMode;
  setTheme: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
};
