// Barrel — keep this as .ts (no React components) so Fast Refresh stays clean.
export type { Language } from './context';
export {
  STORAGE_KEY,
  makeT,
  translate,
  getLanguage,
  translateStatus,
  translateRole,
} from './translate';
export { I18nProvider, useI18n } from './I18nProvider';
export { ScopedI18nProvider } from './ScopedI18nProvider';
