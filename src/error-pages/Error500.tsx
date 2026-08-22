import React from 'react';
import { useI18n } from '../i18n';

export const Error500: React.FC = () => {
  const { t } = useI18n();
  return (
    <div className="flex flex-col items-center justify-center h-screen text-center">
      <h1 className="text-6xl font-bold text-slate-800">500</h1>
      <p className="text-lg text-slate-600 mt-2">{t('error.server_error')}</p>
      <p className="text-sm text-slate-500">{t('error.server_error_desc')}</p>
    </div>
  );
};