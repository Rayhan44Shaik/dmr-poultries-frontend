import React from 'react';
import { useI18n } from '../i18n';

export const Error403: React.FC = () => {
  const { t } = useI18n();
  return (
    <div className="flex flex-col items-center justify-center h-screen text-center">
      <h1 className="text-6xl font-bold text-slate-800">403</h1>
      <p className="text-lg text-slate-600 mt-2">{t('error.forbidden')}</p>
      <p className="text-sm text-slate-500">{t('error.forbidden_desc')}</p>
    </div>
  );
};