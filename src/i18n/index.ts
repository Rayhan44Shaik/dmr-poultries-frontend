// Re-export from the main i18n implementation
export {
  I18nProvider,
  useI18n,
  STORAGE_KEY,
  makeT,
  translate,
  getLanguage,
  translateStatus,
  type Language,
} from './index.tsx';
export { ScopedI18nProvider } from './ScopedI18nProvider';